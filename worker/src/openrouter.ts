import type { Env } from './types'

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions'

/** Keys the frontend can translate; align with `chat.*` in i18n. */
export type OpenRouterErrorKey =
  | 'openrouter_unavailable'
  | 'openrouter_bad_gateway'
  | 'openrouter_unauthorized'
  | 'openrouter_payment_required'
  | 'openrouter_moderation'
  | 'openrouter_rate_limit'
  | 'openrouter_timeout'
  | 'openrouter_bad_request'
  | 'openrouter_generic'

type OpenRouterJson = {
  error?: { code?: number; message?: string; metadata?: Record<string, unknown> }
  message?: string
}

/**
 * OpenRouter can return 503 with nested error codes (e.g. 1102) in the body.
 * We normalize to stable keys for localized UI. See: OpenRouter 503 = no provider available.
 */
export function mapOpenRouterFailure(httpStatus: number, bodyText: string): {
  errorKey: OpenRouterErrorKey
  /** Short English fallback (logs / clients without i18n) */
  error: string
} {
  const raw = (bodyText || '').trim()
  let nestedCode: number | undefined
  let nestedMsg = ''
  try {
    const j = JSON.parse(raw) as OpenRouterJson
    const e = j.error
    if (e && typeof e === 'object') {
      if (typeof e.code === 'number' && Number.isFinite(e.code)) nestedCode = e.code
      if (typeof e.message === 'string') nestedMsg = e.message
    }
  } catch {
    // not JSON; keep string matching below
  }

  const has1102 = /\b1102\b/.test(raw) || /\bcode\s*:\s*1102\b/i.test(raw)
  const code = nestedCode ?? httpStatus
  const severeStatus = httpStatus === 502 || httpStatus === 503 || httpStatus === 504

  if (httpStatus === 401 || code === 401) {
    return { errorKey: 'openrouter_unauthorized', error: 'OpenRouter: unauthorized (401).' }
  }
  if (httpStatus === 402 || code === 402) {
    return { errorKey: 'openrouter_payment_required', error: 'OpenRouter: payment required (402).' }
  }
  if (httpStatus === 403 || code === 403) {
    return { errorKey: 'openrouter_moderation', error: 'OpenRouter: forbidden / moderation (403).' }
  }
  if (httpStatus === 408 || code === 408) {
    return { errorKey: 'openrouter_timeout', error: 'OpenRouter: request timeout (408).' }
  }
  if (httpStatus === 429 || code === 429) {
    return { errorKey: 'openrouter_rate_limit', error: 'OpenRouter: rate limit (429).' }
  }
  if (httpStatus === 400 || code === 400) {
    return { errorKey: 'openrouter_bad_request', error: 'OpenRouter: bad request (400).' }
  }
  if (httpStatus === 502 || code === 502) {
    return { errorKey: 'openrouter_bad_gateway', error: 'OpenRouter: bad gateway (502).' }
  }
  if (
    httpStatus === 503 ||
    code === 503 ||
    nestedCode === 1102 ||
    (has1102 && severeStatus)
  ) {
    return {
      errorKey: 'openrouter_unavailable',
      error: 'OpenRouter: service / provider unavailable (503).',
    }
  }

  const short = nestedMsg || raw.slice(0, 400) || 'unknown'
  return {
    errorKey: 'openrouter_generic',
    error: `OpenRouter error (${httpStatus}): ${short}`.slice(0, 800),
  }
}

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
