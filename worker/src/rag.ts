import type { Env } from './types'
import { crawlGeosoft, chunkText, vectorIdFor, type TextChunk } from './lib/crawl-chunk'

function asMeta(m: unknown): Record<string, string | number | boolean> {
  if (!m || typeof m !== 'object') return {}
  return m as Record<string, string | number | boolean>
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
  const [vector] = await embedTexts(env, [query])
  const q = await env.VECTORIZE.query(vector, { topK: 5, returnMetadata: 'all' })
  const parts = (q.matches ?? []).map((m, i) => {
    const meta = asMeta(m.metadata)
    const url = String(meta.url ?? '')
    const title = String(meta.title ?? '')
    const text = String(meta.text ?? '')
    return `### Source ${i + 1}${title ? `: ${title}` : ''}${url ? ` (${url})` : ''}\n${text}`
  })
  return parts.filter(Boolean).join('\n\n')
}

export async function ingestGeosoftToVectorize(
  env: Env,
  options: { maxPages?: number; maxDepth?: number } = {}
): Promise<{ chunks: number; vectors: number }> {
  const pages = await crawlGeosoft({
    maxPages: options.maxPages ?? 200,
    maxDepth: options.maxDepth ?? 4,
  })
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
