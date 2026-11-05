<script setup>
import { ref } from 'vue'
import { useStore } from '../../store.js'
import { pointsFmt, fmtDateTime } from '../../utils.js'
import TaskDetailModal from './TaskDetailModal.vue'

const store = useStore()
const detailId = ref(null)
const openReject = ref(false)

function openDetail(id, reject = false) {
  detailId.value = id
  openReject.value = reject
}

async function approve(t) {
  if (!(await store.confirm('اعتماد المهمة',
    `سيُعتمد إنجاز "#${t.no} ${t.title}" وتُضاف ${pointsFmt(t.points)} نقطة لـ ${t.assignedToName}. متابعة؟`))) return
  await store.approveTask(t.id)
}
</script>

<template>
  <section>
    <h2 class="sec-title">✅ المهام بانتظار الاعتماد</h2>
    <div class="cards-list">
      <div v-for="t in store.pendingTasks" :key="t.id" class="tcard" style="border-right-color: var(--purple)">
        <div class="tcard-top">
          <span class="tcard-title">#{{ t.no }} {{ t.title }}</span>
          <span class="points-chip">⭐ {{ pointsFmt(t.points) }}</span>
        </div>
        <div class="tcard-meta">
          <span>👤 {{ t.assignedToName || '' }}</span>
          <span>🕒 {{ fmtDateTime(t.submittedAt) }}</span>
        </div>
        <div class="tcard-actions">
          <button class="btn btn-sm btn-primary" @click="approve(t)">✅ اعتماد</button>
          <button class="btn btn-sm btn-danger" @click="openDetail(t.id, true)">❌ رفض</button>
          <button class="btn btn-sm btn-outline" @click="openDetail(t.id)">👁️ التفاصيل والتقارير</button>
        </div>
      </div>
      <div v-if="!store.pendingTasks.length" class="empty"><span class="big">🎉</span>لا توجد مهام بانتظار الاعتماد</div>
    </div>

    <TaskDetailModal v-if="detailId" :task-id="detailId" :open-reject="openReject" @close="detailId = null" />
  </section>
</template>
