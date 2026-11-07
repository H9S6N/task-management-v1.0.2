<script setup>
import { onMounted } from 'vue'
import { useStore } from './store.js'
import ServerSetup from './components/ServerSetup.vue'
import LoginView from './components/LoginView.vue'
import AppShell from './components/AppShell.vue'
import Toasts from './components/Toasts.vue'
import Lightbox from './components/Lightbox.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'

const store = useStore()
onMounted(() => store.boot())
</script>

<template>
  <!-- شاشة تحميل محايدة أثناء الإقلاع — لا تكشف أي شاشة قبل انتهاء التحقق -->
  <div v-if="!store.booted" class="login-wrap">
    <div class="login-card">
      <div class="login-logo">📋</div>
      <h1>نظام إدارة المهام</h1>
      <p class="login-sub">⏳ جاري التحميل...</p>
    </div>
  </div>

  <ServerSetup v-else-if="store.view === 'setup'" />
  <LoginView v-else-if="store.view === 'login'" />
  <AppShell v-else-if="store.view === 'app'" />

  <Toasts />
  <Lightbox />
  <ConfirmDialog />
</template>
