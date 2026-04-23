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
  return formatAssistantMessageHtml(content)
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
  justify-items: start;
}
.meta {
  font-size: 12px;
  color: var(--muted);
  padding: 0 6px;
}
.bubble {
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px 14px;
  white-space: pre-wrap;
  line-height: 1.45;
  box-shadow: var(--shadow);
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
.user .bubble {
  background: var(--user-bubble);
}
.assistant .bubble {
  background: var(--assistant-bubble);
}
.bubble--report {
  max-width: min(100%, 640px);
  padding: 16px 18px 18px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--border));
  background: linear-gradient(
    165deg,
    color-mix(in srgb, var(--surface) 92%, var(--accent) 8%)) 0%,
    var(--assistant-bubble) 48%
  );
  box-shadow:
    var(--shadow),
    0 0 0 1px color-mix(in srgb, var(--accent) 8%, transparent);
}
.md--report {
  font-size: 15px;
  line-height: 1.58;
}
.md--report :deep(.cr-report) {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.md--report :deep(.cr-gap) {
  height: 10px;
}
.md--report :deep(.cr-para) {
  margin: 0;
  color: var(--text);
}
.md--report :deep(.cr-para--note) {
  margin: 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface-2) 88%, transparent);
  border: 1px solid var(--border);
  font-size: 14px;
  color: var(--muted);
}
.md--report :deep(.cr-verdict) {
  margin: 4px 0 16px;
}
.md--report :deep(.cr-verdict__card) {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 2px;
  padding: 18px 20px 16px;
  border-radius: 16px;
  background: linear-gradient(145deg, color-mix(in srgb, var(--accent) 14%, var(--surface)) 0%, var(--surface-2) 100%);
  border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border));
  box-shadow: 0 8px 28px color-mix(in srgb, var(--accent) 12%, transparent);
}
.md--report :deep(.cr-verdict__eyebrow) {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
}
.md--report :deep(.cr-verdict__grade) {
  margin: 0;
  font-size: clamp(2.5rem, 8vw, 3.25rem);
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.04em;
}
.md--report :deep(.cr-verdict__sub) {
  margin: 4px 0 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
}
.md--report :deep(.cr-verdict--A .cr-verdict__grade) {
  color: #16a34a;
}
.md--report :deep(.cr-verdict--B .cr-verdict__grade) {
  color: #22c55e;
}
.md--report :deep(.cr-verdict--C .cr-verdict__grade) {
  color: #ca8a04;
}
.md--report :deep(.cr-verdict--D .cr-verdict__grade) {
  color: #ea580c;
}
.md--report :deep(.cr-verdict--E .cr-verdict__grade) {
  color: #dc2626;
}
.md--report :deep(.cr-verdict--F .cr-verdict__grade) {
  color: #b91c1c;
}
[data-theme='dark'] .md--report :deep(.cr-verdict--A .cr-verdict__grade) {
  color: #4ade80;
}
[data-theme='dark'] .md--report :deep(.cr-verdict--B .cr-verdict__grade) {
  color: #86efac;
}
[data-theme='dark'] .md--report :deep(.cr-verdict--C .cr-verdict__grade) {
  color: #facc15;
}
[data-theme='dark'] .md--report :deep(.cr-verdict--D .cr-verdict__grade) {
  color: #fb923c;
}
[data-theme='dark'] .md--report :deep(.cr-verdict--E .cr-verdict__grade) {
  color: #f87171;
}
[data-theme='dark'] .md--report :deep(.cr-verdict--F .cr-verdict__grade) {
  color: #fca5a5;
}
.md--report :deep(.cr-metric) {
  margin: 0 0 12px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--surface-2);
  border: 1px solid var(--border);
}
.md--report :deep(.cr-metric[data-na='1'] .cr-metric__track) {
  opacity: 0.35;
}
.md--report :deep(.cr-metric__row) {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.md--report :deep(.cr-metric__name) {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}
.md--report :deep(.cr-metric__val) {
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--accent);
  flex-shrink: 0;
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
  border-radius: 999px;
  background: linear-gradient(90deg, var(--accent-2), var(--accent));
  transition: width 0.35s ease;
}
.md--report :deep(.cr-bullets) {
  margin: 8px 0 12px;
  padding: 12px 14px 12px 12px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--surface-2) 95%, var(--accent) 5%);
  border: 1px solid var(--border);
  list-style: none;
}
.md--report :deep(.cr-bullets__item) {
  position: relative;
  padding: 6px 0 6px 18px;
  font-size: 14px;
  line-height: 1.45;
}
.md--report :deep(.cr-bullets__item + .cr-bullets__item) {
  border-top: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
}
.md--report :deep(.cr-bullets__dot) {
  position: absolute;
  left: 2px;
  top: 14px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  opacity: 0.85;
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
