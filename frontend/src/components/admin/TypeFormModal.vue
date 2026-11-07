<script setup>
import { ref, computed } from 'vue'
import { useStore } from '../../store.js'
import Modal from '../Modal.vue'

const store = useStore()
const props = defineProps({ typeId: { type: String, default: null } })
const emit = defineEmits(['close'])

const editing = computed(() => props.typeId ? store.getTaskType(props.typeId) : null)

const name = ref(editing.value?.name || '')
const code = ref(editing.value?.code || '')
const description = ref(editing.value?.description || '')
const defaultPoints = ref(editing.value ? editing.value.defaultPoints : 1)
const requiresReport = ref(editing.value ? !!editing.value.requiresReport : true)
const requiresPhotos = ref(!!editing.value?.requiresPhotos)
const photosMandatory = ref(!!editing.value?.photosMandatory)
const autoDistributable = ref(editing.value ? editing.value.autoDistributable !== false : true)
const directOnly = ref(!!editing.value?.directOnly)

async function save() {
  if (!name.value.trim()) { store.toast('اكتب اسم النوع', 'err'); return }
  if (!code.value.trim()) { store.toast('اكتب كود النوع', 'err'); return }
  const data = {
    name: name.value.trim(), code: code.value.trim().toUpperCase(),
    description: description.value.trim(),
    defaultPoints: Number(defaultPoints.value) || 0,
    requiresReport: requiresReport.value, requiresPhotos: requiresPhotos.value,
    photosMandatory: photosMandatory.value,
    autoDistributable: autoDistributable.value, directOnly: directOnly.value,
  }
  try {
    if (editing.value) {
      const { code: _ignored, ...patch } = data   // الكود لا يتغير بعد الإنشاء
      await store.updateTaskType(editing.value.id, patch)
      store.toast('تم الحفظ ✅', 'ok')
    } else {
      await store.addTaskType(data)
      store.toast('تم إضافة النوع ✅', 'ok')
    }
    emit('close')
  } catch { /* التوست من store */ }
}
</script>

<template>
  <Modal @close="emit('close')">
    <h3>{{ editing ? '✏️ تعديل نوع: ' + editing.name : '➕ نوع مهمة جديد' }}</h3>

    <div class="grid-2">
      <div><label>الاسم *</label><input v-model="name" maxlength="40"></div>
      <div><label>الكود (لاتيني فريد) *</label><input v-model="code" dir="ltr" maxlength="20" :readonly="!!editing"></div>
    </div>

    <label>الوصف</label>
    <input v-model="description" maxlength="150">

    <div class="grid-2">
      <div><label>النقاط الافتراضية</label><input v-model="defaultPoints" type="number" step="0.5" min="0"></div>
    </div>

    <label>المتطلبات</label>
    <div class="checks">
      <label class="check-pill"><input type="checkbox" v-model="requiresReport"> 📄 يتطلب تقرير</label>
      <label class="check-pill"><input type="checkbox" v-model="requiresPhotos"> 📷 يتطلب صور</label>
      <label class="check-pill"><input type="checkbox" v-model="photosMandatory"> ❗ صور إلزامية</label>
    </div>

    <label>التوزيع</label>
    <div class="checks">
      <label class="check-pill"><input type="checkbox" v-model="autoDistributable"> 📤 يدخل بالتوزيع التلقائي</label>
      <label class="check-pill"><input type="checkbox" v-model="directOnly"> 👤 تكليف مباشر فقط</label>
    </div>

    <div class="form-actions">
      <button class="btn btn-primary" @click="save">حفظ</button>
      <button class="btn btn-outline" @click="emit('close')">إلغاء</button>
    </div>
  </Modal>
</template>
