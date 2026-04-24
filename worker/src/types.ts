export type Env = {
  AI: Ai
  DB: D1Database
  R2: R2Bucket
  VECTORIZE: VectorizeIndex
  ASSETS: Fetcher
  SESSION_SECRET: string
  /** Comma-separated extra `Origin` values (e.g. `https://app.example.com`) for CORS with credentials. */
  CORS_ORIGINS?: string
  /** Optional fallback login (same as pre–D1 users). Checked only if D1 credentials do not match. */
  AUTH_USERNAME?: string
  AUTH_PASSWORD?: string
  /** Max completion tokens for `/api/chat` (string from wrangler vars). */
  MAX_CHAT_OUTPUT_TOKENS?: string
  /** Max assistant characters stored in D1 for `/api/chat` (string from wrangler vars). */
  MAX_ASSISTANT_CHARS?: string
  /** OpenRouter API key (`wrangler secret put OPENROUTER_API_KEY`). */
  OPENROUTER_API_KEY?: string
  /** Optional site URL for OpenRouter app attribution (`HTTP-Referer`). */
  OPENROUTER_HTTP_REFERER?: string
  /** Optional app title for OpenRouter rankings. */
  OPENROUTER_APP_TITLE?: string
}
