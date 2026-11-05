<script setup>
import { useStore } from '../store.js'
const store = useStore()
</script>

<template>
  <Teleport to="body">
    <div v-if="store.confirmBox" class="modal-overlay" @click.self="store._resolveConfirm(false)">
      <div class="modal" style="max-width:460px">
        <h3>{{ store.confirmBox.title }}</h3>
        <p style="margin-bottom:6px">{{ store.confirmBox.text }}</p>
        <div class="form-actions">
          <button class="btn" :class="store.confirmBox.danger ? 'btn-danger' : 'btn-primary'"
                  @click="store._resolveConfirm(true)">تأكيد</button>
          <button class="btn btn-outline" @click="store._resolveConfirm(false)">إلغاء</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
