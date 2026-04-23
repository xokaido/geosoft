# Chat images UX polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make image prompts optional, stop sending placeholder text, add message-scoped image carousel viewing, and rename “GeoSoft AI” to “GeoSoft Cloud”.

**Architecture:** Frontend stops injecting fallback text and can send images-only turns; backend supports images-only multimodal content and uses UI locale (when provided) to force response language when no user text exists. Message rendering uses a lightbox carousel scoped to the clicked message’s image set.

**Tech Stack:** Vue 3 + Pinia (frontend), Cloudflare Worker (Hono) (backend)

---

## File map (what changes where)

- Modify: `frontend/src/views/Chat.vue`
  - Stop using `chat.image_message_placeholder` as outbound message content
  - Send `uiLanguage` (locale) in `/api/chat` request body
  - Add “prompt optional with images” UI hint string usage
- Modify: `frontend/src/components/MessageList.vue`
  - Replace single-image lightbox with carousel state `(urls, index)`
  - Add Prev/Next buttons + arrow-key navigation scoped to current message
- Modify: `frontend/src/i18n/{en,ka,ru}.ts`
  - Rename `app.title` to “GeoSoft Cloud …”
  - Add new `chat.prompt_optional_hint`
  - (Optional) keep `chat.image_message_placeholder` key for compatibility, but unused
- Modify: `frontend/index.html`
  - Update `<title>` to “GeoSoft Cloud …”
- Modify: `worker/src/chat.ts`
  - Accept `uiLanguage` in request body
  - Support images-only user content (no leading text part)
  - Force language instruction from `uiLanguage` when provided (especially for images-only)
- Modify: `worker/src/openrouter.ts`
  - Default OpenRouter title fallback string to “GeoSoft Cloud Chat”
- Modify: `wrangler.toml`
  - Update `OPENROUTER_APP_TITLE` default to “GeoSoft Cloud Chat”

## Task 1: Frontend — stop placeholder fallback, add uiLanguage + hint

**Files:**
- Modify: `frontend/src/views/Chat.vue`
- Modify: `frontend/src/i18n/en.ts`
- Modify: `frontend/src/i18n/ka.ts`
- Modify: `frontend/src/i18n/ru.ts`

- [ ] **Step 1: Update outbound send logic (images-only allowed)**
  - Change `outboundText` to be `text` (no fallback)
  - Keep send enabled when `hasImages` even if text is empty
  - Ensure UI user message renders as images-only (content can be empty string)

- [ ] **Step 2: Send `uiLanguage` with `/api/chat`**
  - In request body add `uiLanguage: locale.value`

- [ ] **Step 3: Add “prompt optional” hint in composer**
  - Add new i18n key `chat.prompt_optional_hint`
  - Render hint when `hasImages` is true (and optionally only when `draft` is empty)

- [ ] **Step 4: Run frontend typecheck/build**
  - Run: `npm -C frontend install`
  - Run: `npm -C frontend run build`
  - Expected: exit code 0

## Task 2: Worker — images-only support + locale-driven language instruction

**Files:**
- Modify: `worker/src/chat.ts`

- [ ] **Step 1: Extend request body parsing**
  - Add `uiLanguage?: 'ka' | 'ru' | 'en'` (string validation)

- [ ] **Step 2: Support images-only multimodal content**
  - Update `buildUserContent(text, imageDataUrls)`:
    - if `text.trim()` is empty, return only `image_url` parts (no `{type:'text'}` part)

- [ ] **Step 3: Use `uiLanguage` to force output language**
  - Add a system message like:
    - ka → “Output language: Georgian (ქართული). Write the entire reply in Georgian.”
    - ru → “Output language: Russian (Русский). Write the entire reply in Russian.”
    - en → “Output language: English. Write the entire reply in English.”
  - Keep existing hidden system prompt; this is a higher-priority explicit instruction for images-only turns.

- [ ] **Step 4: Run worker build**
  - Run: `npm install` (repo root, if applicable)
  - Run: `npm run build` (or `npm -C worker run build` depending on repo scripts)
  - Expected: exit code 0

## Task 3: Frontend — message-only image carousel viewer

**Files:**
- Modify: `frontend/src/components/MessageList.vue`
- Modify: `frontend/src/i18n/{en,ka,ru}.ts` (new labels)

- [ ] **Step 1: Replace `lightboxUrl` with carousel state**
  - State: `{ urls: string[]; index: number } | null`
  - `openLightbox(urls, index)` opens viewer for that message only
  - Next/Prev clamp within `0..urls.length-1`

- [ ] **Step 2: Keyboard navigation**
  - `Escape` closes
  - `ArrowLeft/ArrowRight` prev/next

- [ ] **Step 3: UI controls + labels**
  - Add buttons for Prev/Next + close
  - Show `index + 1` / `total`
  - Add i18n keys (e.g. `chat.lightbox_prev`, `chat.lightbox_next`, `chat.lightbox_counter`)

- [ ] **Step 4: Verify manually**
  - Upload 3+ images → send with empty prompt → open viewer → navigate within that message

## Task 4: Rename GeoSoft AI → GeoSoft Cloud

**Files:**
- Modify: `frontend/src/i18n/en.ts`
- Modify: `frontend/src/i18n/ka.ts`
- Modify: `frontend/src/i18n/ru.ts`
- Modify: `frontend/index.html`
- Modify: `worker/src/openrouter.ts`
- Modify: `wrangler.toml`

- [ ] **Step 1: Update i18n app title**
- [ ] **Step 2: Update HTML `<title>`**
- [ ] **Step 3: Update OpenRouter attribution title default**

## Self-review checklist

- Prompt fallback text never appears in UI or payload.
- Images-only first message still produces a response in the selected UI language (via `uiLanguage`).
- Carousel navigation never crosses message boundaries.
- “GeoSoft Cloud” appears in top-left and document title; OpenRouter title updated.

