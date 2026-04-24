<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import ImageUpload from '../components/ImageUpload.vue'
import LanguageSwitcher from '../components/LanguageSwitcher.vue'
import MessageList, { type UiMsg } from '../components/MessageList.vue'
import ModelSelector, { type UiModel } from '../components/ModelSelector.vue'
import {
  pickChatImageFiles,
  type ChatImageUploadErrorKey,
  uploadChatImageFilesWithProgress,
  type UploadProgressUpdate,
} from '../lib/chat-image-upload'
import { useI18n } from '../i18n'
import { useAuthStore } from '../stores/auth'
import { useThemeStore } from '../stores/theme'

const GEMINI_FAST_MODEL_ID = 'google/gemini-3-flash-preview'
const MAX_IMAGES = 12

const router = useRouter()
const { t, locale } = useI18n()
const auth = useAuthStore()
const theme = useThemeStore()

const sidebarOpen = ref(false)
const models = ref<UiModel[]>([])
const modelsLoading = ref(true)
const modelId = ref('')
const useRag = ref(false)
const draft = ref('')
const imageUrls = ref<string[]>([])
const uploadHint = ref('')
const renameChatId = ref<string | null>(null)
const renameDraft = ref('')

type UploadItem = {
  id: string
  name: string
  progress: number
  status: 'queued' | 'uploading' | 'done' | 'error'
}
const uploadItems = ref<UploadItem[]>([])
const uploadBusy = ref(false)

type ApiChat = { id: string; modelId: string; title: string; createdAt: number; updatedAt: number }
const chats = ref<ApiChat[]>([])
const chatsLoading = ref(false)
const activeChatId = ref<string | null>(null)

const uiMessages = ref<UiMsg[]>([])
const thread = ref<{ role: 'user' | 'assistant'; content: string }[]>([])

const thinking = ref(false)
const streamingModelName = ref('')

const listRef = ref<HTMLElement | null>(null)
const dragOverZone = ref<null | 'messages' | 'composer'>(null)
const dropUploading = computed(() => uploadBusy.value)

const selectedModel = computed(() => models.value.find((m) => m.id === modelId.value))
const vision = computed(
  () => !!selectedModel.value?.vision && !!selectedModel.value?.chatEligible
)

function formatChatDate(ts: number): string {
  const loc = locale.value === 'ka' ? 'ka-GE' : locale.value === 'ru' ? 'ru-RU' : 'en-US'
  return new Date(ts).toLocaleString(loc, { dateStyle: 'short', timeStyle: 'short' })
}

onMounted(async () => {
  try {
    const r = await fetch('/api/models', { credentials: 'include' })
    if (!r.ok) {
      await router.push('/login')
      return
    }
    const data = (await r.json()) as UiModel[]
    models.value = data
    const fast = data.find((m) => m.id === GEMINI_FAST_MODEL_ID && m.chatEligible)
    const firstChat = data.find((m) => m.chatEligible)
    modelId.value = fast?.id ?? firstChat?.id ?? data[0]?.id ?? ''
  } finally {
    modelsLoading.value = false
  }
})

function clearDropZone() {
  dragOverZone.value = null
}

onMounted(() => {
  window.addEventListener('dragend', clearDropZone)
})
onUnmounted(() => {
  window.removeEventListener('dragend', clearDropZone)
})

watch(
  [modelId, modelsLoading],
  async ([id, loading]) => {
    if (loading || !id) return
    await hydrateSessionForModel()
  },
  { flush: 'post' }
)

async function loadChats() {
  if (!modelId.value) return
  chatsLoading.value = true
  try {
    const r = await fetch(`/api/chats?modelId=${encodeURIComponent(modelId.value)}`, {
      credentials: 'include',
    })
    if (!r.ok) {
      chats.value = []
      return
    }
    const data = (await r.json()) as { chats: ApiChat[] }
    chats.value = data.chats ?? []
  } finally {
    chatsLoading.value = false
  }
}

async function loadMessages(chatId: string) {
  const r = await fetch(`/api/chats/${encodeURIComponent(chatId)}/messages`, {
    credentials: 'include',
  })
  if (chatId !== activeChatId.value) return
  if (!r.ok) {
    uploadHint.value = t('chat.load_history_error')
    setTimeout(() => {
      uploadHint.value = ''
    }, 5000)
    return
  }
  const data = (await r.json()) as {
    messages: Array<{
      id: string
      role: 'user' | 'assistant'
      content: string
      modelName?: string | null
      imageUrls?: string[]
    }>
  }
  if (chatId !== activeChatId.value) return
  const list = data.messages ?? []
  thread.value = list.map((m) => ({ role: m.role, content: m.content }))
  uiMessages.value = list.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    modelName: m.modelName ?? undefined,
    imageUrls: m.imageUrls?.length ? [...m.imageUrls] : undefined,
  }))
}

async function hydrateSessionForModel() {
  if (!modelId.value || modelsLoading.value) return
  await loadChats()
  if (chats.value.length === 0) {
    activeChatId.value = null
    thread.value = []
    uiMessages.value = []
    return
  }
  const keep =
    activeChatId.value !== null && chats.value.some((c) => c.id === activeChatId.value)
  if (!keep) {
    activeChatId.value = chats.value[0].id
  }
  await loadMessages(activeChatId.value!)
}

async function ensureActiveChat(): Promise<boolean> {
  if (activeChatId.value) return true
  const r = await fetch('/api/chats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ modelId: modelId.value }),
  })
  if (!r.ok) return false
  const j = (await r.json()) as { id: string }
  activeChatId.value = j.id
  await loadChats()
  return true
}

async function createNewChat() {
  if (!modelId.value || thinking.value) return
  const r = await fetch('/api/chats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ modelId: modelId.value }),
  })
  if (!r.ok) {
    uploadHint.value = t('chat.chat_create_error')
    setTimeout(() => {
      uploadHint.value = ''
    }, 4500)
    return
  }
  const j = (await r.json()) as { id: string }
  activeChatId.value = j.id
  thread.value = []
  uiMessages.value = []
  await loadChats()
  sidebarOpen.value = false
}

async function selectChat(id: string) {
  if (thinking.value || id === activeChatId.value) return
  activeChatId.value = id
  await loadMessages(id)
  sidebarOpen.value = false
}

async function deleteChatById(id: string) {
  if (thinking.value) return
  const r = await fetch(`/api/chats/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!r.ok) return
  if (activeChatId.value === id) {
    activeChatId.value = null
    thread.value = []
    uiMessages.value = []
  }
  await loadChats()
  if (!activeChatId.value && chats.value.length > 0) {
    activeChatId.value = chats.value[0].id
    await loadMessages(activeChatId.value)
  }
}

watch(
  () => uiMessages.value.length,
  async () => {
    await nextTick()
    listRef.value?.scrollTo({ top: listRef.value.scrollHeight, behavior: 'smooth' })
  }
)

async function logout() {
  await auth.logout()
  await router.push('/login')
}

function onUploadError(msg: string) {
  uploadHint.value = msg
  setTimeout(() => {
    uploadHint.value = ''
  }, 3500)
}

function onImagesUploaded(urls: string[]) {
  const next = [...imageUrls.value]
  for (const u of urls) {
    if (next.length >= MAX_IMAGES) break
    next.push(u)
  }
  imageUrls.value = next
}

function removeImageAt(i: number) {
  imageUrls.value = imageUrls.value.filter((_, idx) => idx !== i)
}

function mapUploadErr(key: ChatImageUploadErrorKey): string {
  if (key === 'invalid_type') return t('upload.invalid_type')
  if (key === 'too_large') return t('upload.too_large')
  return t('upload.error')
}

function applyUploadUpdate(u: UploadProgressUpdate) {
  const idx = uploadItems.value.findIndex((x) => x.id === u.id)
  const item: UploadItem = {
    id: u.id,
    name: u.file.name || `image-${u.index + 1}`,
    progress: u.percent,
    status: u.status,
  }
  if (idx >= 0) uploadItems.value[idx] = item
  else uploadItems.value.push(item)
}

async function uploadAndAttach(files: File[]) {
  if (!vision.value || thinking.value || uploadBusy.value) return
  const room = MAX_IMAGES - imageUrls.value.length
  if (room <= 0) {
    onUploadError(t('chat.max_images_reached'))
    return
  }
  const images = pickChatImageFiles(files)
  if (!images.length) {
    onUploadError(t('upload.invalid_type'))
    return
  }
  const batch = images.slice(0, room)
  uploadBusy.value = true
  uploadItems.value = []
  try {
    const result = await uploadChatImageFilesWithProgress(batch, applyUploadUpdate)
    if ('error' in result) {
      onUploadError(mapUploadErr(result.error))
      return
    }
    if (result.urls.length) onImagesUploaded(result.urls)
  } catch {
    onUploadError(t('upload.error'))
  } finally {
    uploadBusy.value = false
    setTimeout(() => {
      if (!uploadBusy.value) uploadItems.value = []
    }, 1500)
  }
}

function isFileDrag(dt: DataTransfer | null): boolean {
  return !!dt?.types?.length && Array.from(dt.types).includes('Files')
}

function onDragOverZone(e: DragEvent, zone: 'messages' | 'composer') {
  if (!vision.value || thinking.value || dropUploading.value) return
  if (!isFileDrag(e.dataTransfer)) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  dragOverZone.value = zone
}

function onDragLeaveZone(e: DragEvent, zone: 'messages' | 'composer') {
  const cur = e.currentTarget as HTMLElement
  const rel = e.relatedTarget as Node | null
  if (rel && cur.contains(rel)) return
  if (dragOverZone.value === zone) dragOverZone.value = null
}

async function onDropZone(e: DragEvent, _zone: 'messages' | 'composer') {
  dragOverZone.value = null
  if (!vision.value || thinking.value) return
  e.preventDefault()
  const raw = e.dataTransfer?.files
  if (!raw?.length) return
  await uploadAndAttach(Array.from(raw))
}

function openRename(c: ApiChat) {
  renameChatId.value = c.id
  renameDraft.value = c.title.trim() ? c.title : ''
}

function cancelRename() {
  renameChatId.value = null
  renameDraft.value = ''
}

async function saveRename() {
  const id = renameChatId.value
  if (!id) return
  const title = renameDraft.value.trim().slice(0, 200)
  const r = await fetch(`/api/chats/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ title }),
  })
  if (!r.ok) {
    uploadHint.value = t('chat.error')
    setTimeout(() => {
      uploadHint.value = ''
    }, 4000)
    return
  }
  cancelRename()
  await loadChats()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    void send()
  }
}

async function readTokenStream(resp: Response, onToken: (t: string) => void) {
  const reader = resp.body?.getReader()
  if (!reader) throw new Error('no_body')
  const dec = new TextDecoder()
  let buf = ''

  const consumeLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) return false
    const payload = trimmed.slice(5).trim()
    if (payload === '[DONE]') return true
    try {
      const v = JSON.parse(payload) as unknown
      if (typeof v === 'string' && v.length) onToken(v)
    } catch {
      // ignore
    }
    return false
  }

  const drain = (flushPartial: boolean) => {
    for (;;) {
      const i = buf.indexOf('\n')
      if (i < 0) break
      let row = buf.slice(0, i)
      buf = buf.slice(i + 1)
      if (row.endsWith('\r')) row = row.slice(0, -1)
      if (consumeLine(row)) return true
    }
    if (flushPartial && buf.trim()) {
      const t = buf.trim()
      buf = ''
      if (consumeLine(t)) return true
    }
    return false
  }

  while (true) {
    const { done, value } = await reader.read()
    if (value) {
      buf += dec.decode(value, { stream: true })
      if (drain(false)) return
    }
    if (done) {
      buf += dec.decode()
      if (drain(true)) return
      break
    }
  }
}

async function send() {
  const text = draft.value.trim()
  const hasImages = vision.value && imageUrls.value.length > 0
  if ((!text && !hasImages) || !modelId.value) return
  const outboundText = text
  const savedImageUrls = [...imageUrls.value]
  if (!(await ensureActiveChat())) {
    uploadHint.value = t('chat.chat_create_error')
    setTimeout(() => {
      uploadHint.value = ''
    }, 4500)
    return
  }

  const attached = vision.value && imageUrls.value.length ? [...imageUrls.value] : []
  const userMsg: UiMsg = {
    id: crypto.randomUUID(),
    role: 'user',
    content: outboundText,
    imageUrls: attached.length ? attached : undefined,
  }
  uiMessages.value.push(userMsg)

  const modelName = selectedModel.value?.name ?? ''
  streamingModelName.value = modelName

  const payloadMessages = [...thread.value, { role: 'user' as const, content: outboundText }]

  draft.value = ''
  thinking.value = true
  let clearUploadedImages = true

  const body: Record<string, unknown> = {
    model: modelId.value,
    chatId: activeChatId.value,
    messages: payloadMessages,
    useRag: useRag.value,
    uiLanguage: locale.value,
  }
  if (imageUrls.value.length && vision.value) {
    body.imageUrls = [...imageUrls.value]
  }

  let assistantId: string | null = null
  let full = ''
  try {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      throw new Error((j as { error?: string }).error || 'chat_failed')
    }
    if (!r.body) throw new Error('no_body')

    await readTokenStream(r, (piece) => {
      full += piece
      if (!assistantId) {
        assistantId = crypto.randomUUID()
        uiMessages.value.push({
          id: assistantId,
          role: 'assistant',
          content: full,
          modelName,
        })
        thinking.value = false
        return
      }
      const last = uiMessages.value.find((m) => m.id === assistantId)
      if (last) last.content = full
    })

    if (!assistantId) {
      assistantId = crypto.randomUUID()
      uiMessages.value.push({
        id: assistantId,
        role: 'assistant',
        content: '',
        modelName,
      })
    }

    thread.value.push({ role: 'user', content: outboundText })
    thread.value.push({ role: 'assistant', content: full })
    void loadChats()
  } catch {
    thinking.value = false
    clearUploadedImages = false
    const idx = uiMessages.value.findIndex((m) => m.id === userMsg.id)
    if (idx >= 0) uiMessages.value.splice(idx, 1)
    draft.value = text
    imageUrls.value = savedImageUrls
    uploadHint.value = t('chat.error')
    setTimeout(() => {
      uploadHint.value = ''
    }, 4500)
  } finally {
    thinking.value = false
    if (clearUploadedImages) imageUrls.value = []
  }
}
</script>

<template>
  <div class="shell">
    <button class="hamburger" type="button" @click="sidebarOpen = !sidebarOpen" aria-label="Menu">
      <span class="hamburger-lines" aria-hidden="true" />
    </button>

    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <div class="brand">
        <div class="logo">{{ t('app.title') }}</div>
      </div>

      <div v-if="modelsLoading" class="muted">{{ t('common.loading') }}</div>
      <template v-else>
        <div class="model-wrap--hidden">
          <ModelSelector v-model:model-id="modelId" :models="models" />
        </div>
        <div v-if="selectedModel" class="model-pill">
          <span class="pill-k">{{ t('chat.model_current') }}</span>
          <span class="pill-v">{{ selectedModel.name }}</span>
        </div>
      </template>

      <div v-if="!modelsLoading && modelId" class="sessions">
        <div class="sessions-head">
          <span class="sessions-title">{{ t('chat.sessions_title') }}</span>
          <button
            type="button"
            class="btn-new-chat"
            :disabled="thinking"
            :title="t('chat.new_session')"
            @click="createNewChat"
          >
            + {{ t('chat.new_session') }}
          </button>
        </div>
        <div v-if="chatsLoading" class="muted">{{ t('common.loading') }}</div>
        <div v-else class="session-list">
          <div
            v-for="c in chats"
            :key="c.id"
            class="session-row"
            :class="{ active: c.id === activeChatId }"
          >
            <template v-if="renameChatId === c.id">
              <div class="rename-box">
                <input
                  v-model="renameDraft"
                  class="rename-input"
                  type="text"
                  maxlength="200"
                  :placeholder="t('chat.rename_placeholder')"
                  @keydown.enter.prevent="saveRename"
                  @keydown.escape.prevent="cancelRename"
                />
                <div class="rename-actions">
                  <button type="button" class="btn-tiny primary" @click="saveRename">
                    {{ t('chat.rename_save') }}
                  </button>
                  <button type="button" class="btn-tiny" @click="cancelRename">
                    {{ t('chat.rename_cancel') }}
                  </button>
                </div>
              </div>
            </template>
            <template v-else>
              <button type="button" class="session-main" @click="selectChat(c.id)">
                <span class="session-title">{{
                  c.title.trim() ? c.title : t('chat.session_untitled')
                }}</span>
                <span class="session-meta">{{ formatChatDate(c.updatedAt) }}</span>
              </button>
              <div class="session-actions">
                <button
                  type="button"
                  class="icon-btn"
                  :aria-label="t('chat.rename_session')"
                  :disabled="thinking"
                  @click.stop="openRename(c)"
                >
                  ✎
                </button>
                <button
                  type="button"
                  class="icon-btn danger"
                  :aria-label="t('chat.delete_session')"
                  :disabled="thinking"
                  @click.stop="deleteChatById(c.id)"
                >
                  ×
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>

      <label class="rag rag--hidden" :title="t('rag.tooltip')">
        <input v-model="useRag" type="checkbox" />
        <span>{{ t('rag.label') }}</span>
      </label>

      <LanguageSwitcher />

      <div class="row2">
        <button
          class="ghost icon"
          type="button"
          :aria-label="theme.theme === 'dark' ? t('nav.theme.light') : t('nav.theme.dark')"
          :title="theme.theme === 'dark' ? t('nav.theme.light') : t('nav.theme.dark')"
          @click="theme.toggle()"
        >
          {{ theme.theme === 'dark' ? '☀️' : '🌙' }}
        </button>
        <button class="ghost" type="button" @click="logout">{{ t('nav.logout') }}</button>
      </div>

    </aside>

    <div class="backdrop" :class="{ on: sidebarOpen }" @click="sidebarOpen = false" />

    <main class="main">
      <div
        ref="listRef"
        class="scroll drop-zone"
        :class="{ 'drop-zone--active': dragOverZone === 'messages' }"
        @dragover.capture="onDragOverZone($event, 'messages')"
        @dragleave="onDragLeaveZone($event, 'messages')"
        @drop.capture="onDropZone($event, 'messages')"
      >
        <div
          v-if="dragOverZone === 'messages' && vision"
          class="drop-overlay"
          aria-hidden="true"
        >
          {{ dropUploading ? t('upload.uploading') : t('chat.drop_images') }}
        </div>
        <MessageList
          :messages="uiMessages"
          :thinking="thinking"
          :streaming-model-name="streamingModelName"
        />
      </div>

      <div v-if="imageUrls.length && vision" class="preview-strip">
        <div v-for="(src, i) in imageUrls" :key="src + i" class="preview-tile">
          <img :src="src" :alt="t('chat.image_preview')" />
          <button type="button" class="preview-x" :aria-label="t('chat.remove_image')" @click="removeImageAt(i)">
            ×
          </button>
        </div>
      </div>

      <div
        class="composer drop-zone"
        :class="{ 'drop-zone--active': dragOverZone === 'composer' }"
        @dragover.capture="onDragOverZone($event, 'composer')"
        @dragleave="onDragLeaveZone($event, 'composer')"
        @drop.capture="onDropZone($event, 'composer')"
      >
        <div
          v-if="dragOverZone === 'composer' && vision"
          class="drop-overlay drop-overlay--composer"
          aria-hidden="true"
        >
          {{ dropUploading ? t('upload.uploading') : t('chat.drop_images') }}
        </div>
        <div class="composer-inner">
          <div class="composer-grow">
            <div class="composer-field" :class="{ 'composer-field--solo': !vision }">
              <ImageUpload
                v-if="vision"
                variant="icon"
                :disabled="thinking || uploadBusy"
                @picked="uploadAndAttach"
              />
              <div class="composer-input-col">
                <textarea
                  v-model="draft"
                  rows="3"
                  class="input"
                  :placeholder="t('chat.placeholder')"
                  @keydown="onKeydown"
                />
                <p v-if="uploadHint" class="composer-feedback warn">{{ uploadHint }}</p>
                <div v-else-if="uploadItems.length" class="upload-queue" aria-live="polite">
                  <div class="upload-queue-head">{{ t('upload.uploading') }}</div>
                  <div v-for="u in uploadItems" :key="u.id" class="upload-row">
                    <div class="upload-name" :title="u.name">{{ u.name }}</div>
                    <div
                      class="upload-bar"
                      role="progressbar"
                      :aria-valuenow="u.progress"
                      aria-valuemin="0"
                      aria-valuemax="100"
                    >
                      <div class="upload-bar-fill" :style="{ width: `${u.progress}%` }" />
                    </div>
                    <div class="upload-pct">{{ u.status === 'done' ? '100%' : `${u.progress}%` }}</div>
                  </div>
                </div>
                <p v-else-if="vision && imageUrls.length" class="composer-feedback composer-hint">
                  {{ t('chat.prompt_optional_hint') }}
                </p>
                <p v-else-if="!vision" class="composer-feedback composer-hint">
                  {{ t('chat.vision_only') }}
                </p>
              </div>
            </div>
          </div>
          <button class="send" type="button" :disabled="thinking || !modelId" @click="send">
            {{ t('chat.send') }}
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.shell {
  flex: 1;
  min-height: 0;
  height: 100%;
  max-height: 100dvh;
  display: grid;
  grid-template-columns: minmax(300px, 360px) 1fr;
  position: relative;
  overflow: hidden;
  background: var(--bg);
}
.sidebar {
  border-right: 1px solid var(--border);
  background: var(--surface);
  padding: 18px 16px 20px;
  display: grid;
  gap: 16px;
  align-content: start;
  height: 100%;
  min-height: 0;
  overflow: auto;
  scrollbar-gutter: stable;
}
.brand {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 2px;
  border-bottom: 1px solid var(--border);
}
.logo {
  font-weight: 800;
  letter-spacing: -0.03em;
  font-size: 1.05rem;
}
.muted {
  color: var(--muted);
  font-size: 13px;
}
.model-wrap--hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.model-pill {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  font-size: 13px;
}
.pill-k {
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.pill-v {
  font-weight: 650;
  text-align: right;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rag {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface-2);
  font-size: 13px;
  line-height: 1.35;
}
.rag--hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.row2 {
  display: grid;
  gap: 8px;
}
.ghost {
  border: 1px solid var(--border);
  background: transparent;
  border-radius: 12px;
  padding: 10px 10px;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}
.ghost:hover {
  background: color-mix(in srgb, var(--surface-2) 80%, transparent);
}
.ghost.icon {
  font-size: 18px;
  line-height: 1;
}
.sessions {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface-2);
  max-height: 260px;
  min-height: 0;
}
.sessions-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.sessions-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.btn-new-chat {
  border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border));
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
  border-radius: 10px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease;
}
.btn-new-chat:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 16%, transparent);
}
.btn-new-chat:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.session-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: auto;
  max-height: 200px;
  padding-right: 2px;
}
.session-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px;
  align-items: stretch;
  border-radius: 11px;
  border: 1px solid transparent;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}
.session-row.active {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
  background: color-mix(in srgb, var(--accent) 11%, transparent);
}
.session-main {
  display: grid;
  gap: 2px;
  text-align: left;
  border: 0;
  background: transparent;
  border-radius: 9px;
  padding: 9px 8px;
  cursor: pointer;
  min-width: 0;
}
.session-main:hover {
  background: color-mix(in srgb, var(--surface) 65%, transparent);
}
.session-title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.session-meta {
  font-size: 11px;
  color: var(--muted);
}
.session-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 4px 4px 0;
}
.icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  color: var(--muted);
  transition:
    background 0.15s ease,
    color 0.15s ease;
}
.icon-btn:hover:not(:disabled) {
  background: var(--surface-2);
  color: var(--text);
}
.icon-btn.danger:hover:not(:disabled) {
  color: var(--danger);
  border-color: color-mix(in srgb, var(--danger) 35%, var(--border));
}
.icon-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.rename-box {
  grid-column: 1 / -1;
  display: grid;
  gap: 8px;
  padding: 8px;
}
.rename-input {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 10px;
  background: var(--surface);
  font-size: 13px;
  outline: none;
}
.rename-actions {
  display: flex;
  gap: 8px;
}
.btn-tiny {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 10px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.btn-tiny.primary {
  border-color: transparent;
  background: linear-gradient(180deg, var(--accent), var(--accent-2));
  color: #fff;
}
.main {
  display: grid;
  grid-template-rows: 1fr auto auto;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  background: var(--bg);
}
.scroll {
  min-height: 0;
  overflow: auto;
  padding: 20px 20px 12px;
  position: relative;
}
.drop-zone {
  position: relative;
}
.drop-zone--active {
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--accent) 55%, transparent);
}
.drop-overlay {
  position: absolute;
  inset: 10px;
  z-index: 3;
  display: grid;
  place-items: center;
  text-align: center;
  padding: 16px;
  font-size: 14px;
  font-weight: 700;
  color: var(--accent);
  border: 2px dashed color-mix(in srgb, var(--accent) 60%, var(--border));
  border-radius: 18px;
  background: color-mix(in srgb, var(--accent) 12%, var(--surface));
  pointer-events: none;
}
.drop-overlay--composer {
  inset: 8px;
  border-radius: 16px;
  font-size: 13px;
}
.composer.drop-zone {
  position: relative;
}
.composer-inner .input,
.composer-inner .send {
  position: relative;
  z-index: 1;
}
.composer-inner {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: end;
  min-width: 0;
}
.composer-grow {
  min-width: 0;
}
.composer-input-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.composer-field {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  align-items: end;
  min-width: 0;
}
.composer-field--solo {
  grid-template-columns: 1fr;
}
.composer-feedback {
  margin: 0;
  font-size: 12px;
  line-height: 1.35;
  padding: 0 2px;
}
.composer-hint {
  color: var(--muted);
}
.composer-feedback.warn {
  color: var(--danger);
}
.upload-queue {
  display: grid;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--surface-2) 80%, transparent);
}
.upload-queue-head {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--muted);
}
.upload-row {
  display: grid;
  grid-template-columns: 1fr 140px auto;
  gap: 10px;
  align-items: center;
  min-width: 0;
}
.upload-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}
.upload-bar {
  height: 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--border) 60%, transparent);
  overflow: hidden;
}
.upload-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
  width: 0%;
  transition: width 0.12s ease;
}
.upload-pct {
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
}
.preview-strip {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 0 20px 12px;
  align-items: flex-start;
}
.preview-tile {
  position: relative;
  width: 76px;
  height: 76px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
}
.preview-tile img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.preview-x {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  border: 0;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  display: grid;
  place-items: center;
}
.composer {
  flex-shrink: 0;
  border-top: 1px solid var(--border);
  background: var(--surface);
  padding: 14px 20px 18px;
  box-shadow: 0 -8px 24px rgba(15, 23, 42, 0.04);
}
[data-theme='dark'] .composer {
  box-shadow: 0 -8px 28px rgba(0, 0, 0, 0.35);
}
.input {
  width: 100%;
  resize: vertical;
  min-height: 96px;
  max-height: 240px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  border-radius: 16px;
  padding: 14px 14px;
  outline: none;
  line-height: 1.5;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.input:focus {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent);
}
.send {
  border: 0;
  border-radius: 14px;
  padding: 12px 18px;
  min-height: 44px;
  background: linear-gradient(180deg, var(--accent), var(--accent-2));
  color: white;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 6px 16px color-mix(in srgb, var(--accent) 35%, transparent);
  transition:
    transform 0.12s ease,
    filter 0.12s ease;
}
.send:hover:not(:disabled) {
  filter: brightness(1.05);
}
.send:active:not(:disabled) {
  transform: translateY(1px);
}
.send:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: none;
}
.hamburger {
  display: none;
}
.hamburger-lines {
  width: 18px;
  height: 2px;
  border-radius: 2px;
  background: var(--text);
  position: relative;
}
.hamburger-lines::before,
.hamburger-lines::after {
  content: '';
  position: absolute;
  left: 0;
  width: 18px;
  height: 2px;
  border-radius: 2px;
  background: var(--text);
}
.hamburger-lines::before {
  top: -6px;
}
.hamburger-lines::after {
  top: 6px;
}
.backdrop {
  display: none;
}
@media (max-width: 900px) {
  .shell {
    grid-template-columns: 1fr;
  }
  .hamburger {
    display: inline-grid;
    place-items: center;
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 5;
    border: 1px solid var(--border);
    background: var(--surface);
    border-radius: 12px;
    width: 44px;
    height: 44px;
    padding: 0;
    cursor: pointer;
    box-shadow: var(--shadow);
  }
  .sidebar {
    position: fixed;
    z-index: 6;
    width: min(94vw, 380px);
    transform: translateX(-105%);
    transition: transform 180ms cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: var(--shadow);
  }
  .sidebar.open {
    transform: translateX(0);
  }
  .backdrop.on {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.4);
    backdrop-filter: blur(2px);
    z-index: 4;
  }
  .main {
    padding-top: 56px;
  }
}
</style>
