# Debugging & Testing Prompts

> Use these focused prompts when specific parts of the app need troubleshooting or testing.

---

## 1. Debug: SSE Streaming Not Working

```
The `/api/chat` endpoint in my Cloudflare Worker is supposed to stream AI responses as Server-Sent Events (SSE), but the frontend receives the full response at once instead of streaming token by token.

Worker code uses:
- Hono framework
- `env.AI.run(model, { messages, stream: true })`
- Returns a `ReadableStream` with `data: <token>\n\n` format

Frontend uses:
- `fetch()` with `response.body.getReader()`
- Reads chunks and appends to a reactive string

Please diagnose the most common causes of this problem in Cloudflare Workers and provide fixed versions of both the Worker handler and the Vue 3 frontend fetch logic. Make sure the stream is properly closed with `data: [DONE]\n\n`.
```

---

## 2. Debug: Vectorize Returns Empty Results

```
My Cloudflare Vectorize semantic search returns 0 results even though vectors were successfully upserted during ingestion.

Setup:
- Index name: geosoft-rag
- Dimensions: 768
- Metric: cosine
- Embedding model: @cf/baai/bge-base-en-v1.5
- Upserted ~500 vectors with metadata { url, title, chunk_index }

Query code in Worker:
const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [query] });
const results = await env.VECTORIZE.query(embedding.data[0], { topK: 5, returnMetadata: true });

Results always: { matches: [], count: 0 }

Please identify all possible causes (namespace mismatch, wrong vector shape, index not yet ready, query format issues) and provide a corrected implementation with proper error logging.
```

---

## 3. Debug: R2 Image Upload Returns 403

```
Uploading images to my R2 bucket via the Worker returns a 403 error. 

Worker upload handler:
- Receives multipart/form-data
- Calls env.R2.put(key, arrayBuffer, { httpMetadata: { contentType } })
- R2 binding name: "R2", bucket name: "geosoft"

The wrangler.toml binding:
[[r2_buckets]]
binding = "R2"
bucket_name = "geosoft"

Please diagnose why R2 put operations return 403 in a Cloudflare Worker, and provide the corrected Worker code including proper content-type handling and error messages.
```

---

## 4. Debug: JWT Cookie Auth Fails After Deploy

```
JWT authentication works in local `wrangler dev` but fails in production (deployed Worker). The session cookie is set correctly but subsequent requests return 401.

Implementation:
- JWT signed with HS256 using SESSION_SECRET from env vars
- Cookie: HttpOnly; Secure; SameSite=Strict
- Using `jose` library for sign/verify

Suspected issues: secret not set as Wrangler secret in production, cookie domain mismatch, SameSite policy blocking.

Please provide:
1. Checklist of things to verify for production JWT cookie auth in Cloudflare Workers
2. How to properly set SESSION_SECRET as a Wrangler secret (not a var)
3. Corrected cookie attributes for production deployment
4. A debug middleware that logs auth failures with reasons (without leaking secrets)
```

---

## 5. Test: Write Integration Tests for the Worker API

```
Write integration tests for a Cloudflare Worker API using Vitest and `@cloudflare/vitest-pool-workers`.

The Worker has these routes (all implemented with Hono):
- POST /api/login — validates username/password, sets JWT cookie
- POST /api/logout — clears cookie
- GET /api/models — returns static model list (no auth needed)
- POST /api/chat — protected, calls env.AI, streams SSE
- POST /api/upload — protected, stores file in env.R2
- GET /api/image/:key — protected, reads from env.R2
- POST /api/rag/ingest — protected, crawls + vectorizes

Write tests for:
1. Login success and failure cases
2. Protected route returns 401 without valid session
3. /api/models returns correct structure
4. /api/upload rejects non-image MIME types
5. /api/upload rejects files over 10MB

Use mocks for AI, R2, and VECTORIZE bindings. Show the full vitest.config.ts and a sample test file.
```

---

## 6. Performance: Optimize Cold Start

```
My Cloudflare Worker has a noticeable cold start delay (~800ms) on first request. The Worker uses:
- Hono for routing
- jose for JWT
- Multiple Cloudflare bindings (AI, R2, D1, VECTORIZE)

Please provide:
1. Analysis of what causes cold starts in Cloudflare Workers
2. Specific optimizations for this stack (lazy imports, removing unused dependencies, etc.)
3. How to use `wrangler.toml` `compatibility_flags` to improve startup
4. Whether splitting into multiple Workers would help and how to structure it
```
