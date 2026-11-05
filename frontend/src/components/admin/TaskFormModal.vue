<script setup>
import { ref, computed, watch } from 'vue'
import { useStore } from '../../store.js'
import { pointsFmt, isOnLeaveNow, humanizeDelay } from '../../utils.js'
import Modal from '../Modal.vue'

const store = useStore()
const props = defineProps({ editTask: { type: Object, default: null } })
const emit = defineEmits(['close'])

const editing = computed(() => !!props.editTask)
const types = computed(() => store.listTaskTypes(true))
const activeEmps = computed(() => store.listEmployees(false).filter(e => e.status === 'active'))

const typeId = ref(props.editTask?.taskTypeId || types.value[0]?.id || '')
const title = ref(props.editTask?.title || '')
const desc = ref(props.editTask?.description || '')
const points = ref(props.editTask ? props.editTask.points : null)
const assign = ref(props.editTask?.assignmentType || 'auto')
const empId = ref(activeEmps.value[0]?.id || '')

/* التحكم بالتوزيع التلقائي — الافتراضي من الإعدادات */
const dist = ref(store.settings.defaultDistribution || 'lowest')
const distCount = ref(Number(store.settings.defaultCandidates) || 1)

/* الجدولة: تبدأ عامة للكل ثم تتحول لعرض حصري بعد وقت — من ثواني إلى ساعات */
const scheduled = ref(false)
const delayNum = ref(30)
const delayUnit = ref('60')            // ثواني: 1 | دقائق: 60 | ساعات: 3600
const convertStrategy = ref('lowest')

const delaySeconds = computed(() => Math.max(1, Math.round((Number(delayNum.value) || 0) * Number(delayUnit.value))))
const delayText = computed(() => humanizeDelay(delaySeconds.value))

const STRATEGIES = [
  ['lowest', '⬇️ صاحب الأقل نقاطاً'],
  ['no_tasks', '🟢 موظف بلا مهام مفتوحة'],
  ['least_open', '📉 الأقل حمولة (مهام مفتوحة)'],
  ['random', '🎲 عشوائي'],
]

watch(typeId, id => {
  const t = store.getTaskType(id)
  if (t && !editing.value) points.value = t.defaultPoints
}, { immediate: true })

/* المؤهلون فعلياً: نشط + ليس في إجازة + غير مستثنى من النوع */
const eligible = computed(() => typeId.value
  ? activeEmps.value.filter(e =>
      !isOnLeaveNow(e) && !(e.exceptions || []).includes(typeId.value))
  : [])

const preview = computed(() => {
  const arr = eligible.value.slice()
  if (dist.value === 'lowest') {
    arr.sort((a, b) => (Number(a.totalPoints) || 0) - (Number(b.totalPoints) || 0))
    return arr.slice(0, distCount.value)
  }
  if (dist.value === 'random') {
    return arr.slice().sort(() => Math.random() - 0.5).slice(0, distCount.value)
  }
  return arr
})

async function save() {
  if (!title.value.trim()) { store.toast('اكتب عنوان المهمة', 'err'); return }
  const type = store.getTaskType(typeId.value)
  if (!editing.value && type?.directOnly && assign.value === 'auto') { store.toast('هذا النوع تكليف مباشر فقط', 'err'); return }
  if (!editing.value && scheduled.value && !eligible.value.length) { store.toast('لا يوجد موظفون مؤهلون للتحويل التلقائي', 'err'); return }
  try {
    const body = {
      taskTypeId: typeId.value, title: title.value.trim(),
      description: desc.value.trim(),
      points: points.value === '' || points.value == null ? null : Number(points.value),
    }
    if (editing.value) {
      await store.updateTask(props.editTask.id, body)
      store.toast('تم حفظ تعديلات المهمة ✅', 'ok')
    } else {
      body.assignmentType = assign.value
      body.createdBy = store.auth.name
      if (assign.value === 'direct') {
        body.offeredTo = [empId.value]
      } else if (scheduled.value) {
        // مهمة عامة الآن + تحويل تلقائي بعد الوقت المحدد
        body.delaySeconds = delaySeconds.value
        body.convertStrategy = convertStrategy.value
        body.offeredTo = []
      } else {
        body.offeredTo = preview.value.map(e => e.id)
        body.distribution = dist.value
        body.candidateCount = distCount.value
      }
      const r = await store.createTask(body)
      store.toast(scheduled.value
        ? `تم إنشاء المهمة #${r.task.no} 📢 — عامة للكل وتتحول بعد ${delayText.value} ⏰`
        : `تم إنشاء المهمة #${r.task.no} ✅ — الإشعارات تُرسل من الخادم تلقائياً 📩`, 'ok')
    }
    emit('close')
  } catch { /* التوست يظهر من store */ }
}
</script>

<template>
  <Modal @close="emit('close')">
    <h3>{{ editing ? `✏️ تعديل المهمة #${editTask.no}` : '➕ مهمة جديدة' }}</h3>

    <label>نوع المهمة</label>
    <select v-model="typeId" :disabled="editing">
      <option v-for="t in types" :key="t.id" :value="t.id">
        {{ t.name }} (⭐{{ pointsFmt(t.defaultPoints) }}{{ t.directOnly ? ' — تكليف مباشر فقط' : '' }})
      </option>
    </select>

    <label>عنوان المهمة</label>
    <input v-model="title" placeholder="مثال: كشف سوق المنصور" maxlength="120">

    <label>الوصف (اختياري)</label>
    <textarea v-model="desc" rows="2" placeholder="تفاصيل المهمة..."></textarea>

    <div class="grid-2">
      <div>
        <label>النقاط</label>
        <input v-model="points" type="number" step="0.5" min="0">
      </div>
      <div v-if="!editing">
        <label>طريقة التوزيع</label>
        <select v-model="assign">
          <option value="auto">📤 توزيع تلقائي</option>
          <option value="direct">👤 تكليف مباشر (يستلم تلقائياً)</option>
        </select>
      </div>
    </div>

    <!-- التحكم الكامل بالتوزيع التلقائي -->
    <template v-if="!editing && assign === 'auto'">
      <!-- الجدولة: عامة للكل ثم تتحول تلقائياً -->
      <div class="detail-sec schedule-box">
        <label class="switch-row" style="margin-bottom:4px">
          <input type="checkbox" v-model="scheduled">
          ⏰ أرسلها عامة للكل الآن ثم كلّف تلقائياً بعد وقت محدد
        </label>
        <p class="hint" style="margin:2px 0 10px">تبقى المهمة عامة (أي موظف يقدر يقبلها أو يرفضها) — وبتوقيتك تتحول تلقائياً لعرض حصري على موظف تختار طريقته</p>

        <template v-if="scheduled">
          <div class="grid-3">
            <div>
              <label>المدة</label>
              <input v-model.number="delayNum" type="number" min="1" max="9999">
            </div>
            <div>
              <label>الوحدة</label>
              <select v-model="delayUnit">
                <option value="1">ثواني</option>
                <option value="60">دقائق</option>
                <option value="3600">ساعات</option>
              </select>
            </div>
            <div>
              <label>تُكلّف بعد</label>
              <input :value="delayText" readonly class="readonly">
            </div>
          </div>
          <label>من تُكلّف لها تلقائياً؟</label>
          <select v-model="convertStrategy">
            <option v-for="[k, lbl] in STRATEGIES" :key="k" :value="k">{{ lbl }}</option>
          </select>
          <p class="hint">📊 {{ eligible.length }} موظف مؤهل حالياً (نشط + غير مجاز + غير مستثنى) — والمعروض عليهم يحسب عند الخادم لحظة التحويل</p>
        </template>
      </div>

      <!-- التوزيع الفوري العادي -->
      <template v-if="!scheduled">
        <div class="grid-2">
          <div>
            <label>نمط التوزيع</label>
            <select v-model="dist">
              <option value="lowest">⬇️ صاحب الأقل نقاطاً أولاً</option>
              <option value="random">🎲 عشوائي</option>
              <option value="all">👥 كل المؤهلين</option>
            </select>
          </div>
          <div v-if="dist !== 'all'">
            <label>عدد المعروض عليهم (1 - {{ eligible.length }})</label>
            <input v-model.number="distCount" type="number" min="1" :max="Math.max(1, eligible.length)">
          </div>
        </div>

        <div class="detail-sec">
          <template v-if="preview.length">
            📤 ستُعرض المهمة على {{ preview.length }} من {{ eligible.length }} مؤهل:
            <b>{{ preview.map(c => c.fullName + ' (⭐' + pointsFmt(c.totalPoints) + ')').join('، ') }}</b><br>
            <span class="muted">سيصلهم إشعار تيليكرام + إشعار متصفح فوراً من الخادم</span>
            <span v-if="dist === 'random'" class="muted"> — الاختيار العشوائي النهائي يتم عند الخادم</span>
          </template>
          <template v-else>
            ⚠️ <b>لا يوجد موظفون مؤهلون</b> لهذا النوع حالياً (إجازة/استثناء/توقف) — المهمة ستُنشأ متاحة وستُبلغ بالإشعار
          </template>
        </div>
      </template>
    </template>

    <div v-if="!editing && assign === 'direct'">
      <label>الموظف المكلف — تستلمه تلقائياً بدون قبول، ويبدأ العمل ويرفع التقرير</label>
      <select v-model="empId">
        <option v-for="e in activeEmps" :key="e.id" :value="e.id">{{ e.fullName }} (⭐{{ pointsFmt(e.totalPoints) }})</option>
      </select>
    </div>

    <div class="form-actions">
      <button class="btn btn-primary" @click="save">{{ editing ? '💾 حفظ التعديلات' : (scheduled ? 'إنشاء وجدولة ⏰' : 'إنشاء وإرسال') }}</button>
      <button class="btn btn-outline" @click="emit('close')">إلغاء</button>
    </div>
  </Modal>
</template>
