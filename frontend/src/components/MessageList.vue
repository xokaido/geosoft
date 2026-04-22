<script setup lang="ts">
import { useI18n } from '../i18n'

export type UiMsg = {
  id: string
  role: 'user' | 'assistant'
  content: string
  modelName?: string
}

defineProps<{
  messages: UiMsg[]
  thinking: boolean
  streamingModelName?: string
}>()

const { t } = useI18n()
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
      <div class="bubble">{{ m.content }}</div>
    </div>

    <div v-if="thinking" class="row assistant">
      <div class="meta">{{ streamingModelName || t('chat.assistant') }}</div>
      <div class="bubble skeleton">{{ t('chat.thinking') }}</div>
    </div>
  </div>
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
</style>
