# Frontend i18n (Translations) — Build Prompt

> Use this prompt to have an AI generate all three locale files for the app: Georgian (default), Russian, and English.

---

## Prompt

Generate the three i18n locale files for a Vue 3 + Pinia chat application. The app is an AI chat interface with model selection, RAG toggle, image upload, and light/dark mode.

Create these three files with **identical keys** and full translations:

- `frontend/src/i18n/ka.ts` — Georgian (default language)
- `frontend/src/i18n/ru.ts` — Russian
- `frontend/src/i18n/en.ts` — English

### Keys to translate (use this English reference):

```typescript
export default {
  // Auth
  login: {
    title: "Sign In",
    username: "Username",
    password: "Password",
    submit: "Sign In",
    error: "Invalid username or password",
    loading: "Signing in...",
  },

  // Navigation / Sidebar
  nav: {
    logout: "Log Out",
    theme: {
      light: "Light Mode",
      dark: "Dark Mode",
    },
  },

  // Model selector
  models: {
    label: "AI Model",
    placeholder: "Select a model",
    vision_badge: "Vision",
    groups: {
      text: "Text Models",
      vision: "Vision Models",
    },
  },

  // RAG
  rag: {
    label: "Use geosoft.ge knowledge base",
    tooltip: "When enabled, answers are augmented with content from geosoft.ge",
  },

  // Chat
  chat: {
    placeholder: "Type a message...",
    send: "Send",
    thinking: "Thinking...",
    attach_image: "Attach image",
    remove_image: "Remove image",
    image_preview: "Image preview",
    you: "You",
    assistant: "Assistant",
    empty_state: "Select a model and start chatting",
    error: "Something went wrong. Please try again.",
    vision_only: "Image upload is only available for vision-capable models",
  },

  // Image upload
  upload: {
    uploading: "Uploading...",
    error: "Upload failed. Please try again.",
    invalid_type: "Only JPG, PNG, WebP, and GIF images are allowed",
    too_large: "Image must be under 10MB",
  },

  // Language switcher
  language: {
    label: "Language",
    ka: "Georgian",
    ru: "Russian",
    en: "English",
  },

  // General
  common: {
    loading: "Loading...",
    error: "Error",
    retry: "Retry",
    close: "Close",
  },
}
```

### Instructions:
- For `ka.ts`: Translate all values into natural Georgian. Use the ქართული script. Do not transliterate — use proper Georgian words. For technical terms with no Georgian equivalent (like "RAG", model names), keep the original term but add a Georgian description where helpful.
- For `ru.ts`: Translate all values into natural Russian. Use the Кириллица script.
- For `en.ts`: Use the English strings from the reference above exactly as-is.

Each file must export a default object with the exact same nested key structure. The TypeScript type should be inferred from the English file and shared across all three.

Also create `frontend/src/i18n/index.ts` that:
- Exports a `useI18n()` composable backed by a Pinia store
- Stores current locale in `localStorage` under key `locale`
- Defaults to `'ka'` if no stored preference
- Exposes `{ t, locale, setLocale }` where `t(key: string)` resolves dot-notation keys like `t('chat.placeholder')`
