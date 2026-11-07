<script setup>
/* إنشاء وتعديل المهمة — v1.0.1
   أنواع التوجيه: تلقائي / موظف محدد / مجموعة موظفين (من يسبق يكسب) / كل الموظفين
   v1.0.1+: مهمة جماعية — مهمة واحدة لعدة موظفين كلهم ينفذونها
            (تحديد مباشر / أقل نقاطاً / عشوائي — نسخة مستقلة لكل موظف)
   + إرسال مجدول (مهمة مع توقيت — ترسل تلقائياً من الخادم وقتها) */
import { ref, computed, watch } from 'vue'
import { useStore } from '../../store.js'
import { pointsFmt, isOnLeaveNow } from '../../utils.js'
import Modal from '../Modal.vue'

const store = useStore()
const props = defineProps({
  editTask: { type: Object, default: null },
  /* v1.0.2: إسناد مباشر لموظف محدد — يفتح من ملف الموظف (بدون تعميم للكل) */
  presetEmployeeId: { type: String, default: null },
})
const emit = defineEmits(['close'])

const editing = computed(() => !!props.editTask)
const types = computed(() => store.listTaskTypes(true))
const activeEmps = computed(() =>
  store.listEmployees(false).filter(e => e.status === 'active' && !isOnLeaveNow(e)))

/* v1.0.1+: تطبيق التعديل على كل نسخ المهمة الجماعية */
const applyGroupAll = ref(true)
const groupSiblings = computed(() => {
  if (!props.editTask?.groupId) return 0
  return store.tasks.filter(t => t.groupId === props.editTask.groupId && !t.deleted).length
})

const typeId = ref(props.editTask?.taskTypeId || types.value[0]?.id || '')
const title = ref(props.editTask?.title || '')
const desc = ref(props.editTask?.description || '')
const points = ref(props.editTask ? props.editTask.points : null)
/* v1.0.2: موظف محدد مسبقاً من ملف الموظف → تكليف مباشر تلقائياً */
const presetOk = !!(props.presetEmployeeId && activeEmps.value.some(e => e.id === props.presetEmployeeId))
const assign = ref(props.editTask?.assignmentType || (presetOk ? 'direct' : 'auto'))
const empId = ref(presetOk ? props.presetEmployeeId : (activeEmps.value[0]?.id || ''))
if (props.presetEmployeeId && !presetOk && !props.editTask) {
  /* الموظف المجاز أو الموقوف ما ينكلف — نفس الآلية اللي تمنع التوزيع */
  store.toast('هذا الموظف مجاز أو موقوف حالياً — ما يكدر يستلم مهام حتى يرجع متوفر', 'err')
}

/* مجموعة موظفين — تحديد متعدد (تُستخدم أيضاً بالمهمة الجماعية المباشرة) */
const multiSel = ref(new Set(props.editTask?.offeredTo || []))
function toggleMulti(id) {
  multiSel.value.has(id) ? multiSel.value.delete(id) : multiSel.value.add(id)
  multiSel.value = new Set(multiSel.value)
}
const multiList = computed(() => [...multiSel.value].map(id => store.getEmployee(id)).filter(Boolean))

/* v1.0.1+: المهمة الجماعية — طريقة تحديد الموظفين */
const groupMode = ref('direct')
const groupCount = ref(2)
const groupPreview = computed(() => {
  if (groupMode.value === 'direct') {
    return [...multiSel.value].map(id => store.getEmployee(id)).filter(Boolean)
  }
  const arr = eligible.value.slice()
  const n = Math.max(1, Math.min(Number(groupCount.value) || 1, arr.length))
  if (groupMode.value === 'lowest') {
    return arr.sort((a, b) => (Number(a.totalPoints) || 0) - (Number(b.totalPoints) || 0)).slice(0, n)
  }
  return arr.sort(() => Math.random() - 0.5).slice(0, n)
})

/* التحكم بالتوزيع التلقائي — الافتراضي من الإعدادات */
const dist = ref(store.settings.defaultDistribution || 'lowest')
const distCount = ref(Number(store.settings.defaultCandidates) || 1)

/* الإرسال المجدول */
const useSchedule = ref(!!props.editTask?.sendAt)
const sendDate = ref('')
const sendTime = ref('09:00')

watch(typeId, id => {
  const t = store.getTaskType(id)
  if (t && !editing.value) points.value = t.defaultPoints
}, { immediate: true })

/* المؤهلون فعلياً: نشط + ليس في إجازة + غير مستثنى من النوع
   (مدير المهام يرى موظفيه المرتبطين فقط — قادمين جاهزين من الخادم) */
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

function defaultSendAtIso() {
  if (!sendDate.value) return null
  const d = new Date(`${sendDate.value}T${sendTime.value || '09:00'}:00`)
  if (isNaN(d)) return null
  return d.toISOString()
}

async function save() {
  if (!title.value.trim()) { store.toast('اكتب عنوان المهمة', 'err'); return }
  const type = store.getTaskType(typeId.value)
  if (!editing.value && type?.directOnly && assign.value !== 'direct') { store.toast('هذا النوع تكليف مباشر فقط', 'err'); return }
  if (!editing.value && assign.value === 'multi' && !multiSel.value.size) { store.toast('اختر موظفين للمجموعة', 'err'); return }
  if (!editing.value && assign.value === 'group' && groupMode.value === 'direct' && !multiSel.value.size) { store.toast('اختر موظفين للمهمة الجماعية', 'err'); return }
  if (!editing.value && useSchedule.value && !sendDate.value) { store.toast('حدد تاريخ الإرسال المجدول', 'err'); return }

  try {
    const body = {
      taskTypeId: typeId.value, title: title.value.trim(),
      description: desc.value.trim(),
      points: points.value === '' || points.value == null ? null : Number(points.value),
    }
    if (editing.value) {
      if (props.editTask.status === 'scheduled') {
        body.sendAt = useSchedule.value ? defaultSendAtIso() : ''
        if (useSchedule.value && !body.sendAt) { store.toast('وقت الإرسال غير صحيح', 'err'); return }
      }
      if (props.editTask.groupId && applyGroupAll.value && groupSiblings.value > 1) body.applyGroup = true
      await store.updateTask(props.editTask.id, body)
      store.toast('تم حفظ التعديلات — وصل إشعار للموظفين المعنيين ✅', 'ok')
    } else {
      body.assignmentType = assign.value
      if (useSchedule.value) {
        body.sendAt = defaultSendAtIso()
        if (!body.sendAt) { store.toast('وقت الإرسال غير صحيح', 'err'); return }
      }
      if (assign.value === 'direct') {
        body.offeredTo = [empId.value]
      } else if (assign.value === 'multi') {
        body.offeredTo = [...multiSel.value]
      } else if (assign.value === 'group') {
        /* v1.0.1+: مهمة جماعية — كل الموظفين المحددين ينفذونها */
        body.groupMode = groupMode.value
        if (groupMode.value === 'direct') {
          body.offeredTo = [...multiSel.value]
        } else {
          body.groupCount = Math.max(1, Math.min(Number(groupCount.value) || 1, eligible.value.length || 1))
        }
      } else if (assign.value === 'auto') {
        body.offeredTo = preview.value.map(e => e.id)
        body.distribution = dist.value
        body.candidateCount = distCount.value
      }
      const r = await store.createTask(body)
      if (assign.value === 'group') {
        store.toast(body.sendAt
          ? `تم جدولة المهمة الجماعية ⏰ — تنسخ للموظفين تلقائياً وقت الإرسال`
          : `تم إنشاء المهمة الجماعية ✅ — نسخ مستقلة لـ ${r?.created || '?'} موظف ووصلتهم إشعارات`, 'ok')
      } else {
        store.toast(body.sendAt
          ? `تم إنشاء المهمة #${r.task.no} ⏰ — ترسل تلقائياً بالوقت المحدد`
          : `تم إنشاء المهمة #${r.task.no} ✅ — وصلت إشعارات فورية للموظفين`, 'ok')
      }
    }
    emit('close')
  } catch { /* التوست يظهر من store */ }
}

function setToday() {
  const d = new Date()
  sendDate.value = d.toISOString().slice(0, 10)
}
setToday()
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
        <label>التوجيه</label>
        <select v-model="assign">
          <option value="auto">📤 توزيع تلقائي (من يسبق يكسب)</option>
          <option value="direct">👤 موظف محدد</option>
          <option value="group">👥 مهمة جماعية — عدة موظفين كلهم ينفذونها</option>
          <option value="multi">⚡ مجموعة موظفين — الأسرع يقبلها يأخذها</option>
          <option value="all">🌍 كل المؤهلين</option>
        </select>
      </div>
    </div>

    <!-- توجيه: موظف محدد -->
    <div v-if="!editing && assign === 'direct'">
      <label>الموظف المكلف <span class="muted">(المهام المباشرة لا يمكن رفضها)</span></label>
      <select v-model="empId">
        <option v-for="e in activeEmps" :key="e.id" :value="e.id">{{ e.fullName }} (⭐{{ pointsFmt(e.totalPoints) }})</option>
      </select>
    </div>

    <!-- v1.0.1+: توجيه جماعي — مهمة واحدة لعدة موظفين، كلهم ينفذونها -->
    <template v-if="!editing && assign === 'group'">
      <label>طريقة تحديد الموظفين</label>
      <div class="checks">
        <label class="check-pill" :class="{ on: groupMode === 'direct' }">
          <input type="radio" value="direct" v-model="groupMode"> ✋ تحديد مباشر
        </label>
        <label class="check-pill" :class="{ on: groupMode === 'lowest' }">
          <input type="radio" value="lowest" v-model="groupMode"> ⬇️ الأقل نقاطاً
        </label>
        <label class="check-pill" :class="{ on: groupMode === 'random' }">
          <input type="radio" value="random" v-model="groupMode"> 🎲 عشوائي
        </label>
      </div>

      <div v-if="groupMode !== 'direct'">
        <label>عدد الموظفين (1 - {{ eligible.length }})</label>
        <input v-model.number="groupCount" type="number" min="1" :max="Math.max(1, eligible.length)">
      </div>
      <div v-else>
        <label>اختر الموظفين ({{ multiSel.size }} من {{ eligible.length }})</label>
        <div class="checks">
          <label v-for="e in eligible" :key="e.id" class="check-pill">
            <input type="checkbox" :checked="multiSel.has(e.id)" @change="toggleMulti(e.id)">
            {{ e.fullName }} (⭐{{ pointsFmt(e.totalPoints) }})
          </label>
        </div>
      </div>

      <div class="detail-sec">
        <template v-if="groupPreview.length">
          👥 المهمة راح تنسخ لـ <b>{{ groupPreview.length }}</b> موظف:
          <b>{{ groupPreview.map(c => c.fullName).join('، ') }}</b><br>
          <span class="muted">كل موظف يحصل على نسخته الخاصة: يقبلها وينفذها ويرفع تقريره — والنقاط تنحسب لكل واحد على حدة</span>
        </template>
        <template v-else>
          ⚠️ <b>لا يوجد موظفون مؤهلون</b> حالياً (إجازة/استثناء/توقف)
        </template>
      </div>
    </template>

    <!-- توجيه: مجموعة موظفين -->
    <template v-if="!editing && assign === 'multi'">
      <label>اختر الموظفين ({{ multiSel.size }} من {{ eligible.length }})</label>
      <div class="checks">
        <label v-for="e in eligible" :key="e.id" class="check-pill">
          <input type="checkbox" :checked="multiSel.has(e.id)" @change="toggleMulti(e.id)">
          {{ e.fullName }} (⭐{{ pointsFmt(e.totalPoints) }})
        </label>
      </div>
      <p class="hint">المهمة تظهر لهذين الموظفين والأسرع يقبلها يأخذها — وبكدر يرفضها</p>
    </template>

    <!-- توجيه: توزيع تلقائي -->
    <template v-if="!editing && assign === 'auto'">
      <div class="grid-2">
        <div>
          <label>نمط التوزيع</label>
          <select v-model="dist">
            <option value="lowest">⬇️ الأقل نقاطاً (وبلا مهام مفتوحة أولاً)</option>
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
          <span class="muted">يوصلهم إشعار فوري (متصفح + تيليكرام)</span>
          <span v-if="dist === 'random'" class="muted"> — الاختيار العشوائي النهائي عند الخادم</span>
        </template>
        <template v-else>
          ⚠️ <b>لا يوجد موظفون مؤهلون</b> حالياً (إجازة/استثناء/توقف)
        </template>
      </div>
    </template>

    <!-- توجيه: كل المؤهلين -->
    <div v-if="!editing && assign === 'all'" class="detail-sec">
      🌍 المهمة تتاح لكل الموظفين المؤهلين ({{ eligible.length }} موظف) — الأسرع يقبلها يحصل عليها،
      وكل موظف يكدر يرفضها فتروح من قائمته وتنحسب بالمرفوضة.
    </div>

    <!-- الإرسال المجدول -->
    <div class="detail-sec">
      <label class="switch-row">
        <input type="checkbox" v-model="useSchedule" :disabled="editing && props.editTask?.status !== 'scheduled'">
        ⏰ إرسال مجدول — ترسل المهمة تلقائياً بالوقت المحدد (مهمة مع توقيت)
      </label>
      <div v-if="useSchedule" class="grid-2">
        <div><label>تاريخ الإرسال</label><input v-model="sendDate" type="date"></div>
        <div><label>الساعة</label><input v-model="sendTime" type="time"></div>
      </div>
      <p v-if="useSchedule" class="hint">إشعارات التوزيع والنقاط ترسل لحظة الإرسال تلقائياً من الخادم حتى لو المتصفح مسكر</p>
    </div>

    <!-- v1.0.1+: تعديل مهمة جماعية — تطبيق على كل النسخ -->
    <div v-if="editing && editTask.groupId && groupSiblings > 1" class="detail-sec">
      <label class="switch-row">
        <input type="checkbox" v-model="applyGroupAll">
        👥 طبّق التعديل على كل نسخ المهمة الجماعية ({{ groupSiblings }} نسخة) — كل موظف يوصله إشعار
      </label>
    </div>

    <div class="form-actions">
      <button class="btn btn-primary" @click="save">{{ editing ? '💾 حفظ التعديلات' : (useSchedule ? '⏰ جدولة وإرسال لاحقاً' : 'إنشاء وإرسال الآن') }}</button>
      <button class="btn btn-outline" @click="emit('close')">إلغاء</button>
    </div>
  </Modal>
</template>
