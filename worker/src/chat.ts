import type { Context } from 'hono'
import { isAllowedModel, isVisionModel } from './models'
import { retrieveRagContext } from './rag'
import type { Env } from './types'

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

function buildUserContent(text: string, imageDataUrl: string | null): string | unknown[] {
  if (!imageDataUrl) return text
  return [
    { type: 'text', text },
    { type: 'image_url', image_url: { url: imageDataUrl } },
  ]
}

function emitSseBlock(enc: TextEncoder, controller: ReadableStreamDefaultController<Uint8Array>, block: string) {
  for (const line of block.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) continue
    const payload = trimmed.slice(5).trim()
    if (payload === '[DONE]') {
      controller.enqueue(enc.encode('data: [DONE]\n\n'))
      continue
    }
    try {
      const json = JSON.parse(payload) as { response?: string }
      const piece = json.response ?? ''
      if (piece) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(piece)}\n\n`))
      }
    } catch {
      // ignore non-JSON noise
    }
  }
}

function transformAiSseToTokenSse(source: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const dec = new TextDecoder()
  const enc = new TextEncoder()
  let buffer = ''
  return new ReadableStream({
    async start(controller) {
      const reader = source.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += dec.decode(value, { stream: true })
          const parts = buffer.split('\n\n')
          buffer = parts.pop() ?? ''
          for (const block of parts) {
            emitSseBlock(enc, controller, block)
          }
        }
        buffer += dec.decode()
        if (buffer.trim()) {
          for (const block of buffer.split('\n\n')) {
            if (block.trim()) emitSseBlock(enc, controller, block)
          }
        }
        controller.enqueue(enc.encode('data: [DONE]\n\n'))
      } finally {
        reader.releaseLock()
        controller.close()
      }
    },
  })
}

export async function handleChat(c: Context<{ Bindings: Env }>): Promise<Response> {
  let body: {
    model?: string
    messages?: ChatMessage[]
    imageUrl?: string
    useRag?: boolean
  }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
  const model = body.model
  const messages = body.messages
  if (!model || !isAllowedModel(model)) {
    return c.json({ error: 'Unsupported model' }, 400)
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

  const vision = isVisionModel(model)
  let imageDataUrl: string | null = null
  if (body.imageUrl) {
    if (!vision) {
      return c.json({ error: 'Model does not support images' }, 400)
    }
    imageDataUrl = (await loadImageFromR2(c.env, body.imageUrl))?.dataUrl ?? null
    if (!imageDataUrl) {
      return c.json({ error: 'Image not found' }, 404)
    }
  }

  const outMessages: ChatMessage[] = []
  if (ragBlock) {
    outMessages.push({
      role: 'system',
      content:
        'You are a helpful assistant. Use the following retrieved context from geosoft.ge when relevant. If context is irrelevant, ignore it.\n\n' +
        ragBlock,
    })
  }
  for (const m of messages) {
    if (m.role === 'user' && imageDataUrl && m === messages[messages.length - 1]) {
      const text = typeof m.content === 'string' ? m.content : lastUserQuery([m])
      outMessages.push({ role: 'user', content: buildUserContent(text, imageDataUrl) })
    } else {
      outMessages.push(m)
    }
  }

  try {
    const stream = await c.env.AI.run(model, {
      messages: outMessages,
      max_tokens: 1024,
      stream: true,
    })
    if (!(stream instanceof ReadableStream)) {
      return c.json({ error: 'Streaming not available for this model' }, 500)
    }
    const out = transformAiSseToTokenSse(stream as ReadableStream<Uint8Array>)
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
