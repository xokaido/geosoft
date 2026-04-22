import { defineStore } from 'pinia'

export type ThemeName = 'light' | 'dark'

const THEME_KEY = 'theme'

function readStored(): ThemeName | null {
  if (typeof localStorage === 'undefined') return null
  const v = localStorage.getItem(THEME_KEY)
  return v === 'light' || v === 'dark' ? v : null
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    theme: 'light' as ThemeName,
  }),
  actions: {
    init() {
      const stored = readStored()
      const prefersDark =
        typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
      const t: ThemeName = stored ?? (prefersDark ? 'dark' : 'light')
      this.apply(t, false)
    },
    toggle() {
      const next: ThemeName = this.theme === 'dark' ? 'light' : 'dark'
      this.apply(next, true)
    },
    apply(theme: ThemeName, persist = true) {
      this.theme = theme
      document.documentElement.setAttribute('data-theme', theme)
      if (persist && typeof localStorage !== 'undefined') {
        localStorage.setItem(THEME_KEY, theme)
      }
    },
  },
})
