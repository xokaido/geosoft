import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const here = path.dirname(fileURLToPath(import.meta.url))
const dist = path.resolve(here, '../dist')

export default defineConfig({
  root: here,
  plugins: [vue()],
  base: '/',
  build: {
    outDir: dist,
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
})
