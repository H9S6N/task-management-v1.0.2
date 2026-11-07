<script setup>
/* إضافة/تعديل مدير مهام + تحديد الموظفين المرتبطين به */
import { ref, computed } from 'vue'
import { useStore } from '../../store.js'
import Modal from '../Modal.vue'

const store = useStore()
const props = defineProps({ mgrId: { type: String, default: null } })
const emit = defineEmits(['close'])

const editing = computed(() => props.mgrId ? store.getManager(props.mgrId) : null)

const fullName = ref(editing.value?.fullName || '')
const username = ref(editing.value?.username || '')
const password = ref('')
const bound = ref(new Set(editing.value?.boundEmployeeIds || []))

const employees = computed(() => store.listEmployees(true).filter(e => !e.deleted))

function toggle(id) {
  bound.value.has(id) ? bound.value.delete(id) : bound.value.add(id)
  bound.value = new Set(bound.value)
}

async function save() {
  if (!fullName.value.trim()) { store.toast('اكتب الاسم', 'err'); return }
  if (!username.value.trim()) { store.toast('اكتب اسم المستخدم', 'err'); return }
  try {
    if (editing.value) {
      const patch = { fullName: fullName.value.trim(), username: username.value.trim(), boundEmployeeIds: [...bound.value] }
      if (password.value) patch.password = password.value
      await store.updateManager(editing.value.id, patch)
      store.toast('تم حفظ مدير المهام ✅', 'ok')
    } else {
      if (password.value.length < 4) { store.toast('كلمة المرور 4 أحرف على الأقل', 'err'); return }
      await store.addManager({
        fullName: fullName.value.trim(), username: username.value.trim(),
        password: password.value, boundEmployeeIds: [...bound.value],
      })
      store.toast('تم إنشاء مدير المهام ✅ — سجل دخوله: ' + username.value.trim(), 'ok')
    }
    emit('close')
  } catch { /* التوست من store */ }
}
</script>

<template>
  <Modal @close="emit('close')">
    <h3>{{ editing ? '✏️ تعديل مدير مهام: ' + editing.fullName : '➕ مدير مهام جديد' }}</h3>

    <div class="grid-2">
      <div><label>الاسم الكامل *</label><input v-model="fullName" maxlength="60"></div>
      <div><label>اسم المستخدم (للدخول) *</label><input v-model="username" dir="ltr" maxlength="40" placeholder="manager1"></div>
    </div>
    <div>
      <label>{{ editing ? 'كلمة مرور جديدة (اتركها فارغة للإبقاء)' : 'كلمة المرور *' }}</label>
      <input v-model="password" type="password" maxlength="64" autocomplete="off">
    </div>

    <label>🔗 الموظفون المرتبطون به — يرسل المهام لهؤلاء فقط ({{ bound.size }})</label>
    <div class="checks">
      <label v-for="e in employees" :key="e.id" class="check-pill"
             :class="{ 'pill-active': bound.has(e.id) }">
        <input type="checkbox" :checked="bound.has(e.id)" @change="toggle(e.id)">
        {{ e.fullName }}
        <span v-if="e.status !== 'active'" class="muted">({{ e.status === 'on_leave' ? 'مجاز' : 'موقوف' }})</span>
      </label>
    </div>
    <p class="hint">الموظف لا يشوف مين أرسل المهمة — يظهر له "الإدارة" دائماً. أنت فقط ترى هوية المرسل من تفاصيل المهمة وسجل النظام.</p>

    <div class="form-actions">
      <button class="btn btn-primary" @click="save">حفظ</button>
      <button class="btn btn-outline" @click="emit('close')">إلغاء</button>
    </div>
  </Modal>
</template>
