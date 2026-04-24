import type { Context } from 'hono'
import { finalizeExchange, insertUserMessage, verifyChatForUser } from './chats'
import { getModelMeta, isChatModel, isVisionModel } from './models'
import { mapOpenRouterFailure, openRouterChatStream } from './openrouter'
import { geosoftAssistantFallbackContext } from './geosoft-overview'
import { retrieveRagContext } from './rag'
import type { Env } from './types'
import bundledChatSystemPrompt from './prompts/chat-system.md'
import { signImageToken } from './upload'

const DEFAULT_MAX_OUTPUT_TOKENS = 131_072
const ABSOLUTE_MAX_OUTPUT_TOKENS = 200_000
const DEFAULT_MAX_ASSISTANT_CHARS = 200_000
const ABSOLUTE_MAX_ASSISTANT_CHARS = 1_000_000
const DEFAULT_MAX_CHAT_IMAGES = 12
const ABSOLUTE_MAX_CHAT_IMAGES = 24
const DEFAULT_VISION_IMAGES_PER_CALL = 3
const ABSOLUTE_MAX_VISION_IMAGES_PER_CALL = 8
/** Max tokens per batched vision sub-request (short notes only). */
const VISION_BATCH_MAX_TOKENS = 4096
const BATCH_NOTES_ACCUM_MAX = 96_000

function maxChatOutputTokens(env: Env): number {
  const raw = env.MAX_CHAT_OUTPUT_TOKENS
  if (raw === undefined || raw === '') return DEFAULT_MAX_OUTPUT_TOKENS
  const n = Number.parseInt(String(raw).trim(), 10)
  if (!Number.isFinite(n) || n < 1) return DEFAULT_MAX_OUTPUT_TOKENS
  return Math.min(Math.floor(n), ABSOLUTE_MAX_OUTPUT_TOKENS)
}

type ChatMessage = { role: string; content: string | unknown[] }

function maxAssistantChars(env: Env): number {
  const raw = (env as unknown as { MAX_ASSISTANT_CHARS?: string }).MAX_ASSISTANT_CHARS
  if (raw === undefined || raw === '') return DEFAULT_MAX_ASSISTANT_CHARS
  const n = Number.parseInt(String(raw).trim(), 10)
  if (!Number.isFinite(n) || n < 1) return DEFAULT_MAX_ASSISTANT_CHARS
  return Math.min(Math.floor(n), ABSOLUTE_MAX_ASSISTANT_CHARS)
}

/** From app language switcher: ka | ru | en */
type UiLanguage = 'ka' | 'ru' | 'en'

const UI_LANG_LABEL: Record<UiLanguage, string> = {
  ka: 'Georgian (ქართული)',
  ru: 'Russian (русский)',
  en: 'English',
}

function parseUiLanguage(raw: unknown): UiLanguage | null {
  if (raw === 'ka' || raw === 'ru' || raw === 'en') return raw
  return null
}

function langLineRagWithSnippets(ui: UiLanguage | null): string {
  if (ui) {
    return `Write the entire answer in ${UI_LANG_LABEL[ui]}. The user chose this language in the app UI; use it for the response even if the user’s message is in another language, unless the user clearly asks for a different reply language.`
  }
  return `Write the entire answer in the same language as the user’s latest message (Georgian → Georgian, Russian → Russian, etc.); do not switch to English unless the user wrote in English.`
}

function langLineRagFallbackOnly(ui: UiLanguage | null): string {
  if (ui) {
    return `Write your entire answer in ${UI_LANG_LABEL[ui]}. The app UI language takes precedence for the response unless the user explicitly requests another output language.`
  }
  return `Write your entire answer in the same language as the user’s latest message (Georgian → Georgian only, Russian → Russian only, etc.).`
}

function systemOutputLanguageFromUi(ui: UiLanguage | null): string {
  if (ui) {
    return (
      `Output language: The application UI is set to ${UI_LANG_LABEL[ui]}. ` +
      `Write the full assistant reply in that language. ` +
      `If the user’s message is in a different language, still answer in ${UI_LANG_LABEL[ui]} unless the user explicitly asks for the reply in another language.`
    )
  }
  return (
    'Output language: Match the user’s latest message. Write the full reply in that language only (e.g. ქართული prompt → ქართული პასუხი მთლიანად). ' +
    'Do not answer in English when the user wrote Georgian, Russian, or another non-English language. English is allowed only if the user’s message is English or they explicitly request English.'
  )
}

function maxChatImages(env: Env): number {
  const raw = env.MAX_CHAT_IMAGES
  if (raw === undefined || raw === '') return DEFAULT_MAX_CHAT_IMAGES
  const n = Number.parseInt(String(raw).trim(), 10)
  if (!Number.isFinite(n) || n < 1) return DEFAULT_MAX_CHAT_IMAGES
  return Math.min(Math.floor(n), ABSOLUTE_MAX_CHAT_IMAGES)
}

function visionImagesPerUpstreamCall(env: Env): number {
  const raw = env.VISION_IMAGES_PER_UPSTREAM_CALL
  if (raw === undefined || raw === '') return DEFAULT_VISION_IMAGES_PER_CALL
  const n = Number.parseInt(String(raw).trim(), 10)
  if (!Number.isFinite(n) || n < 1) return DEFAULT_VISION_IMAGES_PER_CALL
  return Math.min(Math.floor(n), ABSOLUTE_MAX_VISION_IMAGES_PER_CALL)
}

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

async function signedImageUrl(env: Env, reqUrl: string, imageUrl: string): Promise<string | null> {
  let pathname: string
  try {
    pathname = imageUrl.startsWith('http') ? new URL(imageUrl).pathname : imageUrl
  } catch {
    return null
  }
  const m = pathname.match(/^\/api\/image\/(.+)$/)
  if (!m) return null
  const name = m[1]
  if (!name || name.includes('..') || name.includes('/')) return null
  const token = await signImageToken(env, name)
  const origin = new URL(reqUrl).origin
  return `${origin}/image-signed/${token}`
}

function buildUserContent(text: string, imageDataUrls: string[]): string | unknown[] {
  if (!imageDataUrls.length) return text
  const parts: unknown[] = [{ type: 'text', text }]
  for (const url of imageDataUrls) {
    parts.push({ type: 'image_url', image_url: { url } })
  }
  return parts
}

function withSynthesisInsteadOfImages(msgs: ChatMessage[], text: string): ChatMessage[] {
  const out: ChatMessage[] = [...msgs]
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i].role === 'user' && Array.isArray(out[i].content)) {
      out[i] = { role: 'user', content: text }
      return out
    }
  }
  return [...msgs, { role: 'user', content: text }]
}

function buildVisionSynthesisUserContent(
  userText: string,
  parts: string[],
  imageCount: number
): string {
  const q = userText.trim()
  const head = q
    ? `User request:\n${q}\n\n`
    : `The user sent ${imageCount} images without additional text. Infer their goal and answer from the notes below.\n\n`
  return (
    head +
    '---\n' +
    `Structured notes from ${imageCount} image(s), produced in ${parts.length} analysis step(s):\n\n` +
    parts.map((p, i) => `Step ${i + 1}:\n${p}`).join('\n\n')
  )
}

async function jsonResponseForOpenRouterFailure(
  c: Context<{ Bindings: Env }>,
  upstream: Response
): Promise<Response | null> {
  if (upstream.ok) return null
  const detail = await upstream.text().catch(() => '')
  const s = upstream.status
  const mapped = mapOpenRouterFailure(s, detail)
  const payload = { error: mapped.error, errorKey: mapped.errorKey }
  if (s === 401) return c.json(payload, 401)
  if (s === 403) return c.json(payload, 403)
  if (s === 402) return c.json(payload, 402)
  if (s === 429) return c.json(payload, 429)
  if (s === 408) return c.json(payload, 408)
  if (s === 400) return c.json(payload, 400)
  if (s === 502) return c.json(payload, 502)
  if (s === 503) return c.json(payload, 503)
  return c.json(payload, 502)
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

async function accumulateWorkersAiText(
  source: ReadableStream<Uint8Array>,
  maxChars: number
): Promise<string> {
  const dec = new TextDecoder()
  let lineBuf = ''
  const prevResponse = { value: '' }
  let full = ''
  let truncated = false

  const handleLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) return
    const payload = trimmed.slice(5).trim()
    if (payload === '[DONE]') return
    try {
      const json = JSON.parse(payload) as Record<string, unknown>
      const piece = extractStreamDelta(json, prevResponse)
      if (!piece) return
      if (full.length >= maxChars) {
        truncated = true
        return
      }
      const room = maxChars - full.length
      if (piece.length <= room) {
        full += piece
      } else {
        full += piece.slice(0, room)
        truncated = true
      }
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
      if (truncated) {
        // Stop pulling more data once we've hit a safe cap.
        await reader.cancel().catch(() => {})
        break
      }
      if (done) {
        appendAndDrain(dec.decode())
        if (lineBuf.trim()) handleLine(lineBuf)
        break
      }
    }
  } finally {
    reader.releaseLock()
  }
  if (truncated) {
    full += '\n\n[Truncated due to server-side safety limit]'
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
    /** ka | ru | en — app language switcher; drives assistant reply language */
    uiLanguage?: string
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
  const uiLang = parseUiLanguage(body.uiLanguage)

  const vision = isVisionModel(model)
  const rawUrls: string[] = []
  if (Array.isArray(body.imageUrls) && body.imageUrls.length) {
    for (const u of body.imageUrls) {
      if (typeof u === 'string' && u.trim()) rawUrls.push(u.trim())
    }
  } else if (body.imageUrl && typeof body.imageUrl === 'string' && body.imageUrl.trim()) {
    rawUrls.push(body.imageUrl.trim())
  }
  const maxImgs = maxChatImages(c.env)
  if (rawUrls.length > maxImgs) {
    return c.json({ error: `Too many images (max ${maxImgs})` }, 400)
  }
  const imageDataUrls: string[] = []
  if (rawUrls.length) {
    if (!vision) {
      return c.json({ error: 'Model does not support images' }, 400)
    }
    for (const url of rawUrls) {
      const signed = await signedImageUrl(c.env, c.req.url, url)
      if (!signed) {
        return c.json({ error: 'One or more images were not found' }, 404)
      }
      imageDataUrls.push(signed)
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
          'If something is not in the passages, say so honestly. ' +
          langLineRagWithSnippets(uiLang) +
          '\n\n' +
          ragBlock,
      })
    } else {
      outMessages.push({
        role: 'system',
        content:
          'You are a warm, professional assistant for GeoSoft (geosoft.ge), the Georgian cloud & workplace technology partner.\n' +
          'The live site index did not return matching snippets for this question, but you must still answer helpfully using ONLY the approved overview below. ' +
          'Do not invent prices, contract terms, or SKU-level catalog details not stated there. ' +
          langLineRagFallbackOnly(uiLang) +
          ' Be concise, friendly, and invite them to visit geosoft.ge or contact GeoSoft for specifics.\n' +
          'Do not open with a harsh refusal — acknowledge the question and give useful orientation.\n\n' +
          geosoftAssistantFallbackContext(),
      })
    }
  }

  outMessages.push({
    role: 'system',
    content: systemOutputLanguageFromUi(uiLang),
  })

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
    const perCall = visionImagesPerUpstreamCall(c.env)
    let messagesForUpstream: ChatMessage[] = outMessages

    if (imageDataUrls.length > perCall) {
      const total = imageDataUrls.length
      const nBatches = Math.ceil(total / perCall)
      const notes: string[] = []
      const batchOutCap = Math.min(VISION_BATCH_MAX_TOKENS, maxChatOutputTokens(c.env))

      for (let b = 0; b < nBatches; b++) {
        const from = b * perCall
        const slice = imageDataUrls.slice(from, from + perCall)
        const fromN = from + 1
        const toN = from + slice.length
        const safeQ = (userTextForDb || '(no text; images only)').replace(/"/g, "'")
        const descLangHint = uiLang
          ? `Write these descriptions in ${UI_LANG_LABEL[uiLang]} (same as the app UI language).`
          : 'If the user message is in a non-English language, write these descriptions in that language when possible.'
        const instr =
          `You are processing part of a ${total}-image request. ` +
          `This is batch ${b + 1} of ${nBatches} (images ${fromN}–${toN} of ${total}). ` +
          `User message (for context; must not be used to invent image contents): "${safeQ}". ` +
          `For each image in order, give a short factual description (2–4 sentences) of what is visible. ` +
          `Begin each block with a line "Image N:" where N is the global index (${fromN}…${toN}). ` +
          descLangHint

        const batchMessages: ChatMessage[] = [
          {
            role: 'system',
            content:
              'You are a vision assistant. You only see part of a larger set of user images. Describe what is actually visible. If something is illegible, say so briefly. Do not refuse the task — answer from pixels.',
          },
          { role: 'user', content: buildUserContent(instr, slice) },
        ]

        const batchUp = await openRouterChatStream(c.env, apiKey, {
          model,
          messages: batchMessages,
          stream: true,
          max_tokens: batchOutCap,
        })
        const batchErr = await jsonResponseForOpenRouterFailure(c, batchUp)
        if (batchErr) return batchErr
        if (!batchUp.body) {
          return c.json(
            { error: 'OpenRouter returned an empty response body', errorKey: 'openrouter_generic' },
            502
          )
        }
        const note = await accumulateWorkersAiText(batchUp.body, BATCH_NOTES_ACCUM_MAX)
        notes.push(note)
      }

      const synthesis = buildVisionSynthesisUserContent(userTextForDb, notes, total)
      messagesForUpstream = withSynthesisInsteadOfImages(outMessages, synthesis)
    }

    const upstream = await openRouterChatStream(c.env, apiKey, {
      model,
      messages: messagesForUpstream,
      stream: true,
      max_tokens: maxChatOutputTokens(c.env),
    })
    const preStreamErr = await jsonResponseForOpenRouterFailure(c, upstream)
    if (preStreamErr) return preStreamErr
    const raw = upstream.body
    if (!raw) {
      return c.json({ error: 'OpenRouter returned an empty response body' }, 502)
    }
    const [toClient, toRecorder] = raw.tee()
    const out = transformAiSseToTokenSse(toClient)

    const userMsgId = crypto.randomUUID()
    const userNow = Date.now()
    const userImageUrlsJson = rawUrls.length > 0 ? JSON.stringify(rawUrls) : null
    await insertUserMessage(c.env.DB, chatId, userMsgId, userTextForDb, userNow, userImageUrlsJson)

    const meta = getModelMeta(model)
    const assistantModelName = meta?.name ?? meta?.slug ?? model
    const assistantMsgId = crypto.randomUUID()

    const cap = maxAssistantChars(c.env)
    const persist = accumulateWorkersAiText(toRecorder, cap).then((assistantText) =>
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
