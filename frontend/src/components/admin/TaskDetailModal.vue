<script setup>
/* تفاصيل المهمة — v1.0.2:
   + من فتح المهمة وشافها (تتبع المشاهدات) بشكل واضح ومنظم
   + مين رفض المهمة
   + أرشفة وحذف ناعم متاحين لكل حالات المهمة (نشطة/مكتملة/ملغاة/مؤرشفة) — ماكو حذف نهائي
   + الاعتماد والرفض مع سبب (للمدير العام ومدير المهام) */
import { ref, computed, onMounted } from 'vue'
import { useStore } from '../../store.js'
import { statusLabel, statusClass, pointsFmt, fmtDateTime, ASSIGN_LABELS } from '../../utils.js'
import { loadPhotoUrl } from '../../api.js'
import Modal from '../Modal.vue'

const store = useStore()
const props = defineProps({ taskId: String, openReject: { type: Boolean, default: false } })
const emit = defineEmits(['close', 'edit'])

const task = computed(() => store.getTask(props.taskId))
const subs = ref([])
const photoUrls = ref({})
const showReject = ref(props.openReject)
const rejectReason = ref('')
const confirmAction = ref(null)   // approve | cancel | unassign | archive | delete

onMounted(async () => {
  try {
    const r = await store.getSubmissions(props.taskId)
    subs.value = r.submissions || []
    for (const s of subs.value) {
      (s.photos || []).forEach(async (p, i) => {
        try { photoUrls.value[`${s.submissionNumber}-${i}`] = await loadPhotoUrl(p) } catch { /* */ }
      })
    }
  } catch (e) { /* */ }
})

const canManage = computed(() => store.isManagement)
const canReview = computed(() => {
  if (store.isAdmin) return true
  if (!store.isManager) return false
  const t = task.value
  if (!t) return false
  if (t.createdById === store.me?.id) return true
  return (store.me?.boundEmployeeIds || []).includes(t.assignedToId)
})

/* المشاهدات: مين فتح المهمة — مرتبة من الأحدث، مع حالة الموظف */
const viewers = computed(() => {
  const t = task.value
  if (!t) return []
  const st = empStatus(t)
  return (t.views || []).slice().sort((a, b) => (b.at || '').localeCompare(a.at || ''))
    .map(v => ({ ...v, taskStatus: st(v.employeeId) }))
})
const declined = computed(() => (task.value?.declinedBy || []).slice().sort((a, b) => (b.at || '').localeCompare(a.at || '')))

function empStatus(t) {
  return id => {
    if (t.assignedToId === id) return statusLabel(t.status)
    if ((t.offeredTo || []).includes(id)) return 'بانتظار الاستلام'
    if ((t.declinedBy || []).some(d => d.employeeId === id)) return 'رفضها'
    return '—'
  }
}

const timeline = computed(() => {
  const t = task.value
  if (!t) return []
  return [
    t.createdAt && `🕒 أُنشئت: ${fmtDateTime(t.createdAt)}`,
    t.sendAt && t.status === 'scheduled' && `⏰ مجدولة الإرسال: ${fmtDateTime(t.sendAt)}`,
    t.sentAt && `🚀 أُرسلت: ${fmtDateTime(t.sentAt)}`,
    t.acceptedAt && `🤝 قُبلت: ${fmtDateTime(t.acceptedAt)}`,
    t.submittedAt && `📤 رُفع التقرير: ${fmtDateTime(t.submittedAt)}`,
    t.reviewedAt && `${t.status === 'completed' ? '✅' : '❌'} رُوجعت: ${fmtDateTime(t.reviewedAt)}`,
    t.completedAt && `🏁 اكتملت: ${fmtDateTime(t.completedAt)}`,
  ].filter(Boolean)
})

async function doApprove() {
  confirmAction.value = null
  await store.approveTask(props.taskId)
  emit('close')
}
async function doReject() {
  if (rejectReason.value.trim().length < 3) { store.toast('اكتب سبب الرفض — راح يوصله للموظف بالإشعار', 'err'); return }
  await store.rejectTask(props.taskId, rejectReason.value.trim())
  showReject.value = false
  emit('close')
}
async function doUnassign() {
  confirmAction.value = null
  await store.unassignTask(props.taskId)
  emit('close')
}
async function doCancel() {
  confirmAction.value = null
  await store.cancelTask(props.taskId)
  emit('close')
}
async function doArchive() {
  confirmAction.value = null
  await store.archiveTask(props.taskId)
  emit('close')
}
async function doDelete() {
  confirmAction.value = null
  await store.deleteTask(props.taskId)
  emit('close')
}
async function doUnarchive() {
  await store.unarchiveTask(props.taskId)
  emit('close')
}
async function doRestore() {
  await store.restoreTask(props.taskId)
  emit('close')
}

/* v1.0.1+: عمليات المجموعة كاملة */
async function doArchiveGroup() {
  confirmAction.value = null
  await store.archiveTaskGroup(props.taskId)
  emit('close')
}
async function doDeleteGroup() {
  confirmAction.value = null
  await store.deleteTaskGroup(props.taskId)
  emit('close')
}
async function doUnarchiveGroup() {
  await store.unarchiveTaskGroup(props.taskId)
  emit('close')
}
async function doRestoreGroup() {
  await store.restoreTaskGroup(props.taskId)
  emit('close')
}

/* v1.0.1+: نسخ المهمة الجماعية (كل نسخ نفس groupId) */
const siblings = computed(() => {
  const t = task.value
  if (!t?.groupId) return []
  return store.tasks.filter(x => x.groupId === t.groupId)
    .sort((a, b) => (a.groupIndex || 0) - (b.groupIndex || 0))
})
</script>

<template>
  <Modal @close="emit('close')">
    <template v-if="task">
      <h3>#{{ task.no }} {{ task.title }}</h3>
      <div class="tcard-top" style="margin-bottom:8px">
        <span :class="statusClass(task.status)">{{ statusLabel(task.status) }}</span>
        <span class="points-chip">⭐ {{ pointsFmt(task.points) }}</span>
        <span class="st" :class="'st-' + task.assignmentType">{{ ASSIGN_LABELS[task.assignmentType] || task.assignmentType }}</span>
        <span v-if="task.archived" class="st st-archived">📦 مؤرشفة</span>
        <span v-if="task.deleted" class="st st-cancelled">🗑️ محذوفة</span>
      </div>

      <!-- v1.0.1+: نسخ المهمة الجماعية — حالة كل موظف -->
      <div v-if="task.groupId && siblings.length > 1" class="detail-sec">
        <div class="lbl">👥 نسخ المهمة الجماعية ({{ siblings.length }}) — كل موظف بنسخته الخاصة</div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>#</th><th>الموظف</th><th>الحالة</th><th>النقاط</th></tr></thead>
            <tbody>
              <tr v-for="s in siblings" :key="s.id" :style="s.id === task.id ? 'font-weight:800' : ''">
                <td>{{ s.groupIndex }}</td>
                <td><b>{{ s.groupTargetName || s.assignedToName || '—' }}</b></td>
                <td><span :class="statusClass(s.status)">{{ statusLabel(s.status) }}</span></td>
                <td>⭐ {{ pointsFmt(s.points) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="hint">النقاط تنحسب لكل موظف بعد اعتماد نسخته — وكل نسخة ترفض أو تنحذف على حدة</p>
      </div>

      <div class="detail-sec">
        <div class="lbl">التفاصيل</div>
        <p>🏷️ النوع: {{ task.taskTypeName }}</p>
        <p v-if="task.description">📝 {{ task.description }}</p>
        <p>👤 الموظف: <b>{{ task.assignedToName || '— لم يُقبل بعد' }}</b></p>
        <!-- هوية المرسل — المدير العام فقط يعرف مين أرسل -->
        <p v-if="store.isAdmin">
          🖊️ المرسل: <b>{{ task.createdBy }}</b>
          <span v-if="task.createdByRole === 'manager'" class="st st-manager">مدير مهام</span>
        </p>
        <p v-if="task.requiresReport">📄 يتطلب تقرير</p>
        <p v-if="task.requiresPhotos">📷 تتطلب صور {{ task.photosMandatory ? '(إلزامية)' : '(اختيارية)' }}</p>
        <p v-if="task.rejectable === false">🚫 مهمة مباشرة — لا يمكن رفضها من الموظف</p>
        <p v-if="task.pointsAwarded">⭐ النقاط أُضيفت</p>
      </div>

      <!-- من فتح المهمة وشافها — v1.0.1 -->
      <div class="detail-sec">
        <div class="lbl">👁️ من فتح المهمة ({{ viewers.length }})</div>
        <div v-if="viewers.length" class="table-wrap">
          <table class="table">
            <thead><tr><th>الموظف</th><th>آخر فتح</th><th>عدد المرات</th><th>حالته بالمهمة</th></tr></thead>
            <tbody>
              <tr v-for="v in viewers" :key="v.employeeId">
                <td><b>{{ v.employeeName }}</b></td>
                <td>{{ fmtDateTime(v.at) }}</td>
                <td>{{ v.count || 1 }}</td>
                <td><span class="muted">{{ v.taskStatus }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="muted" style="margin-top:6px">لم يفتح أحد المهمة بعد</p>
      </div>

      <!-- مين رفض المهمة — v1.0.1 -->
      <div v-if="declined.length" class="detail-sec" style="background:var(--danger-bg)">
        <div class="lbl">🚫 رفضوا المهمة ({{ declined.length }})</div>
        <div v-for="d in declined" :key="d.employeeId" style="margin-top:4px">
          👤 <b>{{ d.employeeName }}</b> — {{ fmtDateTime(d.at) }}
        </div>
      </div>

      <div class="detail-sec">
        <div class="lbl">الجدول الزمني</div>
        <div class="timeline"><div v-for="(line, i) in timeline" :key="i">{{ line }}</div></div>
      </div>

      <div v-if="task.rejectionReason && task.assignedToId" class="reject-box">سبب رفض الاعتماد: {{ task.rejectionReason }}</div>

      <h3 style="margin-top:14px">📤 التقارير المرفوعة ({{ subs.length }})</h3>
      <div v-if="subs.length">
        <div v-for="s in subs" :key="s.submissionNumber" class="detail-sec">
          <div class="lbl">المحاولة {{ s.submissionNumber }} — {{ fmtDateTime(s.submittedAt) }}</div>
          <p v-if="s.reportText" style="margin-top:4px;white-space:pre-wrap">{{ s.reportText }}</p>
          <p v-else class="muted">بدون نص</p>
          <div v-if="s.photos && s.photos.length" class="photos-grid">
            <img v-for="(p, i) in s.photos" :key="i" :src="photoUrls[`${s.submissionNumber}-${i}`]"
                 alt="صورة" @click="store.showLightbox(photoUrls[`${s.submissionNumber}-${i}`])">
          </div>
        </div>
      </div>
      <div v-else class="detail-sec"><p class="muted">لا توجد تقارير مرفوعة بعد</p></div>

      <!-- تأكيدات -->
      <div v-if="confirmAction === 'approve'" class="detail-sec" style="background:var(--ok-bg)">
        سيُعتمد الإنجاز وتُضاف <b>{{ pointsFmt(task.points) }}</b> نقطة لـ {{ task.assignedToName }}. متابعة؟
        <div class="form-actions">
          <button class="btn btn-primary" @click="doApprove">✅ نعم، اعتماد</button>
          <button class="btn btn-outline" @click="confirmAction = null">تراجع</button>
        </div>
      </div>
      <div v-if="confirmAction === 'unassign'" class="detail-sec">
        ستعود المهمة إلى "متاحة". متابعة؟
        <div class="form-actions">
          <button class="btn btn-primary" @click="doUnassign">نعم</button>
          <button class="btn btn-outline" @click="confirmAction = null">تراجع</button>
        </div>
      </div>
      <div v-if="confirmAction === 'cancel'" class="detail-sec" style="background:var(--danger-bg)">
        سيتم إلغاء المهمة. متابعة؟
        <div class="form-actions">
          <button class="btn btn-danger" @click="doCancel">نعم، إلغاء المهمة</button>
          <button class="btn btn-outline" @click="confirmAction = null">تراجع</button>
        </div>
      </div>
      <div v-if="confirmAction === 'archive'" class="detail-sec" style="background:var(--purple-bg)">
        📦 الأرشفة تخفي المهمة من قوائم المهام وتبقى بقسم الأرشيف. متابعة؟
        <div class="form-actions">
          <button class="btn btn-primary" @click="doArchive">نعم، أرشفة</button>
          <button class="btn btn-outline" @click="confirmAction = null">تراجع</button>
        </div>
      </div>
      <div v-if="confirmAction === 'archiveGroup'" class="detail-sec" style="background:var(--purple-bg)">
        📦 راح تنأرشف <b>كل نسخ المهمة الجماعية ({{ siblings.length }})</b> — كل النسخ تختفي من القوائم مع بعض. متابعة؟
        <div class="form-actions">
          <button class="btn btn-primary" @click="doArchiveGroup">نعم، أرشفة المجموعة كاملة</button>
          <button class="btn btn-outline" @click="confirmAction = null">تراجع</button>
        </div>
      </div>
      <div v-if="confirmAction === 'delete'" class="detail-sec" style="background:var(--danger-bg)">
        🗑️ الحذف ناعم — المهمة تروح لسلة المحذوفات وتكدر تستعيدها، ماكو حذف نهائي بالنظام. متابعة؟
        <div class="form-actions">
          <button class="btn btn-danger" @click="doDelete">نعم، حذف</button>
          <button class="btn btn-outline" @click="confirmAction = null">تراجع</button>
        </div>
      </div>
      <div v-if="confirmAction === 'deleteGroup'" class="detail-sec" style="background:var(--danger-bg)">
        🗑️ راح تنحذف <b>كل نسخ المهمة الجماعية ({{ siblings.length }})</b> حذفاً ناعماً — وتكدر تستعيد المجموعة كاملة من سلة المحذوفات. متابعة؟
        <div class="form-actions">
          <button class="btn btn-danger" @click="doDeleteGroup">نعم، حذف المجموعة كاملة</button>
          <button class="btn btn-outline" @click="confirmAction = null">تراجع</button>
        </div>
      </div>

      <!-- نموذج رفض الاعتماد -->
      <template v-if="showReject">
        <h3 style="margin-top:14px">❌ رفض اعتماد المهمة #{{ task.no }}</h3>
        <p class="muted">يُعاد الأمر للموظف {{ task.assignedToName || '' }} ليعدل التقرير — ويوصله إشعار بالسبب</p>
        <label>سبب الرفض (إلزامي — يوصله للموظف بالإشعار)</label>
        <textarea v-model="rejectReason" rows="3" placeholder="مثال: الصور غير واضحة، أكمل التقرير..."></textarea>
        <div class="form-actions">
          <button class="btn btn-danger" @click="doReject">رفض وإبلاغ الموظف</button>
          <button class="btn btn-outline" @click="showReject = false">إلغاء</button>
        </div>
      </template>

      <div v-else class="form-actions">
        <template v-if="canReview && task.status === 'pending_approval'">
          <button class="btn btn-primary" @click="confirmAction = 'approve'">✅ اعتماد وإضافة النقاط</button>
          <button class="btn btn-danger" @click="showReject = true">❌ رفض مع سبب</button>
        </template>
        <template v-if="canManage && ['accepted', 'in_progress'].includes(task.status)">
          <button class="btn btn-outline" @click="confirmAction = 'unassign'">↩️ إلغاء قبول الموظف</button>
        </template>
        <template v-if="canManage && !['completed', 'cancelled'].includes(task.status) && !task.deleted">
          <button class="btn btn-outline" @click="emit('edit', task.id)">✏️ تعديل</button>
          <button class="btn btn-outline" @click="confirmAction = 'cancel'">🚫 إلغاء المهمة</button>
        </template>
        <!-- v1.0.2: الأرشفة والحذف الناعم متاحين لكل الحالات — المهمة المكتملة تنأرشف وتنحذف كمان -->
        <template v-if="canManage && !task.deleted && !task.archived">
          <button class="btn btn-outline" @click="confirmAction = 'archive'">📦 أرشفة</button>
        </template>
        <template v-if="canManage && task.archived && !task.deleted">
          <button class="btn btn-outline" @click="doUnarchive">📤 إخراج من الأرشيف</button>
        </template>
        <template v-if="canManage && task.deleted">
          <button class="btn btn-primary" @click="siblings.length > 1 ? doRestoreGroup() : doRestore()">♻️ استعادة من المحذوفات</button>
        </template>
        <template v-if="canManage && !task.deleted">
          <button class="btn btn-ghost" @click="confirmAction = siblings.length > 1 ? 'deleteGroup' : 'delete'">🗑️ حذف (ناعم)</button>
        </template>
        <button class="btn btn-outline" @click="emit('close')">إغلاق</button>
      </div>
    </template>
  </Modal>
</template>
