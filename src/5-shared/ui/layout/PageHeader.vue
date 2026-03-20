<!--
  PageHeader - 页面头部组件

  职责:
  - 显示页面标题和描述
  - 提供面包屑导航
  - 提供操作按钮区域
  - 支持返回按钮
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

/** 面包屑项 */
export interface BreadcrumbItem {
  /** 标题 */
  title: string
  /** 路由路径 */
  path?: string
  /** 是否禁用 */
  disabled?: boolean
}

/** Props */
export interface PageHeaderProps {
  /** 页面标题 */
  title: string
  /** 页面描述 */
  description?: string
  /** 面包屑导航 */
  breadcrumb?: BreadcrumbItem[]
  /** 是否显示返回按钮 */
  showBack?: boolean
  /** 返回按钮文字 */
  backText?: string
  /** 是否显示分割线 */
  divider?: boolean
}

const props = withDefaults(defineProps<PageHeaderProps>(), {
  description: '',
  breadcrumb: () => [],
  showBack: false,
  backText: '返回',
  divider: true
})

const emit = defineEmits<{
  /** 返回事件 */
  back: []
}>()

const router = useRouter()

/** 处理返回 */
const handleBack = () => {
  emit('back')
  // 如果没有监听 back 事件，则默认使用路由返回
  if (!emit('back')) {
    router.back()
  }
}

/** 处理面包屑点击 */
const handleBreadcrumbClick = (item: BreadcrumbItem) => {
  if (item.path && !item.disabled) {
    router.push(item.path)
  }
}

/** 是否显示面包屑 */
const showBreadcrumb = computed(() => props.breadcrumb && props.breadcrumb.length > 0)
</script>

<template>
  <div class="page-header" :class="{ 'page-header--divider': divider }">
    <!-- 面包屑导航 -->
    <div v-if="showBreadcrumb" class="page-header__breadcrumb">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item
          v-for="(item, index) in breadcrumb"
          :key="index"
          :to="item.path && !item.disabled ? { path: item.path } : undefined"
        >
          <span
            :class="{
              'breadcrumb-item--disabled': item.disabled,
              'breadcrumb-item--link': item.path && !item.disabled
            }"
            @click="handleBreadcrumbClick(item)"
          >
            {{ item.title }}
          </span>
        </el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <!-- 主要内容 -->
    <div class="page-header__main">
      <!-- 左侧：标题和描述 -->
      <div class="page-header__content">
        <!-- 返回按钮 -->
        <el-button
          v-if="showBack"
          class="page-header__back"
          link
          @click="handleBack"
        >
          <el-icon><ArrowLeft /></el-icon>
          <span>{{ backText }}</span>
        </el-button>

        <!-- 标题 -->
        <div class="page-header__title-wrapper">
          <h1 class="page-header__title">
            <slot name="title">{{ title }}</slot>
          </h1>
          <div v-if="$slots.extra" class="page-header__extra">
            <slot name="extra" />
          </div>
        </div>

        <!-- 描述 -->
        <p v-if="description || $slots.description" class="page-header__description">
          <slot name="description">{{ description }}</slot>
        </p>
      </div>

      <!-- 右侧：操作按钮 -->
      <div v-if="$slots.actions" class="page-header__actions">
        <slot name="actions" />
      </div>
    </div>

    <!-- 底部扩展区域 -->
    <div v-if="$slots.footer" class="page-header__footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<style scoped>
.page-header {
  margin-bottom: 24px;
}

.page-header--divider {
  padding-bottom: 20px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.page-header__breadcrumb {
  margin-bottom: 16px;
}

.breadcrumb-item--link {
  cursor: pointer;
  transition: color 0.3s;
}

.breadcrumb-item--link:hover {
  color: var(--el-color-primary);
}

.breadcrumb-item--disabled {
  color: var(--el-text-color-disabled);
  cursor: not-allowed;
}

.page-header__main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

.page-header__content {
  flex: 1;
  min-width: 0;
}

.page-header__back {
  margin-bottom: 12px;
  padding: 0;
  font-size: 14px;
}

.page-header__back .el-icon {
  margin-right: 4px;
}

.page-header__title-wrapper {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 8px;
}

.page-header__title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--el-text-color-primary);
}

.page-header__extra {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-header__description {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
}

.page-header__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.page-header__footer {
  margin-top: 16px;
}
</style>
