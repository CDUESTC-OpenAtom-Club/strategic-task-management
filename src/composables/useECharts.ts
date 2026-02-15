/**
 * useECharts - ECharts 通用 Composable
 *
 * 职责:
 * - 管理 ECharts 实例生命周期
 * - 处理图表响应式调整
 * - 提供统一的图表配置
 * - 处理主题切换
 *
 * @module composables
 */

import { ref, onMounted, onUnmounted, watch, nextTick, type Ref } from 'vue'
// 按需导入ECharts核心和组件
import * as echarts from 'echarts/core'
// 导入需要的图表类型
import {
  BarChart,
  LineChart,
  PieChart,
  TreemapChart,
  SankeyChart,
  RadarChart
} from 'echarts/charts'
// 导入需要的组件
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
  TransformComponent
} from 'echarts/components'
// 导入渲染器
import { LabelLayout, UniversalTransition } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'

// 注册所有需要的组件
echarts.use([
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
  TransformComponent,
  BarChart,
  LineChart,
  PieChart,
  TreemapChart,
  SankeyChart,
  RadarChart,
  LabelLayout,
  UniversalTransition,
  CanvasRenderer
])

import type { ECharts, EChartsOption } from 'echarts'

/**
 * ECharts 主题配置
 */
export type ChartTheme = 'light' | 'dark' | 'custom'

/**
 * 图表配置选项
 */
export interface UseEChartsOptions {
  /** 初始主题 */
  theme?: ChartTheme
  /** 是否启用动画 */
  animation?: boolean
  /** 动画时长 (ms) */
  animationDuration?: number
  /** 是否自动调整大小 */
  autoResize?: boolean
  /** 调整大小延迟 (ms) */
  resizeDelay?: number
}

/**
 * ECharts Composable 返回值
 */
export interface UseEChartsReturn {
  /** 图表 DOM 引用 */
  chartRef: Ref<HTMLElement | null>
  /** ECharts 实例 */
  chartInstance: Ref<ECharts | null>
  /** 是否已初始化 */
  isInitialized: Ref<boolean>
  /** 初始化图表 */
  init: () => void
  /** 设置图表选项 */
  setOption: (option: EChartsOption, notMerge?: boolean) => void
  /** 调整图表大小 */
  resize: () => void
  /** 销毁图表 */
  dispose: () => void
  /** 获取图表实例 */
  getInstance: () => ECharts | null
}

/**
 * 默认图表配置
 */
const DEFAULT_OPTIONS: Required<UseEChartsOptions> = {
  theme: 'light',
  animation: true,
  animationDuration: 300,
  autoResize: true,
  resizeDelay: 100
}

/**
 * 通用饼图样式配置
 */
export const PIE_COMMON_STYLE = {
  itemStyle: {
    borderRadius: 8,
    borderColor: '#fff',
    borderWidth: 4,
    shadowBlur: 10,
    shadowColor: 'rgba(0, 0, 0, 0.05)'
  },
  label: { show: false },
  emphasis: {
    scale: true,
    scaleSize: 10,
    itemStyle: {
      shadowBlur: 20,
      shadowOffsetX: 0,
      shadowColor: 'rgba(0, 0, 0, 0.2)',
      borderRadius: 12
    }
  },
  labelLine: { show: false }
}

/**
 * 通用图例配置
 */
export const LEGEND_COMMON_CONFIG = {
  orient: 'vertical' as const,
  right: 10,
  top: 'center' as const,
  itemWidth: 10,
  itemHeight: 10,
  textStyle: { fontSize: 12 }
}

/**
 * 环形图中心文字配置
 */
export interface DonutCenterTextConfig {
  /** 上方文字 */
  topText: string
  /** 下方文字 (数值) */
  bottomText: string | number
  /** 中心位置 X */
  centerX?: string
  /** 中心位置 Y */
  centerY?: string
}

/**
 * 生成环形图中心文字配置
 */
export function createDonutCenterText(config: DonutCenterTextTextConfig) {
  const { topText, bottomText, centerX = '35%', centerY = '50%' } = config

  return {
    type: 'group',
    left: centerX,
    top: centerY,
    bounding: 'raw',
    children: [
      {
        type: 'text',
        left: 'center',
        top: -20,
        style: {
          fill: '#909399',
          text: topText,
          font: '14px "Microsoft YaHei", sans-serif'
        }
      },
      {
        type: 'text',
        left: 'center',
        top: 5,
        style: {
          fill: '#303133',
          text: String(bottomText),
          font: 'bold 24px "DIN Alternate", "Helvetica Neue", sans-serif'
        }
      }
    ]
  }
}

/**
 * ECharts Composable
 */
export function useECharts(options: UseEChartsOptions = {}): UseEChartsReturn {
  const resolvedOptions = { ...DEFAULT_OPTIONS, ...options }

  const chartRef = ref<HTMLElement | null>(null)
  const chartInstance = ref<ECharts | null>(null)
  const isInitialized = ref(false)

  let resizeTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * 初始化图表
   */
  const init = () => {
    if (!chartRef.value) {
      console.warn('[useECharts] Chart ref is not ready')
      return
    }

    if (chartInstance.value) {
      return // 已初始化
    }

    try {
      chartInstance.value = echarts.init(
        chartRef.value,
        resolvedOptions.theme
      )
      isInitialized.value = true

      if (resolvedOptions.autoResize) {
        window.addEventListener('resize', handleResize)
      }
    } catch (error) {
      console.error('[useECharts] Failed to initialize chart:', error)
    }
  }

  /**
   * 设置图表选项
   */
  const setOption = (option: EChartsOption, notMerge = false) => {
    if (!chartInstance.value) {
      console.warn('[useECharts] Chart instance not initialized')
      return
    }

    chartInstance.value.setOption(option, {
      notMerge,
      lazyUpdate: !resolvedOptions.animation
    })
  }

  /**
   * 调整图表大小
   */
  const resize = () => {
    if (!chartInstance.value) return

    try {
      chartInstance.value.resize()
    } catch (error) {
      console.error('[useECharts] Failed to resize chart:', error)
    }
  }

  /**
   * 处理窗口大小变化
   */
  const handleResize = () => {
    if (resizeTimer) {
      clearTimeout(resizeTimer)
    }

    resizeTimer = setTimeout(() => {
      resize()
    }, resolvedOptions.resizeDelay)
  }

  /**
   * 销毁图表
   */
  const dispose = () => {
    if (resizeTimer) {
      clearTimeout(resizeTimer)
    }

    if (resolvedOptions.autoResize) {
      window.removeEventListener('resize', handleResize)
    }

    if (chartInstance.value) {
      try {
        chartInstance.value.dispose()
        chartInstance.value = null
        isInitialized.value = false
      } catch (error) {
        console.error('[useECharts] Failed to dispose chart:', error)
      }
    }
  }

  /**
   * 获取图表实例
   */
  const getInstance = () => chartInstance.value

  // 生命周期管理
  onMounted(() => {
    // 等待 DOM 准备就绪
    nextTick(() => {
      init()
    })
  })

  onUnmounted(() => {
    dispose()
  })

  return {
    chartRef,
    chartInstance,
    isInitialized,
    init,
    setOption,
    resize,
    dispose,
    getInstance
  }
}

/**
 * 监听响应式数据变化并更新图表
 */
export function useChartOption<T>(
  chartInstance: Ref<ECharts | null>,
  optionFn: () => EChartsOption,
  deps: Ref<T> | Ref<T>[]
) {
  watch(
    deps,
    () => {
      if (chartInstance.value) {
        chartInstance.value.setOption(optionFn(), {
          notMerge: false,
          lazyUpdate: false
        })
      }
    },
    { deep: true }
  )
}

// 修复类型错误
type DonutCenterTextTextConfig = {
  topText: string
  bottomText: string | number
  centerX?: string
  centerY?: string
}
