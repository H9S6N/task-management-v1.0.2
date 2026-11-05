<script setup>
/* تعديل النقاط + عدد المهام المكتملة — زيادة/خصم أو تعيين قيمة محددة */
import { ref, computed } from 'vue'
import { useStore } from '../../store.js'
import { pointsFmt } from '../../utils.js'
import Modal from '../Modal.vue'

const store = useStore()
const props = defineProps({ empId: String })
const emit = defineEmits(['close'])

const emp = computed(() => store.getEmployee(props.empId))

const mode = ref('delta')            // delta = زيادة/خصم | set = تعيين قيمة محددة
const amount = ref('')
const reason = ref('')
const setBalance = ref('')
const setCompleted = ref('')

async function save() {
  if (mode.value === 'delta') {
    const a = Number(amount.value)
    if (!a) { store.toast('اكتب المقدار', 'err'); return }
    if (reason.value.trim().length < 3) { store.toast('اكتب سبب التعديل', 'err'); return }
    await store.adjustPoints(props.empId, a, reason.value.trim())
    emit('close')
    return
  }
  // تعيين قيم محددة
  const patch = { reason: reason.value.trim() || 'تصحيح من المدير' }
  const b = setBalance.value === '' ? null : Number(setBalance.value)
  const c = setCompleted.value === '' ? null : Math.max(0, parseInt(setCompleted.value, 10) || 0)
  if (b == null && c == null) { store.toast('اكتب رصيداً أو عدد مهام لتعيينه', 'err'); return }
  if (b != null && isNaN(b)) { store.toast('الرصيد غير صحيح', 'err'); return }
  patch.balance = b
  patch.tasksCompleted = c
  try {
    await store.setEmployeeStats(props.empId, patch)
    emit('close')
  } catch { /* التوست من store */ }
}
</script>

<template>
  <Modal @close="emit('close')">
    <h3>⭐ تعديل: {{ emp?.fullName }}</h3>
    <p class="muted">الرصيد الحالي: <b>{{ pointsFmt(emp?.totalPoints) }}</b> — المكتملة: <b>{{ emp?.tasksCompleted || 0 }}</b> — كل تغيير يُسجل بالسجل</p>

    <div class="filter-bar">
      <button class="chip" :class="{ active: mode === 'delta' }" @click="mode = 'delta'">➕ زيادة / ➖ خصم</button>
      <button class="chip" :class="{ active: mode === 'set' }" @click="mode = 'set'">🎯 تعيين قيمة محددة</button>
    </div>

    <template v-if="mode === 'delta'">
      <div class="grid-2">
        <div><label>المقدار (استخدم - للخصم)</label><input v-model="amount" type="number" step="0.5" placeholder="مثال: 2 أو -1"></div>
        <div><label>السبب *</label><input v-model="reason" placeholder="مثال: مكافأة، خصم تأخير..."></div>
      </div>
    </template>

    <template v-else>
      <div class="grid-2">
        <div><label>تعيين الرصيد إلى</label><input v-model="setBalance" type="number" step="0.5" :placeholder="String(emp?.totalPoints ?? 0)"></div>
        <div><label>تعيين عدد المهام المكتملة إلى</label><input v-model="setCompleted" type="number" min="0" :placeholder="String(emp?.tasksCompleted ?? 0)"></div>
      </div>
      <label>السبب (يُسجل بالسجل) *</label>
      <input v-model="reason" placeholder="مثال: تصحيح إحصائيات، تسوية يدوية...">
      <p class="hint">اترك الحقل فارغاً إذا ما تريد تغييره — الفرق بالنقاط يُسجل تلقائياً بسجل النقاط</p>
    </template>

    <div class="form-actions">
      <button class="btn btn-primary" @click="save">{{ mode === 'delta' ? 'تطبيق' : 'تعيين' }}</button>
      <button class="btn btn-outline" @click="emit('close')">إلغاء</button>
    </div>
  </Modal>
</template>
