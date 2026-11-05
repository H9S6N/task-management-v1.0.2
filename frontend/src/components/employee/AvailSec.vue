<script setup>
import { ref } from 'vue'
import { useStore } from '../../store.js'
import { pointsFmt, fmtDateTime } from '../../utils.js'
import Modal from '../Modal.vue'

const store = useStore()
const busyId = ref('')
const declineTask = ref(null)
const declineReason = ref('')

async function accept(t) {
  if (!(await store.confirm('قبول المهمة', 'أسرع من يقبلها يحصل عليها — هل تريد قبولها الآن؟'))) return
  busyId.value = t.id
  try {
    const r = await store.acceptTask(t.id)
    store.toast(r.message || 'تم قبول المهمة', 'ok')
  } catch { /* التوست من store */ }
  busyId.value = ''
}

function openDecline(t) {
  declineTask.value = t
  declineReason.value = ''
}

async function confirmDecline() {
  const t = declineTask.value
  if (declineReason.value.trim().length < 3) { store.toast('اكتب سبب الرفض (3 أحرف على الأقل)', 'err'); return }
  busyId.value = t.id
  try {
    await store.declineTask(t.id, declineReason.value.trim())
    declineTask.value = null
  } catch { /* التوست من store */ }
  busyId.value = ''
}
</script>

<template>
  <section>
    <h2 class="sec-title">🪙 المهام المتاحة</h2>
    <p class="muted">أسرع من يقبل المهمة يحصل عليها — وإذا ما تقدر عليها ارفضها وسيبلغ المدير</p>

    <div class="cards-list">
      <div v-for="t in store.myAvailableTasks" :key="t.id" class="tcard" style="border-right-color: var(--info)">
        <div class="tcard-top">
          <span class="tcard-title">#{{ t.no }} {{ t.title }}</span>
          <span class="points-chip">⭐ {{ pointsFmt(t.points) }}</span>
          <span class="st" :class="t.offeredTo && t.offeredTo.length ? 'st-direct' : 'st-available'">
            {{ t.offeredTo && t.offeredTo.length ? '⚡ معروضة عليك' : '📢 عامة للكل' }}
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
          <button class="btn btn-outline" :disabled="busyId === t.id" @click="openDecline(t)">🚫 رفض</button>
        </div>
      </div>
      <div v-if="!store.myAvailableTasks.length" class="empty">
        <span class="big">🪙</span>لا توجد مهام متاحة حالياً<br>
        <span class="muted">ستصلك إشعارات المتصفح + تيليكرام بأي مهمة جديدة</span>
      </div>
    </div>

    <!-- نافذة رفض المهمة العامة -->
    <Modal v-if="declineTask" @close="declineTask = null">
      <h3>🚫 رفض المهمة #{{ declineTask.no }}</h3>
      <p class="muted">{{ declineTask.title }} — سيبلغ المدير برفضك وسببه، وما را تظهر لك من جديد</p>
      <label>سبب الرفض (إلزامي)</label>
      <textarea v-model="declineReason" rows="3" placeholder="مثال: خارج دوامي، ما عندي المعدات، بعيد عن منطقتي..."></textarea>
      <div class="form-actions">
        <button class="btn btn-danger" :disabled="busyId === declineTask.id" @click="confirmDecline">تأكيد الرفض</button>
        <button class="btn btn-outline" @click="declineTask = null">تراجع</button>
      </div>
    </Modal>
  </section>
</template>
