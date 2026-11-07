<script setup>
import { ref, computed, watch } from 'vue'
import { useStore } from '../../store.js'
import { api } from '../../api.js'
import { pointsFmt, fmtDateTime, statusLabel, EMP_STATUSES, exportCSV } from '../../utils.js'

const store = useStore()

/* ==================== سجل النقاط — فلترة كاملة ==================== */
const ledEmp = ref('')
const ledPeriod = ref('month')
const ledDate = ref('')
const ledLimit = ref(50)
const ledData = ref({ total: 0, summary: { count: 0, sumPositive: 0, sumNegative: 0 }, items: [] })
const ledLoading = ref(false)

const today = new Date()
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function resetDate(r) {
  const d = new Date()
  if (r === 'day') return iso(d)
  if (r === 'month') return iso(d).slice(0, 7)
  if (r === 'year') return d.getFullYear()
  return ''
}
ledDate.value = resetDate('month')

const PERIODS = [['day', 'اليوم'], ['month', 'الشهر'], ['year', 'السنة'], ['all', 'الكل']]

async function loadLedger() {
  ledLoading.value = true
  try {
    const params = new URLSearchParams()
    if (ledEmp.value) params.set('employeeId', ledEmp.value)
    params.set('period', ledPeriod.value)
    if (ledPeriod.value !== 'all') params.set('date', String(ledDate.value || ''))
    params.set('limit', String(ledLimit.value))
    ledData.value = await api('/api/ledger?' + params.toString())
  } catch (e) { store.toast(e.message, 'err') }
  ledLoading.value = false
}
watch([ledEmp, ledPeriod, ledDate, ledLimit], () => { if (ledPeriod.value !== 'all' && !ledDate.value) ledDate.value = resetDate(ledPeriod.value); loadLedger() }, { immediate: true })

const ledPeriodDate = computed(() => {
  if (ledPeriod.value === 'day') return { type: 'date', placeholder: '' }
  if (ledPeriod.value === 'month') return { type: 'month', placeholder: '' }
  if (ledPeriod.value === 'year') return { type: 'number', placeholder: '2026' }
  return null
})

/* ==================== سجل النظام (اللوك) ==================== */
const audPeriod = ref('month')
const audDate = ref(resetDate('month'))
const audLimit = ref(50)
const audData = ref({ total: 0, items: [] })
const audLoading = ref(false)

const AUDIT_LABELS = {
  login: 'دخول', create_task: 'إنشاء مهمة', update_task: 'تعديل مهمة',
  accept_task: 'قبول مهمة', start_task: 'بدء مهمة', submit_task: 'رفع تقرير',
  approve_task: 'اعتماد', reject_task: 'رفض', cancel_task: 'إلغاء مهمة',
  unassign_task: 'إلغاء قبول', manual_points: 'تعديل نقاط', settings: 'إعدادات',
  change_password: 'تغيير كلمة المرور', auto_leave_end: 'انتهاء إجازة تلقائي',
  employee_add: 'إضافة موظف', employee_update: 'تعديل موظف',
}

async function loadAudit() {
  audLoading.value = true
  try {
    const params = new URLSearchParams()
    params.set('period', audPeriod.value)
    if (audPeriod.value !== 'all') params.set('date', String(audDate.value || ''))
    params.set('limit', String(audLimit.value))
    audData.value = await api('/api/audit?' + params.toString())
  } catch (e) { store.toast(e.message, 'err') }
  audLoading.value = false
}
watch([audPeriod, audDate, audLimit], () => { if (audPeriod.value !== 'all' && !audDate.value) audDate.value = resetDate(audPeriod.value); loadAudit() }, { immediate: true })

const audPeriodDate = computed(() => {
  if (audPeriod.value === 'day') return { type: 'date' }
  if (audPeriod.value === 'month') return { type: 'month' }
  if (audPeriod.value === 'year') return { type: 'number' }
  return null
})

function onPeriodChange(which) {
  if (which === 'led') ledDate.value = resetDate(ledPeriod.value)
  else audDate.value = resetDate(audPeriod.value)
}

/* ==================== الإحصائيات والترتيب ==================== */
const byAsc = computed(() =>
  store.employees.slice().sort((a, b) => (Number(a.totalPoints) || 0) - (Number(b.totalPoints) || 0))
)

const typeStats = computed(() =>
  store.listTaskTypes(false).map(t => {
    const mine = store.tasks.filter(x => x.taskTypeId === t.id)
    return {
      name: t.name, total: mine.length,
      completed: mine.filter(x => x.status === 'completed').length,
      working: mine.filter(x => ['accepted', 'in_progress', 'pending_approval'].includes(x.status)).length,
      auto: mine.filter(x => x.assignmentType === 'auto').length,
    }
  })
)

function expTasks() {
  exportCSV('tasks.csv', ['الرقم', 'العنوان', 'النوع', 'الحالة', 'نوع التوزيع', 'الموظف', 'النقاط', 'تاريخ الإنشاء', 'تاريخ الإكمال', 'سبب الرفض'],
    store.tasks.map(t => [
      '#' + t.no, t.title, t.taskTypeName, statusLabel(t.status),
      t.assignmentType === 'direct' ? 'مباشر' : 'تلقائي', t.assignedToName || '',
      t.points, fmtDateTime(t.createdAt), fmtDateTime(t.completedAt), t.rejectionReason || '',
    ]))
}
function expEmployees() {
  exportCSV('employees.csv', ['الاسم', 'المستخدم', 'الحالة', 'النقاط', 'مكتملة', 'مرفوضة', 'Chat ID', 'ملاحظات'],
    store.listEmployees(true).map(e => [
      e.fullName, e.username || '', EMP_STATUSES[e.status], e.totalPoints || 0,
      e.tasksCompleted || 0, e.tasksRejected || 0, e.telegramChatId || '', e.notes || '',
    ]))
}
function expLedger() {
  exportCSV('points_ledger.csv', ['التاريخ', 'الموظف', 'التغيير', 'الرصيد', 'السبب', 'بواسطة'],
    ledData.value.items.map(l => [fmtDateTime(l.createdAt), l.employeeName, l.changeAmount, l.balanceAfter, l.reason, l.performedBy || 'النظام']))
}
function expAudit() {
  exportCSV('system_log.csv', ['التاريخ', 'الحدث', 'التفاصيل', 'بواسطة'],
    audData.value.items.map(a => [fmtDateTime(a.createdAt), AUDIT_LABELS[a.action] || a.action, a.details, a.actor]))
}
</script>

<template>
  <section>
    <h2 class="sec-title">⭐ النقاط والتقارير</h2>

    <div class="card">
      <h3>🏅 ترتيب الموظفين (الأقل نقاطاً = أولوية التوزيع)</h3>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>#</th><th>الموظف</th><th>الحالة</th><th>النقاط</th><th>مكتملة</th><th>مرفوضة</th></tr></thead>
          <tbody>
            <tr v-for="(e, i) in byAsc" :key="e.id">
              <td>{{ i + 1 }}</td>
              <td><b>{{ e.fullName }}</b></td>
              <td><span class="st" :class="'st-' + e.status">{{ EMP_STATUSES[e.status] }}</span></td>
              <td>⭐ {{ pointsFmt(e.totalPoints) }}</td>
              <td>{{ e.tasksCompleted || 0 }}</td>
              <td>{{ e.tasksRejected || 0 }}</td>
            </tr>
            <tr v-if="!byAsc.length"><td colspan="6" class="empty">لا يوجد موظفون</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ==================== سجل النقاط المفلتر ==================== -->
    <div class="card">
      <div class="sec-head">
        <h3>📜 سجل النقاط والتقارير</h3>
        <span class="muted">{{ ledLoading ? '⏳ جاري التحميل...' : `${ledData.total} حركة` }}</span>
      </div>

      <div class="filter-bar">
        <select v-model="ledEmp" class="input-inline">
          <option value="">كل الموظفين</option>
          <option v-for="e in store.employees" :key="e.id" :value="e.id">{{ e.fullName }}</option>
        </select>
        <button v-for="[k, lbl] in PERIODS" :key="k" class="chip" :class="{ active: ledPeriod === k }" @click="ledPeriod = k; onPeriodChange('led')">{{ lbl }}</button>
        <input v-if="ledPeriodDate" v-model="ledDate" :type="ledPeriodDate.type" class="input-inline" style="max-width:150px">
        <select v-model.number="ledLimit" class="input-inline" style="max-width:110px">
          <option :value="10">10 مخرجات</option>
          <option :value="50">50 مخرج</option>
          <option :value="100">100 مخرج</option>
        </select>
      </div>

      <p v-if="ledPeriod !== 'all'" class="muted" style="margin:6px 0">
        ملخص الفترة: <b>{{ ledData.summary.count }}</b> حركة —
        زيادات: <b class="plus">+{{ pointsFmt(ledData.summary.sumPositive) }}</b> —
        خصومات: <b class="minus">{{ pointsFmt(ledData.summary.sumNegative) }}</b>
      </p>

      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>التاريخ</th><th>الموظف</th><th>التغيير</th><th>الرصيد بعدها</th><th>السبب</th><th>بواسطة</th></tr></thead>
          <tbody>
            <tr v-for="(l, i) in ledData.items" :key="l.id || i">
              <td>{{ fmtDateTime(l.createdAt) }}</td>
              <td>{{ l.employeeName }}</td>
              <td :class="l.changeAmount >= 0 ? 'plus' : 'minus'">{{ l.changeAmount >= 0 ? '+' : '' }}{{ pointsFmt(l.changeAmount) }}</td>
              <td>{{ pointsFmt(l.balanceAfter) }}</td>
              <td>{{ l.reason }}</td>
              <td>{{ l.performedBy || 'النظام' }}</td>
            </tr>
            <tr v-if="!ledData.items.length"><td colspan="6" class="empty">لا توجد حركات بهذه الفترة</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ==================== سجل النظام ==================== -->
    <div class="card">
      <div class="sec-head">
        <h3>🛡️ سجل النظام (اللوك)</h3>
        <span class="muted">{{ audLoading ? '⏳ جاري التحميل...' : `${audData.total} حدث` }}</span>
      </div>

      <div class="filter-bar">
        <button v-for="[k, lbl] in PERIODS" :key="k" class="chip" :class="{ active: audPeriod === k }" @click="audPeriod = k; onPeriodChange('aud')">{{ lbl }}</button>
        <input v-if="audPeriodDate" v-model="audDate" :type="audPeriodDate.type" class="input-inline" style="max-width:150px">
        <select v-model.number="audLimit" class="input-inline" style="max-width:110px">
          <option :value="10">10 مخرجات</option>
          <option :value="50">50 مخرج</option>
          <option :value="100">100 مخرج</option>
        </select>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>التاريخ</th><th>الحدث</th><th>التفاصيل</th><th>بواسطة</th></tr></thead>
          <tbody>
            <tr v-for="(a, i) in audData.items" :key="a.id || i">
              <td>{{ fmtDateTime(a.createdAt) }}</td>
              <td><b>{{ AUDIT_LABELS[a.action] || a.action }}</b></td>
              <td>{{ a.details }}</td>
              <td>{{ a.actor }}</td>
            </tr>
            <tr v-if="!audData.items.length"><td colspan="4" class="empty">لا توجد أحداث بهذه الفترة</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h3>📈 إحصائيات حسب النوع</h3>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>النوع</th><th>إجمالي</th><th>مكتملة</th><th>قيد العمل</th><th>موزع تلقائياً</th></tr></thead>
          <tbody>
            <tr v-for="s in typeStats" :key="s.name">
              <td><b>{{ s.name }}</b></td><td>{{ s.total }}</td><td>{{ s.completed }}</td><td>{{ s.working }}</td><td>{{ s.auto }}</td>
            </tr>
            <tr v-if="!typeStats.length"><td colspan="5" class="empty">لا توجد أنواع</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="export-row">
      <button class="btn btn-outline" @click="expTasks">📥 تصدير المهام CSV</button>
      <button class="btn btn-outline" @click="expEmployees">📥 تصدير الموظفين CSV</button>
      <button class="btn btn-outline" @click="expLedger">📥 تصدير سجل النقاط CSV</button>
      <button class="btn btn-outline" @click="expAudit">📥 تصدير سجل النظام CSV</button>
    </div>
  </section>
</template>
