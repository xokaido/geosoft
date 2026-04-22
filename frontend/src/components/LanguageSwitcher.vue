<script setup lang="ts">
import { useI18n, type Locale } from '../i18n'

const { t, locale, setLocale } = useI18n()

function pick(next: Locale) {
  setLocale(next)
}
</script>

<template>
  <div class="lang">
    <span class="label">{{ t('language.label') }}</span>
    <div class="row" role="group" :aria-label="t('language.label')">
      <button type="button" :class="{ on: locale === 'ka' }" @click="pick('ka')">🇬🇪 ქართ</button>
      <button type="button" :class="{ on: locale === 'ru' }" @click="pick('ru')">🇷🇺 Рус</button>
      <button type="button" :class="{ on: locale === 'en' }" @click="pick('en')">🇬🇧 Eng</button>
    </div>
  </div>
</template>

<style scoped>
.lang {
  display: grid;
  gap: 8px;
}
.label {
  font-size: 12px;
  color: var(--muted);
}
.row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
button {
  border: 1px solid var(--border);
  background: var(--surface-2);
  border-radius: 10px;
  padding: 8px 10px;
  cursor: pointer;
}
button.on {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent);
}
</style>
