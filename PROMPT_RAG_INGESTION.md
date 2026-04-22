# RAG Ingestion Script — Build Prompt

> Use this prompt to have an AI coding agent write the `scripts/ingest-geosoft.ts` file in isolation, if you need to build or debug it separately from the main app.

---

## Prompt

Write a complete Node.js + TypeScript script at `scripts/ingest-geosoft.ts` that crawls the website `https://geosoft.ge`, extracts text content, and ingests it into a Cloudflare Vectorize index for RAG (Retrieval-Augmented Generation).

### Requirements:

#### Crawler
- Start from `https://geosoft.ge`
- Recursively follow `<a href>` links that are on the same domain only
- Maximum crawl depth: 4
- Maximum pages: 200
- Skip: binary files, anchors (`#`), `mailto:`, external domains
- Polite crawling: 300ms delay between requests, User-Agent: `GeoSoftBot/1.0`
- Track visited URLs to avoid duplicates

#### Text Extraction
- Use `node-html-parser` to parse HTML
- Remove `<script>`, `<style>`, `<nav>`, `<footer>`, `<header>` tags before extracting text
- Extract `<title>` as the page title
- Extract `<meta name="description">` content if available
- Clean extracted text: collapse whitespace, remove empty lines

#### Chunking
- Split cleaned text into chunks of approximately 400 tokens (use character count: 1 token ≈ 4 chars, so ~1600 chars per chunk)
- Overlap between chunks: ~50 tokens (~200 chars)
- Minimum chunk size: 100 characters (skip shorter chunks)
- Each chunk carries metadata: `{ url: string, title: string, chunk_index: number }`

#### Embedding
- Use Cloudflare AI REST API: `POST https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/@cf/baai/bge-base-en-v1.5`
- Auth header: `Authorization: Bearer {api_token}`
- Body: `{ "text": ["chunk text here"] }`
- Extract the embedding vector from `result.data[0]`
- Batch embedding calls: process 10 chunks per API call to reduce requests

#### Vectorize Upsert
- Use Cloudflare Vectorize REST API: `POST https://api.cloudflare.com/client/v4/accounts/{account_id}/vectorize/v2/indexes/geosoft-rag/upsert`
- Each vector: `{ id: "<url_hash>_<chunk_index>", values: [...], metadata: { url, title, chunk_index } }`
- Batch upserts: 100 vectors per request
- Log progress: pages crawled, chunks created, vectors upserted

#### Environment
- Read from `.env` file (use `dotenv`):
  - `CLOUDFLARE_ACCOUNT_ID`
  - `CLOUDFLARE_API_TOKEN` (needs AI Read + Vectorize Edit permissions)
- TypeScript, run with `npx tsx scripts/ingest-geosoft.ts`

#### Error Handling
- Retry failed HTTP requests up to 3 times with exponential backoff
- Log errors per page but continue crawling
- At the end, print a summary: `✅ Crawled X pages, created Y chunks, upserted Z vectors`

#### Dependencies needed:
```json
{
  "node-html-parser": "^6.x",
  "dotenv": "^16.x",
  "tsx": "^4.x"
}
```

Write the complete script with full TypeScript types. No placeholders — every function must be fully implemented.
