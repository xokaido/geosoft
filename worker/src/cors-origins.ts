import type { Env } from './types'

/** Browser `Origin` values allowed to call this API with credentials (cookies). */
const BUILTIN = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://127.0.0.1:5173',
  'https://car.kadri.ge',
] as const

/** Returns the request Origin if allowed, otherwise null (browser blocks the response). */
export function resolveCorsOrigin(env: Env, requestOrigin: string): string | null {
  const origin = requestOrigin.trim()
  if (!origin) return null
  const extras = (env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const set = new Set<string>([...BUILTIN, ...extras])
  return set.has(origin) ? origin : null
}
