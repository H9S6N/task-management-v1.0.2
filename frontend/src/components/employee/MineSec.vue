<script setup>
import { ref, computed } from 'vue'
import { useStore } from '../../store.js'
import { pointsFmt, statusLabel, statusClass } from '../../utils.js'
import SubmitReportModal from './SubmitReportModal.vue'

const store = useStore()
const filter = ref('open')
const submitId = ref(null)

const mine = computed(() => store.myTasks)
const open = ['accepted', 'in_progress', 'pending_approval', 'rejected']
const list = computed(() => {
  if (filter.value === 'open') return mine.value.filter(t => open.includes(t.status))
  if (filter.value === 'all') return mine.value
  return mine.value.filter(t => t.status === filter.value)
})
const countFor = k => k === 'open' ? mine.value.filter(t => open.includes(t.status)).length
  : k === 'all' ? mine.value.length
  : mine.value.filter(t => t.status === k).length

async function start(t) {
  await store.startTask(t.id)
  store.toast('تم — المهمة الآن "يتم العمل عليها" 🔧', 'ok')
}

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
      <button v-for="[k, lbl] in [['open', 'المفتوحة'], ['accepted', 'تم استلامها'], ['in_progress', 'يتم العمل عليها'], ['pending_approval', 'بانتظار الاعتماد'], ['rejected', 'مرفوضة'], ['completed', 'المكتملة'], ['all', 'الكل']]" :key="k"
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
          <template v-if="t.status === 'accepted'">
            <span class="received-badge">✅ تم استلام المهمة</span>
            <button class="btn btn-sm btn-outline" @click="start(t)">🔧 يتم العمل عليها</button>
          </template>
          <template v-if="t.status === 'in_progress'">
            <span class="received-badge warn">🔧 يتم العمل عليها</span>
            <button class="btn btn-sm btn-primary" @click="submitId = t.id">📤 المهمة اكتملت — رفع التقرير</button>
          </template>
          <button v-if="t.status === 'rejected'" class="btn btn-sm btn-primary" @click="submitId = t.id">📤 إعادة الإرسال</button>
          <span v-if="t.status === 'pending_approval'" class="muted">⏳ بانتظار مراجعة المدير</span>
          <span v-if="t.status === 'completed'" class="plus">⭐ +{{ pointsFmt(t.points) }} نقطة</span>
        </div>
      </div>
      <div v-if="!list.length" class="empty"><span class="big">📌</span>لا توجد مهام هنا</div>
    </div>

    <SubmitReportModal v-if="submitId" :task-id="submitId" @close="submitId = null" />
  </section>
</template>
