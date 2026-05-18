# Model Picker Restriction + Per-Request Cost Tracking

**Date:** 2026-05-18
**Status:** Draft (awaiting review)

## Goal

Two user-facing changes:

1. **Restrict the model picker to Google Gemini Fast and Gemini Pro only.** The other four models in the codebase (GPT-5.4, GPT-5.4 Mini, Claude Opus, Claude Sonnet) stay in source but are hidden from the UI.
2. **Track per-request cost and show it on every assistant reply.** OpenRouter returns `usage.cost` (USD) in the final SSE chunk; we capture it, persist it, render it under the bubble, and sum it per chat in the sidebar.

## Non-Goals

- Account-level / monthly aggregate spend
- GEL or other currency conversion
- Per-user budget alerts
- Time-to-first-token measurement
- Cost-based model auto-selection
- Reintroducing GPT/Claude through any UI affordance

## UX

### Model picker — segmented toggle

Replaces the existing `<select>` `ModelSelector.vue` dropdown with a two-button segmented pill in the top bar:

```
Model  [ ⚡ Fast | ✨ Pro ]
```

- Active button: `var(--surface)` background + subtle shadow, bold label.
- Inactive: transparent on `var(--surface-2)` container.
- `role="radiogroup"` + `role="radio"` + `aria-checked`. Browser-default keyboard navigation (Tab/Enter).
- Data-driven: renders one button per item returned by `/api/models`. Adding a third Gemini variant later is a config change, not a component change.

### Per-reply meta line

Under each assistant bubble (only when usage data is available):

```
1,284 in · 168 out · $0.0014 · 1.2 s
```

- Font: small, `var(--muted)`, tabular numerals.
- Cost gets `var(--accent)` and bold weight (the headline value).
- Cost format: `null` → hidden; `0` → `$0.0000`; `0 < n < 0.0001` → `<$0.0001`; else `$X.XXXX` (4 decimals, USD).
- Token format: `Intl.NumberFormat(locale)` with thousands separator.
- Latency: `< 1000` ms → `423 ms`; else `1.2 s` (one decimal).
- The whole line is hidden when `costUsd`, `promptTokens`, and `completionTokens` are all `null` (old rows, failed parses, etc.). `latencyMs` alone does **not** render the line — without a cost or token count to anchor it, latency is uninformative.

Latency is measured on the **frontend** (`performance.now()` at `send()` → `performance.now()` at stream end). Not persisted, not shown on historical messages — only the current-session reply gets a latency value.

### Sidebar per-chat total

Each chat list item shows the running spend on the right of the title:

```
MikroTik pricing                       $0.0142
12 messages · 2 min ago
```

- Hidden when `totalCostUsd === 0` (avoids a row of `$0.0000` for new chats).
- Active chat gets bold + `var(--accent)`; others get `var(--muted)`.
- Updates optimistically after each new reply finishes streaming — no extra `/api/chats` round-trip.

## Architecture

```
┌─ Frontend ──────────────────────────────────────────────────────────────┐
│  ModelToggle.vue ──► /api/models (filtered list)                        │
│  Chat.vue ──► measures latency, parses {"usage":{…}} SSE frame          │
│  MessageList.vue ──► renders meta line under assistant bubbles          │
│  Sidebar (Chat.vue) ──► totalCostUsd per chat row                       │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─ Worker ────────────────────────────────────────────────────────────────┐
│  /api/models    ──► filters MODELS by chatVisible                       │
│  /api/chats     ──► joins SUM(cost_usd) per chat                        │
│  /api/chat (SSE) ──► tee() upstream; recorder extracts usage from       │
│                       final chunk; transformer emits extra usage frame  │
│                       before [DONE]                                     │
│  /api/chats/:id/messages ──► returns costUsd, promptTokens, etc.        │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─ D1 ────────────────────────────────────────────────────────────────────┐
│  chat_messages + cost_usd REAL, prompt_tokens INTEGER,                  │
│                 completion_tokens INTEGER (all nullable)                │
└─────────────────────────────────────────────────────────────────────────┘
```

## Worker changes

### Model whitelist (`worker/src/models.ts`)

Add `chatVisible: boolean` to `ChatModelMeta`. Set `true` on the two Gemini entries, `false` on the other four. **Do not delete** the other entries — old chats persisted with those IDs must still resolve via `getModelMeta()`.

```ts
export type ChatModelMeta = {
  id: string; slug: string; name: string; task: string
  vision: boolean; chatEligible: boolean; deprecated: boolean
  chatVisible: boolean   // new
}
```

In `worker/src/index.ts`, the `GET /api/models` handler returns `MODELS.filter(m => m.chatVisible)`.

### Usage extraction (`worker/src/openrouter.ts`)

New helper:

```ts
export type Usage = {
  costUsd: number
  promptTokens: number
  completionTokens: number
}

export function extractUsageFromChunk(json: unknown): Usage | null {
  const u = (json as { usage?: unknown }).usage as
    | { cost?: number; prompt_tokens?: number; completion_tokens?: number }
    | undefined
  if (!u) return null
  const { cost, prompt_tokens, completion_tokens } = u
  if (
    !Number.isFinite(cost) ||
    !Number.isFinite(prompt_tokens) ||
    !Number.isFinite(completion_tokens)
  ) return null
  return {
    costUsd: cost as number,
    promptTokens: prompt_tokens as number,
    completionTokens: completion_tokens as number,
  }
}
```

OpenRouter sends `usage` unconditionally in the final SSE chunk and on every non-streaming JSON response. **No new request parameter required.**

### Streaming path (`worker/src/chat.ts`)

Rename `accumulateWorkersAiText` → `accumulateAssistantPayload`. Return type widens:

```ts
async function accumulateAssistantPayload(
  source: ReadableStream<Uint8Array>,
  maxChars: number
): Promise<{ text: string; usage: Usage | null }>
```

The recorder branch already parses every JSON chunk; we add one line per chunk that runs `extractUsageFromChunk(json)` and stashes the last non-null result.

Bridge the two `tee()` branches with a shared promise so the transformer can append a usage frame to the client stream:

```ts
let resolveUsage!: (u: Usage | null) => void
const usagePromise = new Promise<Usage | null>(r => { resolveUsage = r })

const persist = accumulateAssistantPayload(toRecorder, cap).then(({ text, usage }) => {
  resolveUsage(usage)
  return finalizeExchange(c.env.DB, { …rest, assistantContent: text, usage })
})

const out = transformAiSseToTokenSse(toClient, usagePromise)
```

`transformAiSseToTokenSse` gains a second arg. When its source stream ends, it `await`s `usagePromise` and emits one extra row before `[DONE]`:

```
data: {"usage":{"costUsd":0.0014328,"promptTokens":1284,"completionTokens":168}}

data: [DONE]
```

If `usagePromise` resolves to `null` (no usage in the stream), the transformer just emits `[DONE]` with no extra frame.

### Vehicle-report path (`worker/src/chat.ts`)

The non-streaming `openRouterChatJson` response has `usage` at the top level. Extract with the same helper, pass to `finalizeExchange`, include in the JSON response body:

```ts
return c.json({
  message: { id, role: 'assistant', content, modelName, structuredReport: report },
  report,
  usage,   // new — may be null
})
```

### `finalizeExchange` (`worker/src/chats.ts`)

Adds an optional `usage` param:

```ts
export async function finalizeExchange(
  db: D1Database,
  params: {
    chatId: string
    assistantMessageId: string
    assistantContent: string
    modelName: string
    structuredReport?: VehicleInspectionReport
    userPreviewForTitle: string
    usage?: Usage | null   // new
    now: number
  }
): Promise<void>
```

INSERT writes `cost_usd`, `prompt_tokens`, `completion_tokens` as NULL when `usage` is omitted or null, else the numeric values.

### Chats list (`worker/src/chats.ts`)

`handleListChats` query gains a join:

```sql
SELECT c.id, c.model_id AS modelId, c.title,
       c.created_at AS createdAt, c.updated_at AS updatedAt,
       COALESCE(SUM(m.cost_usd), 0) AS totalCostUsd
FROM chats c
LEFT JOIN chat_messages m ON m.chat_id = c.id
WHERE c.user_id = ? AND c.model_id = ?
GROUP BY c.id
ORDER BY c.updated_at DESC LIMIT 100
```

### Messages endpoint (`worker/src/chats.ts`)

`handleGetChatMessages` selects the three new columns and maps them to `costUsd`, `promptTokens`, `completionTokens` (camelCase) in the JSON response.

## Database migration

`worker/migrations/0005_message_usage.sql`:

```sql
ALTER TABLE chat_messages ADD COLUMN cost_usd REAL;
ALTER TABLE chat_messages ADD COLUMN prompt_tokens INTEGER;
ALTER TABLE chat_messages ADD COLUMN completion_tokens INTEGER;
```

Three nullable columns. NULL = "no usage data" (old row, vehicle-report row pre-feature, parse failure, stream cancellation). The UI's meta-line `v-if` correctly hides under that condition.

No index needed — `SUM(cost_usd)` per chat is bounded by `idx_messages_chat_created` already.

## Frontend changes

### New files

- `frontend/src/components/ModelToggle.vue` — segmented-pill model picker (~80 lines including styles).
- `frontend/src/lib/usage-format.ts` — `fmtCost`, `fmtTokens`, `fmtLatency` helpers (pure functions, ~30 lines).

### Modified files

- `frontend/src/views/Chat.vue`
  - Import `ModelToggle` instead of `ModelSelector`.
  - `readTokenStream` extended: when the parsed JSON payload is a non-string object with `.usage`, fire a new `onUsage(usage)` callback instead of `onToken`.
  - Wrap `send()` with `performance.now()` start/end timestamps; pass `latencyMs` along with usage when attaching to the active assistant `UiMsg`.
  - Optimistically bump `chats.value.find(c => c.id === activeChatId.value).totalCostUsd` by the new cost when the stream finishes.
  - Sidebar `<li>`: show `fmtCost(c.totalCostUsd)` on the right (hidden if zero).
  - `ApiChat` type gains `totalCostUsd: number`.

- `frontend/src/components/MessageList.vue`
  - `UiMsg` gains `costUsd?`, `promptTokens?`, `completionTokens?`, `latencyMs?`.
  - New small element under the assistant bubble that renders the meta line when any of the four is non-null.

- `frontend/src/i18n/{en,ka,ru}.ts` — three new nested keys:
  ```ts
  chat: {
    usage: {
      tokens_in: 'in',     // ka: 'შესვლა', ru: 'вх.'
      tokens_out: 'out',   // ka: 'გასვლა', ru: 'исх.'
      cost_below: '<$0.0001',
    },
    total_cost_label: 'Total',
  }
  ```
  Cost and token numbers themselves stay USD-formatted in all locales (no GEL/RUB conversion).

### Untouched

- `frontend/src/components/ModelSelector.vue` — left in place but no longer imported. Easy revert if the toggle doesn't work out; can be deleted in a follow-up once the toggle has shipped.

## Format specifications

| Value | Format | Examples |
|---|---|---|
| `costUsd === null` | hidden | (no span) |
| `costUsd === 0` | `$0.0000` | BYOK |
| `0 < costUsd < 0.0001` | `<$0.0001` | sub-tenth-cent |
| `costUsd >= 0.0001` | `$X.XXXX` (4 dp) | `$0.0014`, `$1.4328` |
| `tokens` | locale thousands separator | `1,284` (en), `1 284` (ka/ru) |
| `latencyMs < 1000` | `N ms` | `423 ms` |
| `latencyMs >= 1000` | `X.X s` | `1.2 s` |
| `totalCostUsd === 0` | hidden | new chats, BYOK |

## Edge cases

- **Final chunk has no `usage`** (provider hiccup): `extractUsageFromChunk` returns `null`, columns stay NULL, meta line hides.
- **Stream canceled by client mid-flight**: recorder finalizes partial text, usage stays `null`. No regression vs. current behavior.
- **Old chat with non-Google `model_id`**: not reachable from the sidebar (which filters by the currently active model, and no toggle button exists for the legacy model). The rows remain in D1 — preserved, not deleted — but effectively hidden from the UI. Acceptable per the "keep in code, hide from UI" decision. The legacy `model_id` still resolves in `getModelMeta()` so backend operations on the row don't crash.
- **BYOK with `cost === 0`**: shows `$0.0000` truthfully. If this becomes visual noise we can hide zero entirely in a follow-up.
- **Vehicle-report path failure** (non-streaming): if upstream JSON has no `usage`, no usage persisted. Meta line hides on that row.

## Testing

No automated test suite exists in this repo today. Manual verification on dev server:

1. Migration applies cleanly via `wrangler d1 migrations apply geosoft-chat-db --local`. Re-running is a no-op.
2. Old chats load — messages render, meta lines absent on historical assistant rows, no console errors.
3. New Gemini Fast text reply — meta line shows all four values, numbers plausible.
4. Short reply ("hi") — cost shows `<$0.0001` (unless BYOK).
5. Vehicle-report path — non-streaming response also renders a meta line.
6. Sidebar total updates without manual refresh; persists across chat switches.
7. Model toggle: Fast↔Pro switches without dropping the chat; keyboard nav (Tab + arrow keys + Enter) works.
8. `GET /api/models` returns exactly 2 entries; `getModelMeta('openai/gpt-5.4')` in the worker still resolves (for old chat compatibility).
9. Stream cancellation: close tab mid-reply, reopen — partial text persisted, usage NULL, meta line hidden.
10. i18n parity: ka and ru both translate `in`/`out` labels; currency stays USD.

## Rollout

Single PR. Order on deploy:

1. `wrangler d1 migrations apply geosoft-chat-db --remote`
2. `npm run deploy`

The reverse order would break inserts (worker writes columns that don't exist yet).

## File summary

**Added**:
- `worker/migrations/0005_message_usage.sql`
- `frontend/src/components/ModelToggle.vue`
- `frontend/src/lib/usage-format.ts`

**Modified**:
- `worker/src/models.ts` (add `chatVisible`)
- `worker/src/index.ts` (filter `/api/models`)
- `worker/src/openrouter.ts` (add `extractUsageFromChunk`)
- `worker/src/chat.ts` (rename accumulator, plumb usage through tee, emit usage SSE frame, vehicle-report usage)
- `worker/src/chats.ts` (`finalizeExchange` usage param, list-chats JOIN, messages endpoint columns)
- `frontend/src/views/Chat.vue` (toggle, latency timing, usage frame parsing, sidebar total)
- `frontend/src/components/MessageList.vue` (meta line, `UiMsg` extension)
- `frontend/src/i18n/{en,ka,ru}.ts` (usage labels)

**Unchanged but kept**:
- `frontend/src/components/ModelSelector.vue` (revert path)
