/**
 * useDashboardState - Dashboard 状态管理 Composable
 *
 * 职责:
 * - 管理图表实例引用
 * - 管理筛选状态
 * - 管理下钻状态
 * - 管理指标卡片显示状态
 *
 * @module composables/dashboard
 */

import { ref, type Ref } from 'vue'
import type { ECharts } from 'echarts'
import type { UserRole } from '@/types'

/** 指标状态类型 */
export type IndicatorStatus = 'normal' | 'ahead' | 'warning' | 'delayed'

/** 状态颜色配置 */
export const STATUS_COLORS = {
  ahead: '#67C23A',   // 绿色 - 超前完成
  normal: '#409EFF',  // 蓝色 - 正常
  warning: '#E6A23C', // 黄色 - 预警
  delayed: '#F56C6C'  // 红色 - 延期
}

export interface DashboardStateOptions {
  initialMonth?: number
}

export function useDashboardState(options: DashboardStateOptions = {}) {
  const { initialMonth = new Date().getMonth() + 1 } = options

  // 图表实例
  const radarChartInstance: Ref<ECharts | null> = ref(null)
  const benchmarkChartInstance: Ref<ECharts | null> = ref(null)
  const collegeChartInstance: Ref<ECharts | null> = ref(null)
  const collegeRankingChartInstance: Ref<ECharts | null> = ref(null)

  // 图表 DOM 引用
  const radarChartRef = ref<HTMLElement | null>(null)
  const benchmarkChartRef = ref<HTMLElement | null>(null)
  const collegeChartRef = ref<HTMLElement | null>(null)
  const collegeRankingChartRef = ref<HTMLElement | null>(null)

  // 选中的部门（用于右侧指标完成情况卡片）
  const selectedBenchmarkDept = ref<string | null>(null)
  const showIndicatorCard = ref(false)
  const selectedStatusFilter = ref<IndicatorStatus | null>(null)

  // 月份筛选和下钻状态（用于堆叠柱状图）
  const selectedMonth = ref(initialMonth)
  const isDrillDown = ref(false)
  const drilledDept = ref('')

  // 下钻后的月份指标卡片状态
  const selectedMonthInDrillDown = ref<number | null>(null)
  const showMonthIndicatorCard = ref(false)

  // 学院看板状态（职能部门视角）
  const collegeSelectedMonth = ref(initialMonth)
  const isCollegeDrillDown = ref(false)
  const drilledCollege = ref('')
  const selectedMonthInCollegeDrillDown = ref<number | null>(null)
  const showCollegeMonthIndicatorCard = ref(false)

  // 分院排名看板状态
  const collegeRankingMonth = ref(initialMonth)
  const selectedOwnerDeptFilter = ref<string>('all')

  // 帮助文本
  const helpTexts = {
    totalScore: '总得分 = 基础性指标得分 + 发展性指标得分，满分120分。基础性指标满分100分，发展性指标满分20分。',
    basicScore: '基础性指标是必须完成的核心指标，根据各指标完成进度加权计算得分，满分100分。',
    developmentScore: '发展性指标是鼓励性指标，完成后可获得额外加分，满分20分。',
    warningCount: '预警任务指进度低于50%的指标数量，需要重点关注和推进。',
    scoreComposition: '展示基础性指标和发展性指标的得分占比，帮助了解整体得分构成。',
    alertDistribution: '按预警级别统计指标数量：严重（进度<30%）、中度（30%-60%）、正常（≥60%）。点击可筛选对应级别的指标。',
    completionRate: '完成率 = 已完成指标数 / 总指标数 × 100%，反映整体任务完成情况。',
    departmentProgress: '展示各部门的指标完成进度，进度条颜色表示状态：绿色（≥80%）、黄色（50%-80%）、红色（<50%）。',
    benchmark: '展示各部门执行进度与基准线对比，红色表示低于基准线，蓝色表示达标。',
    radar: '多维度分析各项核心指标的完成情况，帮助识别短板领域。',
    delayedTasks: '展示当前进度滞后、且需优先处理的任务清单，支持一键发送催办提醒。',
    aiBriefing: '基于大模型分析，实时提炼全校及部门战略执行的核心动态与风险提示。'
  }

  // 重置下钻状态
  const resetDrillDown = () => {
    isDrillDown.value = false
    drilledDept.value = ''
    selectedMonthInDrillDown.value = null
    showMonthIndicatorCard.value = false
  }

  // 重置学院下钻状态
  const resetCollegeDrillDown = () => {
    isCollegeDrillDown.value = false
    drilledCollege.value = ''
    selectedMonthInCollegeDrillDown.value = null
    showCollegeMonthIndicatorCard.value = false
  }

  // 清理图表实例
  const disposeCharts = () => {
    radarChartInstance.value?.dispose()
    benchmarkChartInstance.value?.dispose()
    collegeChartInstance.value?.dispose()
    collegeRankingChartInstance.value?.dispose()

    radarChartInstance.value = null
    benchmarkChartInstance.value = null
    collegeChartInstance.value = null
    collegeRankingChartInstance.value = null
  }

  return {
    // 图表实例
    radarChartInstance,
    benchmarkChartInstance,
    collegeChartInstance,
    collegeRankingChartInstance,

    // 图表 DOM 引用
    radarChartRef,
    benchmarkChartRef,
    collegeChartRef,
    collegeRankingChartRef,

    // 筛选状态
    selectedBenchmarkDept,
    showIndicatorCard,
    selectedStatusFilter,

    // 月份和下钻状态
    selectedMonth,
    isDrillDown,
    drilledDept,
    selectedMonthInDrillDown,
    showMonthIndicatorCard,

    // 学院看板状态
    collegeSelectedMonth,
    isCollegeDrillDown,
    drilledCollege,
    selectedMonthInCollegeDrillDown,
    showCollegeMonthIndicatorCard,

    // 分院排名状态
    collegeRankingMonth,
    selectedOwnerDeptFilter,

    // 帮助文本
    helpTexts,

    // 方法
    resetDrillDown,
    resetCollegeDrillDown,
    disposeCharts
  }
}
