<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { useI18n } from '../i18n'

export type UiMsg = {
  id: string
  role: 'user' | 'assistant'
  content: string
  modelName?: string
  /** Image shown in-thread (e.g. `/api/image/...`); retained after send. */
  imageUrl?: string | null
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
      <div class="bubble" :class="{ 'has-media': m.role === 'user' && m.imageUrl }">
        <button
          v-if="m.role === 'user' && m.imageUrl"
          type="button"
          class="img-btn"
          :aria-label="t('chat.image_enlarge')"
          @click="openLightbox(m.imageUrl!)"
        >
          <img :src="m.imageUrl" class="thumb" alt="" />
        </button>
        <div v-if="m.content" class="text">{{ m.content }}</div>
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
.user .bubble {
  background: var(--user-bubble);
}
.assistant .bubble {
  background: var(--assistant-bubble);
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
