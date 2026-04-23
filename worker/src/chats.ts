import type { Context } from 'hono'
import { isChatModel } from './models'
import type { Env } from './types'

type ChatListItem = {
  id: string
  modelId: string
  title: string
  createdAt: number
  updatedAt: number
}

type ChatMessageApiRow = {
  id: string
  role: string
  content: string
  modelName: string | null
  imageUrlsJson: string | null
  createdAt: number
}

function parseStoredImageUrls(raw: string | null): string[] | undefined {
  if (!raw || !String(raw).trim()) return undefined
  try {
    const v = JSON.parse(String(raw)) as unknown
    if (!Array.isArray(v)) return undefined
    const urls = v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    return urls.length ? urls : undefined
  } catch {
    return undefined
  }
}

function truncateTitle(text: string, max = 72): string {
  const t = text.trim().replace(/\s+/g, ' ')
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

export async function verifyChatForUser(
  db: D1Database,
  userId: string,
  chatId: string,
  modelId: string
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 AS ok FROM chats WHERE id = ? AND user_id = ? AND model_id = ? LIMIT 1`
    )
    .bind(chatId, userId, modelId)
    .first<{ ok: number }>()
  return !!row
}

export async function handleListChats(c: Context<{ Bindings: Env }>): Promise<Response> {
  const userId = c.get('session').username
  const modelId = c.req.query('modelId')
  if (!modelId) {
    return c.json({ error: 'modelId query parameter is required' }, 400)
  }
  if (!isChatModel(modelId)) {
    return c.json({ error: 'Invalid or unsupported model for chat' }, 400)
  }
  const { results } = await c.env.DB.prepare(
    `SELECT id, model_id AS modelId, title, created_at AS createdAt, updated_at AS updatedAt
     FROM chats WHERE user_id = ? AND model_id = ?
     ORDER BY updated_at DESC LIMIT 100`
  )
    .bind(userId, modelId)
    .all<ChatListItem>()
  return c.json({ chats: results ?? [] })
}

export async function handleCreateChat(c: Context<{ Bindings: Env }>): Promise<Response> {
  const userId = c.get('session').username
  let body: { modelId?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
  const modelId = body.modelId
  if (!modelId || !isChatModel(modelId)) {
    return c.json({ error: 'modelId required and must be a chat model' }, 400)
  }
  const id = crypto.randomUUID()
  const now = Date.now()
  await c.env.DB.prepare(
    `INSERT INTO chats (id, user_id, model_id, title, created_at, updated_at) VALUES (?, ?, ?, '', ?, ?)`
  )
    .bind(id, userId, modelId, now, now)
    .run()
  return c.json({
    id,
    modelId,
    title: '',
    createdAt: now,
    updatedAt: now,
  })
}

export async function handleGetChatMessages(c: Context<{ Bindings: Env }>): Promise<Response> {
  const userId = c.get('session').username
  const chatId = c.req.param('id')
  if (!chatId) {
    return c.json({ error: 'Missing chat id' }, 400)
  }
  const row = await c.env.DB.prepare(
    `SELECT id FROM chats WHERE id = ? AND user_id = ? LIMIT 1`
  )
    .bind(chatId, userId)
    .first<{ id: string }>()
  if (!row) {
    return c.json({ error: 'Chat not found' }, 404)
  }
  const { results } = await c.env.DB.prepare(
    `SELECT id, role, content, model_name AS modelName, image_urls AS imageUrlsJson, created_at AS createdAt
     FROM chat_messages WHERE chat_id = ? ORDER BY created_at ASC, id ASC`
  )
    .bind(chatId)
    .all<ChatMessageApiRow>()
  const rows = results ?? []
  return c.json({
    messages: rows.map((r) => {
      const imageUrls = parseStoredImageUrls(r.imageUrlsJson)
      return {
        id: r.id,
        role: r.role,
        content: r.content,
        modelName: r.modelName,
        ...(imageUrls ? { imageUrls } : {}),
        createdAt: r.createdAt,
      }
    }),
  })
}

export async function handleUpdateChat(c: Context<{ Bindings: Env }>): Promise<Response> {
  const userId = c.get('session').username
  const chatId = c.req.param('id')
  if (!chatId) {
    return c.json({ error: 'Missing chat id' }, 400)
  }
  let body: { title?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
  const raw = body.title
  const title = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ').slice(0, 200) : ''
  const now = Date.now()
  const res = await c.env.DB.prepare(
    `UPDATE chats SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?`
  )
    .bind(title, now, chatId, userId)
    .run()
  if (!res.success || (res.meta?.changes ?? 0) < 1) {
    return c.json({ error: 'Chat not found' }, 404)
  }
  return c.json({ ok: true, title })
}

export async function handleDeleteChat(c: Context<{ Bindings: Env }>): Promise<Response> {
  const userId = c.get('session').username
  const chatId = c.req.param('id')
  if (!chatId) {
    return c.json({ error: 'Missing chat id' }, 400)
  }
  const res = await c.env.DB.prepare(`DELETE FROM chats WHERE id = ? AND user_id = ?`)
    .bind(chatId, userId)
    .run()
  if (!res.success || (res.meta?.changes ?? 0) < 1) {
    return c.json({ error: 'Chat not found' }, 404)
  }
  return c.json({ ok: true })
}

export async function insertUserMessage(
  db: D1Database,
  chatId: string,
  id: string,
  content: string,
  createdAt: number,
  imageUrlsJson: string | null = null
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO chat_messages (id, chat_id, role, content, model_name, image_urls, created_at) VALUES (?, ?, 'user', ?, NULL, ?, ?)`
    )
    .bind(id, chatId, content, imageUrlsJson, createdAt)
    .run()
}

export async function finalizeExchange(
  db: D1Database,
  params: {
    chatId: string
    assistantMessageId: string
    assistantContent: string
    modelName: string
    userPreviewForTitle: string
    now: number
  }
): Promise<void> {
  const title = truncateTitle(params.userPreviewForTitle)
  await db.batch([
    db
      .prepare(
        `INSERT INTO chat_messages (id, chat_id, role, content, model_name, image_urls, created_at) VALUES (?, ?, 'assistant', ?, ?, NULL, ?)`
      )
      .bind(
        params.assistantMessageId,
        params.chatId,
        params.assistantContent,
        params.modelName,
        params.now
      ),
    db
      .prepare(
        `UPDATE chats SET updated_at = ?, title = CASE WHEN trim(title) = '' THEN ? ELSE title END WHERE id = ?`
      )
      .bind(params.now, title, params.chatId),
  ])
}
