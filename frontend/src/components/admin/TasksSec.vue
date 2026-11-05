<script setup>
import { ref, computed } from 'vue'
import { useStore } from '../../store.js'
import { TASK_STATUSES, statusLabel, statusClass, pointsFmt, fmtDateTime } from '../../utils.js'
import TaskFormModal from './TaskFormModal.vue'
import TaskDetailModal from './TaskDetailModal.vue'

const store = useStore()
const statusFilter = ref('all')
const period = ref('all')          // day | week | month | all
const showForm = ref(false)
const editTask = ref(null)
const detailId = ref(null)

const PERIODS = [
  ['day', '☀️ مهام اليوم'],
  ['week', '📅 هذا الأسبوع'],
  ['month', '🗓️ هذا الشهر'],
  ['all', '🗃️ الكل'],
]

/* حدود الفترة الزمنية (حسب تاريخ إنشاء المهمة) */
function inPeriod(t) {
  if (period.value === 'all') return true
  const d = new Date(t.createdAt)
  if (isNaN(d)) return false
  const now = new Date()
  if (period.value === 'day') {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  }
  if (period.value === 'week') {
    const from = new Date(now)
    from.setDate(now.getDate() - 6)
    from.setHours(0, 0, 0, 0)
    return d >= from
  }
  if (period.value === 'month') {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }
  return true
}

const periodTasks = computed(() => store.tasks.filter(inPeriod))

const counts = computed(() => {
  const c = { all: periodTasks.value.length }
  TASK_STATUSES.forEach(s => c[s] = periodTasks.value.filter(t => t.status === s).length)
  return c
})
const list = computed(() =>
  statusFilter.value === 'all' ? periodTasks.value : periodTasks.value.filter(t => t.status === statusFilter.value)
)

const periodCounts = computed(() => {
  const now = new Date()
  const same = (d, y, m, dd) => d.getFullYear() === y && d.getMonth() === m && d.getDate() === dd
  const weekFrom = new Date(now); weekFrom.setDate(now.getDate() - 6); weekFrom.setHours(0, 0, 0, 0)
  return {
    day: store.tasks.filter(t => { const d = new Date(t.createdAt); return !isNaN(d) && same(d, now.getFullYear(), now.getMonth(), now.getDate()) }).length,
    week: store.tasks.filter(t => { const d = new Date(t.createdAt); return !isNaN(d) && d >= weekFrom }).length,
    month: store.tasks.filter(t => { const d = new Date(t.createdAt); return !isNaN(d) && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() }).length,
    all: store.tasks.length,
  }
})

function borderColor(t) {
  if (t.status === 'completed') return 'var(--ok)'
  if (t.status === 'rejected' || t.status === 'cancelled') return 'var(--danger)'
  if (t.status === 'pending_approval') return 'var(--purple)'
  if (t.status === 'available') return 'var(--info)'
  return 'var(--warn)'
}

function openEdit(t) {
  detailId.value = null
  editTask.value = t
  showForm.value = true
}
</script>

<template>
  <section>
    <div class="sec-head">
      <h2 class="sec-title">🗂️ المهام</h2>
      <button class="btn btn-primary" @click="showForm = true">➕ مهمة جديدة</button>
    </div>

    <!-- الفترة الزمنية: اليوم / الأسبوع / الشهر / الكل -->
    <div class="filter-bar period-bar">
      <button v-for="[k, lbl] in PERIODS" :key="k"
              class="chip chip-period" :class="{ active: period === k }" @click="period = k">
        {{ lbl }} <b class="chip-count">{{ periodCounts[k] }}</b>
      </button>
    </div>

    <!-- الحالة: مكتملة / شغالة / إلخ -->
    <div class="filter-bar">
      <button class="chip" :class="{ active: statusFilter === 'all' }" @click="statusFilter = 'all'">
        كل الحالات ({{ counts.all }})
      </button>
      <button v-for="s in TASK_STATUSES" :key="s"
              class="chip" :class="{ active: statusFilter === s }" @click="statusFilter = s">
        {{ statusLabel(s) }} ({{ counts[s] || 0 }})
      </button>
    </div>

    <div class="cards-list">
      <div v-for="t in list" :key="t.id" class="tcard" :style="{ borderRightColor: borderColor(t) }" @click="detailId = t.id">
        <div class="tcard-top">
          <span class="tcard-title">#{{ t.no }} {{ t.title }}</span>
          <span class="points-chip">⭐ {{ pointsFmt(t.points) }}</span>
          <span :class="statusClass(t.status)">{{ statusLabel(t.status) }}</span>
          <span class="st" :class="'st-' + t.assignmentType">{{ t.assignmentType === 'direct' ? 'تكليف مباشر' : (t.autoConvertAt && !t.converted ? 'مجدولة' : 'تلقائي') }}</span>
        </div>
        <div class="tcard-meta">
          <span>🏷️ {{ t.taskTypeName }}</span>
          <span v-if="t.assignedToName">👤 {{ t.assignedToName }}</span>
          <span v-else-if="t.offeredTo && t.offeredTo.length">📤 معروضة على {{ t.offeredTo.length }} موظف</span>
          <span v-else-if="t.autoConvertAt && !t.converted">📢 عامة للكل</span>
          <span>🕒 {{ fmtDateTime(t.createdAt) }}</span>
          <span v-if="t.declinedBy && t.declinedBy.length" class="minus">🚫 {{ t.declinedBy.length }} رفض</span>
          <span v-if="t.rejectionReason">❌ {{ t.rejectionReason }}</span>
        </div>
      </div>
      <div v-if="!list.length" class="empty"><span class="big">🗂️</span>لا توجد مهام بهذا التصنيف</div>
    </div>

    <TaskFormModal v-if="showForm" :edit-task="editTask" @close="showForm = false; editTask = null" />
    <TaskDetailModal v-if="detailId" :task-id="detailId" @close="detailId = null" @edit="openEdit(store.getTask($event))" />
  </section>
</template>
