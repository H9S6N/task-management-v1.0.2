<script setup>
/* إضافة/تعديل موظف — v1.0.2:
   - اسم المستخدم + كلمة المرور ضروريات إلزامية — يدخل بهما الموظف من صفحة الدخول الموحدة
   - الإجازة بدون تواريخ: تشغيل/إيقاف فقط من زر الإجازة بقائمة الموظفين
   - تعديل عدد المهام المكتملة مباشرة */
import { ref, computed, watch } from 'vue'
import { useStore } from '../../store.js'
import { api } from '../../api.js'
import { pointsFmt, fmtDateTime } from '../../utils.js'
import Modal from '../Modal.vue'

const store = useStore()
const props = defineProps({ empId: { type: String, default: null } })
const emit = defineEmits(['close'])

const editing = computed(() => props.empId ? store.getEmployee(props.empId) : null)
const types = computed(() => store.listTaskTypes(false))

const fullName = ref(editing.value?.fullName || '')
const username = ref(editing.value?.username || '')
const pin = ref('')
const telegramChatId = ref(editing.value?.telegramChatId || '')
const status = ref(editing.value?.status || 'active')
const notificationsEnabled = ref(editing.value ? editing.value.notificationsEnabled !== false : true)
const notes = ref(editing.value?.notes || '')
const exceptions = ref(new Set(editing.value?.exceptions || []))
const completedCount = ref(editing.value ? (editing.value.tasksCompleted || 0) : 0)

/* ============ سجل الموظف — فلترة حسب اليوم/الشهر/السنة/الكل + عدد مخرجات (الافتراضي 10) ============ */
const recPeriod = ref('month')
const recDate = ref('')
const recLimit = ref(10)
const recData = ref({ total: 0, summary: { count: 0, sumPositive: 0, sumNegative: 0 }, items: [] })
const recLoading = ref(false)

function _iso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function resetRecDate() {
  const d = new Date()
  if (recPeriod.value === 'day') recDate.value = _iso(d)
  else if (recPeriod.value === 'month') recDate.value = _iso(d).slice(0, 7)
  else if (recPeriod.value === 'year') recDate.value = d.getFullYear()
  else recDate.value = ''
}
resetRecDate()

const PERIODS = [['day', 'اليوم'], ['month', 'الشهر'], ['year', 'السنة'], ['all', 'الكل']]
const recPeriodDate = computed(() => {
  if (recPeriod.value === 'day') return 'date'
  if (recPeriod.value === 'month') return 'month'
  if (recPeriod.value === 'year') return 'number'
  return null
})

async function loadRecord() {
  if (!props.empId) return
  recLoading.value = true
  try {
    const p = new URLSearchParams({ employeeId: props.empId, period: recPeriod.value, limit: String(recLimit.value) })
    if (recPeriod.value !== 'all') p.set('date', String(recDate.value || ''))
    recData.value = await api('/api/ledger?' + p.toString())
  } catch (e) { store.toast(e.message, 'err') }
  recLoading.value = false
}
watch([recPeriod, recDate, recLimit], () => { if (recPeriod.value !== 'all' && !recDate.value) resetRecDate(); loadRecord() }, { immediate: true })

function toggleException(id) {
  exceptions.value.has(id) ? exceptions.value.delete(id) : exceptions.value.add(id)
  exceptions.value = new Set(exceptions.value)
}

async function save() {
  if (!fullName.value.trim()) { store.toast('اكتب اسم الموظف', 'err'); return }
  if (!username.value.trim()) { store.toast('اسم المستخدم ضروري — يدخل به الموظف من صفحة الدخول', 'err'); return }
  if (!editing.value && pin.value.length < 4) { store.toast('كلمة المرور ضرورية — 4 أحرف على الأقل', 'err'); return }
  if (editing.value && pin.value && pin.value.length < 4) { store.toast('كلمة المرور 4 أحرف على الأقل', 'err'); return }

  const patch = {
    fullName: fullName.value.trim(),
    username: username.value.trim(),
    telegramChatId: telegramChatId.value.trim(),
    status: status.value,
    notificationsEnabled: notificationsEnabled.value,
    notes: notes.value.trim(),
    exceptions: [...exceptions.value],
  }
  if (pin.value) patch.pin = pin.value
  /* الإجازة بدون تواريخ — تحويل الحالة إلى إجازة = إجازة مفتوحة من الآن (بدون وقت) */
  if (status.value === 'on_leave' && editing.value?.status !== 'on_leave') {
    patch.leaveStart = null
    patch.leaveEnd = null
  }
  if (editing.value) {
    const cc = parseInt(completedCount.value, 10)
    if (!isNaN(cc) && cc !== (editing.value.tasksCompleted || 0)) patch.completedCount = cc
  }

  try {
    if (editing.value) {
      await store.updateEmployee(editing.value.id, patch)
      store.toast('تم حفظ التعديلات ✅', 'ok')
    } else {
      await store.addEmployee({ ...patch, pin: pin.value })
      store.toast('تم إضافة الموظف ✅ — أعطه الرمز السري', 'ok')
    }
    emit('close')
  } catch { /* التوست من store */ }
}
</script>

<template>
  <Modal @close="emit('close')">
    <h3>{{ editing ? '✏️ تعديل موظف: ' + editing.fullName : '➕ إضافة موظف' }}</h3>

    <div class="grid-2">
      <div><label>الاسم الكامل *</label><input v-model="fullName" maxlength="60"></div>
      <div>
        <label>اسم المستخدم * (للدخول — ضروري)</label>
        <input v-model="username" dir="ltr" maxlength="40" placeholder="employee1" autocomplete="off">
      </div>
    </div>
    <div class="grid-2">
      <div>
        <label>{{ editing ? 'كلمة مرور جديدة (اتركها فارغة للإبقاء)' : 'كلمة المرور * (4 أحرف على الأقل)' }}</label>
        <input v-model="pin" type="password" maxlength="64" autocomplete="off">
      </div>
      <div><label>Chat ID تيليكرام (للإشعارات)</label><input v-model="telegramChatId" dir="ltr" placeholder="123456789"></div>
    </div>
    <div class="grid-2">
      <div>
        <label>الحالة</label>
        <select v-model="status">
          <option value="active">نشط</option>
          <option value="on_leave">في إجازة 🏖️ (بدون وقت — من زر الإجازة)</option>
          <option value="disabled">موقوف ⏸️</option>
        </select>
      </div>
      <div v-if="editing">
        <label>عدد المهام المكتملة (تعديل يدوي)</label>
        <input v-model.number="completedCount" type="number" min="0" class="input-sm">
      </div>
      <div v-else>
        <label>الإشعارات</label>
        <select v-model="notificationsEnabled">
          <option :value="true">🔔 مفعلة</option>
          <option :value="false">🔕 مطفأة</option>
        </select>
      </div>
    </div>

    <p v-if="status === 'on_leave'" class="hint">
      الإجازة بدون وقت — تشغيل/إيقاف فقط من زر «إجازة» بقائمة الموظفين.
      الموظف المجاز يدخل ويشوف حسابه عادي، لكن ما يوصله إشعارات ولا مهام جديدة ويظهر للإدارة كمجاز وغير متوفر.
    </p>

    <label>ملاحظات</label>
    <input v-model="notes" maxlength="200">

    <!-- ============ سجل الموظف ============ -->
    <div v-if="editing" class="detail-sec" style="margin-top:16px">
      <div class="lbl">📊 سجل نقاط هذا الموظف — {{ recLoading ? '⏳ جاري التحميل...' : `${recData.total} حركة` }}</div>

      <div class="filter-bar">
        <button v-for="[k, lbl] in PERIODS" :key="k" class="chip" :class="{ active: recPeriod === k }" @click="recPeriod = k; resetRecDate()">{{ lbl }}</button>
        <input v-if="recPeriodDate" v-model="recDate" :type="recPeriodDate" class="input-inline" style="max-width:150px">
        <select v-model.number="recLimit" class="input-inline" style="max-width:110px">
          <option :value="10">10 مخرجات</option>
          <option :value="50">50 مخرج</option>
          <option :value="100">100 مخرج</option>
        </select>
      </div>

      <p v-if="recPeriod !== 'all'" class="muted" style="margin:6px 0">
        الفترة: <b>{{ recData.summary.count }}</b> حركة —
        زيادات: <b class="plus">+{{ pointsFmt(recData.summary.sumPositive) }}</b> —
        خصومات: <b class="minus">{{ pointsFmt(recData.summary.sumNegative) }}</b>
      </p>

      <div class="table-wrap" style="max-height:260px">
        <table class="table">
          <thead><tr><th>التاريخ</th><th>التغيير</th><th>الرصيد</th><th>السبب</th></tr></thead>
          <tbody>
            <tr v-for="(l, i) in recData.items" :key="l.id || i">
              <td>{{ fmtDateTime(l.createdAt) }}</td>
              <td :class="l.changeAmount >= 0 ? 'plus' : 'minus'">{{ l.changeAmount >= 0 ? '+' : '' }}{{ pointsFmt(l.changeAmount) }}</td>
              <td>{{ pointsFmt(l.balanceAfter) }}</td>
              <td>{{ l.reason }}</td>
            </tr>
            <tr v-if="!recData.items.length"><td colspan="4" class="empty">لا توجد حركات بهذه الفترة</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <template v-if="types.length">
      <label>🚫 استثناء من أنواع مهام (لن تُعرض عليه ولن توزع تلقائياً عليه)</label>
      <div class="checks">
        <label v-for="t in types" :key="t.id" class="check-pill">
          <input type="checkbox" :checked="exceptions.has(t.id)" @change="toggleException(t.id)"> {{ t.name }}
        </label>
      </div>
    </template>

    <div class="form-actions">
      <button class="btn btn-primary" @click="save">حفظ</button>
      <button class="btn btn-outline" @click="emit('close')">إلغاء</button>
    </div>
  </Modal>
</template>
