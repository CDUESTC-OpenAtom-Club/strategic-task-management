<!--
  通用骨架屏组件

  用于数据加载时显示占位内容，提升用户体验
-->
<template>
  <div class="skeleton-loader" :class="{ 'skeleton-loader--dark': dark }">
    <!-- 表格骨架 -->
    <template v-if="type === 'table'">
      <div class="skeleton-table">
        <div v-for="i in rows" :key="i" class="skeleton-table__row">
          <div
            v-for="j in columns"
            :key="j"
            class="skeleton-table__cell"
            :style="{ width: getCellWidth(j) }"
          >
            <div class="skeleton-shape"></div>
          </div>
        </div>
      </div>
    </template>

    <!-- 卡片骨架 -->
    <template v-else-if="type === 'card'">
      <div class="skeleton-card" :style="{ width: cardWidth }">
        <div v-if="showAvatar" class="skeleton-card__avatar">
          <div class="skeleton-shape skeleton-shape--circle"></div>
        </div>
        <div class="skeleton-card__content">
          <div class="skeleton-card__title">
            <div class="skeleton-shape" style="width: 60%"></div>
          </div>
          <div class="skeleton-card__desc">
            <div class="skeleton-shape" style="width: 100%"></div>
          </div>
          <div class="skeleton-card__desc">
            <div class="skeleton-shape" style="width: 80%"></div>
          </div>
        </div>
      </div>
    </template>

    <!-- 列表骨架 -->
    <template v-else-if="type === 'list'">
      <div class="skeleton-list">
        <div v-for="i in rows" :key="i" class="skeleton-list__item">
          <div v-if="showAvatar" class="skeleton-list__avatar">
            <div class="skeleton-shape skeleton-shape--circle"></div>
          </div>
          <div class="skeleton-list__content">
            <div class="skeleton-shape" style="width: 40%; margin-bottom: 8px"></div>
            <div class="skeleton-shape" style="width: 70%"></div>
          </div>
        </div>
      </div>
    </template>

    <!-- 图表骨架 -->
    <template v-else-if="type === 'chart'">
      <div class="skeleton-chart" :style="{ height: chartHeight, width: chartWidth }">
        <div class="skeleton-chart__header">
          <div class="skeleton-shape" style="width: 30%"></div>
        </div>
        <div class="skeleton-chart__body">
          <div class="skeleton-chart__axis"></div>
          <div class="skeleton-chart__bars">
            <div v-for="i in 6" :key="i" class="skeleton-chart__bar" :style="{ height: `${40 + Math.random() * 40}%` }"></div>
          </div>
        </div>
      </div>
    </template>

    <!-- 表单骨架 -->
    <template v-else-if="type === 'form'">
      <div class="skeleton-form" :style="{ width: formWidth }">
        <div v-for="i in rows" :key="i" class="skeleton-form__field">
          <div class="skeleton-form__label">
            <div class="skeleton-shape" style="width: 25%"></div>
          </div>
          <div class="skeleton-form__input">
            <div class="skeleton-shape"></div>
          </div>
        </div>
        <div class="skeleton-form__actions">
          <div class="skeleton-shape" style="width: 100px"></div>
          <div class="skeleton-shape" style="width: 100px"></div>
        </div>
      </div>
    </template>

    <!-- 基础骨架（矩形） -->
    <template v-else>
      <div class="skeleton-basic" :style="{ width, height }">
        <div class="skeleton-shape"></div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
interface Props {
  /** 骨架屏类型 */
  type?: 'table' | 'card' | 'list' | 'chart' | 'form' | 'basic'
  /** 行数（用于表格、列表、表单） */
  rows?: number
  /** 列数（用于表格） */
  columns?: number
  /** 是否显示头像（用于卡片、列表） */
  showAvatar?: boolean
  /** 卡片宽度 */
  cardWidth?: string
  /** 表单宽度 */
  formWidth?: string
  /** 图表高度 */
  chartHeight?: string
  /** 图表宽度 */
  chartWidth?: string
  /** 基础骨架宽度 */
  width?: string
  /** 基础骨架高度 */
  height?: string
  /** 是否为深色主题 */
  dark?: boolean
}

withDefaults(defineProps<Props>(), {
  type: 'basic',
  rows: 5,
  columns: 5,
  showAvatar: false,
  cardWidth: '100%',
  formWidth: '100%',
  chartHeight: '300px',
  chartWidth: '100%',
  width: '100%',
  height: '100px',
  dark: false
})

/** 获取表格单元格宽度（模拟真实内容长度差异） */
function getCellWidth(index: number): string {
  const widths = ['40%', '70%', '50%', '60%', '30%'] as const
  return widths[(index - 1) % widths.length] ?? widths[0]
}
</script>

<style scoped>
.skeleton-loader {
  --skeleton-base: #f2f3f5;
  --skeleton-highlight: #e5e7eb;
  --skeleton-shimmer: linear-gradient(
    90deg,
    var(--skeleton-base) 0%,
    var(--skeleton-highlight) 50%,
    var(--skeleton-base) 100%
  );
}

.skeleton-loader--dark {
  --skeleton-base: #2c2c2c;
  --skeleton-highlight: #3a3a3a;
}

/* 骨架形状动画 */
.skeleton-shape {
  background: var(--skeleton-shimmer);
  background-size: 200% 100%;
  border-radius: 4px;
  animation: shimmer 1.5s infinite;
  height: 16px;
  width: 100%;
}

.skeleton-shape--circle {
  border-radius: 50%;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

/* 表格骨架 */
.skeleton-table {
  width: 100%;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  overflow: hidden;
}

.skeleton-table__row {
  display: flex;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.skeleton-table__row:last-child {
  border-bottom: none;
}

.skeleton-table__cell {
  padding: 12px 16px;
  flex-shrink: 0;
}

/* 卡片骨架 */
.skeleton-card {
  display: flex;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
}

.skeleton-card__avatar .skeleton-shape {
  width: 48px;
  height: 48px;
}

.skeleton-card__content {
  flex: 1;
}

.skeleton-card__title .skeleton-shape {
  height: 20px;
  margin-bottom: 12px;
}

.skeleton-card__desc {
  margin-bottom: 8px;
}

/* 列表骨架 */
.skeleton-list__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.skeleton-list__item:last-child {
  border-bottom: none;
}

.skeleton-list__avatar .skeleton-shape {
  width: 40px;
  height: 40px;
}

.skeleton-list__content {
  flex: 1;
}

/* 图表骨架 */
.skeleton-chart {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 16px;
}

.skeleton-chart__header {
  margin-bottom: 20px;
}

.skeleton-chart__header .skeleton-shape {
  height: 20px;
}

.skeleton-chart__body {
  display: flex;
  height: calc(100% - 40px);
}

.skeleton-chart__axis {
  width: 40px;
  border-right: 1px solid var(--el-border-color-light);
  margin-right: 12px;
}

.skeleton-chart__bars {
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  gap: 8px;
}

.skeleton-chart__bar {
  flex: 1;
  max-width: 60px;
  background: var(--skeleton-shimmer);
  background-size: 200% 100%;
  border-radius: 4px 4px 0 0;
  animation: shimmer 1.5s infinite;
}

/* 表单骨架 */
.skeleton-form__field {
  margin-bottom: 20px;
}

.skeleton-form__label {
  margin-bottom: 8px;
}

.skeleton-form__input .skeleton-shape {
  height: 36px;
}

.skeleton-form__actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.skeleton-form__actions .skeleton-shape {
  height: 32px;
}

/* 基础骨架 */
.skeleton-basic {
  display: inline-block;
}

.skeleton-basic .skeleton-shape {
  height: 100%;
}
</style>
