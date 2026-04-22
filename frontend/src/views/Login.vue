<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from '../i18n'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const { t } = useI18n()
const auth = useAuthStore()

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await auth.login(username.value, password.value)
    await router.push('/')
  } catch {
    error.value = t('login.error')
  } finally {
    loading.value = false
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    void submit()
  }
}
</script>

<template>
  <div class="page">
    <form class="card" @submit.prevent="submit" @keydown="onKeydown">
      <h1 class="title">{{ t('login.title') }}</h1>

      <label class="field">
        <span>{{ t('login.username') }}</span>
        <input v-model="username" autocomplete="username" />
      </label>

      <label class="field">
        <span>{{ t('login.password') }}</span>
        <input v-model="password" type="password" autocomplete="current-password" />
      </label>

      <p v-if="error" class="err">{{ error }}</p>

      <button class="btn" type="submit" :disabled="loading">
        {{ loading ? t('login.loading') : t('login.submit') }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.page {
  min-height: 100%;
  display: grid;
  place-items: center;
  padding: 24px;
}
.card {
  width: min(440px, 100%);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 22px;
  box-shadow: var(--shadow);
  display: grid;
  gap: 14px;
}
.title {
  margin: 0 0 6px;
  font-size: 22px;
}
.field {
  display: grid;
  gap: 8px;
  font-size: 13px;
  color: var(--muted);
}
input {
  border: 1px solid var(--border);
  background: var(--surface-2);
  border-radius: 12px;
  padding: 12px 12px;
}
.btn {
  border: 0;
  border-radius: 12px;
  padding: 12px 14px;
  background: linear-gradient(180deg, var(--accent), var(--accent-2));
  color: white;
  font-weight: 650;
  cursor: pointer;
}
.btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
.err {
  margin: 0;
  color: var(--danger);
  font-size: 13px;
}
</style>
