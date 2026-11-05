<script setup>
import { computed } from 'vue'
import { useStore } from '../../store.js'
import { pointsFmt, statusLabel, statusClass, isOnLeaveNow } from '../../utils.js'

const store = useStore()
const stats = computed(() => [
  ['👥', store.activeEmployees.filter(e => e.status === 'active').length, 'موظف نشط'],
  ['🪙', store.tasks.filter(t => t.status === 'available').length, 'مهمة متاحة'],
  ['🔧', store.tasks.filter(t => ['accepted', 'in_progress'].includes(t.status)).length, 'قيد التنفيذ'],
  ['⏳', store.pendingTasks.length, 'بانتظار الاعتماد'],
  ['✅', store.tasks.filter(t => t.status === 'completed').length, 'مكتملة'],
  ['⭐', pointsFmt(store.tasks.filter(t => t.pointsAwarded).reduce((s, t) => s + (Number(t.points) || 0), 0)), 'مجموع النقاط الموزعة'],
])

/* ============ حالة كل موظف الآن — واضحة ومباشرة ============ */
const isToday = iso => {
  if (!iso) return false
  const d = new Date(iso), n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}

function openTasksOf(eid) {
  return store.tasks.filter(t => t.assignedToId === eid && ['accepted', 'in_progress', 'pending_approval'].includes(t.status))
}

function empState(e) {
  if (e.status === 'disabled') return { key: 'disabled', icon: '⛔', label: 'موقوف', cls: 'b-gray' }
  if (e.status === 'on_leave' || isOnLeaveNow(e)) return { key: 'leave', icon: '🏖️', label: 'مجاز', cls: 'b-info' }
  const open = openTasksOf(e.id)
  const working = open.filter(t => t.status === 'in_progress')
  const waiting = open.filter(t => t.status === 'accepted')
  const review = open.filter(t => t.status === 'pending_approval')
  if (review.length) return { key: 'review', icon: '⏳', label: `رفع تقرير — بانتظار اعتمادك (${review.length})`, cls: 'b-purple' }
  if (working.length) return { key: 'work', icon: '🔧', label: `طالع شغل — يتم العمل عليها (${working.length})`, cls: 'b-warn' }
  if (waiting.length) return { key: 'has', icon: '📌', label: `عنده مهمة وما كمّلها (${waiting.length})`, cls: 'b-indigo' }
  return { key: 'free', icon: '🟢', label: 'فاضي — ما عنده مهام', cls: 'b-ok' }
}

function completedToday(eid) {
  return store.tasks.filter(t => t.assignedToId === eid && t.status === 'completed' && (isToday(t.completedAt) || isToday(t.reviewedAt))).length
}
</script>

<template>
  <section>
    <h2 class="sec-title">📊 لوحة التحكم</h2>
    <div class="stats-grid">
      <div v-for="(s, i) in stats" :key="i" class="stat">
        <div class="num">{{ s[0] }} {{ s[1] }}</div>
        <div class="lbl">{{ s[2] }}</div>
      </div>
    </div>

    <!-- حالة الموظفين الآن -->
    <div class="card">
      <h3>👥 حالة الموظفين الآن</h3>
      <div class="table-wrap">
        <table class="table emp-board">
          <thead>
            <tr><th>الموظف</th><th>الحالة الآن</th><th>كمّل اليوم</th><th>مكتملة (الكل)</th><th>النقاط</th></tr>
          </thead>
          <tbody>
            <tr v-for="e in store.listEmployees(true)" :key="e.id" :class="'row-' + empState(e).key">
              <td><b>{{ e.fullName }}</b></td>
              <td><span class="emp-badge" :class="empState(e).cls">{{ empState(e).icon }} {{ empState(e).label }}</span></td>
              <td>
                <span v-if="completedToday(e.id)" class="plus">✅ {{ completedToday(e.id) }} اليوم</span>
                <span v-else class="muted">—</span>
              </td>
              <td>{{ e.tasksCompleted || 0 }}</td>
              <td>⭐ {{ pointsFmt(e.totalPoints) }}</td>
            </tr>
            <tr v-if="!store.employees.length"><td colspan="5" class="empty">لا يوجد موظفون</td></tr>
          </tbody>
        </table>
      </div>
      <p class="hint">🔧 طالع شغل = بدأ ينفذ · 📌 عنده مهمة وما كمّلها = مستلم ما بدأ · ⏳ رفع تقرير وينتظر اعتمادك · 🏖️ مجاز</p>
    </div>

    <div class="dash-cols">
      <div class="card">
        <h3>⏳ بانتظار الاعتماد</h3>
        <div class="mini-list">
          <template v-if="store.pendingTasks.length">
            <div v-for="t in store.pendingTasks.slice(0, 6)" :key="t.id" class="mini-item" @click="store.setSection('approvals')">
              <span class="t">#{{ t.no }} {{ t.title }}</span>
              <span :class="statusClass(t.status)">{{ statusLabel(t.status) }}</span>
            </div>
            <p v-if="store.pendingTasks.length > 6" class="muted">+{{ store.pendingTasks.length - 6 }} أخرى في قسم الاعتماد</p>
          </template>
          <div v-else class="empty"><span class="big">🎉</span>لا يوجد شيء بانتظار الاعتماد</div>
        </div>
      </div>
      <div class="card">
        <h3>🆕 أحدث المهام</h3>
        <div class="mini-list">
          <template v-if="store.tasks.length">
            <div v-for="t in store.tasks.slice(0, 6)" :key="t.id" class="mini-item" @click="store.setSection('tasks')">
              <span class="t">#{{ t.no }} {{ t.title }}</span>
              <span :class="statusClass(t.status)">{{ statusLabel(t.status) }}</span>
            </div>
          </template>
          <div v-else class="empty"><span class="big">🗂️</span>لا توجد مهام بعد — أنشئ أول مهمة</div>
        </div>
      </div>
    </div>
  </section>
</template>
