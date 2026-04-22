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
const { t } = useI18n()
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

const uiMessages = ref<UiMsg[]>([])
const thread = ref<{ role: 'user' | 'assistant'; content: string }[]>([])

const thinking = ref(false)
const streamingModelName = ref('')

const listRef = ref<HTMLElement | null>(null)

const selectedModel = computed(() => models.value.find((m) => m.id === modelId.value))
const vision = computed(
  () => !!selectedModel.value?.vision && !!selectedModel.value?.chatEligible
)

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
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const parts = buf.split('\n\n')
    buf = parts.pop() ?? ''
    for (const block of parts) {
      for (const line of block.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') return
        try {
          onToken(JSON.parse(payload) as string)
        } catch {
          // ignore
        }
      }
    }
  }
  const tail = buf.trim()
  if (tail) {
    for (const line of tail.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (payload === '[DONE]') return
      try {
        onToken(JSON.parse(payload) as string)
      } catch {
        // ignore
      }
    }
  }
}

async function send() {
  const text = draft.value.trim()
  if (!text || !modelId.value) return

  const userMsg: UiMsg = {
    id: crypto.randomUUID(),
    role: 'user',
    content: text,
  }
  uiMessages.value.push(userMsg)

  const modelName = selectedModel.value?.name ?? ''
  streamingModelName.value = modelName

  const payloadMessages = [...thread.value, { role: 'user' as const, content: text }]

  draft.value = ''
  thinking.value = true

  const body: Record<string, unknown> = {
    model: modelId.value,
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
  height: 100%;
  display: grid;
  grid-template-columns: 320px 1fr;
  position: relative;
}
.sidebar {
  border-right: 1px solid var(--border);
  background: var(--surface);
  padding: 16px;
  display: grid;
  gap: 14px;
  align-content: start;
  height: 100%;
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
  height: 100%;
}
.scroll {
  overflow: auto;
  padding: 14px 16px 10px;
}
.preview {
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
