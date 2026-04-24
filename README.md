# GeoSoft AI Chat

Full-stack AI chat on Cloudflare Workers with RAG (Vectorize + `geosoft.ge` crawl), image upload to R2, **[OpenRouter](https://openrouter.ai/)** chat completions (streaming), Workers AI for embeddings only, and a Vite + Vue 3 + Pinia frontend (Georgian / Russian / English, light/dark).

The original **prompt pack** files (`PROMPT_*.md`) are still in this repo if you want to regenerate or extend pieces in isolation.

---

## Prerequisites

- Node.js 20+
- npm
- Wrangler CLI (`npm install -g wrangler` or use `npx wrangler`)
- Cloudflare account on the **Workers Paid** plan (D1, Vectorize, AI)

---

## Cloudflare setup

All Wrangler commands run from the **repository root** (`wrangler.toml` is at the root).

1. Authenticate: `wrangler login`
2. **D1**: `npx wrangler d1 create geosoft-chat-db` — copy `database_id` into `wrangler.toml`
3. **Migrations**: `npx wrangler d1 migrations apply geosoft-chat-db --remote` (applies all SQL in `worker/migrations/`, including `app_users` for per-user logins). For `wrangler dev`, also run `… --local`.
4. **R2**: `npx wrangler r2 bucket create geosoft` (or confirm it exists)
5. **Vectorize** (768 dims, cosine, matches `@cf/baai/bge-base-en-v1.5`):

   `npx wrangler vectorize create geosoft-rag --dimensions=768 --metric=cosine`

6. **Secrets** (recommended for production):

   ```bash
   npx wrangler secret put SESSION_SECRET
   npx wrangler secret put OPENROUTER_API_KEY
   ```

   Remove or override the dev fallbacks in `wrangler.toml` `[vars]` once secrets are set.

   For local `wrangler dev`, copy `.dev.vars.example` to **`.dev.vars`** and set `OPENROUTER_API_KEY` (this file is gitignored).

7. **Create logins** (one row per person; no self-service registration). Passwords must be at least 8 characters.

   ```bash
   npm run user:add -- company_a 'their-secure-password'
   ```

   Run the printed `wrangler d1 execute …` command against **local** or **remote** D1. Each username gets its own chat history (`chats.user_id`). Repeat for every company user.

---

## Local development

Install dependencies:

```bash
npm install
```

Run Worker and Vite together:

```bash
npm run dev
```

- Frontend: http://localhost:5173 (proxies `/api` → http://127.0.0.1:8787)
- Worker: http://127.0.0.1:8787

After `d1 migrations apply --local`, create at least one user with `npm run user:add -- <username> '<password>'` and run the printed SQL against the local database, then sign in with that username and password.

---

## RAG ingestion (one-off)

1. Copy `.env.example` → `.env` and set `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` (AI read + Vectorize edit).
2. Run:

```bash
npm run ingest
```

This crawls `https://geosoft.ge`, chunks text, embeds with `@cf/baai/bge-base-en-v1.5`, and upserts into the `geosoft-rag` index. Each run also upserts **curated overview chunks** (`worker/src/geosoft-overview.ts`) so common questions (including Georgian, e.g. what GeoSoft offers) have strong retrieval targets. Re-run ingest after editing that file.

---

## Production deploy

Single Worker serves **both** the API and the static SPA. Vite outputs to **`dist/`** at the repo root; Wrangler uploads that folder as `[assets]` (see `wrangler.toml`).

```bash
npm run build
```

This runs `vite build` (→ `dist/`) then `wrangler deploy` from the repo root.

### Cloudflare Workers (GitHub / CI)

Wrangler **v4** needs the **`dist/`** folder to exist before deploy (Vite writes it). Cloudflare already runs **`npm ci`** (or equivalent) before your custom build command—**do not** put `npm ci &&` in the build command or you install dependencies twice.

**Build command** (pick one):

```bash
npx vite build --config frontend/vite.config.ts
```

This works even if an older `package.json` on GitHub is missing the `build:assets` script. Alternatively, on the latest repo:

```bash
npm run build:assets
```

**Deploy command**:

```bash
npx wrangler deploy
```

If the dashboard has a single “build & deploy” step and you are on the **latest** `package.json` from this repo:

```bash
npm run build
```

(`npm run build` = `build:assets` + `wrangler deploy`.)

**If you see `Missing script: "build:assets"`:** the commit Cloudflare built does not include the current root `package.json`. Push your latest changes to the default branch (or change the Workers build branch), or use the `npx vite build --config frontend/vite.config.ts` build command above.

---

## Environment variables

| Variable | Where | Description |
|----------|-------|-------------|
| `SESSION_SECRET` | `[vars]` locally / `wrangler secret put` in prod | JWT signing key |
| `AUTH_USERNAME` / `AUTH_PASSWORD` | `[vars]` or secrets (optional) | Fallback login only if D1 does not accept that pair (recovery / legacy). Remove in production once all users exist in `app_users`. |
| `CORS_ORIGINS` | `[vars]` (optional) | Comma-separated extra browser `Origin` values allowed with cookies (production domain is built in; add more if needed). |
| *(logins)* | D1 table `app_users` | Primary logins: PBKDF2 password hashes; provision with `npm run user:add` (see Cloudflare setup above) |
| `CLOUDFLARE_ACCOUNT_ID` | `.env` (ingest script only) | Account ID for REST calls |
| `CLOUDFLARE_API_TOKEN` | `.env` (ingest script only) | Token with AI + Vectorize permissions |
| `OPENROUTER_API_KEY` | `wrangler secret put` / `.dev.vars` | [OpenRouter](https://openrouter.ai/) API key for chat |
| `OPENROUTER_HTTP_REFERER` | `wrangler.toml` `[vars]` (optional) | Public URL of your app; sent as `HTTP-Referer` for OpenRouter attribution |
| `OPENROUTER_APP_TITLE` | `wrangler.toml` `[vars]` (optional) | App title for OpenRouter (`X-OpenRouter-Title`) |
| `MAX_CHAT_OUTPUT_TOKENS` | `wrangler.toml` `[vars]` (optional) | Requested max completion tokens (clamped in worker) |

---

## Chat models (OpenRouter)

The selector lists a small curated set from the [OpenRouter model catalog](https://openrouter.ai/models):

| Group | Model ID | Notes |
|-------|----------|--------|
| Google Gemini | `google/gemini-3-flash-preview` | Fast (newer than 2.5 Flash) |
| Google Gemini | `google/gemini-3.1-pro-preview` | Pro (preview) |
| OpenAI GPT | `openai/gpt-5.4-mini` | Fast |
| OpenAI GPT | `openai/gpt-5.4` | Frontier / reasoning-oriented |
| Anthropic Claude | `~anthropic/claude-opus-latest` | Always tracks latest Opus |
| Anthropic Claude | `anthropic/claude-sonnet-4.6` | Sonnet |

To change the lineup, edit `worker/src/models.ts`.

The optional script `npm run models:sync` still updates `worker/src/workers_ai_models.generated.json` for reference only; chat no longer reads that file.

## Notes

- **Vectorize dimensions** must stay **768** for `@cf/baai/bge-base-en-v1.5` unless you recreate the index and re-ingest.
- **Vision**: curated OpenRouter chat models are marked with vision support for image upload in the UI (see `worker/src/models.ts`).
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
