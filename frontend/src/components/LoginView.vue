<script setup>
/* تسجيل الدخول — v1.0.2: دخول موحد
   صفحة واحدة للكل: اسم المستخدم + كلمة المرور — والنظام يتعرف على صلاحيتك تلقائياً
   (مدير عام / مدير مهام / موظف) بدون اختيار صلاحية */
import { ref } from 'vue'
import { useStore } from '../store.js'
import { hasServerUrl } from '../api.js'

const store = useStore()
const username = ref('')
const password = ref('')
const err = ref('')
const busy = ref(false)

/* أول تشغيل (النظام غير مرتبط)؟ الدخول يفتح شاشة الربط — بكلمة مرور المدير */
const systemDown = () => !hasServerUrl() || !!store.setupError

async function submit() {
  err.value = ''
  busy.value = true
  try {
    if (systemDown()) {
      /* النظام غير مرتبط أو الخادم غير متوفر — شاشة الربط (للمدير فقط) */
      store.requestLinking(password.value)
      password.value = ''
      return
    }
    await store.login({ username: username.value.trim(), password: password.value })
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
      <div class="login-logo">📋</div>
      <h1>نظام إدارة المهام</h1>
      <p class="login-sub">دخول موحد لكل المستخدمين — المدير ومدير المهام والموظف</p>

      <div v-if="store.setupError" class="mode-banner">{{ store.setupError }}</div>

      <form class="login-form" @submit.prevent="submit">
        <label>اسم المستخدم</label>
        <input v-model="username" dir="ltr" placeholder="username" autocomplete="username" required>

        <label>كلمة المرور</label>
        <input type="password" v-model="password" placeholder="••••••" autocomplete="current-password" required>

        <button type="submit" class="btn btn-primary btn-block" :disabled="busy">دخول</button>
      </form>

      <p v-if="systemDown()" class="hint" style="margin-top:10px">
        أول تشغيل؟ اكتب كلمة مرور المدير فقط واضغط دخول لربط النظام
      </p>
      <p v-else class="hint" style="margin-top:10px">
        اسم المستخدم وكلمة المرور يعطيك إياها المدير عند تسجيلك
      </p>

      <p v-if="err" class="login-error">{{ err }}</p>
    </div>
    <p class="login-footer">نظام إدارة المهام v{{ store.appVersion || '1.0.2' }}</p>
  </div>
</template>
