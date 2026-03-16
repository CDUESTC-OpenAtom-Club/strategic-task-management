<template>
  <div class="plan-list-page">
    <PlanListView />
  </div>
</template>

<script setup lang="ts">
import { PlanListView } from '@/features/plan/ui'
</script>

<style scoped>
.plan-list-page {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}
</style>
