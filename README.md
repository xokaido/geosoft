# GeoSoft AI Chat

Full-stack AI chat on Cloudflare Workers with RAG (Vectorize + `geosoft.ge` crawl), image upload to R2, Workers AI streaming, and a Vite + Vue 3 + Pinia frontend (Georgian / Russian / English, light/dark).

The original **prompt pack** files (`PROMPT_*.md`) are still in this repo if you want to regenerate or extend pieces in isolation.

---

## Prerequisites

- Node.js 20+
- npm
- Wrangler CLI (`npm install -g wrangler` or use `npx wrangler`)
- Cloudflare account on the **Workers Paid** plan (D1, Vectorize, AI)

---

## Cloudflare setup

1. Authenticate: `wrangler login`
2. **D1**: `cd worker && npx wrangler d1 create geosoft-chat-db` — copy `database_id` into `worker/wrangler.toml`
3. **Migrations**: `cd worker && npx wrangler d1 migrations apply geosoft-chat-db --remote`
4. **R2**: `cd worker && npx wrangler r2 bucket create geosoft` (or confirm it exists)
5. **Vectorize** (768 dims, cosine, matches `@cf/baai/bge-base-en-v1.5`):

   `cd worker && npx wrangler vectorize create geosoft-rag --dimensions=768 --metric=cosine`

6. **Secrets** (recommended for production):

   ```bash
   cd worker
   npx wrangler secret put AUTH_PASSWORD
   npx wrangler secret put SESSION_SECRET
   ```

   Remove or override the dev fallbacks in `worker/wrangler.toml` `[vars]` once secrets are set.

---

## Local development

Install dependencies (workspaces):

```bash
npm install
```

Run Worker and Vite together:

```bash
npm run dev
```

- Frontend: http://localhost:5173 (proxies `/api` → http://127.0.0.1:8787)
- Worker: http://127.0.0.1:8787

Default credentials match `worker/wrangler.toml` (`AUTH_USERNAME` / `AUTH_PASSWORD`) until you change them.

---

## RAG ingestion (one-off)

1. Copy `.env.example` → `.env` and set `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` (AI read + Vectorize edit).
2. Run:

```bash
npm run ingest
```

This crawls `https://geosoft.ge`, chunks text, embeds with `@cf/baai/bge-base-en-v1.5`, and upserts into the `geosoft-rag` index.

---

## Production deploy

```bash
npm run build
```

This builds the Vue app into `worker/public/` and runs `wrangler deploy` from `worker/`.

---

## Environment variables

| Variable | Where | Description |
|----------|-------|-------------|
| `AUTH_USERNAME` | `worker/wrangler.toml` `[vars]` | Login username |
| `AUTH_PASSWORD` | `[vars]` locally / `wrangler secret put` in prod | Login password |
| `SESSION_SECRET` | `[vars]` locally / `wrangler secret put` in prod | JWT signing key |
| `CLOUDFLARE_ACCOUNT_ID` | `.env` (ingest script only) | Account ID for REST calls |
| `CLOUDFLARE_API_TOKEN` | `.env` (ingest script only) | Token with AI + Vectorize permissions |

---

## Notes

- **Vectorize dimensions** must stay **768** for `@cf/baai/bge-base-en-v1.5` unless you recreate the index and re-ingest.
- **Vision**: only `@cf/meta/llama-3.2-11b-vision-instruct` is marked `vision: true`; the UI hides image upload for other models.
- **R2**: uploads use keys under `uploads/` in the `geosoft` bucket.
- **Meta Llama Vision license**: Cloudflare requires a one-time `{"prompt":"agree"}` call to the vision model endpoint before normal use in some accounts.

---

## Prompt pack (optional)

| File | Purpose |
|------|---------|
| `PROMPT_MAIN.md` | Full original build specification |
| `PROMPT_CLOUDFLARE_SETUP.md` | Infra / wrangler notes |
| `PROMPT_RAG_INGESTION.md` | Ingest script details |
| `PROMPT_I18N.md` | Locale key reference |
| `PROMPT_DEBUGGING.md` | Targeted troubleshooting prompts |
