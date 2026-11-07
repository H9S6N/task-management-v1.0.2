<script setup>
/* المهام — v1.0.2: فلترة بالفترة (اليوم افتراضياً)، أرشيف، سلة محذوفات مع استعادة
   + أزرار أرشفة وحذف ناعم على كل كرت مهمة مباشرة — كل الحذف ناعم (ماكو حذف نهائي) */
import { ref, computed, watch } from 'vue'
import { useStore } from '../../store.js'
import { PERIODS, statusLabel, statusClass, pointsFmt, fmtDateTime, taskInPeriod, ASSIGN_LABELS } from '../../utils.js'
import TaskFormModal from './TaskFormModal.vue'
import TaskDetailModal from './TaskDetailModal.vue'

const store = useStore()
const period = ref('today')
const statusFilter = ref('all')
const view = ref('active')          // active | archived | trash
const showForm = ref(false)
const editTask = ref(null)
const detailId = ref(null)

/* من يكدر يعدل على المهمة؟ المدير العام دائماً، مدير المهام لمهامه فقط (نفس منطق الخادم) */
function canTouch(t) {
  if (!store.isManagement) return false
  if (store.isAdmin) return true
  return t.createdById === store.me?.id
}

async function quickArchive(t) {
  if (!(await store.confirm('أرشفة المهمة', `ترجع المهمة #${t.no} "${t.title}" لقسم الأرشيف؟ تختفي من قوائم المهام وتبقى بالأرشيف.`))) return
  await store.archiveTask(t.id)
}
async function quickDelete(t) {
  const ok = await store.confirm('حذف المهمة (ناعم)',
    `حذف المهمة #${t.no} "${t.title}" حذفاً ناعماً؟\nتروح لسلة المحذوفات وتكدر تستعيدها — ماكو حذف نهائي بالنظام.`, true)
  if (!ok) return
  await store.deleteTask(t.id)
}
async function quickUnarchive(t) {
  if (!(await store.confirm('إخراج من الأرشيف', `ترجع المهمة #${t.no} "${t.title}" لقائمة المهام النشطة؟`))) return
  await store.unarchiveTask(t.id)
}

function openEdit(t) {
  detailId.value = null
  editTask.value = t
  showForm.value = true
}

const props = defineProps({ openTaskId: { type: String, default: null } })

const pool = computed(() => {
  if (view.value === 'archived') return store.archivedTasks
  if (view.value === 'trash') return store.deletedTasks
  return store.tasks.filter(t => !t.archived && !t.deleted)
})

const baseList = computed(() => {
  const src = view.value === 'active' ? pool.value.filter(t => taskInPeriod(t, period.value)) : pool.value
  if (statusFilter.value === 'all') return src
  return src.filter(t => t.status === statusFilter.value)
})

const counts = computed(() => {
  const src = view.value === 'active' ? pool.value.filter(t => taskInPeriod(t, period.value)) : pool.value
  const c = { all: src.length }
  src.forEach(t => { c[t.status] = (c[t.status] || 0) + 1 })
  return c
})

function borderColor(t) {
  if (t.deleted) return 'var(--muted)'
  if (t.archived) return 'var(--line)'
  if (t.status === 'completed') return 'var(--ok)'
  if (t.status === 'rejected' || t.status === 'cancelled') return 'var(--danger)'
  if (t.status === 'pending_approval') return 'var(--purple)'
  if (t.status === 'scheduled') return 'var(--purple)'
  if (t.status === 'available') return 'var(--info)'
  return 'var(--warn)'
}

async function restore(t) {
  if (!(await store.confirm('استعادة المهمة', `ترجع المهمة #${t.no} "${t.title}" لقائمة المهام؟`))) return
  await store.restoreTask(t.id)
}

watch(() => props.openTaskId, id => {
  if (id) {
    const t = store.getTask(id)
    if (t) {
      view.value = t.deleted ? 'trash' : t.archived ? 'archived' : 'active'
      period.value = 'all'
      statusFilter.value = 'all'
    }
    detailId.value = id
  }
}, { immediate: true })
</script>

<template>
  <section>
    <div class="sec-head">
      <h2 class="sec-title">🗂️ المهام</h2>
      <button class="btn btn-primary" @click="showForm = true">➕ مهمة جديدة</button>
    </div>

    <!-- خانات العرض: النشطة / الأرشيف / المحذوفة -->
    <div class="filter-bar">
      <button class="chip" :class="{ active: view === 'active' }" @click="view = 'active'">📤 المهام النشطة</button>
      <button class="chip" :class="{ active: view === 'archived' }" @click="view = 'archived'">📦 الأرشيف ({{ store.archivedTasks.length }})</button>
      <button class="chip" :class="{ active: view === 'trash' }" @click="view = 'trash'">🗑️ المحذوفة ({{ store.deletedTasks.length }})</button>
    </div>

    <!-- فلترة الفترة — الافتراضي اليوم -->
    <div v-if="view === 'active'" class="filter-bar">
      <button v-for="[k, lbl] in PERIODS" :key="k" class="chip" :class="{ active: period === k }" @click="period = k">
        {{ lbl }}
      </button>
    </div>

    <!-- فلترة الحالة -->
    <div class="filter-bar">
      <button class="chip" :class="{ active: statusFilter === 'all' }" @click="statusFilter = 'all'">الكل ({{ counts.all || 0 }})</button>
      <button v-for="s in ['scheduled','available','accepted','in_progress','pending_approval','completed','rejected','cancelled']"
              :key="s" class="chip" :class="{ active: statusFilter === s }" @click="statusFilter = s">
        {{ statusLabel(s) }} ({{ counts[s] || 0 }})
      </button>
    </div>

    <div class="cards-list">
      <div v-for="t in baseList" :key="t.id" class="tcard"
           :class="{ 'emp-disabled': t.deleted, 'archived-card': t.archived }"
           :style="{ borderRightColor: borderColor(t) }" @click="detailId = t.id">
        <div class="tcard-top">
          <span class="tcard-title">#{{ t.no }} {{ t.title }}</span>
          <span class="points-chip">⭐ {{ pointsFmt(t.points) }}</span>
          <span :class="statusClass(t.status)">{{ statusLabel(t.status) }}</span>
          <span class="st" :class="'st-' + t.assignmentType">{{ ASSIGN_LABELS[t.assignmentType] || t.assignmentType }}</span>
        </div>
        <div class="tcard-meta">
          <span>🏷️ {{ t.taskTypeName }}</span>
          <span v-if="t.groupId && t.groupTargetName" style="color:#047857;font-weight:700">👥 {{ t.groupTargetName }} ({{ t.groupIndex }}/{{ t.groupTotal }})</span>
          <span v-else-if="t.groupId">👥 نسخة {{ t.groupIndex }}/{{ t.groupTotal }} — المهمة الجماعية</span>
          <span v-else-if="t.groupParent" style="color:#047857;font-weight:700">👥 مهمة جماعية مجدولة — تنسخ وقت الإرسال</span>
          <span v-if="t.assignedToName">👤 {{ t.assignedToName }}</span>
          <span v-else-if="t.offeredTo && t.offeredTo.length">📤 معروضة على {{ t.offeredTo.length }} موظف</span>
          <span v-if="t.sendAt && t.status === 'scheduled'">⏰ ترسل: {{ fmtDateTime(t.sendAt) }}</span>
          <span>🕒 {{ fmtDateTime(t.createdAt) }}</span>
          <span v-if="(t.views || []).length" title="من فتح المهمة">👁️ {{ t.views.length }} شاهد</span>
          <span v-if="(t.declinedBy || []).length" class="minus" title="من رفض المهمة">🚫 {{ t.declinedBy.length }} رفض</span>
          <span v-if="t.archived">📦 {{ fmtDateTime(t.archivedAt) }}</span>
          <span v-if="t.deleted">🗑️ {{ fmtDateTime(t.deletedAt) }}</span>
        </div>
        <div v-if="view === 'active' && canTouch(t)" class="tcard-actions" @click.stop>
          <button class="btn btn-sm btn-outline" @click="quickArchive(t)">📦 أرشفة</button>
          <button class="btn btn-sm btn-danger-ghost" @click="quickDelete(t)">🗑️ حذف (ناعم)</button>
        </div>
        <div v-if="view === 'archived' && canTouch(t)" class="tcard-actions" @click.stop>
          <button class="btn btn-sm btn-primary" @click="quickUnarchive(t)">📤 إخراج من الأرشيف</button>
          <button class="btn btn-sm btn-danger-ghost" @click="quickDelete(t)">🗑️ حذف (ناعم)</button>
        </div>
        <div v-if="view === 'trash'" class="tcard-actions" @click.stop>
          <button class="btn btn-sm btn-primary" @click="restore(t)">♻️ استعادة</button>
        </div>
      </div>
      <div v-if="!baseList.length" class="empty">
        <span class="big">{{ view === 'trash' ? '🗑️' : view === 'archived' ? '📦' : '🗂️' }}</span>
        {{ view === 'trash' ? 'سلة المحذوفات فاضية — كل حذف بالنظام ناعم وقابل للاستعادة' : view === 'archived' ? 'الأرشيف فاضي — أرشف المهام المنتهية لتنظيم القوائم' : 'لا توجد مهام بهذه الفترة' }}
      </div>
    </div>

    <TaskFormModal v-if="showForm" :edit-task="editTask" @close="showForm = false; editTask = null" />
    <TaskDetailModal v-if="detailId" :task-id="detailId" @close="detailId = null" @edit="openEdit($event)" />
  </section>
</template>
