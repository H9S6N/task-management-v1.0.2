<script setup>
import { ref } from 'vue'
import { useStore } from '../store.js'
import { hasServerUrl } from '../api.js'
import { APP_VERSION } from '../utils.js'

const store = useStore()
const role = ref('employee')
const adminPass = ref('')
const empName = ref('')
const empPin = ref('')
const err = ref('')
const busy = ref(false)

const systemDown = () => !hasServerUrl() || !!store.setupError

async function submit() {
  err.value = ''
  busy.value = true
  try {
    if (role.value === 'admin') {
      if (!adminPass.value) { err.value = 'اكتب كلمة المرور'; return }
      /* النظام غير مرتبط أو الخادم غير متوفر؟ فتح شاشة الربط — للمدير فقط.
         الموظف لا يرى هذه الشاشة إطلاقاً */
      if (systemDown()) {
        store.requestLinking(adminPass.value)
        adminPass.value = ''
        return
      }
      await store.login({ role: 'admin', password: adminPass.value })
    } else {
      if (systemDown()) { err.value = 'النظام غير متوفر حالياً — راجع المدير'; return }
      await store.login({ role: 'employee', employeeName: empName.value, password: empPin.value })
    }
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

      <div v-if="store.setupError" class="mode-banner">{{ store.setupError }}</div>

      <div class="login-tabs">
        <button class="login-tab" :class="{ active: role === 'employee' }" @click="role = 'employee'">👷 موظف</button>
        <button class="login-tab" :class="{ active: role === 'admin' }" @click="role = 'admin'">👨‍💼 المدير</button>
      </div>

      <!-- دخول الموظف: اسم + رمز فقط، ولا شيء آخر -->
      <form v-if="role === 'employee'" class="login-form" @submit.prevent="submit">
        <label>اسمك (كما سجلك المدير)</label>
        <input v-model="empName" placeholder="مثال: علي حسن" autocomplete="username" required>
        <label>الرمز السري (PIN)</label>
        <input type="password" v-model="empPin" placeholder="••••" inputmode="numeric" autocomplete="off" required>
        <button type="submit" class="btn btn-primary btn-block" :disabled="busy">دخول</button>
        <p class="hint">الرمز السري يعطيك إياه المدير عند تسجيلك</p>
      </form>

      <!-- دخول المدير: كلمة مرور فقط -->
      <form v-else class="login-form" @submit.prevent="submit">
        <label>كلمة المرور</label>
        <input type="password" v-model="adminPass" placeholder="••••••••" autocomplete="current-password" required>
        <button type="submit" class="btn btn-primary btn-block" :disabled="busy">دخول لوحة المدير</button>
      </form>

      <p v-if="err" class="login-error">{{ err }}</p>
    </div>
    <p class="login-footer">نظام إدارة المهام v{{ APP_VERSION }}</p>
  </div>
</template>
