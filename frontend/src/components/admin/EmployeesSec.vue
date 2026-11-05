<script setup>
import { ref } from 'vue'
import { useStore } from '../../store.js'
import { pointsFmt, isOnLeaveNow, EMP_STATUSES } from '../../utils.js'
import EmployeeFormModal from './EmployeeFormModal.vue'
import PointsAdjustModal from './PointsAdjustModal.vue'

const store = useStore()
const editId = ref(null)
const showForm = ref(false)
const adjustId = ref(null)
const busyId = ref('')

function openNew() { editId.value = null; showForm.value = true }
function openEdit(id) { editId.value = id; showForm.value = true }

async function toggleDisable(e) {
  const toDisabled = e.status !== 'disabled'
  const ok = await store.confirm(
    toDisabled ? 'إيقاف الموظف' : 'تفعيل الموظف',
    toDisabled ? `سيتم إيقاف "${e.fullName}" ولن يستطيع الدخول أو استلام مهام` : `سيتم تفعيل حساب "${e.fullName}"`,
    toDisabled
  )
  if (!ok) return
  busyId.value = e.id
  await store.updateEmployee(e.id, { status: toDisabled ? 'disabled' : 'active' })
  busyId.value = ''
}

function borderColor(e) {
  if (e.status === 'active') return 'var(--ok)'
  if (e.status === 'on_leave') return 'var(--info)'
  return 'var(--line)'
}
</script>

<template>
  <section>
    <div class="sec-head">
      <h2 class="sec-title">👥 الموظفون</h2>
      <button class="btn btn-primary" @click="openNew">➕ إضافة موظف</button>
    </div>

    <div class="cards-list">
      <div v-for="e in store.listEmployees(true)" :key="e.id" class="tcard" :style="{ borderRightColor: borderColor(e) }">
        <div class="tcard-top">
          <span class="tcard-title">👷 {{ e.fullName }}</span>
          <span class="points-chip">⭐ {{ pointsFmt(e.totalPoints) }}</span>
          <span class="st" :class="'st-' + e.status">
            {{ EMP_STATUSES[e.status] || e.status }}{{ isOnLeaveNow(e) ? ' (حالياً)' : '' }}
          </span>
        </div>
        <div class="tcard-meta">
          <span v-if="e.username">👤 @{{ e.username }}</span>
          <span>✅ {{ e.tasksCompleted || 0 }} مكتملة</span>
          <span>❌ {{ e.tasksRejected || 0 }} مرفوضة</span>
          <span v-if="e.telegramChatId">📬 TG ID: {{ e.telegramChatId }}</span>
          <span v-if="e.telegramUsername">✈️ @{{ e.telegramUsername }}</span>
          <span v-if="!e.telegramChatId && !e.telegramUsername" class="muted">بدون تيليكرام</span>
          <span v-if="e.notificationsEnabled === false">🔕 إشعارات مطفأة</span>
          <span v-if="(e.exceptions || []).length">🚫 مستثنى من {{ e.exceptions.length }} نوع</span>
          <span v-if="e.notes">📝 {{ e.notes }}</span>
        </div>
        <div class="tcard-actions">
          <button class="btn btn-sm btn-outline" @click="openEdit(e.id)">✏️ تعديل</button>
          <button class="btn btn-sm btn-outline" @click="adjustId = e.id">⭐ تعديل النقاط</button>
          <button class="btn btn-sm btn-ghost" :disabled="busyId === e.id" @click="toggleDisable(e)">
            {{ e.status === 'disabled' ? '▶️ تفعيل' : '⏸️ إيقاف' }}
          </button>
        </div>
      </div>
      <div v-if="!store.employees.length" class="empty"><span class="big">👥</span>لا يوجد موظفون — أضف أول موظف</div>
    </div>

    <EmployeeFormModal v-if="showForm" :emp-id="editId" @close="showForm = false" />
    <PointsAdjustModal v-if="adjustId" :emp-id="adjustId" @close="adjustId = null" />
  </section>
</template>
