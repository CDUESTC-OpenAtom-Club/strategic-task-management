<!--
  StatusBadge - 状态徽章组件

  职责:
  - 显示状态标签
  - 支持多种状态类型
  - 支持自定义颜色
  - 支持不同尺寸
-->
<script setup lang="ts">
import { computed } from 'vue'

/** 状态类型 */
export type StatusType = 'success' | 'info' | 'warning' | 'danger' | 'primary' | 'default'

/** Props */
export interface StatusBadgeProps {
  /** 状态文本 */
  text: string
  /** 状态类型 */
  type?: StatusType
  /** 尺寸 */
  size?: 'small' | 'default' | 'large'
  /** 是否显示圆点 */
  dot?: boolean
  /** 自定义颜色 */
  color?: string
}

const props = withDefaults(defineProps<StatusBadgeProps>(), {
  type: 'default',
  size: 'default',
  dot: false,
  color: ''
})

/** 计算徽章类名 */
const badgeClass = computed(() => [
  'status-badge',
  `status-badge--${props.type}`,
  `status-badge--${props.size}`,
  {
    'status-badge--dot': props.dot
  }
])

/** 计算徽章样式 */
const badgeStyle = computed(() => {
  if (props.color) {
    return {
      backgroundColor: `${props.color}1A`, // 10% opacity
      color: props.color,
      borderColor: props.color
    }
  }
  return {}
})
</script>

<template>
  <span :class="badgeClass" :style="badgeStyle">
    <span v-if="dot" class="status-badge__dot" />
    <span class="status-badge__text">{{ text }}</span>
  </span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.5;
  white-space: nowrap;
  border: 1px solid transparent;
  transition: all 0.3s;
}

/* 尺寸 */
.status-badge--small {
  padding: 2px 8px;
  font-size: 11px;
}

.status-badge--large {
  padding: 6px 12px;
  font-size: 13px;
}

/* 类型 */
.status-badge--success {
  background: rgba(103, 194, 58, 0.1);
  color: var(--el-color-success);
  border-color: var(--el-color-success-light-5);
}

.status-badge--info {
  background: rgba(144, 147, 153, 0.1);
  color: var(--el-color-info);
  border-color: var(--el-color-info-light-5);
}

.status-badge--warning {
  background: rgba(230, 162, 60, 0.1);
  color: var(--el-color-warning);
  border-color: var(--el-color-warning-light-5);
}

.status-badge--danger {
  background: rgba(245, 108, 108, 0.1);
  color: var(--el-color-danger);
  border-color: var(--el-color-danger-light-5);
}

.status-badge--primary {
  background: rgba(64, 158, 255, 0.1);
  color: var(--el-color-primary);
  border-color: var(--el-color-primary-light-5);
}

.status-badge--default {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
  border-color: var(--el-border-color-light);
}

/* 圆点 */
.status-badge--dot .status-badge__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: currentColor;
}

.status-badge__text {
  line-height: 1;
}
</style>
