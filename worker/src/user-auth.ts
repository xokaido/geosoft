import { verifyPassword } from './password'

const USER_RE = /^[a-zA-Z0-9._-]{1,64}$/

export function normalizeLoginUsername(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const u = raw.trim()
  if (!USER_RE.test(u)) return null
  return u
}

export async function verifyAppUserCredentials(
  db: D1Database,
  username: string,
  password: string
): Promise<boolean> {
  try {
    const row = await db
      .prepare('SELECT password_hash FROM app_users WHERE username = ? LIMIT 1')
      .bind(username)
      .first<{ password_hash: string }>()
    if (!row?.password_hash) return false
    return verifyPassword(password, row.password_hash)
  } catch {
    // Missing migration, D1 offline, etc. — fall back to optional env login in index.
    return false
  }
}
