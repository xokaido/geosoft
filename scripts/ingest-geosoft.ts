import 'dotenv/config'
import { geosoftOverviewSeedPages } from '../worker/src/geosoft-overview.ts'
import { chunkText, crawlGeosoft, vectorIdFor, type TextChunk } from '../worker/src/lib/crawl-chunk.ts'

const INDEX = 'geosoft-rag'
const EMBED_MODEL = '@cf/baai/bge-base-en-v1.5'

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchJson<T>(url: string, init: RequestInit, retries = 3): Promise<T> {
  let last = ''
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, init)
    const text = await res.text()
    if (res.ok) return JSON.parse(text) as T
    last = text
    if (res.status < 500 && res.status !== 429) break
    await sleep(250 * 2 ** i)
  }
  throw new Error(last || 'Request failed')
}

type AiRunResponse = {
  success?: boolean
  result?: { data?: unknown; shape?: number[] }
  errors?: unknown
}

function extractEmbeddings(json: AiRunResponse): number[][] {
  const data = json.result?.data
  if (Array.isArray(data) && data.every((row) => Array.isArray(row))) {
    return data as number[][]
  }
  throw new Error(`Unexpected embedding response: ${JSON.stringify(json)}`)
}

type VectorizeUpsertResponse = {
  success?: boolean
  errors?: unknown
}

async function embedBatch(accountId: string, token: string, texts: string[]): Promise<number[][]> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${EMBED_MODEL}`
  const json = await fetchJson<AiRunResponse>(
    url,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: texts }),
    },
    3
  )
  return extractEmbeddings(json)
}

async function upsertVectors(
  accountId: string,
  token: string,
  vectors: { id: string; values: number[]; metadata: Record<string, string | number> }[]
): Promise<void> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/v2/indexes/${INDEX}/upsert`
  const json = await fetchJson<VectorizeUpsertResponse>(
    url,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ vectors }),
    },
    3
  )
  if (json.success === false) {
    throw new Error(`Vectorize upsert failed: ${JSON.stringify(json.errors ?? json)}`)
  }
}

async function main() {
  const accountId = requireEnv('CLOUDFLARE_ACCOUNT_ID')
  const token = requireEnv('CLOUDFLARE_API_TOKEN')

  console.log('Crawling geosoft.ge...')
  const pages = [...(await crawlGeosoft()), ...geosoftOverviewSeedPages()]
  const chunks: TextChunk[] = []
  for (const p of pages) {
    chunks.push(...chunkText(p))
  }
  console.log(`Pages: ${pages.length}, chunks: ${chunks.length}`)

  const embedBatchSize = 10
  const upsertBatchSize = 100
  let upserted = 0

  for (let i = 0; i < chunks.length; i += embedBatchSize) {
    const slice = chunks.slice(i, i + embedBatchSize)
    const texts = slice.map((c) => c.text)
    const embeddings = await embedBatch(accountId, token, texts)
    const vectors = await Promise.all(
      slice.map(async (c, j) => ({
        id: await vectorIdFor(c.url, c.chunk_index),
        values: embeddings[j],
        metadata: {
          url: c.url,
          title: c.title,
          chunk_index: c.chunk_index,
          text: c.text.slice(0, 2048),
        },
      }))
    )

    for (let u = 0; u < vectors.length; u += upsertBatchSize) {
      const batch = vectors.slice(u, u + upsertBatchSize)
      if (!batch.length) continue
      await upsertVectors(accountId, token, batch)
      upserted += batch.length
      console.log(`Upserted ${upserted}/${chunks.length}`)
    }
  }

  console.log(`✅ Crawled ${pages.length} pages, created ${chunks.length} chunks, upserted ${upserted} vectors`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
