/**
 * Builds worker/src/workers_ai_models.generated.json from:
 * 1) data/workers-ai-models-index.md (snapshot of the public Workers AI models list)
 * 2) HTML pages at https://developers.cloudflare.com/workers-ai/models/<slug>/
 *
 * Run: npx tsx scripts/generate-workers-ai-models.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DEFAULT_INDEX = resolve('data/workers-ai-models-index.md')
const DELAY_MS = 80

/** When the docs HTML omits @cf ids, these match Workers AI naming conventions. */
const ID_OVERRIDES: Record<string, string> = {
  'kimi-k2.5': '@cf/moonshotai/kimi-k2.5',
  'kimi-k2.6': '@cf/moonshotai/kimi-k2.6',
  'gemma-7b-it': '@cf/google/gemma-7b-it',
  'gemma-4-26b-a4b-it': '@cf/google/gemma-4-26b-a4b-it',
  'hermes-2-pro-mistral-7b': '@cf/nousresearch/hermes-2-pro-mistral-7b',
  'meta-llama-3-8b-instruct': '@cf/meta/llama-3-8b-instruct',
  'mistral-7b-instruct-v0.2': '@cf/mistral/mistral-7b-instruct-v0.2',
  'mistral-7b-instruct-v0.1-awq': '@cf/thebloke/mistral-7b-instruct-v0.1-awq',
  'deepseek-coder-6.7b-base-awq': '@cf/thebloke/deepseek-coder-6.7b-base-awq',
  'deepseek-coder-6.7b-instruct-awq': '@cf/thebloke/deepseek-coder-6.7b-instruct-awq',
  'llama-2-13b-chat-awq': '@cf/thebloke/llama-2-13b-chat-awq',
  'llamaguard-7b-awq': '@cf/thebloke/llamaguard-7b-awq',
  'neural-chat-7b-v3-1-awq': '@cf/thebloke/neural-chat-7b-v3-1-awq',
  'openhermes-2.5-mistral-7b-awq': '@cf/thebloke/openhermes-2.5-mistral-7b-awq',
  'zephyr-7b-beta-awq': '@cf/thebloke/zephyr-7b-beta-awq',
  'starling-lm-7b-beta': '@cf/nexusflow/starling-lm-7b-beta',
}

const TASK_ORDER = [
  'Automatic Speech Recognition',
  'Text-to-Speech',
  'Text Embeddings',
  'Text Classification',
  'Text-to-Image',
  'Image-to-Text',
  'Image Classification',
  'Voice Activity Detection',
  'Object Detection',
  'Summarization',
  'Translation',
  'Text Generation',
] as const

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function parseIndexLines(indexMd: string) {
  const rows: {
    slug: string
    task: string
    vision: boolean
    deprecated: boolean
  }[] = []

  for (const line of indexMd.split('\n')) {
    const urlM = line.match(/\/workers-ai\/models\/([a-zA-Z0-9._-]+)\/\)/)
    if (!urlM) continue
    const slug = urlM[1]
    let task = 'Unknown'
    for (const t of TASK_ORDER) {
      if (line.includes(t)) {
        task = t
        break
      }
    }
    const bracket = line.split('](')[0] ?? ''
    const vision = /\bVision\b/.test(bracket)
    const deprecated = /Deprecated/i.test(bracket)
    rows.push({ slug, task, vision, deprecated })
  }

  const bySlug = new Map<string, (typeof rows)[number]>()
  for (const r of rows) {
    bySlug.set(r.slug, r)
  }
  return bySlug
}

async function fetchHtmlModelId(slug: string): Promise<string | null> {
  const res = await fetch(`https://developers.cloudflare.com/workers-ai/models/${slug}/`, {
    headers: { 'User-Agent': 'geosoft-model-catalog-script/1.0' },
    redirect: 'follow',
  })
  if (!res.ok) return null
  const html = await res.text()
  const found = new Set<string>()
  for (const m of html.matchAll(/@cf\/[a-zA-Z0-9._/-]+/g)) {
    found.add(m[0])
  }
  if (!found.size) return null
  return [...found][0]
}

function inferVision(slug: string, task: string, indexVision: boolean): boolean {
  if (indexVision) return true
  if (task !== 'Text Generation') return false
  const s = slug.toLowerCase()
  if (s.includes('vision') || s.includes('llava')) return true
  if (s === 'gemma-3-12b-it' || s.startsWith('gemma-4')) return true
  if (s.includes('kimi-k2') || s.includes('llama-4-scout')) return true
  if (s.includes('mistral-small-3.1')) return true
  return false
}

async function main() {
  const indexPath = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_INDEX
  console.log('Reading index:', indexPath)
  const indexMd = readFileSync(indexPath, 'utf8')
  const bySlug = parseIndexLines(indexMd)
  const slugs = [...bySlug.keys()].sort()
  console.log(`Found ${slugs.length} unique model slugs`)

  const models: {
    id: string
    slug: string
    name: string
    task: string
    vision: boolean
    deprecated: boolean
    chatEligible: boolean
  }[] = []
  const errors: { slug: string; err: string }[] = []

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i]
    const meta = bySlug.get(slug)!
    process.stdout.write(`\r[${i + 1}/${slugs.length}] ${slug.padEnd(44)}`)

    let id = ID_OVERRIDES[slug] ?? null
    try {
      if (!id) {
        await sleep(DELAY_MS)
        id = await fetchHtmlModelId(slug)
      }
      if (!id) {
        errors.push({ slug, err: 'no @cf id in HTML' })
        continue
      }

      const name = slug
      const vision = inferVision(slug, meta.task, meta.vision)
      const chatEligible = meta.task === 'Text Generation'

      models.push({
        id,
        slug,
        name,
        task: meta.task,
        vision,
        deprecated: meta.deprecated,
        chatEligible,
      })
    } catch (e) {
      errors.push({ slug, err: e instanceof Error ? e.message : String(e) })
    }
  }
  console.log('\n')

  models.sort((a, b) => a.id.localeCompare(b.id))

  const outPath = resolve('worker/src/workers_ai_models.generated.json')
  writeFileSync(
    outPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), models, errors }, null, 2),
    'utf8'
  )

  console.log(`Wrote ${models.length} models → ${outPath}`)
  if (errors.length) {
    console.warn(`Skipped ${errors.length}:`)
    for (const e of errors) console.warn(`  ${e.slug}: ${e.err}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
