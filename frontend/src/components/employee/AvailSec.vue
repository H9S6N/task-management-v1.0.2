<script setup>
/* المهام المتاحة — v1.0.2
   فلترة بالفترة (اليوم افتراضياً) + زر رفض المهمة
   الموظف المجاز: يشوف رسالة إنه مجاز حالياً — المهام العامة ما تظهرله
   وما يوصله أي إشعار، ويكدر يشوف مهامه المسندة من قسم «مهامي» فقط */
import { ref, computed } from 'vue'
import { useStore } from '../../store.js'
import { pointsFmt, fmtDateTime, PERIODS, taskInPeriod } from '../../utils.js'

const store = useStore()
const busyId = ref('')
const period = ref('today')

/* الموظف المجاز: لا مهام عامة — رسالة فقط */
const onLeaveMe = computed(() => store.me?.status === 'on_leave')

const list = computed(() =>
  store.myAvailableTasks.filter(t => taskInPeriod(t, period.value)))

async function accept(t) {
  if (!(await store.confirm('قبول المهمة', 'أسرع من يقبلها يحصل عليها — هل تريد قبولها الآن؟'))) return
  busyId.value = t.id
  try {
    const r = await store.acceptTask(t.id)
    store.toast(r.message || 'تم قبول المهمة', 'ok')
  } catch { /* التوست من store */ }
  busyId.value = ''
}

async function decline(t) {
  const ok = await store.confirm('رفض المهمة',
    `ترفض المهمة "#${t.no} ${t.title}"؟\nتروح من قائمة مهامك نهائياً، وتنحسب بالتقارير إنك رفضتها.` , true)
  if (!ok) return
  busyId.value = t.id
  try {
    await store.declineTask(t.id)
  } catch { /* التوست من store */ }
  busyId.value = ''
}
</script>

<template>
  <section>
    <h2 class="sec-title">🪙 المهام المتاحة</h2>

    <!-- الموظف المجاز — يرى رسالة فقط: غير متوفر لاستلام المهام -->
    <div v-if="onLeaveMe" class="card" style="border-right:4px solid var(--warn)">
      <h3>🏖️ أنت في إجازة حالياً — غير متوفر</h3>
      <p class="muted">
        حسابك شغال وتكدر تدخل وتشوف حسابك ومهامك المسندة من قسم «مهامي» عادي،
        لكن المهام العامة ما تظهرلك وما يوصلك أي إشعار حتى يرجعك المدير من الإجازة.
      </p>
    </div>

    <template v-else>
      <p class="muted">أسرع من يقبل المهمة يحصل عليها — وتكدر ترفضها إذا ما تناسبك</p>

      <div class="filter-bar">
        <button v-for="[k, lbl] in PERIODS" :key="k" class="chip" :class="{ active: period === k }" @click="period = k">
          {{ lbl }}
        </button>
      </div>

      <div class="cards-list">
        <div v-for="t in list" :key="t.id" class="tcard" style="border-right-color: var(--info)">
          <div class="tcard-top">
            <span class="tcard-title">#{{ t.no }} {{ t.title }}</span>
            <span class="points-chip">⭐ {{ pointsFmt(t.points) }}</span>
            <span class="st" :class="'st-' + t.assignmentType">
              {{ t.assignmentType === 'direct' ? 'مكلّف بها' : (t.offeredTo && t.offeredTo.length ? '⚡ متاحة لك' : 'متاحة للجميع') }}
            </span>
          </div>
          <div class="tcard-meta">
            <span>🏷️ {{ t.taskTypeName }}</span>
            <span v-if="t.description">📝 {{ t.description }}</span>
            <span>🕒 {{ fmtDateTime(t.createdAt) }}</span>
            <span v-if="t.requiresReport">📄 تقرير مطلوب</span>
            <span v-if="t.requiresPhotos">📷 صور {{ t.photosMandatory ? 'إلزامية' : 'اختيارية' }}</span>
          </div>
          <div class="tcard-actions">
            <button class="btn btn-primary" :disabled="busyId === t.id" @click="accept(t)">🤝 قبول المهمة</button>
            <button v-if="t.rejectable !== false && t.assignmentType !== 'direct'"
                    class="btn btn-danger-ghost" :disabled="busyId === t.id" @click="decline(t)">
              🚫 رفض
            </button>
          </div>
        </div>
        <div v-if="!list.length" class="empty">
          <span class="big">🪙</span>لا توجد مهام متاحة بهذه الفترة<br>
          <span class="muted">ستصلك مهام جديدة فوراً — إشعار متصفح + تيليكرام</span>
        </div>
      </div>
    </template>
  </section>
</template>
