<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import ImageUpload from '../components/ImageUpload.vue'
import LanguageSwitcher from '../components/LanguageSwitcher.vue'
import MessageList, { type UiMsg } from '../components/MessageList.vue'
import ModelSelector, { type UiModel } from '../components/ModelSelector.vue'
import { useI18n } from '../i18n'
import { useAuthStore } from '../stores/auth'
import { useThemeStore } from '../stores/theme'

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
const imageUrl = ref<string | null>(null)
const uploadHint = ref('')

type ApiChat = { id: string; modelId: string; title: string; createdAt: number; updatedAt: number }
const chats = ref<ApiChat[]>([])
const chatsLoading = ref(false)
const activeChatId = ref<string | null>(null)

const uiMessages = ref<UiMsg[]>([])
const thread = ref<{ role: 'user' | 'assistant'; content: string }[]>([])

const thinking = ref(false)
const streamingModelName = ref('')

const listRef = ref<HTMLElement | null>(null)

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
    const firstChat = data.find((m) => m.chatEligible)
    modelId.value = firstChat?.id ?? data[0]?.id ?? ''
  } finally {
    modelsLoading.value = false
  }
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
  if (!r.ok) return
  const data = (await r.json()) as {
    messages: Array<{
      id: string
      role: 'user' | 'assistant'
      content: string
      modelName?: string | null
    }>
  }
  const list = data.messages ?? []
  thread.value = list.map((m) => ({ role: m.role, content: m.content }))
  uiMessages.value = list.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    modelName: m.modelName ?? undefined,
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

function removeImage() {
  imageUrl.value = null
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
  if (!text || !modelId.value) return
  if (!(await ensureActiveChat())) {
    uploadHint.value = t('chat.chat_create_error')
    setTimeout(() => {
      uploadHint.value = ''
    }, 4500)
    return
  }

  const attachedImage = vision.value && imageUrl.value ? imageUrl.value : undefined
  const userMsg: UiMsg = {
    id: crypto.randomUUID(),
    role: 'user',
    content: text,
    imageUrl: attachedImage,
  }
  uiMessages.value.push(userMsg)

  const modelName = selectedModel.value?.name ?? ''
  streamingModelName.value = modelName

  const payloadMessages = [...thread.value, { role: 'user' as const, content: text }]

  draft.value = ''
  thinking.value = true

  const body: Record<string, unknown> = {
    model: modelId.value,
    chatId: activeChatId.value,
    messages: payloadMessages,
    useRag: useRag.value,
  }
  if (imageUrl.value && vision.value) {
    body.imageUrl = imageUrl.value
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

    thread.value.push({ role: 'user', content: text })
    thread.value.push({ role: 'assistant', content: full })
    void loadChats()
  } catch {
    thinking.value = false
    const idx = uiMessages.value.findIndex((m) => m.id === userMsg.id)
    if (idx >= 0) uiMessages.value.splice(idx, 1)
    draft.value = text
    uploadHint.value = t('chat.error')
    setTimeout(() => {
      uploadHint.value = ''
    }, 4500)
  } finally {
    thinking.value = false
    imageUrl.value = null
  }
}
</script>

<template>
  <div class="shell">
    <button class="hamburger" type="button" @click="sidebarOpen = !sidebarOpen" aria-label="Menu">
      ☰
    </button>

    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <div class="brand">
        <div class="logo">{{ t('app.title') }}</div>
      </div>

      <div v-if="modelsLoading" class="muted">{{ t('common.loading') }}</div>
      <ModelSelector v-else v-model:model-id="modelId" :models="models" />

      <div v-if="!modelsLoading && modelId" class="sessions">
        <div class="sessions-head">
          <span class="sessions-title">{{ t('chat.sessions_title') }}</span>
          <button
            type="button"
            class="ghost sm"
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
            <button type="button" class="session-main" @click="selectChat(c.id)">
              <span class="session-title">{{
                c.title.trim() ? c.title : t('chat.session_untitled')
              }}</span>
              <span class="session-meta">{{ formatChatDate(c.updatedAt) }}</span>
            </button>
            <button
              type="button"
              class="ghost danger sm icon"
              :aria-label="t('chat.delete_session')"
              :disabled="thinking"
              @click.stop="deleteChatById(c.id)"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      <label class="rag" :title="t('rag.tooltip')">
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

      <p v-if="!vision" class="hint">{{ t('chat.vision_only') }}</p>
      <ImageUpload v-if="vision" :disabled="thinking" @uploaded="(u) => (imageUrl = u)" @error="onUploadError" />
      <p v-if="uploadHint" class="warn">{{ uploadHint }}</p>
    </aside>

    <div class="backdrop" :class="{ on: sidebarOpen }" @click="sidebarOpen = false" />

    <main class="main">
      <div ref="listRef" class="scroll">
        <MessageList
          :messages="uiMessages"
          :thinking="thinking"
          :streaming-model-name="streamingModelName"
        />
      </div>

      <div v-if="imageUrl && vision" class="preview">
        <img :src="imageUrl" :alt="t('chat.image_preview')" />
        <button type="button" class="x" @click="removeImage">{{ t('chat.remove_image') }}</button>
      </div>

      <div class="composer">
        <textarea
          v-model="draft"
          rows="3"
          class="input"
          :placeholder="t('chat.placeholder')"
          @keydown="onKeydown"
        />
        <button class="send" type="button" :disabled="thinking || !modelId" @click="send">
          {{ t('chat.send') }}
        </button>
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
  grid-template-columns: 320px 1fr;
  position: relative;
  overflow: hidden;
}
.sidebar {
  border-right: 1px solid var(--border);
  background: var(--surface);
  padding: 16px;
  display: grid;
  gap: 14px;
  align-content: start;
  height: 100%;
  min-height: 0;
  overflow: auto;
}
.brand {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.logo {
  font-weight: 800;
  letter-spacing: -0.02em;
}
.muted {
  color: var(--muted);
  font-size: 13px;
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
}
.ghost.icon {
  font-size: 18px;
  line-height: 1;
}
.ghost.sm {
  padding: 6px 10px;
  font-size: 12px;
  border-radius: 10px;
}
.ghost.danger {
  border-color: color-mix(in srgb, var(--danger) 45%, var(--border));
  color: var(--danger);
}
.sessions {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface-2);
  max-height: 220px;
  min-height: 0;
}
.sessions-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.sessions-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.session-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: auto;
  max-height: 160px;
  padding-right: 2px;
}
.session-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px;
  align-items: stretch;
  border-radius: 10px;
  border: 1px solid transparent;
}
.session-row.active {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}
.session-main {
  display: grid;
  gap: 2px;
  text-align: left;
  border: 0;
  background: transparent;
  border-radius: 8px;
  padding: 8px 8px;
  cursor: pointer;
  min-width: 0;
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
.hint,
.warn {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
}
.warn {
  color: var(--danger);
}
.main {
  display: grid;
  grid-template-rows: 1fr auto auto;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}
.scroll {
  min-height: 0;
  overflow: auto;
  padding: 14px 16px 10px;
}
.preview {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px 10px;
}
.preview img {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: 12px;
  border: 1px solid var(--border);
}
.x {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 12px;
  padding: 8px 10px;
  cursor: pointer;
}
.composer {
  flex-shrink: 0;
  border-top: 1px solid var(--border);
  background: var(--surface);
  padding: 12px 16px 16px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: end;
}
.input {
  width: 100%;
  resize: vertical;
  min-height: 92px;
  max-height: 220px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  border-radius: 14px;
  padding: 12px 12px;
  outline: none;
}
.send {
  border: 0;
  border-radius: 14px;
  padding: 12px 14px;
  height: 44px;
  background: linear-gradient(180deg, var(--accent), var(--accent-2));
  color: white;
  font-weight: 700;
  cursor: pointer;
}
.send:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.hamburger {
  display: none;
}
.backdrop {
  display: none;
}
@media (max-width: 900px) {
  .shell {
    grid-template-columns: 1fr;
  }
  .hamburger {
    display: inline-flex;
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 5;
    border: 1px solid var(--border);
    background: var(--surface);
    border-radius: 12px;
    padding: 10px 12px;
    cursor: pointer;
  }
  .sidebar {
    position: fixed;
    z-index: 6;
    width: min(92vw, 360px);
    transform: translateX(-105%);
    transition: transform 160ms ease;
    box-shadow: var(--shadow);
  }
  .sidebar.open {
    transform: translateX(0);
  }
  .backdrop.on {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    z-index: 4;
  }
  .main {
    padding-top: 52px;
  }
}
</style>
