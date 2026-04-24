const ITERATIONS = 100_000
const SALT_BYTES = 16
const KEY_BYTES = 32

function bytesToB64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!)
  return btoa(s)
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_BYTES * 8
  )
  return new Uint8Array(bits)
}

/** Stored format: pbkdf2$<iter>$<salt_b64>$<hash_b64> */
export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const key = await deriveKey(plain, salt)
  return `pbkdf2$${ITERATIONS}$${bytesToB64(salt)}$${bytesToB64(key)}`
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iter = Number(parts[1])
  if (iter !== ITERATIONS || !Number.isFinite(iter)) return false
  let salt: Uint8Array
  let expected: Uint8Array
  try {
    salt = b64ToBytes(parts[2]!)
    expected = b64ToBytes(parts[3]!)
  } catch {
    return false
  }
  const actual = await deriveKey(plain, salt)
  if (actual.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ expected[i]!
  return diff === 0
}
