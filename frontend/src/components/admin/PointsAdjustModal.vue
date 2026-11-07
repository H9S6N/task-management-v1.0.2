<script setup>
import { ref, computed } from 'vue'
import { useStore } from '../../store.js'
import { pointsFmt } from '../../utils.js'
import Modal from '../Modal.vue'

const store = useStore()
const props = defineProps({ empId: String })
const emit = defineEmits(['close'])

const emp = computed(() => store.getEmployee(props.empId))
const amount = ref('')
const reason = ref('')

async function save() {
  const a = Number(amount.value)
  if (!a) { store.toast('اكتب المقدار', 'err'); return }
  if (reason.value.trim().length < 3) { store.toast('اكتب سبب التعديل', 'err'); return }
  await store.adjustPoints(props.empId, a, reason.value.trim())
  emit('close')
}
</script>

<template>
  <Modal @close="emit('close')">
    <h3>⭐ تعديل نقاط: {{ emp?.fullName }}</h3>
    <p class="muted">الرصيد الحالي: <b>{{ pointsFmt(emp?.totalPoints) }}</b> نقطة — كل تعديل يُسجل في السجل</p>
    <div class="grid-2">
      <div><label>المقدار (استخدم - للخصم)</label><input v-model="amount" type="number" step="0.5" placeholder="مثال: 2 أو -1"></div>
      <div><label>السبب *</label><input v-model="reason" placeholder="مثال: مكافأة، خصم تأخير..."></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" @click="save">تطبيق</button>
      <button class="btn btn-outline" @click="emit('close')">إلغاء</button>
    </div>
  </Modal>
</template>
