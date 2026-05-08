<!--
  BaseChart - 通用图表基础组件

  职责:
  - 提供 vue-echarts 的统一封装
  - 处理图表加载状态
  - 处理图表错误状态
  - 提供统一的样式和配置
-->
<script setup lang="ts">
import {
  computed,
  ref as _ref,
  watch as _watch,
  onMounted as _onMounted,
  onUnmounted as _onUnmounted
} from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsOption } from 'echarts'

// 注册渲染器
use([CanvasRenderer])

/** 图表组件 Props */
export interface BaseChartProps {
  /** ECharts 配置选项 */
  option: EChartsOption
  /** 图表高度 */
  height?: string | number
  /** 图表宽度 */
  width?: string | number
  /** 是否自动调整大小 */
  autoresize?: boolean
  /** 是否显示加载状态 */
  loading?: boolean
  /** 加载状态文字 */
  loadingText?: string
  /** 是否显示空状态 */
  empty?: boolean
  /** 空状态文字 */
  emptyText?: string
  /** 主题 */
  theme?: 'light' | 'dark'
}

const props = withDefaults(defineProps<BaseChartProps>(), {
  height: '400px',
  width: '100%',
  autoresize: true,
  loading: false,
  loadingText: '加载中...',
  empty: false,
  emptyText: '暂无数据',
  theme: 'light'
})

const emit = defineEmits<{
  /** 图表就绪事件 */
  ready: [instance: unknown]
  /** 图表点击事件 */
  click: [params: Record<string, unknown>]
  /** 图表鼠标悬停事件 */
  mouseover: [params: Record<string, unknown>]
  /** 图图鼠标离开事件 */
  mouseout: [params: Record<string, unknown>]
}>()

/** 图表容器样式 */
const chartStyle = computed(() => ({
  width: typeof props.width === 'number' ? `${props.width}px` : props.width,
  height: typeof props.height === 'number' ? `${props.height}px` : props.height
}))

/** 是否显示内容 */
const _showContent = computed(() => !props.loading && !props.empty)

/** 处理图表就绪 */
const handleReady = (instance: unknown) => {
  emit('ready', instance)
}

/** 处理图表点击 */
const handleClick = (params: Record<string, unknown>) => {
  emit('click', params)
}

/** 处理鼠标悬停 */
const handleMouseover = (params: Record<string, unknown>) => {
  emit('mouseover', params)
}

/** 处理鼠标离开 */
const handleMouseout = (params: Record<string, unknown>) => {
  emit('mouseout', params)
}
</script>

<template>
  <div class="base-chart">
    <!-- 加载状态 -->
    <div v-if="loading" class="base-chart__loading">
      <el-icon class="is-loading" :size="32">
        <Loading />
      </el-icon>
      <p class="base-chart__loading-text">{{ loadingText }}</p>
    </div>

    <!-- 空状态 -->
    <div v-else-if="empty" class="base-chart__empty">
      <el-empty :description="emptyText" />
    </div>

    <!-- 图表内容 -->
    <v-chart
      v-else
      :class="['base-chart__content', { 'base-chart__content--interactive': $emit('click') }]"
      :option="option"
      :theme="theme"
      :autoresize="autoresize"
      :style="chartStyle"
      @ready="handleReady"
      @click="handleClick"
      @mouseover="handleMouseover"
      @mouseout="handleMouseout"
    />
  </div>
</template>

<style scoped>
.base-chart {
  width: 100%;
  height: 100%;
  position: relative;
}

.base-chart__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 200px;
  color: var(--el-color-primary);
}

.base-chart__loading-text {
  margin-top: 12px;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.base-chart__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 200px;
}

.base-chart__content {
  width: 100%;
  height: 100%;
}

.base-chart__content--interactive {
  cursor: pointer;
}
</style>
