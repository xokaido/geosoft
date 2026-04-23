# Chat images UX polish (prompt optional, carousel, rename)

Date: 2026-04-23  
Project: GeoSoft chat UI + worker

## Goals

- Allow sending **images without requiring any prompt text**.
- When prompt text is empty and images are attached, **do not send any fallback text** (send only images).
- Rename product label from **"GeoSoft AI" → "GeoSoft Cloud"**.
- Make browsing multiple uploaded images convenient via an in-place viewer (no close/reopen loops).

## Non-goals

- Changing model/system prompt behavior beyond removing UI-injected fallback text.
- Adding cross-message “gallery mode” navigation.

## Current behavior (problem)

- Frontend currently substitutes `t('chat.image_message_placeholder')` when the draft is empty but images exist, which results in messages like:
  - ka: `(ფოტოები მიმაგრებულია — დაწერეთ რა გსურთ შეფასდეს.)`
  - ru/en equivalents
- This fallback text is included in:
  - the UI’s “user” message bubble
  - the payload to the backend (becoming the model-visible user text)

## Desired behavior

### 1) Send rules (prompt optional with images)

- If **no text** and **no images**: do not send.
- If **text exists**: send text (with any attached images).
- If **images exist** and **text is empty**:
  - Send a user turn with **images only** (no text content part).
  - UI should still render the user message bubble as an “images-only” turn.

### 2) Language handling

- The UI language selection determines UI copy.
- The system prompt is responsible for assistant response language selection; therefore the UI must **not** inject language-specific fallback user text just to drive language.

### 3) Multi-image viewer (message-only)

- Clicking an image thumbnail inside a single user message opens a lightbox viewer.
- The viewer supports:
  - Next/Prev navigation **only within that message’s image set**
  - Arrow keys: Left/Right navigate; Escape closes
  - Optional: display `index/total`
  - Optional: thumbnail strip for quick selection (still scoped to the message)

### 4) Rename “GeoSoft AI” → “GeoSoft Cloud”

- Update UI-visible brand/title strings:
  - i18n `app.title` in `en`, `ka`, `ru`
  - page `<title>` in `frontend/index.html`
- Update server-identifying title used for upstream requests:
  - `OPENROUTER_APP_TITLE` default + fallback string in `worker/src/openrouter.ts`
- Docs/readme naming consistency (optional but recommended).

## Implementation notes (high level)

- Frontend `send()` should stop using `image_message_placeholder` fallback.
- Request payload should preserve an **empty string** (or omit the text message entirely) when images-only.
- Worker `buildUserContent()` must support images-only content without prepending a text block.
- Viewer change is localized to `frontend/src/components/MessageList.vue`:
  - replace `lightboxUrl: string` with a `(urls[], index)` based viewer state.

## Acceptance criteria

- With images attached, user can press Send with an empty textarea.
- The outbound request contains images; it does **not** contain the previous fallback string.
- The user bubble shows images without showing the placeholder sentence.
- In a user message with multiple images, user can click any thumbnail and then navigate next/prev within that message.
- “GeoSoft Cloud” appears in the top-left UI brand and page title.

