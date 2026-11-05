<script setup>
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
const telegramUsername = ref(editing.value?.telegramUsername || '')
const status = ref(editing.value?.status || 'active')
const notificationsEnabled = ref(editing.value ? editing.value.notificationsEnabled !== false : true)
const notes = ref(editing.value?.notes || '')
const exceptions = ref(new Set(editing.value?.exceptions || []))
const leaveStart = ref(editing.value?.leaveStart ? editing.value.leaveStart.slice(0, 10) : '')
const leaveEnd = ref(editing.value?.leaveEnd ? editing.value.leaveEnd.slice(0, 10) : '')

watch(status, v => { if (v !== 'on_leave') { leaveStart.value = ''; leaveEnd.value = '' } })

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
  if (!editing.value && pin.value.length < 4) { store.toast('الرمز السري 4 أرقام على الأقل', 'err'); return }
  if (editing.value && pin.value && pin.value.length < 4) { store.toast('الرمز السري 4 أرقام على الأقل', 'err'); return }

  const patch = {
    fullName: fullName.value.trim(),
    username: username.value.trim(),
    telegramChatId: telegramChatId.value.trim(),
    telegramUsername: telegramUsername.value.trim(),
    status: status.value,
    notificationsEnabled: notificationsEnabled.value,
    notes: notes.value.trim(),
    exceptions: [...exceptions.value],
  }
  if (pin.value) patch.pin = pin.value
  if (status.value === 'on_leave') {
    patch.leaveStart = leaveStart.value || null
    patch.leaveEnd = leaveEnd.value || null
    if (!patch.leaveEnd) { store.toast('حدد تاريخ نهاية الإجازة', 'err'); return }
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
      <div><label>اسم المستخدم (للدخول)</label><input v-model="username" maxlength="40" dir="ltr"></div>
    </div>
    <div class="grid-2">
      <div>
        <label>{{ editing ? 'رمز سري جديد (اتركه فارغاً للإبقاء)' : 'الرمز السري PIN * (4 أرقام أو أكثر)' }}</label>
        <input v-model="pin" type="password" inputmode="numeric" maxlength="10" autocomplete="off">
      </div>
      <div><label>Chat ID تيليكرام (للإشعارات)</label><input v-model="telegramChatId" dir="ltr" placeholder="123456789"></div>
    </div>
    <div class="grid-2">
      <div><label>معرف تيليكرام @username (يُحفظ مع بياناته)</label><input v-model="telegramUsername" dir="ltr" placeholder="@username"></div>
      <div></div>
    </div>
    <div class="grid-2">
      <div>
        <label>الحالة</label>
        <select v-model="status">
          <option value="active">نشط</option>
          <option value="on_leave">في إجازة</option>
          <option value="disabled">موقوف</option>
        </select>
      </div>
      <div>
        <label>الإشعارات</label>
        <select v-model="notificationsEnabled">
          <option :value="true">🔔 مفعلة</option>
          <option :value="false">🔕 مطفأة</option>
        </select>
      </div>
    </div>

    <div v-if="status === 'on_leave'">
      <div class="grid-2">
        <div><label>بداية الإجازة</label><input v-model="leaveStart" type="date"></div>
        <div><label>نهاية الإجازة (يرجع تلقائياً بعدها)</label><input v-model="leaveEnd" type="date"></div>
      </div>
    </div>

    <label>ملاحظات</label>
    <input v-model="notes" maxlength="200">

    <!-- ============ سجل الموظف ============ -->
    <div v-if="editing" class="detail-sec" style="margin-top:16px">
      <div class="lbl">📊 سجل هذا الموظف — {{ recLoading ? '⏳ جاري التحميل...' : `${recData.total} حركة` }}</div>

      <div class="filter-bar">
        <button v-for="[k, lbl] in PERIODS" :key="k" class="chip" :class="{ active: recPeriod === k }" @click="recPeriod = k; resetRecDate()">{{ lbl }}</button>
        <input v-if="recPeriodDate" v-model="recDate" :type="recPeriodDate" class="input-inline" style="max-width:150px">
        <select v-model.number="recLimit" class="input-inline" style="max-width:120px">
          <option :value="10">10 مخرجات</option>
          <option :value="25">25 مخرج</option>
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
