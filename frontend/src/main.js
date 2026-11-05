import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles.css'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')

/* تسجيل Service Worker — إشعارات المتصفح (Web Push) تعمل حتى لو الموقع مقفل */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* غير حرج */ })
  })
}
