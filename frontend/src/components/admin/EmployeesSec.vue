<script setup>
/* الموظفون — v1.0.2:
   - الموظف الموقوف يظهر بلون باهت/شفاف، والمجاز بلون مميز عن المتوفر
   - زر إجازة بدون وقت: تشغيل/إيقاف فقط — إجازة مفتوحة حتى يعيدها المدير
   - الضغط على كرت الموظف يفتح ملفه: تقييمه + مهامه السابقة + إسناد مهمة مباشرة
   - حذف ناعم مع استعادة (ماكو حذف نهائي)
   - ترتيب بالنقاط تنازلياً */
import { ref, computed } from 'vue'
import { useStore } from '../../store.js'
import { pointsFmt, isOnLeaveNow, EMP_STATUSES } from '../../utils.js'
import EmployeeFormModal from './EmployeeFormModal.vue'
import PointsAdjustModal from './PointsAdjustModal.vue'
import EmployeeProfileModal from './EmployeeProfileModal.vue'

const store = useStore()
const editId = ref(null)
const showForm = ref(false)
const adjustId = ref(null)
const busyId = ref('')
const showDeleted = ref(false)
const search = ref('')
const profileId = ref(null)

function openNew() { editId.value = null; showForm.value = true }
function openEdit(id) { editId.value = id; showForm.value = true }
const filtered = computed(() => {
  const src = showDeleted.value ? store.employees.filter(e => e.deleted) : store.listEmployees(true)
  const q = search.value.trim().toLowerCase()
  return q ? src.filter(e => (e.fullName || '').toLowerCase().includes(q) || (e.username || '').toLowerCase().includes(q)) : src
})

async function toggleDisable(e) {
  const toDisabled = e.status !== 'disabled'
  const ok = await store.confirm(
    toDisabled ? 'إيقاف الموظف' : 'تفعيل الموظف',
    toDisabled
      ? `يوقف حساب "${e.fullName}" نهائياً — ما يكدر يدخل ولا يستلم شي، ويظهر بلون باهت بالقائمة`
      : `تفعيل حساب "${e.fullName}" من جديد`,
    toDisabled
  )
  if (!ok) return
  busyId.value = e.id
  await store.updateEmployee(e.id, { status: toDisabled ? 'disabled' : 'active' })
  busyId.value = ''
}

/* زر الإجازة — v1.0.2: بدون وقت ولا أيام، تشغيل/إيقاف فقط
   المجاز: يدخل ويشوف حسابه عادي لكن ما يوصله شي ويظهر مجازاً وغير متوفر */
async function toggleLeave(e) {
  const leaving = e.status !== 'on_leave'
  if (leaving) {
    const ok = await store.confirm('إجازة الموظف (بدون وقت)',
      `"${e.fullName}" راح يدخل إجازة مفتوحة — تشغيل/إيقاف فقط بدون أيام.\n` +
      `يدخل ويشوف حسابه عادي، لكن ما يوصله مهام ولا إشعارات، وما ينحسب بالتوزيع،\n` +
      `ويظهر عندك وعند مدير المهام كـ «مجاز حالياً — غير متوفر». متابعة؟`)
    if (!ok) return
    busyId.value = e.id
    await store.toggleLeave(e.id, true)
    busyId.value = ''
  } else {
    busyId.value = e.id
    await store.toggleLeave(e.id, false)
    busyId.value = ''
    store.toast(`تمت عودة "${e.fullName}" من الإجازة ✅`, 'ok')
  }
}

async function toggleDelete(e) {
  if (!e.deleted) {
    const ok = await store.confirm('حذف الموظف',
      `حذف "${e.fullName}" حذف ناعم — يختفي من القوائم ولا يكدر يدخل، وتبقى سجلاته كلها.\n` +
      `تكدر تستعيده من زر "المحذوفون" فوق. متابعة؟`, true)
    if (!ok) return
    busyId.value = e.id
    await store.updateEmployee(e.id, { deleted: true })
    busyId.value = ''
  } else {
    busyId.value = e.id
    await store.updateEmployee(e.id, { deleted: false })
    busyId.value = ''
    store.toast(`تم استعادة "${e.fullName}" ✅`, 'ok')
  }
}

function cardClass(e) {
  return {
    'emp-disabled': e.status === 'disabled' || e.deleted,
    'emp-on-leave': e.status === 'on_leave' && !e.deleted,
  }
}
function borderColor(e) {
  if (e.deleted) return 'var(--muted)'
  if (e.status === 'disabled') return 'var(--line)'
  if (e.status === 'on_leave') return 'var(--warn)'
  return 'var(--ok)'
}
</script>

<template>
  <section>
    <div class="sec-head">
      <h2 class="sec-title">{{ store.isManager ? '👷 موظفاي المرتبطون' : '👥 الموظفون' }}</h2>
      <button v-if="store.isAdmin" class="btn btn-primary" @click="openNew">➕ إضافة موظف</button>
    </div>

    <div class="filter-bar">
      <input v-model="search" class="input-inline" placeholder="🔎 بحث بالاسم..." style="max-width:220px">
      <button class="chip" :class="{ active: showDeleted }" @click="showDeleted = !showDeleted">
        🗑️ المحذوفون ({{ store.employees.filter(e => e.deleted).length }})
      </button>
      <span class="hint" style="align-self:center">
        الموقوف يظهر <b>باهت</b> — المجاز بلون <b class="leave-color">مميز</b> — مرتبين بالنقاط ⬇️
      </span>
    </div>

    <div class="cards-list">
      <div v-for="e in filtered" :key="e.id" class="tcard emp-clickable"
           :class="cardClass(e)"
           :style="{ borderRightColor: borderColor(e) }"
           @click="profileId = e.id"
           :title="'فتح ملف ' + e.fullName">
        <div class="tcard-top">
          <span class="tcard-title">👷 {{ e.fullName }}</span>
          <span class="points-chip">⭐ {{ pointsFmt(e.totalPoints) }}</span>
          <span v-if="e.deleted" class="st st-cancelled">محذوف</span>
          <span v-else class="st" :class="'st-' + e.status">
            {{ EMP_STATUSES[e.status] || e.status }}{{ isOnLeaveNow(e) && e.status === 'on_leave' ? ' — غير متوفر حالياً' : '' }}
          </span>
        </div>
        <div class="tcard-meta">
          <span v-if="e.username">👤 {{ e.username }}</span>
          <span>✅ {{ e.tasksCompleted || 0 }} مكتملة</span>
          <span>❌ {{ e.tasksRejected || 0 }} مرفوضة</span>
          <span v-if="e.telegramChatId">📬 TG: {{ e.telegramChatId }}</span>
          <span v-if="e.notificationsEnabled === false">🔕 إشعارات مطفأة</span>
          <span v-if="(e.exceptions || []).length">🚫 مستثنى من {{ e.exceptions.length }} نوع</span>
          <span v-if="e.notes">📝 {{ e.notes }}</span>
        </div>
        <div class="tcard-actions" @click.stop>
          <button class="btn btn-sm btn-outline" @click="profileId = e.id">📋 ملفه ومهامه</button>
          <!-- المدير العام: إدارة كاملة — مدير المهام: متابعة فقط -->
          <template v-if="!e.deleted && store.isAdmin">
            <button class="btn btn-sm btn-outline" @click="openEdit(e.id)">✏️ تعديل</button>
            <button class="btn btn-sm btn-outline" @click="adjustId = e.id">⭐ النقاط</button>
            <button class="btn btn-sm" :class="e.status === 'on_leave' ? 'btn-primary' : 'btn-warn'"
                    :disabled="busyId === e.id" @click="toggleLeave(e)"
                    :title="e.status === 'on_leave' ? 'إرجاعه من الإجازة (تشغيل/إيقاف بدون وقت)' : 'إجازة بدون وقت — ما يوصله شي حتى تعيده'">
              {{ e.status === 'on_leave' ? '▶️ عودة من الإجازة' : '🏖️ إجازة' }}
            </button>
            <button class="btn btn-sm btn-ghost" :disabled="busyId === e.id" @click="toggleDisable(e)">
              {{ e.status === 'disabled' ? '▶️ تفعيل' : '⏸️ إيقاف' }}
            </button>
            <button class="btn btn-sm btn-danger-ghost" @click="toggleDelete(e)">🗑️ حذف</button>
          </template>
          <template v-else-if="!e.deleted && store.isManager">
            <span class="muted">متابعة فقط — التعديل من المدير العام</span>
          </template>
          <template v-else-if="e.deleted && store.isAdmin">
            <button class="btn btn-sm btn-primary" :disabled="busyId === e.id" @click="toggleDelete(e)">♻️ استعادة</button>
          </template>
        </div>
      </div>
      <div v-if="!filtered.length" class="empty">
        <span class="big">👥</span>
        {{ showDeleted ? 'ماكو موظفين محذوفين' : 'لا يوجد موظفون — أضف أول موظف' }}
      </div>
    </div>

    <EmployeeProfileModal v-if="profileId" :emp-id="profileId" @close="profileId = null" />
    <EmployeeFormModal v-if="showForm" :emp-id="editId" @close="showForm = false" />
    <PointsAdjustModal v-if="adjustId" :emp-id="adjustId" @close="adjustId = null" />
  </section>
</template>
