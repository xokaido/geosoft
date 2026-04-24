/**
 * Prints a wrangler `d1 execute` command to upsert one app user.
 * Usage: npx tsx scripts/add-app-user.ts <username> <password>
 * Then run the printed command against local or remote D1.
 */
import { hashPassword } from '../worker/src/password.ts'

const USER_RE = /^[a-zA-Z0-9._-]{1,64}$/

function sqlString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`
}

async function main() {
  const username = process.argv[2]?.trim()
  const password = process.argv[3]
  if (!username || password === undefined) {
    console.error('Usage: npx tsx scripts/add-app-user.ts <username> <password>')
    process.exit(1)
  }
  if (!USER_RE.test(username)) {
    console.error('Username must be 1–64 chars: letters, digits, . _ -')
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.')
    process.exit(1)
  }
  const passwordHash = await hashPassword(password)
  const now = Date.now()
  const dbName = 'geosoft-chat-db'
  const sql = `INSERT OR REPLACE INTO app_users (username, password_hash, created_at) VALUES (${sqlString(username)}, ${sqlString(passwordHash)}, ${now})`
  console.log('Run one of:\n')
  console.log(`npx wrangler d1 execute ${dbName} --local --command=${JSON.stringify(sql)}`)
  console.log(`npx wrangler d1 execute ${dbName} --remote --command=${JSON.stringify(sql)}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
