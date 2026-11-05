<script setup>
/* شاشة الربط — تُفتح فقط بعد أن يدخل المدير كلمة مروره من شاشة الدخول.
   لا تحتوي على أي تعليمات أو أمثلة — حقل واحد فقط */
import { onMounted, ref } from 'vue'
import { useStore } from '../store.js'
import { getServerUrl } from '../api.js'

const store = useStore()
const url = ref(getServerUrl())
const busy = ref(false)
const err = ref('')

onMounted(() => {
  /* حماية: أي محاولة وصول لهذه الشاشة بدون كلمة مرور المدير → رجوع للدخول */
  if (!store.pendingAdminPass) store.view = 'login'
})

async function connect() {
  err.value = ''
  if (!url.value.trim()) { err.value = 'اكتب عنوان الربط'; return }
  busy.value = true
  try {
    await store.connectServer(url.value)
  } catch (e) {
    err.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="login-wrap">
    <div class="login-card">
      <div class="login-logo">🔗</div>
      <h1>ربط النظام</h1>
      <p class="login-sub">هذه الشاشة للمدير فقط</p>

      <div class="login-form">
        <label>عنوان الربط</label>
        <input v-model="url" dir="ltr" placeholder="https://..." @keyup.enter="connect" :disabled="busy">

        <button class="btn btn-primary btn-block" style="margin-top:18px" :disabled="busy" @click="connect">
          {{ busy ? '⏳ جاري التحقق...' : '🔗 ربط' }}
        </button>

        <p v-if="err" class="login-error">{{ err }}</p>
      </div>
    </div>
    <p class="login-footer">نظام إدارة المهام</p>
  </div>
</template>
