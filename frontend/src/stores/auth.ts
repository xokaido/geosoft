import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    ready: false,
    authed: false,
  }),
  actions: {
    async check() {
      try {
        const r = await fetch('/api/models', { credentials: 'include' })
        this.authed = r.ok
      } catch {
        this.authed = false
      } finally {
        this.ready = true
      }
    },
    async login(username: string, password: string) {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error || 'login_failed')
      }
      this.authed = true
      this.ready = true
    },
    async logout() {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
      this.authed = false
    },
  },
})
