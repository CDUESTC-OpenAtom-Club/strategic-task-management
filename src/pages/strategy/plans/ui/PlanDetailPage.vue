<template>
  <div class="plan-detail-page">
    <PlanDetailView />
  </div>
</template>

<script setup lang="ts">
import { PlanDetailView } from '@/features/plan/ui'
</script>

<style scoped>
.plan-detail-page {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}
</style>
