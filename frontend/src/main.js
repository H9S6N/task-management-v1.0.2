import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles.css'
import { applyInviteFromHash, cleanAppHash } from './api.js'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')

/* لو وصل رابط دعوة والتطبيق مفتوح من قبل — طبق الربط وحدّث الصفحة */
window.addEventListener('hashchange', () => {
  if (applyInviteFromHash()) {
    cleanAppHash()
    location.reload()
  }
})
