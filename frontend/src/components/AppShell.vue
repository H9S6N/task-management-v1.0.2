<script setup>
/* هيكل التطبيق — الهيدر + القائمة الجانبية (مدير) أو التنقل السفلي (موظف) + الأقسام */
import { computed, ref } from 'vue'
import { useStore } from '../store.js'
import { APP_VERSION } from '../utils.js'

import DashboardSec from './admin/DashboardSec.vue'
import TasksSec from './admin/TasksSec.vue'
import ApprovalsSec from './admin/ApprovalsSec.vue'
import EmployeesSec from './admin/EmployeesSec.vue'
import TaskTypesSec from './admin/TaskTypesSec.vue'
import PointsSec from './admin/PointsSec.vue'
import SettingsSec from './admin/SettingsSec.vue'

import AvailSec from './employee/AvailSec.vue'
import MineSec from './employee/MineSec.vue'
import MyPointsSec from './employee/MyPointsSec.vue'
import RankSec from './employee/RankSec.vue'
import EmpSettingsSec from './employee/EmpSettingsSec.vue'

const store = useStore()
const menuOpen = ref(false)

const adminSections = {
  dashboard: DashboardSec, tasks: TasksSec, approvals: ApprovalsSec,
  employees: EmployeesSec, taskTypes: TaskTypesSec, points: PointsSec, settings: SettingsSec,
}
const employeeSections = { avail: AvailSec, mine: MineSec, mypoints: MyPointsSec, rank: RankSec, empsettings: EmpSettingsSec }

const sections = computed(() => store.isAdmin ? adminSections : employeeSections)
const current = computed(() => sections.value[store.section] || Object.values(sections.value)[0])

/* رقم واتساب الدعم — يحدده المدير من الإعدادات */
const waLink = computed(() => {
  const n = String(store.isAdmin ? (store.settings.supportWhatsapp || '') : (store.serverSettings?.supportWhatsapp || '')).replace(/\D/g, '')
  return n ? `https://wa.me/${n}?text=${encodeURIComponent('مرحبا، عندي استفسار عن نظام إدارة المهام')}` : ''
})

function go(name) {
  menuOpen.value = false
  store.setSection(name)
  window.scrollTo(0, 0)
}
</script>

<template>
  <div>
    <header class="topbar">
      <button v-if="store.isAdmin" class="icon-btn menu-btn" aria-label="القائمة" @click="menuOpen = !menuOpen">☰</button>
      <div class="topbar-title">
        <span class="topbar-logo">📋</span> نظام إدارة المهام
        <span class="ver-chip">v{{ APP_VERSION }}</span>
      </div>
      <div class="topbar-left">
        <span class="conn-dot" :class="store.conn === 'ok' ? 'cloud' : 'off'" title="حالة الاتصال"></span>
        <span class="user-chip">{{ store.auth?.name }}</span>
        <button class="btn btn-ghost btn-sm" @click="store.logout()">خروج</button>
      </div>
    </header>

    <div class="shell">
      <!-- قائمة المدير الجانبية -->
      <nav v-if="store.isAdmin" class="sidebar" :class="{ open: menuOpen }">
        <button class="nav-item" :class="{ active: store.section === 'dashboard' }" @click="go('dashboard')">📊 لوحة التحكم</button>
        <button class="nav-item" :class="{ active: store.section === 'tasks' }" @click="go('tasks')">🗂️ المهام</button>
        <button class="nav-item" :class="{ active: store.section === 'approvals' }" @click="go('approvals')">
          ✅ اعتماد الإنجاز <span v-if="store.pendingTasks.length" class="badge">{{ store.pendingTasks.length }}</span>
        </button>
        <button class="nav-item" :class="{ active: store.section === 'employees' }" @click="go('employees')">👥 الموظفون</button>
        <button class="nav-item" :class="{ active: store.section === 'taskTypes' }" @click="go('taskTypes')">📋 أنواع المهام</button>
        <button class="nav-item" :class="{ active: store.section === 'points' }" @click="go('points')">⭐ النقاط والتقارير</button>
        <button class="nav-item" :class="{ active: store.section === 'settings' }" @click="go('settings')">⚙️ الإعدادات</button>
      </nav>

      <main class="content" :class="{ 'has-employee-nav': store.isEmployee }">
        <component :is="current" />
      </main>
    </div>

    <!-- تنقل الموظف السفلي -->
    <nav v-if="store.isEmployee" class="bottom-nav">
      <button class="nav-item" :class="{ active: store.section === 'avail' }" @click="go('avail')">
        🪙<span>المتاحة <span v-if="store.myAvailableTasks.length" class="badge">{{ store.myAvailableTasks.length }}</span></span>
      </button>
      <button class="nav-item" :class="{ active: store.section === 'mine' }" @click="go('mine')">📌<span>مهامي</span></button>
      <button class="nav-item" :class="{ active: store.section === 'mypoints' }" @click="go('mypoints')">⭐<span>نقاطي</span></button>
      <button class="nav-item" :class="{ active: store.section === 'rank' }" @click="go('rank')">🏅<span>الترتيب</span></button>
      <button class="nav-item" :class="{ active: store.section === 'empsettings' }" @click="go('empsettings')">⚙️<span>إعداداتي</span></button>
    </nav>

    <!-- زر واتساب الدعم — ظاهر للجميع إذا حدده المدير -->
    <a v-if="waLink" class="wa-float" :href="waLink" target="_blank" rel="noopener" title="تواصل مع الدعم عبر واتساب">💬</a>

    <!-- طبقة فوق القائمة للموبايل -->
    <div v-if="menuOpen" @click="menuOpen = false"
         style="position:fixed;inset:0;z-index:50;background:rgba(15,23,42,.3)"></div>
  </div>
</template>
