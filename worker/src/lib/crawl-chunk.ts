import { parse } from 'node-html-parser'

export const GEOSOFT_ORIGIN = 'https://geosoft.ge'
const USER_AGENT = 'GeoSoftBot/1.0'
const CRAWL_DELAY_MS = 300
const MAX_DEPTH = 4
const MAX_PAGES = 200

export type PageRecord = { url: string; title: string; text: string }

export type TextChunk = {
  url: string
  title: string
  chunk_index: number
  text: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchWithRetry(url: string, init: RequestInit, retries = 3): Promise<Response> {
  let last: Error | null = null
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, init)
      if (res.status >= 500 && i < retries - 1) {
        await sleep(200 * 2 ** i)
        continue
      }
      return res
    } catch (e) {
      last = e instanceof Error ? e : new Error(String(e))
      await sleep(200 * 2 ** i)
    }
  }
  throw last ?? new Error('fetch failed')
}

function sameOrigin(u: URL, origin: URL): boolean {
  return u.origin === origin.origin
}

function normalizeHref(href: string, pageUrl: URL): string | null {
  try {
    if (!href || href.startsWith('#') || href.startsWith('mailto:')) return null
    const u = new URL(href, pageUrl)
    if (!sameOrigin(u, new URL(GEOSOFT_ORIGIN))) return null
    u.hash = ''
    return u.toString()
  } catch {
    return null
  }
}

export function extractPage(html: string, url: string): PageRecord {
  const root = parse(html)
  for (const sel of ['script', 'style', 'nav', 'footer', 'header']) {
    root.querySelectorAll(sel).forEach((n) => n.remove())
  }
  const title = root.querySelector('title')?.text?.trim() || ''
  const desc =
    root.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || ''
  const bodyText = root.text.replace(/\u00a0/g, ' ')
  const pieces = [title, desc, bodyText].filter(Boolean)
  const text = cleanText(pieces.join('\n\n'))
  return { url, title: title || url, text }
}

export function cleanText(raw: string): string {
  return raw
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const CHARS_PER_TOKEN = 4
const CHUNK_CHARS = 400 * CHARS_PER_TOKEN
const OVERLAP_CHARS = 50 * CHARS_PER_TOKEN
const MIN_CHUNK = 100

export function chunkText(record: PageRecord): TextChunk[] {
  const t = cleanText(record.text)
  if (t.length < MIN_CHUNK) return []
  const chunks: TextChunk[] = []
  let start = 0
  let idx = 0
  while (start < t.length) {
    const end = Math.min(t.length, start + CHUNK_CHARS)
    const slice = t.slice(start, end).trim()
    if (slice.length >= MIN_CHUNK) {
      chunks.push({
        url: record.url,
        title: record.title,
        chunk_index: idx,
        text: slice,
      })
      idx++
    }
    if (end >= t.length) break
    start = end - OVERLAP_CHARS
    if (start < 0) start = 0
  }
  return chunks
}

export async function crawlGeosoft(
  options: Partial<{ maxDepth: number; maxPages: number; delayMs: number }> = {}
): Promise<PageRecord[]> {
  const maxDepth = options.maxDepth ?? MAX_DEPTH
  const maxPages = options.maxPages ?? MAX_PAGES
  const delayMs = options.delayMs ?? CRAWL_DELAY_MS
  const origin = new URL(GEOSOFT_ORIGIN)
  const queue: { url: string; depth: number }[] = [{ url: GEOSOFT_ORIGIN, depth: 0 }]
  const visited = new Set<string>()
  const pages: PageRecord[] = []

  while (queue.length && pages.length < maxPages) {
    const next = queue.shift()!
    if (visited.has(next.url)) continue
    visited.add(next.url)
    await sleep(delayMs)
    let res: Response
    try {
      res = await fetchWithRetry(next.url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
        redirect: 'follow',
      })
    } catch {
      continue
    }
    const ct = res.headers.get('content-type') || ''
    if (!res.ok || !ct.includes('text/html')) continue
    let html: string
    try {
      html = await res.text()
    } catch {
      continue
    }
    let record: PageRecord
    try {
      record = extractPage(html, next.url)
    } catch {
      continue
    }
    if (record.text.length >= MIN_CHUNK) {
      pages.push(record)
    }
    if (next.depth >= maxDepth) continue
    let root
    try {
      root = parse(html)
    } catch {
      continue
    }
    const pageUrl = new URL(next.url)
    for (const a of root.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href')
      if (!href) continue
      const abs = normalizeHref(href, pageUrl)
      if (!abs || visited.has(abs)) continue
      if (!queue.some((q) => q.url === abs)) {
        queue.push({ url: abs, depth: next.depth + 1 })
      }
    }
  }
  return pages
}

export async function vectorIdFor(url: string, chunkIndex: number): Promise<string> {
  const input = `${url}#${chunkIndex}`
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 24)}_${chunkIndex}`
}
