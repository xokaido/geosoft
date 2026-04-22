import type { Context, Next } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { SignJWT, jwtVerify } from 'jose'
import type { Env } from './types'

const COOKIE = 'session'
const MAX_AGE = 60 * 60 * 24

function getSecret(env: Env): Uint8Array {
  return new TextEncoder().encode(env.SESSION_SECRET)
}

export async function signSession(env: Env, username: string): Promise<string> {
  return new SignJWT({ sub: username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(getSecret(env))
}

export async function verifySession(
  env: Env,
  token: string | undefined
): Promise<{ username: string } | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSecret(env))
    const sub = payload.sub
    if (typeof sub !== 'string' || !sub) return null
    return { username: sub }
  } catch {
    return null
  }
}

export function setSessionCookie(c: Context<{ Bindings: Env }>, token: string): void {
  const secure = new URL(c.req.url).protocol === 'https:'
  setCookie(c, COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure,
    sameSite: 'Strict',
    maxAge: MAX_AGE,
  })
}

export function clearSessionCookie(c: Context<{ Bindings: Env }>): void {
  const secure = new URL(c.req.url).protocol === 'https:'
  setCookie(c, COOKIE, '', {
    path: '/',
    httpOnly: true,
    secure,
    sameSite: 'Strict',
    maxAge: 0,
  })
}

export function readSessionToken(c: Context<{ Bindings: Env }>): string | undefined {
  return getCookie(c, COOKIE)
}

export async function requireAuth(c: Context<{ Bindings: Env }>, next: Next): Promise<Response | void> {
  const token = readSessionToken(c)
  const session = await verifySession(c.env, token)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  c.set('session', session)
  await next()
}

declare module 'hono' {
  interface ContextVariableMap {
    session: { username: string }
  }
}
