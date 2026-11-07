<script setup>
/* مهامي — v1.0.1: فلترة بالفترة (اليوم افتراضياً) + حالة واضحة لكل مهمة */
import { ref, computed } from 'vue'
import { useStore } from '../../store.js'
import { pointsFmt, statusLabel, statusClass, PERIODS, taskInPeriod } from '../../utils.js'
import SubmitReportModal from './SubmitReportModal.vue'

const store = useStore()
const filter = ref('open')
const submitId = ref(null)
const period = ref('today')

const mine = computed(() => store.myTasks)
const open = ['accepted', 'in_progress', 'pending_approval', 'rejected']
const list = computed(() => {
  let src = mine.value.filter(t => taskInPeriod(t, period.value))
  if (filter.value === 'open') src = src.filter(t => open.includes(t.status))
  else if (filter.value !== 'all') src = src.filter(t => t.status === filter.value)
  return src
})
const countFor = k => {
  const src = mine.value.filter(t => taskInPeriod(t, period.value))
  return k === 'open' ? src.filter(t => open.includes(t.status)).length
    : k === 'all' ? src.length
    : src.filter(t => t.status === k).length
}

async function start(t) { await store.startTask(t.id) }

function borderColor(t) {
  if (t.status === 'completed') return 'var(--ok)'
  if (t.status === 'rejected') return 'var(--danger)'
  if (t.status === 'pending_approval') return 'var(--purple)'
  return 'var(--warn)'
}
</script>

<template>
  <section>
    <h2 class="sec-title">📌 مهامي</h2>

    <div class="filter-bar">
      <button v-for="[k, lbl] in PERIODS" :key="k" class="chip" :class="{ active: period === k }" @click="period = k">
        {{ lbl }}
      </button>
    </div>

    <div class="filter-bar">
      <button v-for="[k, lbl] in [['open', 'المفتوحة'], ['pending_approval', 'بانتظار الاعتماد'], ['rejected', 'مرفوضة'], ['completed', 'المكتملة'], ['all', 'الكل']]" :key="k"
              class="chip" :class="{ active: filter === k }" @click="filter = k">
        {{ lbl }} ({{ countFor(k) }})
      </button>
    </div>

    <div class="cards-list">
      <div v-for="t in list" :key="t.id" class="tcard" :style="{ borderRightColor: borderColor(t) }">
        <div class="tcard-top">
          <span class="tcard-title">#{{ t.no }} {{ t.title }}</span>
          <span class="points-chip">⭐ {{ pointsFmt(t.points) }}</span>
          <span :class="statusClass(t.status)">{{ statusLabel(t.status) }}</span>
        </div>
        <div class="tcard-meta">
          <span>🏷️ {{ t.taskTypeName }}</span>
          <span v-if="t.description">📝 {{ t.description }}</span>
          <span v-if="t.rejectionReason" class="minus">❌ سبب الرفض: {{ t.rejectionReason }}</span>
        </div>
        <div class="tcard-actions">
          <button v-if="t.status === 'accepted'" class="btn btn-sm btn-outline" @click="start(t)">🔧 بدء التنفيذ</button>
          <button v-if="['accepted', 'in_progress'].includes(t.status)" class="btn btn-sm btn-primary" @click="submitId = t.id">📤 رفع تقرير الإنجاز</button>
          <button v-if="t.status === 'rejected'" class="btn btn-sm btn-primary" @click="submitId = t.id">📤 تعديل وإعادة الإرسال</button>
          <span v-if="t.status === 'pending_approval'" class="muted">⏳ بانتظار مراجعة الإدارة</span>
          <span v-if="t.status === 'completed'" class="plus">⭐ +{{ pointsFmt(t.points) }} نقطة</span>
        </div>
      </div>
      <div v-if="!list.length" class="empty"><span class="big">📌</span>لا توجد مهام بهذه الفترة</div>
    </div>

    <SubmitReportModal v-if="submitId" :task-id="submitId" @close="submitId = null" />
  </section>
</template>
