# GeoSoft AI Chat App — Full Build Prompt

> Paste this entire prompt into Claude Code, Cursor, Windsurf, or any AI coding agent to generate the complete application.

---

Build a full-stack AI chat web application deployed on Cloudflare. The entire project must live in a single GitHub repository with both backend (Cloudflare Workers) and frontend (static assets served via Worker) together.

---

## REPOSITORY STRUCTURE

```
/
├── worker/               # Cloudflare Worker (Hono based)
│   ├── src/
│   │   ├── index.ts      # Entry point, route registration
│   │   ├── auth.ts       # Session/cookie auth middleware
│   │   ├── chat.ts       # /api/chat handler (AI inference)
│   │   ├── upload.ts     # /api/upload handler (R2)
│   │   ├── rag.ts        # /api/rag + vectorize logic
│   │   └── models.ts     # Static model list
│   └── wrangler.toml
├── frontend/             # Vite + Vue 3 + TypeScript + Pinia
│   ├── src/
│   │   ├── main.ts
│   │   ├── i18n/
│   │   │   ├── ka.ts     # Georgian (default)
│   │   │   ├── ru.ts     # Russian
│   │   │   └── en.ts     # English
│   │   ├── views/
│   │   │   ├── Login.vue
│   │   │   └── Chat.vue
│   │   └── components/
│   │       ├── ModelSelector.vue
│   │       ├── MessageList.vue
│   │       ├── ImageUpload.vue
│   │       └── LanguageSwitcher.vue
│   └── vite.config.ts
├── scripts/
│   └── ingest-geosoft.ts # One-shot crawler + vectorize ingestion script
└── package.json          # Root workspace
```

---

## CLOUDFLARE BINDINGS (`wrangler.toml`)

```toml
name = "geosoft-chat"
main = "worker/src/index.ts"
compatibility_date = "2024-09-23"

[ai]
binding = "AI"

[[d1_databases]]
binding = "DB"
database_name = "geosoft-chat-db"
database_id = "<YOUR_D1_ID>"

[[r2_buckets]]
binding = "R2"
bucket_name = "geosoft"

[[vectorize]]
binding = "VECTORIZE"
index_name = "geosoft-rag"
dimensions = 768
metric = "cosine"

[vars]
AUTH_USERNAME = "admin"
AUTH_PASSWORD = "changeme"
SESSION_SECRET = "replace-with-random-secret"
```

---

## AUTHENTICATION

- Static single-user login: username + password defined in `wrangler.toml` vars.
- On successful POST `/api/login`, issue a signed JWT (using `jose` or Web Crypto) stored in an HttpOnly cookie (name: `session`).
- Auth middleware on all `/api/*` routes (except `/api/login`) validates this cookie and returns 401 if invalid/expired.
- Session duration: 24 hours.
- POST `/api/logout` clears the cookie.
- Frontend redirects unauthenticated users to `/login`.

---

## BACKEND: `/api/` WORKER ROUTES

All routes are handled by the same Worker. Use Hono for routing.

### POST `/api/login`
- Body: `{ username, password }`
- Validates against env vars `AUTH_USERNAME` / `AUTH_PASSWORD`
- Returns signed JWT in HttpOnly cookie on success
- Returns 401 on failure

### POST `/api/logout`
- Clears session cookie

### GET `/api/models`
- Returns a static JSON array of available Cloudflare AI models grouped by capability:

```json
[
  { "id": "@cf/meta/llama-3.1-8b-instruct", "name": "Llama 3.1 8B", "type": "text", "vision": false },
  { "id": "@cf/meta/llama-3.1-70b-instruct", "name": "Llama 3.1 70B", "type": "text", "vision": false },
  { "id": "@cf/meta/llama-3.2-11b-vision-instruct", "name": "Llama 3.2 11B Vision", "type": "text", "vision": true },
  { "id": "@cf/meta/llama-3.3-70b-instruct-fp8-fast", "name": "Llama 3.3 70B Fast", "type": "text", "vision": false },
  { "id": "@cf/google/gemma-3-12b-it", "name": "Gemma 3 12B", "type": "text", "vision": false },
  { "id": "@cf/mistral/mistral-7b-instruct-v0.1", "name": "Mistral 7B", "type": "text", "vision": false },
  { "id": "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", "name": "DeepSeek R1 32B", "type": "text", "vision": false },
  { "id": "@cf/qwen/qwen2.5-coder-32b-instruct", "name": "Qwen 2.5 Coder 32B", "type": "text", "vision": false }
]
```

Only vision-capable models show the image upload button in the UI (check `vision: true` on the selected model).

### POST `/api/upload`
- Accepts `multipart/form-data` with field `file` (image: jpg/png/webp/gif, max 10MB)
- Stores the file in R2 bucket `geosoft` under key `uploads/<uuid>.<ext>`
- Returns `{ url: "/api/image/<uuid>.<ext>" }`

### GET `/api/image/:key`
- Streams the object from R2 with correct `Content-Type`
- Returns 404 if not found

### POST `/api/chat`
- Body:
```json
{
  "model": "@cf/meta/llama-3.1-8b-instruct",
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "imageUrl": "/api/image/abc.jpg",
  "useRag": true
}
```
- If `useRag: true`, run semantic search against Vectorize (embedding model: `@cf/baai/bge-base-en-v1.5`, top-K 5) and prepend retrieved context chunks to the system prompt.
- If `imageUrl` is provided and the model is vision-capable, include the image as a base64-encoded content block fetched from R2.
- Stream the AI response back using `ReadableStream` (SSE format: `data: <token>\n\n`, terminated with `data: [DONE]\n\n`).
- The frontend consumes SSE and renders tokens as they arrive.

### POST `/api/rag/ingest` (protected, admin only)
- Triggers re-ingestion of geosoft.ge content into Vectorize.
- Delegates to the same logic as `scripts/ingest-geosoft.ts` but runs inside the Worker using `fetch`.
- Returns `{ chunks: N }` with the count of vectors upserted.

---

## RAG: geosoft.ge INGESTION

Create `scripts/ingest-geosoft.ts` — a Node.js script (run once, locally or via CI) that:

1. Crawls `https://geosoft.ge` using a recursive fetch-based crawler (respect `<a href>` links, same-domain only, max depth 4, max 200 pages).
2. Extracts clean text from each page using a lightweight HTML-to-text parser (e.g. `node-html-parser` + strip tags).
3. Chunks text into ~400-token segments with 50-token overlap.
4. For each chunk, calls Cloudflare AI REST API to generate an embedding using `@cf/baai/bge-base-en-v1.5`.
5. Upserts vectors into Cloudflare Vectorize index `geosoft-rag` with metadata `{ url, title, chunk_index }`.

The script reads `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` from `.env`. Include a `README` section with exact run instructions.

---

## FRONTEND

Stack: **Vite + Vue 3 + TypeScript + Pinia**. No heavy UI library — build custom components. Serve frontend as static assets from the Worker (bundle into `worker/public/` via build step, Worker serves `index.html` for all non-`/api/` routes).

### Login Page (`/login`)
- Clean centered form: username + password fields + submit button.
- On success, redirect to `/`.
- Show error message on 401.

### Chat Page (`/`) — main layout

**Sidebar (collapsible on mobile):**
- App logo / title
- **Model Selector**: dropdown grouped by type, shows which models support vision
- **RAG toggle**: checkbox "Use geosoft.ge knowledge base" — when on, sends `useRag: true`
- Language switcher: 🇬🇪 ქართ / 🇷🇺 Рус / 🇬🇧 Eng
- Dark/light mode toggle (sun/moon icon)
- Logout button

**Main area:**
- Message list (user messages right-aligned, assistant left-aligned, with model name shown on assistant bubbles)
- Streaming tokens render in real time as they arrive via SSE
- Image attachment: if selected model has `vision: true`, show a paperclip/image button — clicking opens file picker, uploads via `/api/upload`, shows a thumbnail preview in the message compose area
- Text input + Send button (Enter to send, Shift+Enter for newline)
- "Thinking..." skeleton while waiting for first token

### i18n
Three locale files (`ka`, `ru`, `en`). Georgian is default. All UI strings go through the i18n system — no hardcoded English text in templates. Provide full translations for all strings.

### Theme
- CSS custom properties for all colors, support `data-theme="light"` / `data-theme="dark"` on `<html>`.
- Persist theme preference and language choice in `localStorage`.
- Respect `prefers-color-scheme` as the default if no preference is stored.

---

## D1 DATABASE

Create migration `0001_init.sql`:

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
```

Sessions are JWT-based so D1 is available for future use (e.g. conversation history). Include the migration but the first version does not need to persist chat history.

---

## BUILD & DEPLOYMENT

Root `package.json` scripts:

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:worker\" \"npm run dev:frontend\"",
    "dev:worker": "cd worker && wrangler dev",
    "dev:frontend": "cd frontend && vite --port 5173 --proxy /api=http://localhost:8787",
    "build": "cd frontend && vite build --outDir ../worker/public && cd ../worker && wrangler deploy",
    "ingest": "npx tsx scripts/ingest-geosoft.ts"
  }
}
```

Vite config must set `base: "/"` and output to `../worker/public`.

Worker must serve `worker/public/index.html` for all GET requests that do not start with `/api/`.

---

## SECURITY & ERROR HANDLING

- All `/api/*` routes return JSON errors with `{ error: string }` and appropriate HTTP status codes.
- Auth cookie: `HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`
- R2 uploads: validate MIME type server-side, reject non-image types.
- Vectorize + AI calls: wrap in try/catch, return graceful errors.
- Never expose `AUTH_PASSWORD` or `SESSION_SECRET` to the frontend.

---

## README

Include a complete `README.md` with:
1. Prerequisites (Node 20+, Wrangler CLI, Cloudflare account)
2. `wrangler.toml` setup steps (create D1, create R2, create Vectorize index, fill in IDs)
3. Local development instructions
4. One-time RAG ingestion instructions (`npm run ingest`)
5. Production deployment (`npm run build`)
6. Environment variables reference
