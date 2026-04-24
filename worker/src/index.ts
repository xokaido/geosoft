import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  clearSessionCookie,
  requireAuth,
  setSessionCookie,
  signSession,
} from './auth'
import { resolveCorsOrigin } from './cors-origins'
import { normalizeLoginUsername, verifyAppUserCredentials } from './user-auth'
import { handleChat } from './chat'
import {
  handleCreateChat,
  handleDeleteChat,
  handleGetChatMessages,
  handleListChats,
  handleUpdateChat,
} from './chats'
import { MODELS } from './models'
import { ingestGeosoftToVectorize } from './rag'
import type { Env } from './types'
import { handleImage, handleSignedImage, handleUpload } from './upload'

const app = new Hono<{ Bindings: Env }>()

app.use(
  '*',
  cors({
    origin: (origin, c) => resolveCorsOrigin(c.env, origin),
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
)

app.post('/api/login', async (c) => {
  let body: { username?: string; password?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
  const username = normalizeLoginUsername(body.username)
  const password = typeof body.password === 'string' ? body.password : ''
  if (!username || password.length === 0) {
    return c.json({ error: 'Invalid username or password' }, 401)
  }
  let ok = await verifyAppUserCredentials(c.env.DB, username, password)
  if (!ok) {
    const lu = c.env.AUTH_USERNAME
    const lp = c.env.AUTH_PASSWORD
    if (
      typeof lu === 'string' &&
      lu.length > 0 &&
      typeof lp === 'string' &&
      lp.length > 0 &&
      lu === username &&
      lp === password
    ) {
      ok = true
    }
  }
  if (!ok) {
    return c.json({ error: 'Invalid username or password' }, 401)
  }
  const token = await signSession(c.env, username)
  setSessionCookie(c, token)
  return c.json({ ok: true })
})

app.post('/api/logout', async (c) => {
  clearSessionCookie(c)
  return c.json({ ok: true })
})

// Public, short-lived signed URLs for model providers (avoid buffering image bytes in the worker).
app.get('/image-signed/:token', (c) => handleSignedImage(c))

const api = new Hono<{ Bindings: Env }>()
api.use('*', requireAuth)

api.get('/models', (c) => c.json(MODELS))
api.get('/chats', (c) => handleListChats(c))
api.post('/chats', (c) => handleCreateChat(c))
api.get('/chats/:id/messages', (c) => handleGetChatMessages(c))
api.patch('/chats/:id', (c) => handleUpdateChat(c))
api.delete('/chats/:id', (c) => handleDeleteChat(c))
api.post('/upload', (c) => handleUpload(c))
api.get('/image/:key', (c) => handleImage(c))
api.post('/chat', (c) => handleChat(c))
api.post('/rag/ingest', async (c) => {
  try {
    const result = await ingestGeosoftToVectorize(c.env)
    return c.json({ chunks: result.vectors })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Ingest failed'
    return c.json({ error: msg }, 500)
  }
})

app.route('/api', api)

app.all('*', async (c) => {
  if (c.req.path.startsWith('/api')) {
    return c.json({ error: 'Not found' }, 404)
  }
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    return c.json({ error: 'Method not allowed' }, 405)
  }
  const url = new URL(c.req.url)
  let pathname = url.pathname
  if (pathname === '/') pathname = '/index.html'
  const assetReq = new Request(`https://assets${pathname}`, c.req.raw)
  let res = await c.env.ASSETS.fetch(assetReq)
  if (res.status === 404 && !pathname.includes('.')) {
    res = await c.env.ASSETS.fetch(new Request('https://assets/index.html', c.req.raw))
  }
  return res
})

export default app
