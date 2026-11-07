<script setup>
/* نافذة رفع التقرير — ضغط الصور + رفعها للخادم + إرسال التقرير */
import { ref, computed } from 'vue'
import { useStore } from '../../store.js'
import { compressImage } from '../../utils.js'
import { apiUpload } from '../../api.js'
import Modal from '../Modal.vue'

const store = useStore()
const props = defineProps({ taskId: String })
const emit = defineEmits(['close'])

const task = computed(() => store.getTask(props.taskId))
const reportText = ref('')
const photos = ref([])          // [{preview, file}]
const uploading = ref(false)
const busy = ref(false)
const fileInput = ref(null)

const photoWord = computed(() => {
  const t = task.value
  if (!t) return ''
  return t.photosMandatory ? '📷 الصور إلزامية لهذه المهمة' : (t.requiresPhotos ? '📷 الصور مطلوبة نوعاً لكنها غير إلزامية' : '')
})

async function onPick(ev) {
  const files = Array.from(ev.target.files || [])
  for (const f of files) {
    if (photos.value.length >= 3) { store.toast('الحد الأقصى 3 صور', 'err'); break }
    try {
      const compressed = await compressImage(f)
      photos.value.push({ preview: URL.createObjectURL(compressed), file: compressed })
    } catch (e) { store.toast(e.message, 'err') }
  }
  ev.target.value = ''
}

function removePhoto(i) {
  URL.revokeObjectURL(photos.value[i].preview)
  photos.value.splice(i, 1)
}

async function save() {
  const t = task.value
  if (t.requiresReport && reportText.value.trim().length < 3) { store.toast('اكتب نص التقرير', 'err'); return }
  if (t.photosMandatory && !photos.value.length) { store.toast('هذه المهمة تتطلب صور إلزامية', 'err'); return }

  busy.value = true
  try {
    // رفع الصور أولاً
    const photoIds = []
    uploading.value = photos.value.length > 0
    for (const p of photos.value) {
      const r = await apiUpload(p.file)
      photoIds.push(r.id)
    }
    uploading.value = false
    await store.submitReport(props.taskId, reportText.value.trim(), photoIds)
    emit('close')
    store.toast('تم إرسال التقرير للمراجعة ✅', 'ok')
  } catch (e) {
    uploading.value = false
    if (e.message) store.toast(e.message, 'err')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <Modal @close="emit('close')">
    <template v-if="task">
      <h3>📤 رفع تقرير — مهمة #{{ task.no }}</h3>
      <p class="muted">{{ task.title }}</p>
      <div v-if="task.rejectionReason" class="reject-box">سبب الرفض السابق: {{ task.rejectionReason }}</div>

      <label>نص التقرير {{ task.requiresReport ? '*' : '(اختياري)' }}</label>
      <textarea v-model="reportText" rows="4" placeholder="اشرح ما قمت به..."></textarea>

      <label>📷 صور ({{ photoWord || 'اختيارية' }}) — حتى 3 صور</label>
      <input ref="fileInput" type="file" accept="image/*" multiple style="padding:8px" @change="onPick">
      <div class="photo-pick">
        <div v-for="(p, i) in photos" :key="i" class="photo-thumb">
          <img :src="p.preview" alt="صورة">
          <button @click="removePhoto(i)">✕</button>
        </div>
      </div>

      <div class="form-actions">
        <button class="btn btn-primary" :disabled="busy" @click="save">
          {{ busy ? (uploading ? '⏳ جاري رفع الصور...' : '⏳ جاري الإرسال...') : 'إرسال للمراجعة' }}
        </button>
        <button class="btn btn-outline" @click="emit('close')">إلغاء</button>
      </div>
    </template>
  </Modal>
</template>
