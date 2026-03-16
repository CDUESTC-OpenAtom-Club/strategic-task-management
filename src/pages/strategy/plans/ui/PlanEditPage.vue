<template>
  <div class="plan-edit-page">
    <PlanEditView />
  </div>
</template>

<script setup lang="ts">
import { PlanEditView } from '@/features/plan/ui'
</script>

<style scoped>
.plan-edit-page {
  padding: 20px;
  max-width: 900px;
  margin: 0 auto;
}
</style>
