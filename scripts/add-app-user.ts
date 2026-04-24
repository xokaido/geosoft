/**
 * Writes SQL to scripts/.last-app-user-insert.sql and prints wrangler commands.
 * Usage: npm run user:add -- <username> <password>
 *
 * Important: hashes contain `$`. Never paste SQL into bash double quotes — use --file below.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { hashPassword } from '../worker/src/password.ts'

const USER_RE = /^[a-zA-Z0-9._-]{1,64}$/

function sqlString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`
}

async function main() {
  const username = process.argv[2]?.trim()
  const password = process.argv[3]
  if (!username || password === undefined) {
    console.error('Usage: npm run user:add -- <username> <password>')
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
  const outFile = join(process.cwd(), 'scripts', '.last-app-user-insert.sql')
  writeFileSync(outFile, `${sql};\n`, 'utf8')

  console.log(`Wrote: ${outFile}`)
  console.log('\nRun one of (from repo root):\n')
  console.log(`  npx wrangler d1 execute ${dbName} --remote --file=${outFile}`)
  console.log(`  npx wrangler d1 execute ${dbName} --local  --file=${outFile}`)
  console.log(
    '\nWhy --file: password hashes contain `$`. A shell `--command="…$100000…"` mangles them; --file does not.\n'
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
