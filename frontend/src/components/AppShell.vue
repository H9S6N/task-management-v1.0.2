<script setup>
/* هيكل التطبيق — الهيدر + القائمة (حسب الصلاحية) + الأقسام
   v1.0.1: صلاحية مدير مهام، زر تفعيل إشعارات المتصفح
   v1.0.1+: زر واتساب العائم اننقل — صار بأسفل الإعدادات / حسابي فقط */
import { computed, ref, watch } from 'vue'
import { useStore } from '../store.js'

import DashboardSec from './admin/DashboardSec.vue'
import TasksSec from './admin/TasksSec.vue'
import ApprovalsSec from './admin/ApprovalsSec.vue'
import EmployeesSec from './admin/EmployeesSec.vue'
import ManagersSec from './admin/ManagersSec.vue'
import TaskTypesSec from './admin/TaskTypesSec.vue'
import ReportsSec from './admin/ReportsSec.vue'
import SettingsSec from './admin/SettingsSec.vue'

import AvailSec from './employee/AvailSec.vue'
import MineSec from './employee/MineSec.vue'
import MyPointsSec from './employee/MyPointsSec.vue'
import RankSec from './employee/RankSec.vue'
import AccountSec from './employee/AccountSec.vue'

const store = useStore()
const menuOpen = ref(false)

const adminSections = {
  dashboard: ['📊', 'لوحة التحكم', DashboardSec],
  tasks: ['🗂️', 'المهام', TasksSec],
  approvals: ['✅', 'اعتماد الإنجاز', ApprovalsSec],
  employees: ['👥', 'الموظفون', EmployeesSec],
  managers: ['🧑‍💼', 'مديرو المهام', ManagersSec],
  taskTypes: ['📋', 'أنواع المهام', TaskTypesSec],
  reports: ['⭐', 'التقارير', ReportsSec],
  settings: ['⚙️', 'الإعدادات', SettingsSec],
}
const managerSections = {
  dashboard: ['📊', 'لوحة المتابعة', DashboardSec],
  tasks: ['🗂️', 'المهام', TasksSec],
  approvals: ['✅', 'اعتماد الإنجاز', ApprovalsSec],
  employees: ['👷', 'موظفاي', EmployeesSec],
  reports: ['⭐', 'التقارير', ReportsSec],
  account: ['🔑', 'حسابي', AccountSec],
}
const employeeSections = {
  avail: ['🪙', 'المتاحة', AvailSec],
  mine: ['📌', 'مهامي', MineSec],
  mypoints: ['⭐', 'نقاطي', MyPointsSec],
  rank: ['🏅', 'الترتيب', RankSec],
  account: ['🔑', 'حسابي', AccountSec],
}

const sections = computed(() =>
  store.isAdmin ? adminSections : store.isManager ? managerSections : employeeSections)
const current = computed(() => (sections.value[store.section] || Object.values(sections.value)[0])[2])
const sectionTitle = computed(() => (sections.value[store.section] || Object.values(sections.value)[0])[1])

function go(name) {
  menuOpen.value = false
  store.setSection(name)
  window.scrollTo(0, 0)
}

/* مهمة مطلوبة من إشعار متصفح — تفتح تفاصيلها تلقائياً */
const openDeepTask = ref(null)
watch(() => store.pendingOpenTask, id => {
  if (id) { openDeepTask.value = id; store.pendingOpenTask = null }
}, { immediate: true })

const roleChip = computed(() =>
  store.isAdmin ? { txt: 'المدير العام', cls: 'st-admin' }
  : store.isManager ? { txt: 'مدير مهام', cls: 'st-manager' }
  : { txt: '', cls: '' })
</script>

<template>
  <div>
    <header class="topbar">
      <button v-if="!store.isEmployee" class="icon-btn menu-btn" aria-label="القائمة" @click="menuOpen = !menuOpen">☰</button>
      <div class="topbar-title"><span class="topbar-logo">📋</span> نظام إدارة المهام</div>
      <div class="topbar-left">
        <!-- زر تفعيل إشعارات المتصفح -->
        <button v-if="store.isEmployee && (store.pushState === 'unknown' || store.pushState === 'off')"
                class="icon-btn push-btn" title="تفعيل إشعارات المتصفح" @click="store.enablePush()">🔔</button>
        <span class="conn-dot" :class="store.conn === 'ok' ? 'cloud' : 'off'" title="حالة الاتصال بالخادم"></span>
        <span class="user-chip">{{ store.auth?.name }}</span>
        <span v-if="roleChip.txt" class="st" :class="roleChip.cls">{{ roleChip.txt }}</span>
        <button class="btn btn-ghost btn-sm" @click="store.logout()">خروج</button>
      </div>
    </header>

    <div v-if="store.conn === 'off'" class="offline-banner">
      ⚠️ انقطع الاتصال بالخادم — جارٍ إعادة المحاولة تلقائياً… آخر مزامنة: {{ store.lastSync ? new Date(store.lastSync).toLocaleTimeString('ar-IQ-u-nu-latn') : '—' }}
    </div>

    <div class="shell">
      <!-- قائمة الإدارة الجانبية -->
      <nav v-if="!store.isEmployee" class="sidebar" :class="{ open: menuOpen }">
        <button v-for="(s, key) in sections" :key="key" class="nav-item"
                :class="{ active: store.section === key }" @click="go(key)">
          {{ s[0] }} {{ s[1] }}
          <span v-if="key === 'approvals' && store.pendingTasks.length" class="badge">{{ store.pendingTasks.length }}</span>
          <span v-if="key === 'tasks' && store.scheduledTasks.length" class="badge badge-blue">{{ store.scheduledTasks.length }}</span>
        </button>
        <div class="sidebar-foot">
          <div class="muted">الإصدار v{{ store.appVersion || '1.0.2' }}</div>
        </div>
      </nav>

      <main class="content" :class="{ 'has-employee-nav': store.isEmployee }">
        <component :is="current" :open-task-id="openDeepTask" />
      </main>
    </div>

    <!-- تنقل الموظف السفلي -->
    <nav v-if="store.isEmployee" class="bottom-nav">
      <button v-for="(s, key) in employeeSections" :key="key" class="nav-item"
              :class="{ active: store.section === key }" @click="go(key)">
        <span>{{ s[0] }}</span><span>{{ s[1] }}</span>
        <span v-if="key === 'avail' && store.myAvailableTasks.length" class="badge">{{ store.myAvailableTasks.length }}</span>
      </button>
    </nav>

    <!-- v1.0.1+: زر واتساب الدعم العائم انشال من هنا — صار بمكان واحد: أسفل الإعدادات / حسابي -->

    <!-- طبقة فوق القائمة للموبايل -->
    <div v-if="menuOpen" @click="menuOpen = false"
         style="position:fixed;inset:0;z-index:50;background:rgba(15,23,42,.3)"></div>
  </div>
</template>
