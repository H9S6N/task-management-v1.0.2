<script setup>
/* أنواع المهام — v1.0.1: + حذف ناعم (النوع يختفي ويكدر يسترد) */
import { ref } from 'vue'
import { useStore } from '../../store.js'
import { pointsFmt } from '../../utils.js'
import TypeFormModal from './TypeFormModal.vue'

const store = useStore()
const editId = ref(null)
const showForm = ref(false)

async function toggle(t) {
  await store.updateTaskType(t.id, { isActive: t.isActive === false })
}
async function toggleDelete(t) {
  const del = t.deleted !== true
  const ok = await store.confirm(del ? 'حذف نوع المهمة' : 'استعادة نوع المهمة',
    del
      ? `حذف النوع "${t.name}" حذف ناعم — يختفي من قوائم الإنشاء والمهام القديمة تبقى بسجلها. متابعة؟`
      : `استعادة النوع "${t.name}"؟`, del)
  if (!ok) return
  await store.updateTaskType(t.id, { deleted: del })
}
</script>

<template>
  <section>
    <div class="sec-head">
      <h2 class="sec-title">📋 أنواع المهام</h2>
      <button class="btn btn-primary" @click="editId = null; showForm = true">➕ نوع جديد</button>
    </div>

    <div class="cards-list">
      <div v-for="t in store.listTaskTypes(false)" :key="t.id" class="tcard"
           :style="{ borderRightColor: t.isActive !== false ? 'var(--primary)' : 'var(--line)' }">
        <div class="tcard-top">
          <span class="tcard-title">📋 {{ t.name }} <span class="muted" dir="ltr">({{ t.code }})</span></span>
          <span class="points-chip">⭐ {{ pointsFmt(t.defaultPoints) }}</span>
          <span v-if="t.isActive !== false" class="st st-active">مفعل</span>
          <span v-else class="st st-cancelled">متوقف</span>
        </div>
        <div class="tcard-meta">
          <span v-if="t.description">{{ t.description }}</span>
          <span>🗂️ {{ store.tasks.filter(x => x.taskTypeId === t.id).length }} مهمة أُنشئت به</span>
          <span v-if="t.requiresReport">📄 تقرير</span>
          <span v-if="t.requiresPhotos">📷 صور {{ t.photosMandatory ? '(إلزامية)' : '(اختيارية)' }}</span>
          <span v-if="t.directOnly">👤 تكليف مباشر فقط</span>
          <span v-if="t.autoDistributable === false">🚫 بدون توزيع تلقائي</span>
        </div>
        <div class="tcard-actions">
          <button class="btn btn-sm btn-outline" @click="editId = t.id; showForm = true">✏️ تعديل</button>
          <button class="btn btn-sm btn-ghost" @click="toggle(t)">
            {{ t.isActive !== false ? '⏸️ إيقاف' : '▶️ تفعيل' }}
          </button>
          <button class="btn btn-sm btn-danger-ghost" @click="toggleDelete(t)">🗑️ حذف (ناعم)</button>
        </div>
      </div>
      <div v-if="!store.taskTypes.length" class="empty"><span class="big">📋</span>لا توجد أنواع مهام</div>
    </div>

    <TypeFormModal v-if="showForm" :type-id="editId" @close="showForm = false" />
  </section>
</template>
