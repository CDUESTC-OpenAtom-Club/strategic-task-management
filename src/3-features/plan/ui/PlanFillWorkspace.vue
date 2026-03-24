<script setup lang="ts">
defineOptions({
  name: 'PlanFillWorkspace'
})
</script>

<template>
  <section class="plan-fill-workspace">
    <el-empty description="计划填报工作台待接入" />
  </section>
</template>

<style scoped>
.plan-fill-workspace {
  min-height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
</style>
