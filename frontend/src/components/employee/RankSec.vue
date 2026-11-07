<script setup>
import { computed } from 'vue'
import { useStore } from '../../store.js'
import { pointsFmt } from '../../utils.js'

const store = useStore()
const ranked = computed(() =>
  store.leaderboard.slice().sort((a, b) =>
    (Number(b.tasksCompleted) || 0) - (Number(a.tasksCompleted) || 0) ||
    (Number(b.totalPoints) || 0) - (Number(a.totalPoints) || 0)
  )
)
</script>

<template>
  <section>
    <h2 class="sec-title">🏅 ترتيب الموظفين</h2>
    <div class="card">
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>#</th><th>الموظف</th><th>مهام مكتملة</th><th>النقاط</th></tr></thead>
          <tbody>
            <tr v-for="(e, i) in ranked" :key="e.id">
              <td>{{ ['🥇', '🥈', '🥉'][i] || (i + 1) }}</td>
              <td><b>{{ e.fullName }}</b><span v-if="e.id === store.me?.id" class="muted"> (أنت)</span></td>
              <td>✅ {{ e.tasksCompleted || 0 }}</td>
              <td>⭐ {{ pointsFmt(e.totalPoints) }}</td>
            </tr>
            <tr v-if="!ranked.length"><td colspan="4" class="empty">لا يوجد موظفون</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
