<template>
  <el-drawer
    v-model="visible"
    title="任务审批"
    direction="rtl"
    size="600px"
    :before-close="handleClose"
  >
    <div class="drawer-content">
      <el-empty description="组件正在维护中" />
    </div>
    
    <template #footer>
      <div class="drawer-footer">
        <el-button @click="handleClose">关闭</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref } from 'vue'

// Props
const props = defineProps<{
  modelValue: boolean
  indicatorId?: string | number
  showApprovalSection?: boolean
}>()

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
}>()

// 控制抽屉显示
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// 关闭抽屉
const handleClose = () => {
  emit('close')
}
</script>

<style scoped>
.drawer-content {
  padding: 20px;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px;
  border-top: 1px solid var(--el-border-color-light);
}
</style>