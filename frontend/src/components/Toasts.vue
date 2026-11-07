<script setup>
import { useStore } from '../store.js'
const store = useStore()
</script>

<template>
  <Teleport to="body">
    <div class="toasts">
      <div v-for="t in store.toasts" :key="t.id" class="toast" :class="t.type">{{ t.msg }}</div>
    </div>
  </Teleport>
</template>
