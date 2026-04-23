import type { Context } from 'hono'
import { finalizeExchange, insertUserMessage, verifyChatForUser } from './chats'
import { getModelMeta, isChatModel, isVisionModel } from './models'
import { openRouterChatStream } from './openrouter'
import { geosoftAssistantFallbackContext } from './geosoft-overview'
import { retrieveRagContext } from './rag'
import type { Env } from './types'
import bundledChatSystemPrompt from './prompts/chat-system.md'

const DEFAULT_MAX_OUTPUT_TOKENS = 131_072
const ABSOLUTE_MAX_OUTPUT_TOKENS = 200_000

function maxChatOutputTokens(env: Env): number {
  const raw = env.MAX_CHAT_OUTPUT_TOKENS
  if (raw === undefined || raw === '') return DEFAULT_MAX_OUTPUT_TOKENS
  const n = Number.parseInt(String(raw).trim(), 10)
  if (!Number.isFinite(n) || n < 1) return DEFAULT_MAX_OUTPUT_TOKENS
  return Math.min(Math.floor(n), ABSOLUTE_MAX_OUTPUT_TOKENS)
}

type ChatMessage = { role: string; content: string | unknown[] }

function lastUserQuery(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role !== 'user') continue
    if (typeof m.content === 'string') return m.content
    if (Array.isArray(m.content)) {
      const texts = m.content
        .filter((b) => b && typeof b === 'object' && (b as { type?: string }).type === 'text')
        .map((b) => String((b as { text?: string }).text ?? ''))
      return texts.join('\n')
    }
  }
  return ''
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

async function loadImageFromR2(
  env: Env,
  imageUrl: string | undefined
): Promise<{ dataUrl: string } | null> {
  if (!imageUrl) return null
  let pathname: string
  try {
    pathname = imageUrl.startsWith('http') ? new URL(imageUrl).pathname : imageUrl
  } catch {
    return null
  }
  const m = pathname.match(/^\/api\/image\/(.+)$/)
  if (!m) return null
  const name = m[1]
  if (name.includes('..') || name.includes('/')) return null
  const obj = await env.R2.get(`uploads/${name}`)
  if (!obj?.body) return null
  const buf = new Uint8Array(await obj.arrayBuffer())
  const mime = obj.httpMetadata?.contentType ?? 'image/jpeg'
  const b64 = bytesToBase64(buf)
  return { dataUrl: `data:${mime};base64,${b64}` }
}

function buildUserContent(text: string, imageDataUrls: string[]): string | unknown[] {
  if (!imageDataUrls.length) return text
  const parts: unknown[] = [{ type: 'text', text }]
  for (const url of imageDataUrls) {
    parts.push({ type: 'image_url', image_url: { url } })
  }
  return parts
}

/** Workers AI SSE is line-oriented (`data: {...}\\n`). `response` is often cumulative, not a per-chunk delta. */
function extractStreamDelta(json: Record<string, unknown>, prevFull: { value: string }): string | null {
  const choices = json.choices
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === 'object') {
    const delta = (choices[0] as { delta?: { content?: string; reasoning?: string } }).delta
    if (delta && typeof delta === 'object') {
      const bits: string[] = []
      if (typeof delta.reasoning === 'string' && delta.reasoning.length) bits.push(delta.reasoning)
      if (typeof delta.content === 'string' && delta.content.length) bits.push(delta.content)
      if (bits.length) return bits.join('')
    }
  }
  const token = json.token
  if (typeof token === 'string' && token.length) return token

  const r = json.response
  if (r === null || r === undefined) return null
  if (typeof r !== 'string') return null

  const prev = prevFull.value
  if (r === prev) return null
  if (r.startsWith(prev)) {
    const d = r.slice(prev.length)
    prevFull.value = r
    return d.length ? d : null
  }
  prevFull.value = r
  return r
}

function transformAiSseToTokenSse(source: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const dec = new TextDecoder()
  const enc = new TextEncoder()
  let lineBuf = ''
  const prevResponse = { value: '' }
  let clientDone = false

  const handleLine = (line: string, controller: ReadableStreamDefaultController<Uint8Array>) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) return
    const payload = trimmed.slice(5).trim()
    if (payload === '[DONE]') {
      clientDone = true
      controller.enqueue(enc.encode('data: [DONE]\n\n'))
      return
    }
    try {
      const json = JSON.parse(payload) as Record<string, unknown>
      const piece = extractStreamDelta(json, prevResponse)
      if (piece) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(piece)}\n\n`))
      }
    } catch {
      // ignore non-JSON / partial lines
    }
  }

  const appendAndDrain = (chunk: string, controller: ReadableStreamDefaultController<Uint8Array>) => {
    lineBuf += chunk
    for (;;) {
      const i = lineBuf.indexOf('\n')
      if (i < 0) break
      let row = lineBuf.slice(0, i)
      lineBuf = lineBuf.slice(i + 1)
      if (row.endsWith('\r')) row = row.slice(0, -1)
      handleLine(row, controller)
    }
  }

  return new ReadableStream({
    async start(controller) {
      const reader = source.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (value) appendAndDrain(dec.decode(value, { stream: true }), controller)
          if (done) {
            appendAndDrain(dec.decode(), controller)
            if (lineBuf.trim()) handleLine(lineBuf, controller)
            break
          }
        }
        if (!clientDone) {
          controller.enqueue(enc.encode('data: [DONE]\n\n'))
        }
      } finally {
        reader.releaseLock()
        controller.close()
      }
    },
  })
}

async function accumulateWorkersAiText(source: ReadableStream<Uint8Array>): Promise<string> {
  const dec = new TextDecoder()
  let lineBuf = ''
  const prevResponse = { value: '' }
  let full = ''

  const handleLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) return
    const payload = trimmed.slice(5).trim()
    if (payload === '[DONE]') return
    try {
      const json = JSON.parse(payload) as Record<string, unknown>
      const piece = extractStreamDelta(json, prevResponse)
      if (piece) full += piece
    } catch {
      // ignore
    }
  }

  const appendAndDrain = (chunk: string) => {
    lineBuf += chunk
    for (;;) {
      const i = lineBuf.indexOf('\n')
      if (i < 0) break
      let row = lineBuf.slice(0, i)
      lineBuf = lineBuf.slice(i + 1)
      if (row.endsWith('\r')) row = row.slice(0, -1)
      handleLine(row)
    }
  }

  const reader = source.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (value) appendAndDrain(dec.decode(value, { stream: true }))
      if (done) {
        appendAndDrain(dec.decode())
        if (lineBuf.trim()) handleLine(lineBuf)
        break
      }
    }
  } finally {
    reader.releaseLock()
  }
  return full
}

export async function handleChat(c: Context<{ Bindings: Env }>): Promise<Response> {
  let body: {
    model?: string
    messages?: ChatMessage[]
    imageUrl?: string
    imageUrls?: string[]
    useRag?: boolean
    chatId?: string
  }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
  const model = body.model
  const messages = body.messages
  const chatId = body.chatId
  if (!model || !isChatModel(model)) {
    return c.json({ error: 'Unsupported model for chat' }, 400)
  }
  if (!chatId || typeof chatId !== 'string') {
    return c.json({ error: 'chatId is required' }, 400)
  }
  const userId = c.get('session').username
  const okChat = await verifyChatForUser(c.env.DB, userId, chatId, model)
  if (!okChat) {
    return c.json({ error: 'Chat not found or model does not match this session' }, 404)
  }
  if (!Array.isArray(messages) || !messages.length) {
    return c.json({ error: 'messages required' }, 400)
  }

  let ragBlock = ''
  if (body.useRag) {
    try {
      const q = lastUserQuery(messages)
      if (q) {
        ragBlock = await retrieveRagContext(c.env, q)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'RAG failed'
      return c.json({ error: msg }, 500)
    }
  }

  const ragOn = !!body.useRag
  const hasRagContext = ragBlock.trim().length > 0

  const vision = isVisionModel(model)
  const rawUrls: string[] = []
  if (Array.isArray(body.imageUrls) && body.imageUrls.length) {
    for (const u of body.imageUrls) {
      if (typeof u === 'string' && u.trim()) rawUrls.push(u.trim())
    }
  } else if (body.imageUrl && typeof body.imageUrl === 'string' && body.imageUrl.trim()) {
    rawUrls.push(body.imageUrl.trim())
  }
  if (rawUrls.length > 12) {
    return c.json({ error: 'Too many images (max 12)' }, 400)
  }
  const imageDataUrls: string[] = []
  if (rawUrls.length) {
    if (!vision) {
      return c.json({ error: 'Model does not support images' }, 400)
    }
    for (const url of rawUrls) {
      const dataUrl = (await loadImageFromR2(c.env, url))?.dataUrl ?? null
      if (!dataUrl) {
        return c.json({ error: 'One or more images were not found' }, 404)
      }
      imageDataUrls.push(dataUrl)
    }
  }

  const outMessages: ChatMessage[] = []
  const hiddenSystem = String(bundledChatSystemPrompt).trim()
  if (hiddenSystem) {
    outMessages.push({ role: 'system', content: hiddenSystem })
  }
  if (ragOn) {
    if (hasRagContext) {
      outMessages.push({
        role: 'system',
        content:
          'You are a helpful, friendly assistant for GeoSoft (geosoft.ge), the Georgian cloud & workplace technology partner. The user enabled the geosoft.ge knowledge base.\n' +
          'Answer using the retrieved passages below for factual claims about the company, products, and site content. ' +
          'When you use a fact from a passage, mention its source number (e.g. Source 1). ' +
          'If something is not in the passages, say so honestly; prefer the same language as the user when natural.\n\n' +
          ragBlock,
      })
    } else {
      outMessages.push({
        role: 'system',
        content:
          'You are a warm, professional assistant for GeoSoft (geosoft.ge), the Georgian cloud & workplace technology partner.\n' +
          'The live site index did not return matching snippets for this question, but you must still answer helpfully using ONLY the approved overview below. ' +
          'Do not invent prices, contract terms, or SKU-level catalog details not stated there. ' +
          'Answer in the same language as the user (e.g. Georgian for Georgian). Be concise, friendly, and invite them to visit geosoft.ge or contact GeoSoft for specifics.\n' +
          'Do not open with a harsh refusal — acknowledge the question and give useful orientation.\n\n' +
          geosoftAssistantFallbackContext(),
      })
    }
  }
  for (const m of messages) {
    if (m.role === 'user' && imageDataUrls.length && m === messages[messages.length - 1]) {
      const text = typeof m.content === 'string' ? m.content : lastUserQuery([m])
      outMessages.push({ role: 'user', content: buildUserContent(text, imageDataUrls) })
    } else {
      outMessages.push(m)
    }
  }

  const last = messages[messages.length - 1]
  if (!last || last.role !== 'user') {
    return c.json({ error: 'Last message must be from the user' }, 400)
  }
  const userTextForDb =
    typeof last.content === 'string' ? last.content : lastUserQuery([last])

  const apiKey = c.env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) {
    return c.json(
      { error: 'OpenRouter is not configured. Set OPENROUTER_API_KEY (wrangler secret put OPENROUTER_API_KEY).' },
      503
    )
  }

  try {
    const upstream = await openRouterChatStream(c.env, apiKey, {
      model,
      messages: outMessages,
      stream: true,
      max_tokens: maxChatOutputTokens(c.env),
    })
    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '')
      const msg = `OpenRouter error (${upstream.status}): ${detail.slice(0, 1500)}`
      const s = upstream.status
      if (s === 401) return c.json({ error: msg }, 401)
      if (s === 403) return c.json({ error: msg }, 403)
      if (s === 429) return c.json({ error: msg }, 429)
      if (s === 400) return c.json({ error: msg }, 400)
      return c.json({ error: msg }, 502)
    }
    const raw = upstream.body
    if (!raw) {
      return c.json({ error: 'OpenRouter returned an empty response body' }, 502)
    }
    const [toClient, toRecorder] = raw.tee()
    const out = transformAiSseToTokenSse(toClient)

    const userMsgId = crypto.randomUUID()
    const userNow = Date.now()
    await insertUserMessage(c.env.DB, chatId, userMsgId, userTextForDb, userNow)

    const meta = getModelMeta(model)
    const assistantModelName = meta?.name ?? meta?.slug ?? model
    const assistantMsgId = crypto.randomUUID()

    const persist = accumulateWorkersAiText(toRecorder).then((assistantText) =>
      finalizeExchange(c.env.DB, {
        chatId,
        assistantMessageId: assistantMsgId,
        assistantContent: assistantText,
        modelName: assistantModelName,
        userPreviewForTitle: userTextForDb,
        now: Date.now(),
      })
    )

    const ctx = c.executionCtx
    if (ctx?.waitUntil) {
      ctx.waitUntil(persist.catch(() => {}))
    } else {
      void persist.catch(() => {})
    }

    return new Response(out, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Inference failed'
    return c.json({ error: msg }, 500)
  }
}
