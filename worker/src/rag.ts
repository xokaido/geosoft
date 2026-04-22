import type { Env } from './types'
import { geosoftOverviewSeedPages } from './geosoft-overview'
import { crawlGeosoft, chunkText, vectorIdFor, type TextChunk } from './lib/crawl-chunk'

function asMeta(m: unknown): Record<string, string | number | boolean> {
  if (!m || typeof m !== 'object') return {}
  return m as Record<string, string | number | boolean>
}

/** English-centric embeddings miss pure Georgian queries; paraphrase + hint improves recall. */
function expandRetrievalQueries(query: string): string[] {
  const q = query.trim()
  if (!q) return []
  const vendorHints =
    'Geosoft geosoft.ge: Google Workspace, Google Cloud, Microsoft 365, Google Workspace for Education, Synology NAS, Google Maps Platform, AWS, cloud migration, consulting, training, Georgia.'
  const set = new Set<string>([q, `${q}\n${vendorHints}`])
  if (/[\u10A0-\u10FF]/.test(q)) {
    set.add(
      `Georgian question about Geosoft company products and services. English: what does Geosoft sell, software licenses cloud solutions partner.\n${vendorHints}`
    )
  }
  return [...set]
}

export async function embedTexts(env: Env, texts: string[]): Promise<number[][]> {
  const res = (await env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: texts,
  })) as { data?: number[][] }
  const data = res.data
  if (!data?.length) throw new Error('Embedding model returned no vectors')
  return data
}

export async function retrieveRagContext(env: Env, query: string): Promise<string> {
  const trimmed = query.trim()
  if (!trimmed) return ''

  const queries = expandRetrievalQueries(trimmed)
  const best = new Map<string, { score: number; title: string; url: string; text: string }>()

  for (const qtext of queries) {
    const [vector] = await embedTexts(env, [qtext])
    const res = await env.VECTORIZE.query(vector, { topK: 6, returnMetadata: 'all' })
    for (const m of res.matches ?? []) {
      const meta = asMeta(m.metadata)
      const url = String(meta.url ?? '')
      const title = String(meta.title ?? '')
      const text = String(meta.text ?? '')
      if (!text.trim()) continue
      const key = m.id ?? `${url}#${String(meta.chunk_index ?? '')}`
      const score = typeof m.score === 'number' ? m.score : 0
      const prev = best.get(key)
      if (!prev || score > prev.score) {
        best.set(key, { score, title, url, text })
      }
    }
  }

  const merged = [...best.values()].sort((a, b) => b.score - a.score).slice(0, 10)
  return merged
    .map((row, i) => {
      const head = `### Source ${i + 1}${row.title ? `: ${row.title}` : ''}${row.url ? ` (${row.url})` : ''}`
      return `${head}\n${row.text}`
    })
    .join('\n\n')
}

export async function ingestGeosoftToVectorize(
  env: Env,
  options: { maxPages?: number; maxDepth?: number } = {}
): Promise<{ chunks: number; vectors: number }> {
  const pages = [...(await crawlGeosoft({
    maxPages: options.maxPages ?? 200,
    maxDepth: options.maxDepth ?? 4,
  })), ...geosoftOverviewSeedPages()]
  const chunks: TextChunk[] = []
  for (const p of pages) {
    chunks.push(...chunkText(p))
  }
  const embedBatch = 10
  const upsertBatch = 100
  let vectors = 0
  for (let i = 0; i < chunks.length; i += embedBatch) {
    const slice = chunks.slice(i, i + embedBatch)
    const texts = slice.map((c) => c.text)
    const embeddings = await embedTexts(env, texts)
    const upsertVectors = await Promise.all(
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
    for (let u = 0; u < upsertVectors.length; u += upsertBatch) {
      const batch = upsertVectors.slice(u, u + upsertBatch)
      if (batch.length) {
        await env.VECTORIZE.upsert(batch)
        vectors += batch.length
      }
    }
  }
  return { chunks: chunks.length, vectors }
}
