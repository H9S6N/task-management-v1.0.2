<script setup>
import { computed } from 'vue'
import { useStore } from '../../store.js'
import { pointsFmt, fmtDateTime } from '../../utils.js'

const store = useStore()
const me = computed(() => store.me)
const stats = computed(() => [
  ['⭐', pointsFmt(me.value?.totalPoints), 'رصيد نقاطي'],
  ['✅', me.value?.tasksCompleted || 0, 'مهام مكتملة'],
  ['❌', me.value?.tasksRejected || 0, 'مهام مرفوضة'],
  ['🔧', store.myTasks.filter(t => ['accepted', 'in_progress'].includes(t.status)).length, 'قيد التنفيذ الآن'],
])
</script>

<template>
  <section>
    <h2 class="sec-title">⭐ نقاطي</h2>
    <div class="stats-grid">
      <div v-for="(s, i) in stats" :key="i" class="stat">
        <div class="num">{{ s[0] }} {{ s[1] }}</div>
        <div class="lbl">{{ s[2] }}</div>
      </div>
    </div>

    <div class="card">
      <h3>📜 سجل نقاطي</h3>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>التاريخ</th><th>التغيير</th><th>الرصيد</th><th>السبب</th></tr></thead>
          <tbody>
            <tr v-for="(l, i) in store.myLedger.slice(0, 40)" :key="i">
              <td>{{ fmtDateTime(l.createdAt) }}</td>
              <td :class="l.changeAmount >= 0 ? 'plus' : 'minus'">{{ l.changeAmount >= 0 ? '+' : '' }}{{ pointsFmt(l.changeAmount) }}</td>
              <td>{{ pointsFmt(l.balanceAfter) }}</td>
              <td>{{ l.reason }}</td>
            </tr>
            <tr v-if="!store.myLedger.length"><td colspan="4" class="empty">لا توجد حركات بعد — أكمل مهامك لتجمع نقاط</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
