<script setup>
/* مديرو المهام — v1.0.2
   صلاحية وسطى: يرسل مهام ويتابع موظفيه مثل صاحب النظام
   لكن بدون صلاحيات المدير العام (ما يعدل موظفين ولا رموزهم ولا إعدادات)
   المدير العام يحدد الموظفين المرتبطين بكل مدير — يرسل لهم فقط
   + الضغط على كرت مدير المهام يفتح تعديله مباشرة */
import { ref } from 'vue'
import { useStore } from '../../store.js'
import { pointsFmt } from '../../utils.js'
import ManagerFormModal from './ManagerFormModal.vue'

const store = useStore()
const editId = ref(null)
const showForm = ref(false)

function openNew() { editId.value = null; showForm.value = true }
function openEdit(id) { editId.value = id; showForm.value = true }

const boundNames = (m) => (m.boundEmployeeIds || [])
  .map(id => store.getEmployee(id)?.fullName).filter(Boolean)

async function toggleDelete(m) {
  const del = !m.deleted
  const ok = await store.confirm(del ? 'حذف مدير المهام' : 'استعادة مدير المهام',
    del
      ? `حذف حساب مدير المهام "${m.fullName}" حذف ناعم — ما يكدر يدخل، وتكدر تستعيده.` +
        `\nمهامه وسجلاته تبقى كلها بالسجل. متابعة؟`
      : `استعادة حساب "${m.fullName}"؟`, del)
  if (!ok) return
  await store.updateManager(m.id, { deleted: del })
  if (del) store.toast('تم حذف مدير المهام (ناعم — قابل للاستعادة)', 'ok')
}
</script>

<template>
  <section>
    <div class="sec-head">
      <h2 class="sec-title">🧑‍💼 مديرو المهام</h2>
      <button class="btn btn-primary" @click="openNew">➕ مدير مهام جديد</button>
    </div>

    <div class="detail-sec" style="margin-bottom:14px">
      💡 <b>شنو صلاحية مدير المهام؟</b><br>
      يرسل مهام (تلقائي/مباشر/مجموعة/لكل/موقوتة) ويعتمد أو يرفض إنجاز موظفيه ويتابع حالتهم —
      مثل صاحب النظام تقريباً، <b>لكن</b> ما يكدر يعدل الموظفين، ولا يغير رموزهم، ولا يدخل الإعدادات أو النسخ الاحتياطي.<br>
      🔒 كل عملياته تنحفظ بسجل النظام باسمه وبصلاحية "مدير مهام" حتى تفرق مين سوا شو.
    </div>

    <div class="cards-list">
      <div v-for="m in store.managers" :key="m.id" class="tcard emp-clickable"
           :class="{ 'emp-disabled': m.deleted }"
           :style="{ borderRightColor: m.deleted ? 'var(--muted)' : 'var(--purple)' }"
           :title="m.deleted ? '' : 'فتح تعديل ' + m.fullName"
           @click="!m.deleted && openEdit(m.id)">
        <div class="tcard-top">
          <span class="tcard-title">🧑‍💼 {{ m.fullName }}</span>
          <span class="st" :class="'st-manager'">👤 {{ m.username }}</span>
          <span v-if="m.deleted" class="st st-cancelled">محذوف</span>
        </div>
        <div class="tcard-meta">
          <span v-if="!m.deleted && (m.boundEmployeeIds || []).length">
            🔗 مرتبط بـ {{ m.boundEmployeeIds.length }} موظف: {{ boundNames(m).join('، ') || '—' }}
          </span>
          <span v-else-if="!m.deleted" class="minus">⚠️ غير مرتبط بأي موظف — ما يكدر يرسل مهام حتى تربطه</span>
          <span v-if="m.createdAt" class="muted">أُنشئ: {{ m.createdAt.slice(0, 10) }}</span>
        </div>
        <div class="tcard-actions" @click.stop>
          <template v-if="!m.deleted">
            <button class="btn btn-sm btn-outline" @click="openEdit(m.id)">✏️ تعديل والربط</button>
            <button class="btn btn-sm btn-danger-ghost" @click="toggleDelete(m)">🗑️ حذف</button>
          </template>
          <template v-else>
            <button class="btn btn-sm btn-primary" @click="toggleDelete(m)">♻️ استعادة</button>
          </template>
        </div>
      </div>
      <div v-if="!store.managers.length" class="empty">
        <span class="big">🧑‍💼</span>ماكو مديرو مهام — أنشئ أول حساب واربطه بموظفيه
      </div>
    </div>

    <ManagerFormModal v-if="showForm" :mgr-id="editId" @close="showForm = false" />
  </section>
</template>
