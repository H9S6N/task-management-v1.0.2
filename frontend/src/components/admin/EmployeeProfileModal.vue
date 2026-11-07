<script setup>
/* ملف الموظف — v1.0.2: القوائم صارت قابلة للدخول مو بس للعرض
   الضغط على أي موظف (من اللوحة أو قائمة الموظفين) يفتح ملفه:
   تقييمه (نقاط/مكتملة/مرفوضة) + مهامه السابقة كاملة
   + إسناد مهمة مباشرة له بدون تعميم للكل */
import { ref, computed } from 'vue'
import { useStore } from '../../store.js'
import { pointsFmt, fmtDateTime, statusLabel, statusClass, EMP_STATUSES, isOnLeaveNow, taskInPeriod } from '../../utils.js'
import Modal from '../Modal.vue'
import TaskFormModal from './TaskFormModal.vue'
import TaskDetailModal from './TaskDetailModal.vue'

const store = useStore()
const props = defineProps({ empId: { type: String, required: true } })
const emit = defineEmits(['close'])

const emp = computed(() => store.getEmployee(props.empId))
const showAssign = ref(false)
const detailTaskId = ref(null)
const period = ref('all')
const taskLimit = ref(10)

/* كل مهام الموظف (غير المحذوفة) — الأحدث أولاً، مع فلترة فترة اختيارية */
const empTasks = computed(() => {
  if (!emp.value) return []
  return store.tasks
    .filter(t => t.assignedToId === emp.value.id && !t.deleted && taskInPeriod(t, period.value))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
})
const shownTasks = computed(() => empTasks.value.slice(0, taskLimit.value))

/* تقييم سريع: إحصائيات كل مهامه */
const stats = computed(() => {
  const all = store.tasks.filter(t => t.assignedToId === props.empId && !t.deleted)
  return {
    total: all.length,
    completed: all.filter(t => t.status === 'completed').length,
    working: all.filter(t => ['accepted', 'in_progress'].includes(t.status)).length,
    awaiting: all.filter(t => t.status === 'pending_approval').length,
    rejected: all.filter(t => t.status === 'rejected').length,
    declined: all.filter(t => (t.declinedBy || []).some(d => d.employeeId === props.empId)).length,
  }
})

const stateTxt = computed(() => {
  const e = emp.value
  if (!e) return ''
  if (e.deleted) return 'محذوف'
  if (e.status === 'disabled') return 'موقوف — غير متوفر'
  if (e.status === 'on_leave') return 'في إجازة حالياً 🏖️ — غير متوفر'
  return 'متوفر'
})
const stateCls = computed(() => {
  const e = emp.value
  if (!e || e.deleted) return 'st-cancelled'
  return 'st-' + e.status
})

function borderColor() {
  const e = emp.value
  if (!e) return 'var(--line)'
  if (e.deleted) return 'var(--muted)'
  if (e.status === 'disabled') return 'var(--line)'
  if (e.status === 'on_leave') return 'var(--warn)'
  return 'var(--ok)'
}

const PERIODS = [['today', 'اليوم'], ['week', 'هذا الأسبوع'], ['month', 'هذا الشهر'], ['all', 'الكل']]
</script>

<template>
  <Modal @close="emit('close')">
    <template v-if="emp">
      <h3>👷 ملف الموظف: {{ emp.fullName }}</h3>

      <div class="tcard-top" style="margin-bottom:8px">
        <span class="st" :class="stateCls">{{ stateTxt }}</span>
        <span class="points-chip">⭐ {{ pointsFmt(emp.totalPoints) }}</span>
        <span v-if="emp.username" class="st st-manager">👤 {{ emp.username }}</span>
        <span class="st" :class="'st-auto'">{{ EMP_STATUSES[emp.status] || emp.status }}</span>
      </div>

      <!-- التقييم -->
      <div class="stats-grid" style="grid-template-columns:repeat(3, 1fr)">
        <div class="stat"><div class="num">✅ {{ stats.completed }}</div><div class="lbl">مكتملة</div></div>
        <div class="stat"><div class="num">🔧 {{ stats.working }}</div><div class="lbl">قيد التنفيذ</div></div>
        <div class="stat"><div class="num">⏳ {{ stats.awaiting }}</div><div class="lbl">بانتظار اعتماد</div></div>
        <div class="stat"><div class="num">❌ {{ stats.rejected }}</div><div class="lbl">مرفوضة من الإدارة</div></div>
        <div class="stat"><div class="num">🚫 {{ stats.declined }}</div><div class="lbl">رفضها بنفسه</div></div>
        <div class="stat"><div class="num">🗂️ {{ stats.total }}</div><div class="lbl">كل مهامه</div></div>
      </div>

      <div class="detail-sec">
        <p v-if="emp.notes">📝 {{ emp.notes }}</p>
        <p v-if="emp.telegramChatId">📬 تيليكرام: {{ emp.telegramChatId }}</p>
        <p v-if="emp.notificationsEnabled === false">🔕 الإشعارات مطفأة لهذا الموظف</p>
      </div>

      <!-- مهامه السابقة -->
      <div class="detail-sec">
        <div class="lbl">🗂️ مهامه ({{ empTasks.length }}) — اضغط أي مهمة لفتح تفاصيلها</div>
        <div class="filter-bar" style="margin:8px 0">
          <button v-for="[k, lbl] in PERIODS" :key="k" class="chip" :class="{ active: period === k }" @click="period = k">{{ lbl }}</button>
          <select v-model.number="taskLimit" class="input-inline" style="max-width:110px">
            <option :value="10">10 مهام</option><option :value="25">25 مهمة</option><option :value="50">50 مهمة</option>
          </select>
        </div>
        <div v-if="shownTasks.length" class="mini-list" style="max-height:300px;overflow:auto">
          <div v-for="t in shownTasks" :key="t.id" class="mini-item" @click="detailTaskId = t.id">
            <span class="t">#{{ t.no }} {{ t.title }}</span>
            <span class="muted" style="white-space:nowrap">{{ fmtDateTime(t.completedAt || t.createdAt) }}</span>
            <span :class="statusClass(t.status)">{{ statusLabel(t.status) }}</span>
          </div>
          <p v-if="empTasks.length > shownTasks.length" class="muted">
            +{{ empTasks.length - shownTasks.length }} مهمة أخرى — كبر عدد المخرجات من القائمة
          </p>
        </div>
        <p v-else class="muted" style="margin-top:6px">لا توجد مهام بهذه الفترة</p>
      </div>

      <div class="form-actions">
        <button class="btn btn-primary" :disabled="emp.deleted" @click="showAssign = true">
          ➕ إسناد مهمة مباشرة له (بدون تعميم)
        </button>
        <button class="btn btn-outline" @click="emit('close')">إغلاق</button>
      </div>
      <p v-if="emp.status === 'on_leave'" class="hint">
        ⚠️ الموظف مجاز حالياً — خلّه يرجع من الإجازة أول حتى تكدر تسنده له مهمة
      </p>
    </template>

    <TaskFormModal v-if="showAssign && emp" :preset-employee-id="emp.id" @close="showAssign = false" />
    <TaskDetailModal v-if="detailTaskId" :task-id="detailTaskId" @close="detailTaskId = null" />
  </Modal>
</template>
