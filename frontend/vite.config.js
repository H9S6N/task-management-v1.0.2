import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base './' يجعل الموقع يعمل تحت أي مسار على GitHub Pages
// (مثل https://username.github.io/repo-name/)
export default defineConfig({
  base: './',
  plugins: [vue()],
  build: {
    chunkSizeWarningLimit: 900,
  },
})
