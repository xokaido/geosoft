<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from '../i18n'

const { t } = useI18n()

const props = defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  uploaded: [urls: string[]]
  error: [message: string]
}>()

const MAX_FILES = 12
const MAX_BYTES = 10 * 1024 * 1024
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

const uploading = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

function open() {
  if (props.disabled || uploading.value) return
  inputRef.value?.click()
}

async function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  const picked = input.files ? Array.from(input.files) : []
  input.value = ''
  if (!picked.length) return
  const files = picked.slice(0, MAX_FILES)
  for (const file of files) {
    if (!OK_TYPES.includes(file.type)) {
      emit('error', t('upload.invalid_type'))
      return
    }
    if (file.size > MAX_BYTES) {
      emit('error', t('upload.too_large'))
      return
    }
  }
  uploading.value = true
  try {
    const urls: string[] = []
    for (const file of files) {
      const fd = new FormData()
      fd.set('file', file)
      const r = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'include' })
      if (!r.ok) {
        emit('error', t('upload.error'))
        return
      }
      const j = (await r.json()) as { url?: string }
      if (!j.url) {
        emit('error', t('upload.error'))
        return
      }
      urls.push(j.url)
    }
    if (urls.length) emit('uploaded', urls)
  } catch {
    emit('error', t('upload.error'))
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <div class="wrap">
    <input
      ref="inputRef"
      class="hidden"
      type="file"
      multiple
      accept="image/jpeg,image/png,image/webp,image/gif"
      @change="onPick"
    />
    <button type="button" class="btn" :disabled="disabled || uploading" @click="open">
      {{ uploading ? t('upload.uploading') : t('chat.attach_image') }}
    </button>
  </div>
</template>

<style scoped>
.hidden {
  display: none;
}
.btn {
  width: 100%;
  border: 1px dashed var(--border);
  background: transparent;
  border-radius: 10px;
  padding: 10px;
  cursor: pointer;
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
