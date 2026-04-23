<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { formatAssistantMessageHtml, isVehicleReportText } from '../lib/carReportHtml'
import { useI18n } from '../i18n'

export type UiMsg = {
  id: string
  role: 'user' | 'assistant'
  content: string
  modelName?: string
  /** Image shown in-thread (e.g. `/api/image/...`); retained after send. */
  imageUrl?: string | null
  /** Multiple images for one user turn */
  imageUrls?: string[]
}

defineProps<{
  messages: UiMsg[]
  thinking: boolean
  streamingModelName?: string
}>()

const { t } = useI18n()

const lightboxUrl = ref<string | null>(null)

let removeEscapeListener: (() => void) | null = null

watch(lightboxUrl, (url) => {
  removeEscapeListener?.()
  removeEscapeListener = null
  if (!url) return
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') lightboxUrl.value = null
  }
  window.addEventListener('keydown', onKey)
  removeEscapeListener = () => window.removeEventListener('keydown', onKey)
})

onUnmounted(() => {
  removeEscapeListener?.()
})

function openLightbox(url: string) {
  lightboxUrl.value = url
}

function closeLightbox() {
  lightboxUrl.value = null
}

function assistantMessageHtml(content: string): string {
  return formatAssistantMessageHtml(content, {
    verdictLabel: t('chat.verdict_eyebrow'),
    gradeSubLabel: t('chat.verdict_grade_sub'),
  })
}

function userThumbs(m: UiMsg): string[] {
  if (m.imageUrls?.length) return m.imageUrls
  if (m.imageUrl) return [m.imageUrl]
  return []
}
</script>

<template>
  <div class="list">
    <div v-if="!messages.length && !thinking" class="empty">{{ t('chat.empty_state') }}</div>

    <div
      v-for="m in messages"
      :key="m.id"
      class="row"
      :class="m.role === 'user' ? 'user' : 'assistant'"
    >
      <div class="meta">{{ m.role === 'user' ? t('chat.you') : m.modelName || t('chat.assistant') }}</div>
      <div
        class="bubble"
        :class="{
          'has-media': m.role === 'user' && userThumbs(m).length,
          'bubble--report': m.role === 'assistant' && isVehicleReportText(m.content),
        }"
      >
        <div v-if="m.role === 'user' && userThumbs(m).length" class="thumb-grid">
          <button
            v-for="(src, i) in userThumbs(m)"
            :key="`${m.id}-img-${i}`"
            type="button"
            class="img-btn"
            :aria-label="t('chat.image_enlarge')"
            @click="openLightbox(src)"
          >
            <img :src="src" class="thumb" alt="" />
          </button>
        </div>
        <div
          v-if="m.role === 'assistant'"
          class="text md"
          :class="{ 'md--report': isVehicleReportText(m.content) }"
          v-html="assistantMessageHtml(m.content)"
        />
        <div v-else-if="m.content" class="text">{{ m.content }}</div>
      </div>
    </div>

    <div v-if="thinking" class="row assistant">
      <div class="meta">{{ streamingModelName || t('chat.assistant') }}</div>
      <div class="bubble skeleton">{{ t('chat.thinking') }}</div>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="lightboxUrl"
      class="lightbox"
      role="dialog"
      aria-modal="true"
      :aria-label="t('chat.image_enlarge')"
      @click.self="closeLightbox"
    >
      <button type="button" class="lightbox-close" :aria-label="t('chat.lightbox_close')" @click="closeLightbox">
        ×
      </button>
      <img :src="lightboxUrl" class="lightbox-img" alt="" />
    </div>
  </Teleport>
</template>

<style scoped>
.list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 4px 20px;
}
.empty {
  color: var(--muted);
  padding: 18px 8px;
  text-align: center;
}
.row {
  display: grid;
  gap: 6px;
  max-width: 920px;
  width: 100%;
}
.row.user {
  margin-left: auto;
  justify-items: end;
}
.row.assistant {
  margin-right: auto;
  /* stretch = full column width; `start` shrinks the bubble to content min-width and breaks nested layout */
  justify-items: stretch;
}
.meta {
  font-size: 12px;
  color: var(--muted);
  padding: 0 6px;
}
.bubble {
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px 14px;
  white-space: pre-wrap;
  line-height: 1.45;
  box-shadow: var(--shadow);
  box-sizing: border-box;
}
.assistant .bubble {
  width: 100%;
  max-width: 100%;
  background: var(--assistant-bubble);
}
.user .bubble {
  max-width: min(100%, 560px);
  background: var(--user-bubble);
}
.bubble.has-media {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: stretch;
}
.thumb-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}
.img-btn {
  display: block;
  padding: 0;
  margin: 0;
  border: 0;
  border-radius: 10px;
  overflow: hidden;
  cursor: zoom-in;
  background: transparent;
  max-width: min(280px, 85vw);
  align-self: flex-end;
}
.thumb {
  display: block;
  width: 100%;
  height: auto;
  max-height: 200px;
  object-fit: contain;
}
.text {
  white-space: pre-wrap;
}
.text.md {
  white-space: normal;
  line-height: 1.55;
}
.text.md :deep(strong) {
  font-weight: 700;
  color: var(--text);
}
.text.md :deep(.ov-grade) {
  font-weight: 800;
  font-size: 1.15em;
  letter-spacing: 0.02em;
}
.text.md :deep(.grade-A) {
  color: #16a34a;
}
.text.md :deep(.grade-B) {
  color: #22c55e;
}
.text.md :deep(.grade-C) {
  color: #ca8a04;
}
.text.md :deep(.grade-D) {
  color: #ea580c;
}
.text.md :deep(.grade-E) {
  color: #dc2626;
}
.text.md :deep(.grade-F) {
  color: #b91c1c;
}
[data-theme='dark'] .text.md :deep(.grade-A) {
  color: #4ade80;
}
[data-theme='dark'] .text.md :deep(.grade-B) {
  color: #86efac;
}
[data-theme='dark'] .text.md :deep(.grade-C) {
  color: #facc15;
}
[data-theme='dark'] .text.md :deep(.grade-D) {
  color: #fb923c;
}
[data-theme='dark'] .text.md :deep(.grade-E) {
  color: #f87171;
}
[data-theme='dark'] .text.md :deep(.grade-F) {
  color: #fca5a5;
}
/* ---------------------------------------------------------------------------
 * Vehicle assessment report — card-based, tone-aware design.
 * ------------------------------------------------------------------------- */

.bubble--report {
  max-width: min(100%, 720px);
  padding: 22px 22px 24px;
  border-radius: 22px;
  border: 1px solid var(--border);
  overflow: hidden;
  background: var(--surface);
  box-shadow:
    0 1px 0 color-mix(in srgb, var(--border) 60%, transparent),
    0 12px 36px color-mix(in srgb, var(--text) 6%, transparent),
    var(--shadow);
}
.md--report {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, 'Noto Sans',
    'BPG Nino Mtavruli', sans-serif;
  font-size: 15px;
  line-height: 1.6;
  letter-spacing: -0.005em;
  overflow-wrap: break-word;
  word-break: normal;
}
.md--report :deep(.cr-report) {
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: 100%;
  min-width: 0;
  max-width: 100%;

  /* Semantic tone palette used by verdict, metrics, and stat accents. */
  --cr-good-1: #34d399;
  --cr-good-2: #059669;
  --cr-good-fg: #047857;
  --cr-ok-1: #60a5fa;
  --cr-ok-2: #2563eb;
  --cr-ok-fg: #1d4ed8;
  --cr-warn-1: #fbbf24;
  --cr-warn-2: #f59e0b;
  --cr-warn-fg: #b45309;
  --cr-bad-1: #f87171;
  --cr-bad-2: #dc2626;
  --cr-bad-fg: #b91c1c;
  --cr-na-fg: color-mix(in srgb, var(--muted) 92%, var(--text));
}
[data-theme='dark'] .md--report :deep(.cr-report) {
  --cr-good-fg: #6ee7b7;
  --cr-ok-fg: #93c5fd;
  --cr-warn-fg: #fcd34d;
  --cr-bad-fg: #fca5a5;
}
.md--report :deep(.cr-gap) {
  display: none; /* block-level gap is handled by cr-report's flex gap now */
}

/* Paragraphs --------------------------------------------------------------- */

.md--report :deep(.cr-para) {
  margin: 0;
  color: var(--text);
  min-width: 0;
  max-width: 68ch; /* keep prose readable, not wall-of-text */
  overflow-wrap: anywhere;
  word-break: break-word;
}
.md--report :deep(.cr-num) {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: color-mix(in srgb, var(--accent) 85%, var(--text));
  padding: 0 2px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

/* Section heading ---------------------------------------------------------- */

.md--report :deep(.cr-heading) {
  margin: 8px 0 -6px; /* tighter gap to the card that follows */
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.md--report :deep(.cr-heading)::before {
  content: '';
  display: inline-block;
  width: 22px;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--accent-2), var(--accent));
}

/* Verdict hero ------------------------------------------------------------- */

.md--report :deep(.cr-verdict) {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 18px;
  padding: 18px 20px;
  border-radius: 18px;
  min-width: 0;

  /* Tone-tinted surface + coloured left rail. */
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--cr-tone-1, var(--accent)) 16%, var(--surface)) 0%,
    color-mix(in srgb, var(--cr-tone-1, var(--accent)) 6%, var(--surface)) 100%
  );
  border: 1px solid color-mix(in srgb, var(--cr-tone-2, var(--accent)) 30%, var(--border));
  box-shadow:
    inset 4px 0 0 0 var(--cr-tone-2, var(--accent)),
    0 6px 18px color-mix(in srgb, var(--cr-tone-2, var(--accent)) 12%, transparent);
}
.md--report :deep(.cr-verdict[data-tone='good']) {
  --cr-tone-1: var(--cr-good-1);
  --cr-tone-2: var(--cr-good-2);
  --cr-tone-fg: var(--cr-good-fg);
}
.md--report :deep(.cr-verdict[data-tone='ok']) {
  --cr-tone-1: var(--cr-ok-1);
  --cr-tone-2: var(--cr-ok-2);
  --cr-tone-fg: var(--cr-ok-fg);
}
.md--report :deep(.cr-verdict[data-tone='warn']) {
  --cr-tone-1: var(--cr-warn-1);
  --cr-tone-2: var(--cr-warn-2);
  --cr-tone-fg: var(--cr-warn-fg);
}
.md--report :deep(.cr-verdict[data-tone='bad']) {
  --cr-tone-1: var(--cr-bad-1);
  --cr-tone-2: var(--cr-bad-2);
  --cr-tone-fg: var(--cr-bad-fg);
}
.md--report :deep(.cr-verdict__badge) {
  display: grid;
  place-items: center;
  width: 68px;
  height: 68px;
  border-radius: 999px;
  font-size: clamp(2rem, 6vw, 2.5rem);
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.04em;
  color: #fff;
  background: linear-gradient(
    145deg,
    var(--cr-tone-1, var(--accent)) 0%,
    var(--cr-tone-2, var(--accent-2)) 100%
  );
  box-shadow:
    0 0 0 4px color-mix(in srgb, var(--cr-tone-2, var(--accent)) 14%, transparent),
    0 8px 20px color-mix(in srgb, var(--cr-tone-2, var(--accent)) 35%, transparent);
}
.md--report :deep(.cr-verdict__body) {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.md--report :deep(.cr-verdict__eyebrow) {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--cr-tone-fg, var(--muted));
}
.md--report :deep(.cr-verdict__sub) {
  margin: 2px 0 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.01em;
}

/* Ratings (metrics) -------------------------------------------------------- */

.md--report :deep(.cr-metrics) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
  gap: 12px;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
.md--report :deep(.cr-metric) {
  --cr-tone-1: var(--accent-2);
  --cr-tone-2: var(--accent);
  --cr-tone-fg: var(--accent);
  margin: 0;
  padding: 14px 16px;
  border-radius: 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: 0 1px 2px color-mix(in srgb, var(--text) 4%, transparent);
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}
.md--report :deep(.cr-metric[data-tone='good']) {
  --cr-tone-1: var(--cr-good-1);
  --cr-tone-2: var(--cr-good-2);
  --cr-tone-fg: var(--cr-good-fg);
}
.md--report :deep(.cr-metric[data-tone='ok']) {
  --cr-tone-1: var(--cr-ok-1);
  --cr-tone-2: var(--cr-ok-2);
  --cr-tone-fg: var(--cr-ok-fg);
}
.md--report :deep(.cr-metric[data-tone='warn']) {
  --cr-tone-1: var(--cr-warn-1);
  --cr-tone-2: var(--cr-warn-2);
  --cr-tone-fg: var(--cr-warn-fg);
}
.md--report :deep(.cr-metric[data-tone='bad']) {
  --cr-tone-1: var(--cr-bad-1);
  --cr-tone-2: var(--cr-bad-2);
  --cr-tone-fg: var(--cr-bad-fg);
}
.md--report :deep(.cr-metric[data-tone='na']) {
  --cr-tone-1: var(--muted);
  --cr-tone-2: var(--muted);
  --cr-tone-fg: var(--cr-na-fg);
}
.md--report :deep(.cr-metric[data-na='1'] .cr-metric__track) {
  opacity: 0.5;
}
.md--report :deep(.cr-metric__row) {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px 10px;
  margin-bottom: 10px;
  min-width: 0;
}
.md--report :deep(.cr-metric__name) {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  min-width: 0;
  flex: 1 1 100px;
  overflow-wrap: anywhere;
  word-break: break-word;
  hyphens: auto;
}
.md--report :deep(.cr-metric__val) {
  font-size: 13px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--cr-tone-fg, var(--accent));
  background: color-mix(in srgb, var(--cr-tone-2, var(--accent)) 12%, transparent);
  padding: 3px 10px;
  border-radius: 999px;
  flex: 0 0 auto;
  overflow-wrap: anywhere;
}
.md--report :deep(.cr-metric__track) {
  height: 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--muted) 22%, transparent);
  overflow: hidden;
}
.md--report :deep(.cr-metric__fill) {
  height: 100%;
  width: calc(var(--cr-metric-pct) * 1%);
  min-width: 4px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    var(--cr-tone-1, var(--accent-2)),
    var(--cr-tone-2, var(--accent))
  );
  transition: width 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.md--report :deep(.cr-metric[data-tone='na'] .cr-metric__fill) {
  background: color-mix(in srgb, var(--muted) 60%, transparent);
}

/* Key specs (stat strip) --------------------------------------------------- */

.md--report :deep(.cr-stats) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
  gap: 12px;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
.md--report :deep(.cr-stat) {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 14px 16px;
  border-radius: 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: 0 1px 2px color-mix(in srgb, var(--text) 4%, transparent);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.md--report :deep(.cr-stat:hover) {
  border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
  box-shadow: 0 4px 14px color-mix(in srgb, var(--accent) 10%, transparent);
}
.md--report :deep(.cr-stat__icon) {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
}
.md--report :deep(.cr-stat__icon svg) {
  width: 20px;
  height: 20px;
  display: block;
}
.md--report :deep(.cr-stat__body) {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1 1 auto;
}
.md--report :deep(.cr-stat__label) {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
  overflow-wrap: anywhere;
}
.md--report :deep(.cr-stat__value) {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  overflow-wrap: anywhere;
  word-break: break-word;
  line-height: 1.4;
}

/* Note (closing paragraph under verdict) ---------------------------------- */

.md--report :deep(.cr-para--note) {
  margin: 4px 0 0;
  padding: 14px 16px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--surface-2) 85%, transparent);
  border: 1px solid var(--border);
  border-left: 3px solid var(--accent);
  font-size: 14px;
  line-height: 1.6;
  color: var(--text);
  overflow-wrap: anywhere;
  max-width: 100%;
}

/* Bullets (fallback) ------------------------------------------------------- */

.md--report :deep(.cr-bullets) {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  margin: 0;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  list-style: none;
}
.md--report :deep(.cr-bullets__item) {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  min-width: 0;
  padding: 7px 2px;
  font-size: 14px;
  line-height: 1.55;
}
.md--report :deep(.cr-bullets__item + .cr-bullets__item) {
  border-top: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
}
.md--report :deep(.cr-bullets__dot) {
  flex: 0 0 auto;
  margin-top: 9px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  opacity: 0.9;
}
.md--report :deep(.cr-bullets__text) {
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
  white-space: normal;
  color: var(--text);
}

/* Narrow bubble tweaks ----------------------------------------------------- */

@media (max-width: 520px) {
  .bubble--report {
    padding: 18px 16px 20px;
    border-radius: 18px;
  }
  .md--report :deep(.cr-verdict) {
    padding: 16px;
    gap: 14px;
  }
  .md--report :deep(.cr-verdict__badge) {
    width: 56px;
    height: 56px;
    font-size: 1.75rem;
  }
  .md--report :deep(.cr-verdict__sub) {
    font-size: 15px;
  }
}
.skeleton {
  animation: pulse 1.2s ease-in-out infinite;
}
@keyframes pulse {
  0% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.55;
  }
}
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(4px);
}
.lightbox-img {
  max-width: min(96vw, 1400px);
  max-height: min(90vh, 1200px);
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.55);
}
.lightbox-close {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 201;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid var(--border, #334155);
  background: var(--surface, #111827);
  color: var(--text, #e5e7eb);
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}
</style>
