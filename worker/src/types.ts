export type Env = {
  AI: Ai
  DB: D1Database
  R2: R2Bucket
  VECTORIZE: VectorizeIndex
  ASSETS: Fetcher
  AUTH_USERNAME: string
  AUTH_PASSWORD: string
  SESSION_SECRET: string
  /** Max completion tokens for `/api/chat` (string from wrangler vars). */
  MAX_CHAT_OUTPUT_TOKENS?: string
}
