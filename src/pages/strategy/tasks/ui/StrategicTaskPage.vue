<template>
  <div class="strategic-task-page">
    <PageHeader title="战略任务管理" />
    <StrategicTaskView :selected-role="props.selectedRole" />
  </div>
</template>

<script setup lang="ts">
import { PageHeader } from '@/shared/ui/layout'
import { StrategicTaskView } from '@/features/task'

const props = defineProps<{
  selectedRole: string
}>()
</script>

<style scoped>
.strategic-task-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>
