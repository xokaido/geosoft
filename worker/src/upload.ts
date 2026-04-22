import type { Context } from 'hono'
import type { Env } from './types'

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_BYTES = 10 * 1024 * 1024

const extByMime: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

function randomId(): string {
  const a = new Uint8Array(16)
  crypto.getRandomValues(a)
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function handleUpload(c: Context<{ Bindings: Env }>): Promise<Response> {
  try {
    const body = await c.req.parseBody({ all: true })
    const file = body.file
    if (!file || typeof file === 'string') {
      return c.json({ error: 'Missing file field' }, 400)
    }
    const f = file as File
    if (f.size > MAX_BYTES) {
      return c.json({ error: 'File too large' }, 413)
    }
    const type = f.type || 'application/octet-stream'
    if (!ALLOWED.has(type)) {
      return c.json({ error: 'Unsupported file type' }, 415)
    }
    const ext = extByMime[type] ?? 'bin'
    const name = `${randomId()}.${ext}`
    const key = `uploads/${name}`
    await c.env.R2.put(key, f.stream(), {
      httpMetadata: { contentType: type },
    })
    return c.json({ url: `/api/image/${name}` })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Upload failed'
    return c.json({ error: msg }, 500)
  }
}

export async function handleImage(c: Context<{ Bindings: Env }>): Promise<Response> {
  const name = c.req.param('key')
  if (!name || name.includes('..') || name.includes('/')) {
    return c.json({ error: 'Not found' }, 404)
  }
  const key = `uploads/${name}`
  const obj = await c.env.R2.get(key)
  if (!obj) {
    return c.json({ error: 'Not found' }, 404)
  }
  const headers = new Headers()
  const ct = obj.httpMetadata?.contentType ?? 'application/octet-stream'
  headers.set('Content-Type', ct)
  if (obj.httpEtag) headers.set('ETag', obj.httpEtag)
  return new Response(obj.body, { headers })
}
