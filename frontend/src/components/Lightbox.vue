<script setup>
import { useStore } from '../store.js'
const store = useStore()
</script>

<template>
  <Teleport to="body">
    <div v-if="store.lightbox" class="lightbox" @click.self="store.lightbox = null">
      <img :src="store.lightbox" alt="صورة">
      <button class="icon-btn lightbox-close" @click="store.lightbox = null">✕</button>
    </div>
  </Teleport>
</template>
