import type { Env } from './types'

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions'

export function openRouterRequestHeaders(env: Env, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }
  const referer = env.OPENROUTER_HTTP_REFERER?.trim()
  if (referer) {
    headers['HTTP-Referer'] = referer
  }
  headers['X-OpenRouter-Title'] = env.OPENROUTER_APP_TITLE?.trim() || 'GeoSoft AI Chat'
  return headers
}

/** POST chat completions with streaming; returns upstream `Response` (body is SSE). */
export async function openRouterChatStream(
  env: Env,
  apiKey: string,
  body: Record<string, unknown>
): Promise<Response> {
  return fetch(OPENROUTER_CHAT_URL, {
    method: 'POST',
    headers: openRouterRequestHeaders(env, apiKey),
    body: JSON.stringify(body),
  })
}
