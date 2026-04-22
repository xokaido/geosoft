import { defineStore } from 'pinia'
import { computed } from 'vue'
import en from './en'
import ka from './ka'
import ru from './ru'

export type Locale = 'ka' | 'ru' | 'en'

const LOCALE_KEY = 'locale'

const catalogs: Record<Locale, typeof en> = {
  ka,
  ru,
  en,
}

function normalizeLocale(raw: string | null): Locale {
  if (raw === 'ru' || raw === 'en' || raw === 'ka') return raw
  return 'ka'
}

function getByPath(obj: unknown, path: string): string | undefined {
  const parts = path.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return typeof cur === 'string' ? cur : undefined
}

export const useI18nStore = defineStore('i18n', {
  state: () => ({
    locale: normalizeLocale(
      typeof localStorage !== 'undefined' ? localStorage.getItem(LOCALE_KEY) : null
    ),
  }),
  getters: {
    messages(state): typeof en {
      const l = state.locale in catalogs ? state.locale : 'ka'
      return catalogs[l]
    },
  },
  actions: {
    setLocale(locale: Locale) {
      this.locale = locale
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LOCALE_KEY, locale)
      }
    },
    t(key: string): string {
      const v = getByPath(this.messages, key)
      return v ?? key
    },
  },
})

export function useI18n() {
  const store = useI18nStore()
  return {
    t: (key: string) => store.t(key),
    locale: computed(() => store.locale),
    setLocale: (l: Locale) => store.setLocale(l),
  }
}
