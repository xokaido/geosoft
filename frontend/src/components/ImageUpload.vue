<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { pickChatImageFiles } from '../lib/chat-image-upload'
import { useI18n } from '../i18n'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    /** `icon` = compact control for toolbars; `block` = full-width dashed control */
    variant?: 'block' | 'icon'
  }>(),
  { variant: 'block' }
)

const isIcon = computed(() => props.variant === 'icon')

const emit = defineEmits<{
  picked: [files: File[]]
}>()

const MAX_FILES = 12

const inputRef = ref<HTMLInputElement | null>(null)
const dropActive = ref(false)

function open() {
  if (props.disabled) return
  inputRef.value?.click()
}

function ingestFiles(files: File[]) {
  const images = pickChatImageFiles(files)
  if (!images.length) {
    return
  }
  const batch = images.slice(0, MAX_FILES)
  emit('picked', batch)
}

async function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  const picked = input.files ? Array.from(input.files) : []
  input.value = ''
  if (!picked.length) return
  ingestFiles(picked)
}

function isFileDrag(dt: DataTransfer | null): boolean {
  return !!dt?.types?.length && Array.from(dt.types).includes('Files')
}

function onDragOver(e: DragEvent) {
  if (props.disabled || !isFileDrag(e.dataTransfer)) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  dropActive.value = true
}

function onDragLeave(e: DragEvent) {
  const wrap = e.currentTarget as HTMLElement
  const rel = e.relatedTarget as Node | null
  if (rel && wrap.contains(rel)) return
  dropActive.value = false
}

async function onDrop(e: DragEvent) {
  dropActive.value = false
  if (props.disabled) return
  e.preventDefault()
  const list = e.dataTransfer?.files
  if (!list?.length) return
  ingestFiles(Array.from(list))
}

function onWindowDragEnd() {
  dropActive.value = false
}

onMounted(() => {
  window.addEventListener('dragend', onWindowDragEnd)
})
onUnmounted(() => {
  window.removeEventListener('dragend', onWindowDragEnd)
})
</script>

<template>
  <div
    class="wrap"
    :class="{ 'wrap--drop': dropActive, 'wrap--icon': isIcon }"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div v-if="dropActive" class="drop-hint" aria-hidden="true">{{ t('chat.drop_images') }}</div>
    <input
      ref="inputRef"
      class="hidden"
      type="file"
      multiple
      accept="image/jpeg,image/png,image/webp,image/gif"
      @change="onPick"
    />
    <button
      v-if="isIcon"
      type="button"
      class="btn btn--icon"
      :disabled="disabled"
      :title="t('chat.attach_image')"
      :aria-label="t('chat.attach_image')"
      @click="open"
    >
      <svg
        class="btn-ico"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <circle cx="8.5" cy="10" r="1.35" fill="currentColor" stroke="none" />
        <path d="M21 15l-5.08-5.08a1.6 1.6 0 0 0-2.26 0L9 14.5" />
      </svg>
    </button>
    <button v-else type="button" class="btn" :disabled="disabled" @click="open">
      {{ t('chat.attach_image') }}
    </button>
  </div>
</template>

<style scoped>
.wrap {
  position: relative;
  border-radius: 12px;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}
.wrap--icon {
  display: inline-flex;
  width: auto;
  align-self: end;
}
.wrap--drop {
  border: 2px dashed color-mix(in srgb, var(--accent) 55%, var(--border));
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}
.drop-hint {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  text-align: center;
  padding: 10px;
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
  pointer-events: none;
  z-index: 1;
  border-radius: 10px;
}
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
  position: relative;
  z-index: 0;
}
.wrap--drop .btn {
  border-color: transparent;
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.btn--icon {
  width: 44px;
  height: 44px;
  min-width: 44px;
  padding: 0;
  display: grid;
  place-items: center;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  flex-shrink: 0;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;
}
.btn--icon:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 10%, var(--surface-2));
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  color: var(--accent);
}
.btn--icon:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 28%, transparent);
}
.wrap--drop .btn--icon {
  border-color: transparent;
  background: color-mix(in srgb, var(--accent) 14%, var(--surface-2));
}
.btn-ico {
  display: block;
}
</style>
