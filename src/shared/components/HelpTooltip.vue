<script setup lang="ts">
import { QuestionFilled } from '@element-plus/icons-vue'

defineProps<{
  content: string
  title?: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
  width?: number
}>()
</script>

<template>
  <el-tooltip 
    :content="content" 
    :placement="placement || 'top'"
    :popper-options="{ modifiers: [{ name: 'offset', options: { offset: [0, 8] } }] }"
    effect="light"
  >
    <template #content>
      <div class="help-tooltip-content" :style="{ maxWidth: (width || 280) + 'px' }">
        <div v-if="title" class="tooltip-title">{{ title }}</div>
        <div class="tooltip-text">{{ content }}</div>
      </div>
    </template>
    <el-icon class="help-icon">
      <QuestionFilled />
    </el-icon>
  </el-tooltip>
</template>

<style scoped>
.help-icon {
  color: var(--text-placeholder);
  cursor: help;
  font-size: 14px;
  margin-left: 4px;
  transition: color 0.2s;
}

.help-icon:hover {
  color: var(--color-primary);
}

.help-tooltip-content {
  padding: 4px 0;
}

.tooltip-title {
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--text-main);
}

.tooltip-text {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-regular);
}
</style>
