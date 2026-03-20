<!--
  统一空状态组件

  用于展示空数据、无搜索结果、网络错误等状态
-->
<template>
  <div class="empty-state" :class="[`empty-state--${type}`, size ? `empty-state--${size}` : '']">
    <!-- 图标 -->
    <div class="empty-state__icon">
      <component :is="iconComponent" v-if="iconComponent" />
      <slot v-else name="icon">
        <el-icon :size="iconSize">
          <component :is="defaultIcon" />
        </el-icon>
      </slot>
    </div>

    <!-- 标题 -->
    <div v-if="title || $slots.title" class="empty-state__title">
      <slot name="title">
        {{ title }}
      </slot>
    </div>

    <!-- 描述 -->
    <div v-if="description || $slots.description" class="empty-state__description">
      <slot name="description">
        {{ description }}
      </slot>
    </div>

    <!-- 操作按钮 -->
    <div v-if="showAction || $slots.action" class="empty-state__action">
      <slot name="action">
        <el-button v-if="actionText" :type="actionType" @click="handleAction">
          {{ actionText }}
        </el-button>
      </slot>
    </div>

    <!-- 额外内容 -->
    <div v-if="$slots.extra" class="empty-state__extra">
      <slot name="extra"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import {
  Document,
  Search,
  Warning,
  Connection,
  Loading,
  FolderOpened,
  DataAnalysis
} from '@element-plus/icons-vue'

interface Props {
  /** 空状态类型 */
  type?: 'empty' | 'no-result' | 'error' | 'network' | 'loading' | 'no-data' | 'no-permission'
  /** 尺寸 */
  size?: 'small' | 'medium' | 'large'
  /** 自定义图标组件 */
  icon?: Component
  /** 标题 */
  title?: string
  /** 描述 */
  description?: string
  /** 是否显示操作按钮 */
  showAction?: boolean
  /** 操作按钮文字 */
  actionText?: string
  /** 操作按钮类型 */
  actionType?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
}

const props = withDefaults(defineProps<Props>(), {
  type: 'empty',
  size: 'medium',
  icon: undefined,
  title: '',
  description: '',
  showAction: false,
  actionText: '',
  actionType: 'primary'
})

const emit = defineEmits<{
  /** 点击操作按钮时触发 */
  action: []
}>()

/** 默认图标映射 */
const iconMap: Record<string, Component> = {
  empty: Document,
  'no-result': Search,
  error: Warning,
  network: Connection,
  loading: Loading,
  'no-data': DataAnalysis,
  'no-permission': FolderOpened
}

/** 默认文字映射 */
const textMap: Record<string, { title: string; description: string }> = {
  empty: {
    title: '暂无数据',
    description: '还没有任何内容，点击下方按钮创建'
  },
  'no-result': {
    title: '未找到相关内容',
    description: '试试其他搜索条件或关键词'
  },
  error: {
    title: '出错了',
    description: '加载失败，请稍后重试'
  },
  network: {
    title: '网络连接失败',
    description: '请检查网络设置后重试'
  },
  loading: {
    title: '加载中...',
    description: '正在获取数据，请稍候'
  },
  'no-data': {
    title: '暂无数据',
    description: '当前时间段没有相关数据'
  },
  'no-permission': {
    title: '无权限访问',
    description: '您没有查看此内容的权限'
  }
}

/** 图标组件 */
const iconComponent = computed(() => props.icon)

/** 默认图标 */
const defaultIcon = computed(() => iconMap[props.type] || Document)

/** 显示标题 */
const _displayTitle = computed(() => props.title || textMap[props.type]?.title || '')

/** 显示描述 */
const _displayDescription = computed(() => props.description || textMap[props.type]?.description || '')

/** 图标大小 */
const iconSize = computed(() => {
  const sizeMap = { small: 40, medium: 60, large: 80 }
  return sizeMap[props.size] || 60
})

/** 处理操作按钮点击 */
function handleAction() {
  emit('action')
}

// 暴露给模板
const { title, description } = toRefs(props)
</script>

<script lang="ts">
import { toRefs } from 'vue'
export default {
  name: 'EmptyState'
}
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: var(--el-text-color-secondary);
}

.empty-state--small {
  padding: 24px 16px;
}

.empty-state--large {
  padding: 60px 20px;
}

.empty-state__icon {
  margin-bottom: 16px;
  color: var(--el-color-info);
  opacity: 0.6;
}

.empty-state--small .empty-state__icon {
  margin-bottom: 12px;
}

.empty-state--large .empty-state__icon {
  margin-bottom: 24px;
}

.empty-state__title {
  font-size: 16px;
  font-weight: 500;
  color: var(--el-text-color-regular);
  margin-bottom: 8px;
}

.empty-state--small .empty-state__title {
  font-size: 14px;
}

.empty-state--large .empty-state__title {
  font-size: 18px;
}

.empty-state__description {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  max-width: 400px;
  line-height: 1.6;
}

.empty-state--small .empty-state__description {
  font-size: 13px;
  max-width: 300px;
}

.empty-state--large .empty-state__description {
  font-size: 15px;
  max-width: 500px;
}

.empty-state__action {
  margin-top: 20px;
}

.empty-state--small .empty-state__action {
  margin-top: 12px;
}

.empty-state--large .empty-state__action {
  margin-top: 24px;
}

.empty-state__extra {
  margin-top: 16px;
}

/* 类型特定样式 */
.empty-state--error .empty-state__icon {
  color: var(--el-color-danger);
}

.empty-state--network .empty-state__icon {
  color: var(--el-color-warning);
}

.empty-state--loading .empty-state__icon {
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
