<script setup>
/* نافذة منبثقة عامة — تُغلق بالخارج أو Esc */
import { onMounted, onUnmounted } from 'vue'

const emit = defineEmits(['close'])

function onKey(e) { if (e.key === 'Escape') emit('close') }
onMounted(() => document.addEventListener('keydown', onKey))
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="emit('close')">
      <div class="modal">
        <slot />
      </div>
    </div>
  </Teleport>
</template>
