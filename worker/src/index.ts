import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  clearSessionCookie,
  requireAuth,
  setSessionCookie,
  signSession,
} from './auth'
import { handleChat } from './chat'
import {
  handleCreateChat,
  handleDeleteChat,
  handleGetChatMessages,
  handleListChats,
} from './chats'
import { MODELS } from './models'
import { ingestGeosoftToVectorize } from './rag'
import type { Env } from './types'
import { handleImage, handleUpload } from './upload'

const app = new Hono<{ Bindings: Env }>()

app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
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
  if (body.username !== c.env.AUTH_USERNAME || body.password !== c.env.AUTH_PASSWORD) {
    return c.json({ error: 'Invalid username or password' }, 401)
  }
  const token = await signSession(c.env, body.username)
  setSessionCookie(c, token)
  return c.json({ ok: true })
})

app.post('/api/logout', async (c) => {
  clearSessionCookie(c)
  return c.json({ ok: true })
})

const api = new Hono<{ Bindings: Env }>()
api.use('*', requireAuth)

api.get('/models', (c) => c.json(MODELS))
api.get('/chats', (c) => handleListChats(c))
api.post('/chats', (c) => handleCreateChat(c))
api.get('/chats/:id/messages', (c) => handleGetChatMessages(c))
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
