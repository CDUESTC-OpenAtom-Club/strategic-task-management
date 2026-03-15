<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { Download, Warning, Aim, Refresh, QuestionFilled, Top, Close } from '@element-plus/icons-vue'
import type { DashboardData, UserRole } from '@/types'
import { useStrategicStore } from '@/features/task/model/strategic'
import { useDashboardStore } from '@/features/dashboard/model/store'
import { useAuthStore } from '@/features/auth/model/store'
import { useTimeContextStore } from '@/shared/lib/timeContext'
import BreadcrumbNav from '@/shared/ui/layout/BreadcrumbNav.vue'
import ScoreCompositionChart from '@/shared/ui/charts/ScoreCompositionChart.vue'
import AlertDistributionChart from '@/shared/ui/charts/AlertDistributionChart.vue'
import DepartmentProgressChart from '@/shared/ui/charts/DepartmentProgressChart.vue'
// 新增图表组件
import TaskSankeyChart from '@/shared/ui/charts/TaskSankeyChart.vue'
import SourcePieChart from '@/shared/ui/charts/SourcePieChart.vue'
import { ElMessage } from 'element-plus'
import { isSecondaryCollege } from '@/utils/colors'
import { useOrgStore } from '@/features/organization/model/store'
// 加载状态管理 - Requirements 1.5, 1.6
import { useLoadingState } from '@/composables/useLoadingState'

// 动态导入 echarts，避免初始加载时打包
let echarts: typeof import('echarts') | null = null
const loadEcharts = async () => {
  if (!echarts) {
    echarts = await import('echarts')
  }
  return echarts
}

// 动态导入 XLSX，只在导出时加载
let XLSX: typeof import('xlsx') | null = null
const loadXLSX = async () => {
  if (!XLSX) {
    XLSX = await import('xlsx')
  }
  return XLSX
}

// 帮助提示内容
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

// 雷达图实例
let radarChartInstance: echarts.ECharts | null = null
let benchmarkChartInstance: echarts.ECharts | null = null
const radarChartRef = ref<HTMLElement | null>(null)
const benchmarkChartRef = ref<HTMLElement | null>(null)

// 学院看板图表实例
let collegeChartInstance: echarts.ECharts | null = null
const collegeChartRef = ref<HTMLElement | null>(null)

// 分院排名图表实例
let collegeRankingChartInstance: echarts.ECharts | null = null
const collegeRankingChartRef = ref<HTMLElement | null>(null)

// 选中的部门（用于右侧指标完成情况卡片）
const selectedBenchmarkDept = ref<string | null>(null)
// 用于控制卡片内容显示（延迟隐藏，确保退出动画播放）
const showIndicatorCard = ref(false)
// 指标状态筛选
const selectedStatusFilter = ref<IndicatorStatus | null>(null)

// 指标状态类型
type IndicatorStatus = 'normal' | 'ahead' | 'warning' | 'delayed'

// 月份筛选和下钻状态（用于堆叠柱状图）
const selectedMonth = ref(new Date().getMonth() + 1) // 默认当前月
const isDrillDown = ref(false) // 是否处于下钻状态
const drilledDept = ref('') // 下钻选中的部门

// 下钻后的月份指标卡片状态
const selectedMonthInDrillDown = ref<number | null>(null) // 下钻后选中的月份
const showMonthIndicatorCard = ref(false) // 控制月份指标卡片显示

// ============ 学院看板状态（职能部门视角）============
const collegeSelectedMonth = ref(new Date().getMonth() + 1) // 学院看板选中月份
const isCollegeDrillDown = ref(false) // 学院看板下钻状态
const drilledCollege = ref('') // 下钻选中的学院
const selectedMonthInCollegeDrillDown = ref<number | null>(null) // 学院下钻后选中的月份
const showCollegeMonthIndicatorCard = ref(false) // 学院月份指标卡片显示

// ============ 分院排名看板状态 ============
const collegeRankingMonth = ref(new Date().getMonth() + 1) // 分院排名选中月份
const selectedOwnerDeptFilter = ref<string>('all') // 职能部门筛选（战略发展部用）

// 状态颜色配置
const statusColors = {
  ahead: '#67C23A',   // 绿色 - 超前完成
  normal: '#409EFF',  // 蓝色 - 正常
  warning: '#E6A23C', // 黄色 - 预警
  delayed: '#F56C6C'  // 红色 - 延期
}

// 计算指标状态的函数
const getIndicatorStatus = (indicator: any): IndicatorStatus => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const milestones = indicator.milestones || []
  if (milestones.length === 0) {
    return 'normal'
  }
  
  const currentProgress = indicator.progress || 0
  
  // 按deadline排序里程碑
  const sortedMilestones = [...milestones].sort((a, b) => 
    new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
  )
  
  // 检查是否有已过期但未达标的里程碑（延期）
  for (const milestone of sortedMilestones) {
    const deadlineDate = new Date(milestone.deadline)
    deadlineDate.setHours(23, 59, 59, 999)
    
    if (deadlineDate < today && currentProgress < milestone.targetProgress) {
      return 'delayed'
    }
  }
  
  // 找到离今天最近的未来里程碑（deadline > 今天）
  const nextMilestone = sortedMilestones.find(m => {
    const deadlineDate = new Date(m.deadline)
    deadlineDate.setHours(23, 59, 59, 999)
    return deadlineDate >= today
  })
  
  if (!nextMilestone) {
    // 没有未来的里程碑，检查最后一个里程碑是否完成
    const lastMilestone = sortedMilestones[sortedMilestones.length - 1]
    if (lastMilestone && currentProgress >= lastMilestone.targetProgress) {
      return 'ahead' // 全部完成
    }
    return 'normal'
  }
  
  // 检查是否超前完成
  if (currentProgress >= nextMilestone.targetProgress) {
    return 'ahead'
  }
  
  // 检查是否预警（距离deadline ≤ 3天且未达标）
  const nextDeadline = new Date(nextMilestone.deadline)
  nextDeadline.setHours(23, 59, 59, 999)
  const daysUntilDeadline = Math.ceil((nextDeadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  
  if (daysUntilDeadline <= 3 && currentProgress < nextMilestone.targetProgress) {
    return 'warning'
  }
  
  return 'normal'
}

// 获取状态显示文本
const getStatusText = (status: IndicatorStatus): string => {
  const statusMap: Record<IndicatorStatus, string> = {
    normal: '正常',
    ahead: '超前完成',
    warning: '预警',
    delayed: '延期'
  }
  return statusMap[status]
}

// 获取状态对应的颜色类
const getStatusClass = (status: IndicatorStatus): string => {
  const classMap: Record<IndicatorStatus, string> = {
    normal: 'status-normal',
    ahead: 'status-ahead',
    warning: 'status-warning',
    delayed: 'status-delayed'
  }
  return classMap[status]
}

// 获取当月目标进度（离今天最近的里程碑的目标进度）
const getCurrentTargetProgress = (indicator: any): number | null => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const milestones = indicator.milestones || []
  if (milestones.length === 0) {
    return null
  }
  
  // 按deadline排序里程碑
  const sortedMilestones = [...milestones].sort((a, b) => 
    new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
  )
  
  // 找到离今天最近的里程碑（deadline >= 今天）
  const nextMilestone = sortedMilestones.find(m => {
    const deadlineDate = new Date(m.deadline)
    deadlineDate.setHours(23, 59, 59, 999)
    return deadlineDate >= today
  })
  
  if (nextMilestone) {
    return nextMilestone.targetProgress
  }
  
  // 如果没有未来的里程碑，返回最后一个里程碑的目标
  const lastMilestone = sortedMilestones[sortedMilestones.length - 1]
  return lastMilestone ? lastMilestone.targetProgress : null
}

// 获取当前里程碑序号信息（如 "2/5" 表示第2个里程碑，共5个）
const getCurrentMilestoneIndex = (indicator: any): string | null => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const milestones = indicator.milestones || []
  if (milestones.length === 0) {
    return null
  }
  
  const total = milestones.length
  
  // 按deadline排序里程碑
  const sortedMilestones = [...milestones].sort((a, b) => 
    new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
  )
  
  // 找到离今天最近的里程碑（deadline >= 今天）
  const nextMilestoneIndex = sortedMilestones.findIndex(m => {
    const deadlineDate = new Date(m.deadline)
    deadlineDate.setHours(23, 59, 59, 999)
    return deadlineDate >= today
  })
  
  if (nextMilestoneIndex !== -1) {
    return `${nextMilestoneIndex + 1}/${total}`
  }
  
  // 如果没有未来的里程碑，返回最后一个
  return `${total}/${total}`
}

// 选中部门的指标列表
const selectedDeptIndicators = computed(() => {
  if (!selectedBenchmarkDept.value) {
    return []
  }
  
  const strategicStore = useStrategicStore()
  const timeContext = useTimeContextStore()
  const currentYear = timeContext.currentYear
  const realYear = timeContext.realCurrentYear
  
  // 筛选该部门接收的指标（responsibleDept === 选中的部门）
  return strategicStore.indicators
    .filter(i => {
      const indicatorYear = i.year || realYear
      return indicatorYear === currentYear && i.responsibleDept === selectedBenchmarkDept.value
    })
    .map(i => ({
      ...i,
      status: getIndicatorStatus(i),
      targetProgress: getCurrentTargetProgress(i),
      milestoneIndex: getCurrentMilestoneIndex(i)
    }))
})

// 筛选后的指标列表（根据状态筛选）
const filteredDeptIndicators = computed(() => {
  if (!selectedStatusFilter.value) {
    return selectedDeptIndicators.value
  }
  return selectedDeptIndicators.value.filter(i => i.status === selectedStatusFilter.value)
})

// 点击状态筛选
const handleStatusFilterClick = (status: IndicatorStatus) => {
  if (selectedStatusFilter.value === status) {
    // 再次点击同一状态，取消筛选
    selectedStatusFilter.value = null
  } else {
    selectedStatusFilter.value = status
  }
}

// 选中部门的指标状态统计
const selectedDeptStats = computed(() => {
  const indicators = selectedDeptIndicators.value
  return {
    ahead: indicators.filter(i => i.status === 'ahead').length,
    warning: indicators.filter(i => i.status === 'warning').length,
    delayed: indicators.filter(i => i.status === 'delayed').length,
    normal: indicators.filter(i => i.status === 'normal').length
  }
})

// 获取任意部门的指标状态统计（用于tooltip显示）
const _getDeptStats = (deptName: string) => {
  const strategicStore = useStrategicStore()
  const timeContext = useTimeContextStore()
  const currentYear = timeContext.currentYear
  const realYear = timeContext.realCurrentYear
  
  const indicators = strategicStore.indicators
    .filter(i => {
      const indicatorYear = i.year || realYear
      return indicatorYear === currentYear && i.responsibleDept === deptName
    })
    .map(i => ({
      ...i,
      status: getIndicatorStatus(i)
    }))
  
  return {
    ahead: indicators.filter(i => i.status === 'ahead').length,
    warning: indicators.filter(i => i.status === 'warning').length,
    delayed: indicators.filter(i => i.status === 'delayed').length,
    normal: indicators.filter(i => i.status === 'normal').length,
    total: indicators.length
  }
}

// 计算指标在指定月份的状态（用于堆叠柱状图）
const getIndicatorStatusAtMonth = (indicator: any, month: number, year: number): IndicatorStatus => {
  const milestones = indicator.milestones || []
  if (milestones.length === 0) {
    return 'normal'
  }

  // 计算该月的最后一天
  const monthEnd = new Date(year, month, 0) // month的0日就是上个月的最后一天
  monthEnd.setHours(23, 59, 59, 999)

  // 按deadline排序里程碑
  const sortedMilestones = [...milestones].sort((a, b) =>
    new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
  )

  // 筛选截止到该月底的里程碑
  const milestonesUpToMonth = sortedMilestones.filter(m => {
    const deadlineDate = new Date(m.deadline)
    deadlineDate.setHours(23, 59, 59, 999)
    return deadlineDate <= monthEnd
  })

  if (milestonesUpToMonth.length === 0) {
    // 如果该月没有里程碑，返回正常（或者不统计）
    return 'normal'
  }

  // 检查是否有已过期但未达标的里程碑（延期）
  for (const milestone of milestonesUpToMonth) {
    const deadlineDate = new Date(milestone.deadline)
    deadlineDate.setHours(23, 59, 59, 999)
    if (deadlineDate < monthEnd && (indicator.progress || 0) < milestone.targetProgress) {
      return 'delayed'
    }
  }

  // 找到该月内最后一个里程碑
  const lastMilestoneInMonth = milestonesUpToMonth[milestonesUpToMonth.length - 1]
  const currentProgress = indicator.progress || 0

  if (currentProgress >= lastMilestoneInMonth.targetProgress) {
    return 'ahead'
  }

  // 检查是否预警（该月最后一个里程碑后的3天内）
  const nextMonthStart = new Date(year, month, 1)
  const daysAfterMonth = Math.ceil((nextMonthStart.getTime() - monthEnd.getTime()) / (1000 * 60 * 60 * 24))
  if (daysAfterMonth <= 3 && currentProgress < lastMilestoneInMonth.targetProgress) {
    return 'warning'
  }

  return 'normal'
}

// 获取部门在指定月份的指标状态统计
const getDeptStatsAtMonth = (deptName: string, month: number, year: number) => {
  const strategicStore = useStrategicStore()
  const timeContext = useTimeContextStore()
  const currentYear = timeContext.currentYear
  const realYear = timeContext.realCurrentYear

  const indicators = strategicStore.indicators
    .filter(i => {
      const indicatorYear = i.year || realYear
      return indicatorYear === currentYear && i.responsibleDept === deptName
    })
    .map(i => ({
      ...i,
      status: getIndicatorStatusAtMonth(i, month, year)
    }))

  return {
    ahead: indicators.filter(i => i.status === 'ahead').length,
    warning: indicators.filter(i => i.status === 'warning').length,
    delayed: indicators.filter(i => i.status === 'delayed').length,
    normal: indicators.filter(i => i.status === 'normal').length,
    total: indicators.length
  }
}

// 计算堆叠柱状图数据（部门视图 - 第一层）
const stackedBarData = computed(() => {
  if (isDrillDown.value) {return []}

  const summary = dashboardStore.departmentSummary
  if (!summary || summary.length === 0) {
    return []
  }

  // 获取职能部门列表（战略发展部视角）
  const functionalDepts = summary
    .filter(item => !isSecondaryCollege(item.dept))
    .map(item => item.dept)

  return functionalDepts.map(dept => {
    const stats = getDeptStatsAtMonth(dept, selectedMonth.value, timeContext.currentYear)
    return {
      name: dept.length > 8 ? dept.slice(0, 8) + '...' : dept,
      fullName: dept,
      ...stats
    }
  })
})

// 计算下钻后的月度堆叠数据（部门月度视图 - 第二层）
const monthlyStackedData = computed(() => {
  if (!isDrillDown.value || !drilledDept.value) {return []}

  // 显示1月到选中的月份
  const months = []
  for (let m = 1; m <= selectedMonth.value; m++) {
    months.push(m)
  }

  return months.map(month => {
    const stats = getDeptStatsAtMonth(drilledDept.value, month, timeContext.currentYear)
    return {
      name: `${month}月`,
      month,
      ...stats
    }
  })
})

// 下钻后选中月份的指标列表
const monthIndicators = computed(() => {
  if (!isDrillDown.value || !drilledDept.value || selectedMonthInDrillDown.value === null) {
    return []
  }

  const strategicStore = useStrategicStore()
  const timeContext = useTimeContextStore()
  const currentYear = timeContext.currentYear
  const realYear = timeContext.realCurrentYear
  const month = selectedMonthInDrillDown.value

  return strategicStore.indicators
    .filter(i => {
      const indicatorYear = i.year || realYear
      return indicatorYear === currentYear && i.responsibleDept === drilledDept.value
    })
    .map(i => ({
      ...i,
      status: getIndicatorStatusAtMonth(i, month, currentYear),
      targetProgress: getCurrentTargetProgress(i),
      milestoneIndex: getCurrentMilestoneIndex(i)
    }))
})

// 月份指标筛选后的列表
const filteredMonthIndicators = computed(() => {
  if (!selectedStatusFilter.value) {
    return monthIndicators.value
  }
  return monthIndicators.value.filter(i => i.status === selectedStatusFilter.value)
})

// 月份指标状态统计
const monthIndicatorStats = computed(() => {
  const indicators = monthIndicators.value
  return {
    ahead: indicators.filter(i => i.status === 'ahead').length,
    warning: indicators.filter(i => i.status === 'warning').length,
    delayed: indicators.filter(i => i.status === 'delayed').length,
    normal: indicators.filter(i => i.status === 'normal').length,
    total: indicators.length
  }
})

// 处理月份指标卡片关闭
const handleCloseMonthIndicatorCard = () => {
  showMonthIndicatorCard.value = false
  setTimeout(() => {
    selectedMonthInDrillDown.value = null
    selectedStatusFilter.value = null
  }, 400)
}

// ============ 学院看板数据计算（职能部门视角）============

// 获取某职能部门下发给各学院的指标统计
const getCollegeStatsForFunctionalDept = (ownerDept: string, month: number, year: number) => {
  const strategicStore = useStrategicStore()
  const timeContext = useTimeContextStore()
  const currentYear = timeContext.currentYear
  const realYear = timeContext.realCurrentYear

  // 筛选：ownerDept === 职能部门 && responsibleDept 是二级学院
  const indicators = strategicStore.indicators
    .filter(i => {
      const indicatorYear = i.year || realYear
      return indicatorYear === currentYear &&
             i.ownerDept === ownerDept &&
             isSecondaryCollege(i.responsibleDept)
    })
    .map(i => ({
      ...i,
      status: getIndicatorStatusAtMonth(i, month, year)
    }))

  // 按学院分组统计
  const collegeMap = new Map<string, any>()
  indicators.forEach(i => {
    const college = i.responsibleDept
    if (!collegeMap.has(college)) {
      collegeMap.set(college, {
        ahead: 0,
        normal: 0,
        warning: 0,
        delayed: 0,
        total: 0
      })
    }
    const stats = collegeMap.get(college)!
    stats[i.status]++
    stats.total++
  })

  return Array.from(collegeMap.entries()).map(([college, stats]) => ({
    name: college.length > 8 ? college.slice(0, 8) + '...' : college,
    fullName: college,
    ...stats
  }))
}

// 学院看板堆叠数据（第一层：学院视图）
const collegeBarData = computed(() => {
  if (isCollegeDrillDown.value) {return []}
  if (currentRole.value === 'secondary_college') {return []}

  const strategicStore = useStrategicStore()
  const timeContext = useTimeContextStore()
  const currentYear = timeContext.currentYear

  const ownerDept = currentDepartment.value

  // 战略发展部视角：显示所有职能部门下发给学院的指标汇总
  if (currentRole.value === 'strategic_dept') {
    const realYear = timeContext.realCurrentYear

    // 筛选：responsibleDept 是二级学院
    const indicators = strategicStore.indicators
      .filter(i => {
        const indicatorYear = i.year || realYear
        return indicatorYear === currentYear && isSecondaryCollege(i.responsibleDept)
      })
      .map(i => ({
        ...i,
        status: getIndicatorStatusAtMonth(i, collegeSelectedMonth.value, currentYear)
      }))

    // 按学院分组统计（所有来源部门）
    const collegeMap = new Map<string, any>()
    indicators.forEach(i => {
      const college = i.responsibleDept
      if (!collegeMap.has(college)) {
        collegeMap.set(college, {
          ahead: 0,
          normal: 0,
          warning: 0,
          delayed: 0,
          total: 0
        })
      }
      const stats = collegeMap.get(college)!
      stats[i.status]++
      stats.total++
    })

    return Array.from(collegeMap.entries()).map(([college, stats]) => ({
      name: college.length > 8 ? college.slice(0, 8) + '...' : college,
      fullName: college,
      ...stats
    }))
  }

  // 职能部门视角：只看自己下发的
  if (!ownerDept) {
    console.warn('[collegeBarData] 职能部门视角但 currentDepartment 为空,返回空数组')
    return []
  }
  
  return getCollegeStatsForFunctionalDept(ownerDept, collegeSelectedMonth.value, currentYear)
})

// 学院看板月度趋势数据（第二层：学院月度视图）
const collegeMonthlyStackedData = computed(() => {
  if (!isCollegeDrillDown.value || !drilledCollege.value) {return []}

  const months = []
  for (let m = 1; m <= collegeSelectedMonth.value; m++) {
    months.push(m)
  }

  return months.map(month => {
    const strategicStore = useStrategicStore()
    const timeContext = useTimeContextStore()
    const currentYear = timeContext.currentYear
    const realYear = timeContext.realCurrentYear

    let indicators = strategicStore.indicators
      .filter(i => {
        const indicatorYear = i.year || realYear
        return indicatorYear === currentYear && i.responsibleDept === drilledCollege.value
      })
      .map(i => ({
        ...i,
        status: getIndicatorStatusAtMonth(i, month, currentYear)
      }))

    // 职能部门视角：只看自己下发的
    if (currentRole.value === 'functional_dept') {
      const ownerDept = currentDepartment.value
      indicators = indicators.filter(i => i.ownerDept === ownerDept)
    }

    return {
      name: `${month}月`,
      month,
      ahead: indicators.filter(i => i.status === 'ahead').length,
      normal: indicators.filter(i => i.status === 'normal').length,
      warning: indicators.filter(i => i.status === 'warning').length,
      delayed: indicators.filter(i => i.status === 'delayed').length,
      total: indicators.length
    }
  })
})

// 学院下钻后的月份指标列表
const collegeMonthIndicators = computed(() => {
  if (!isCollegeDrillDown.value || !drilledCollege.value || selectedMonthInCollegeDrillDown.value === null) {
    return []
  }

  const strategicStore = useStrategicStore()
  const timeContext = useTimeContextStore()
  const currentYear = timeContext.currentYear
  const realYear = timeContext.realCurrentYear
  const month = selectedMonthInCollegeDrillDown.value

  let indicators = strategicStore.indicators
    .filter(i => {
      const indicatorYear = i.year || realYear
      return indicatorYear === currentYear && i.responsibleDept === drilledCollege.value
    })
    .map(i => ({
      ...i,
      status: getIndicatorStatusAtMonth(i, month, currentYear),
      targetProgress: getCurrentTargetProgress(i),
      milestoneIndex: getCurrentMilestoneIndex(i)
    }))

  // 职能部门视角：只看自己下发的
  if (currentRole.value === 'functional_dept') {
    const ownerDept = currentDepartment.value
    indicators = indicators.filter(i => i.ownerDept === ownerDept)
  }

  return indicators
})

// 学院月份指标筛选后的列表
const filteredCollegeMonthIndicators = computed(() => {
  if (!selectedStatusFilter.value) {
    return collegeMonthIndicators.value
  }
  return collegeMonthIndicators.value.filter(i => i.status === selectedStatusFilter.value)
})

// 学院月份指标状态统计
const collegeMonthIndicatorStats = computed(() => {
  const indicators = collegeMonthIndicators.value
  return {
    ahead: indicators.filter(i => i.status === 'ahead').length,
    warning: indicators.filter(i => i.status === 'warning').length,
    delayed: indicators.filter(i => i.status === 'delayed').length,
    normal: indicators.filter(i => i.status === 'normal').length,
    total: indicators.length
  }
})

// 处理学院月份指标卡片关闭
const handleCloseCollegeMonthIndicatorCard = () => {
  showCollegeMonthIndicatorCard.value = false
  setTimeout(() => {
    selectedMonthInCollegeDrillDown.value = null
    selectedStatusFilter.value = null
  }, 400)
}

// ============ 分院排名看板数据计算 ============

// 计算二级学院的分数（权重 × 进度）
const getCollegeRankingData = computed(() => {
  if (currentRole.value === 'secondary_college') {return []}

  const strategicStore = useStrategicStore()
  const timeContext = useTimeContextStore()
  const currentYear = timeContext.currentYear
  const realYear = timeContext.realCurrentYear
  const month = collegeRankingMonth.value

  // 筛选指标：responsibleDept 是二级学院
  let indicators = strategicStore.indicators
    .filter(i => {
      const indicatorYear = i.year || realYear
      return indicatorYear === currentYear && isSecondaryCollege(i.responsibleDept)
    })
    .map(i => ({
      ...i,
      status: getIndicatorStatusAtMonth(i, month, currentYear)
    }))

  // 根据角色应用部门筛选
  if (currentRole.value === 'functional_dept') {
    // 职能部门：只看自己下发的
    const ownerDept = currentDepartment.value
    indicators = indicators.filter(i => i.ownerDept === ownerDept)
  } else if (currentRole.value === 'strategic_dept' && selectedOwnerDeptFilter.value !== 'all') {
    // 战略发展部：按选定的职能部门筛选
    indicators = indicators.filter(i => i.ownerDept === selectedOwnerDeptFilter.value)
  }

  // 按学院分组计算分数
  const collegeMap = new Map<string, { score: number; totalIndicators: number; completedIndicators: number; ahead: number; normal: number; warning: number; delayed: number }>()

  indicators.forEach(i => {
    const college = i.responsibleDept
    if (!collegeMap.has(college)) {
      collegeMap.set(college, {
        score: 0,
        totalIndicators: 0,
        completedIndicators: 0,
        ahead: 0,
        normal: 0,
        warning: 0,
        delayed: 0
      })
    }
    const stats = collegeMap.get(college)!
    // 分数 = 权重 × 进度
    const weight = parseFloat(i.weight) || 1
    const progress = i.progress || 0
    stats.score += weight * progress / 100
    stats.totalIndicators++
    if (progress >= 100) {stats.completedIndicators++}
    stats[i.status]++
  })

  // 转换为数组并排序
  return Array.from(collegeMap.entries())
    .map(([college, stats]) => ({
      name: college.length > 8 ? college.slice(0, 8) + '...' : college,
      fullName: college,
      value: Math.round(stats.score * 10) / 10, // 保留一位小数
      total: stats.totalIndicators,
      completed: stats.completedIndicators,
      ahead: stats.ahead,
      normal: stats.normal,
      warning: stats.warning,
      delayed: stats.delayed
    }))
    .sort((a, b) => b.value - a.value)
})

// 获取可用的职能部门列表（用于分院排名筛选）
const availableFunctionalDepts = computed(() => {
  const strategicStore = useStrategicStore()
  const depts = new Set<string>()

  strategicStore.indicators.forEach(i => {
    if (i.ownerDept && isSecondaryCollege(i.responsibleDept)) {
      depts.add(i.ownerDept)
    }
  })

  return Array.from(depts).sort()
})

// 处理排名图表点击事件
const _handleBenchmarkClick = (deptName: string) => {
  if (selectedBenchmarkDept.value === deptName) {
    // 再次点击同一部门，取消选中
    handleCloseIndicatorCard()
  } else {
    selectedBenchmarkDept.value = deptName
    // 重置状态筛选
    selectedStatusFilter.value = null
    // 立即显示卡片内容
    showIndicatorCard.value = true
  }
}

// 关闭指标卡片（带退出动画）
const handleCloseIndicatorCard = () => {
  // 先触发退出动画
  showIndicatorCard.value = false
  // 延迟清空数据，等动画完成
  setTimeout(() => {
    selectedBenchmarkDept.value = null
    selectedStatusFilter.value = null
  }, 400)
}

// 接收父组件传递的视角角色和部门
const props = defineProps<{
  viewingRole?: string  // 角色类型
  viewingDept?: string  // 部门名称
}>()

const strategicStore = useStrategicStore()
const dashboardStore = useDashboardStore()
const authStore = useAuthStore()
const timeContext = useTimeContextStore()
const orgStore = useOrgStore()

// ============================================================================
// 加载状态管理 - Requirements 1.5, 1.6
// ============================================================================

/**
 * 使用 useLoadingState 组合式函数管理数据加载状态
 * - 显示骨架屏：数据加载中时显示骨架屏
 * - 空状态处理：数据为空时显示空状态提示
 */
const {
  isLoading: _pageLoading,
  hasError: pageHasError,
  errorMessage: pageErrorMessage,
  showSkeleton,
  startLoading,
  endLoading,
  setError,
  clearError
} = useLoadingState({
  timeout: 30000,
  retryCount: 3,
  showSkeleton: true
})

// 从 strategicStore 获取加载状态
const isDataLoading = computed(() => {
  return strategicStore.loadingState.indicators || strategicStore.loadingState.tasks || dashboardStore.loading
})

// 判断数据是否为空
const isDataEmpty = computed(() => {
  return !isDataLoading.value && dashboardStore.visibleIndicators.length === 0
})

// 监听 store 加载状态，同步到本地加载状态
watch(isDataLoading, (loading) => {
  if (loading) {
    startLoading()
  } else {
    endLoading()
  }
}, { immediate: true })

// 监听 store 错误状态
watch(() => strategicStore.loadingState.error, (error) => {
  if (error) {
    setError(error)
  } else {
    clearError()
  }
}, { immediate: true })

// 重新加载数据函数
const reloadData = async () => {
  try {
    startLoading()
    clearError()
    await strategicStore.loadIndicatorsByYear(timeContext.currentYear)
    await dashboardStore.refreshDashboard()
  } catch (err) {
    setError(err instanceof Error ? err.message : '重新加载失败')
    logger.error('[Dashboard] Failed to reload data:', err)
  } finally {
    endLoading()
  }
}

// ============================================================================
// 降级模式检测 - Requirements 1.4, 10.5
// ============================================================================

/**
 * 检测是否处于降级模式
 * 当 API 不可用时，系统会使用降级数据，此时应显示提示
 * @requirement 1.4 - 当 API 不可用时，应显示降级模式提示
 * @requirement 10.5 - 降级模式下应显示明确的提示标识
 */
const isFallbackMode = computed(() => {
  return strategicStore.dataSource === 'fallback'
})

// 当前视角角色（优先使用父组件传递的，否则使用有效角色）
const currentRole = computed<UserRole>(() => 
  (props.viewingRole as UserRole) || authStore.effectiveRole || 'strategic_dept'
)
const currentDepartment = computed(() => props.viewingDept || authStore.effectiveDepartment || '')

// 是否显示筛选功能（二级学院不显示）
const _showFilterFeature = computed(() => currentRole.value !== 'secondary_college')

// 是否可以查看所有部门（只有战略发展部可以）
const canViewAllDepartments = computed(() => currentRole.value === 'strategic_dept')

// 部门完成情况卡片标题（根据下钻状态动态显示）
const _getDepartmentCardTitle = computed(() => {
  if (dashboardStore.currentOrgLevel === 'functional' && dashboardStore.selectedFunctionalDept) {
    return `${dashboardStore.selectedFunctionalDept} 任务下发情况`
  }
  return canViewAllDepartments.value ? '各部门完成情况' : '下属单位完成情况'
})

// 排名看板标题（根据角色动态显示）
const _getBenchmarkTitle = computed(() => {
  if (currentRole.value === 'strategic_dept') {
    return '职能部门执行排名'
  } else if (currentRole.value === 'functional_dept') {
    return '学院执行排名'
  } else {
    return '学院执行排名'
  }
})

// 筛选面板
const showFilterPanel = ref(false)
const filterForm = ref({
  department: '',
  indicatorType: '' as '' | '定性' | '定量',
  alertLevel: '' as '' | 'severe' | 'moderate' | 'normal'
})

// 部门选项（使用完整配置，根据角色权限过滤）
const _departmentOptions = computed(() => {
  // 战略发展部可以看所有部门
  if (currentRole.value === 'strategic_dept') {
    return orgStore.getAllDepartmentNames()
  }

  // 职能部门能看自己和所有二级学院
  if (currentRole.value === 'functional_dept') {
    return [currentDepartment.value, ...orgStore.getAllCollegeNames()]
  }

  // 二级学院只能看自己
  return [currentDepartment.value]
})

// 从 store 计算仪表盘数据
const dashboardData = computed<DashboardData>(() => {
  // 使用 visibleIndicators（已按角色和年份过滤）
  const indicators = dashboardStore.visibleIndicators
  const totalIndicators = indicators.length
  const completedIndicators = indicators.filter(i => i.progress >= 100).length
  
  const basicIndicators = indicators.filter(i => i.type2 === '基础性')
  const developmentIndicators = indicators.filter(i => i.type2 === '发展性')
  
  const basicScore = basicIndicators.length > 0 
    ? Math.round(basicIndicators.reduce((sum, i) => sum + i.progress, 0) / basicIndicators.length)
    : 0
  const developmentScore = developmentIndicators.length > 0
    ? Math.round(developmentIndicators.reduce((sum, i) => sum + i.progress, 0) / developmentIndicators.length * 0.2)
    : 0
  
  const warningCount = indicators.filter(i => i.progress < 50).length
  
  return {
    totalScore: basicScore + developmentScore,
    basicScore,
    developmentScore,
    completionRate: totalIndicators > 0 ? Math.round((completedIndicators / totalIndicators) * 100) : 0,
    warningCount,
    totalIndicators,
    completedIndicators,
    alertIndicators: {
      severe: indicators.filter(i => i.progress < 30).length,
      moderate: indicators.filter(i => i.progress >= 30 && i.progress < 60).length,
      normal: indicators.filter(i => i.progress >= 60).length
    }
  }
})

// 应用筛选
const applyFilters = () => {
  const filter: Record<string, string | undefined> = {}
  if (filterForm.value.department) {filter.department = filterForm.value.department}
  if (filterForm.value.indicatorType) {filter.indicatorType = filterForm.value.indicatorType}
  if (filterForm.value.alertLevel) {filter.alertLevel = filterForm.value.alertLevel}
  dashboardStore.applyFilter(filter)
  showFilterPanel.value = false
}

// 重置筛选
const _resetFilters = () => {
  filterForm.value = { department: '', indicatorType: '', alertLevel: '' }
  dashboardStore.resetFilters()
  showFilterPanel.value = false
}

// 预警级别点击
const handleAlertClick = (level: 'severe' | 'moderate' | 'normal') => {
  filterForm.value.alertLevel = level
  applyFilters()
}

// 面包屑导航
const handleBreadcrumbNavigate = (index: number) => {
  dashboardStore.navigateToBreadcrumbEnhanced(index)
}

// 判断是否有活跃筛选
const _hasActiveFilters = computed(() => {
  return dashboardStore.filters.department || 
         dashboardStore.filters.indicatorType || 
         dashboardStore.filters.alertLevel
})

// 导出功能 - 根据角色差异化导出
const handleExport = async () => {
  try {
    const role = authStore.user?.role
    let exportData: any[]
    let fileName: string
    let sheetName: string

    if (role === 'strategic_dept') {
      // 战略发展部：导出职能部门对比报表
      const comparison = dashboardStore.departmentComparison

      if (comparison.length === 0) {
        ElMessage.warning('没有可导出的数据')
        return
      }

      exportData = comparison.map((item) => ({
        '排名': item.rank,
        '部门': item.dept,
        '平均进度': `${item.progress}%`,
        '得分': item.score,
        '完成率': `${item.completionRate}%`,
        '指标总数': item.totalIndicators,
        '已完成': item.completedIndicators,
        '进行中': item.totalIndicators - item.completedIndicators,
        '预警数': item.alertCount,
        '状态': item.status === 'success' ? '优秀' : item.status === 'warning' ? '良好' : '需改进'
      }))

      fileName = `职能部门进度对比报表_${new Date().toLocaleDateString()}.xlsx`
      sheetName = '部门对比'

    } else if (role === 'functional_dept') {
      // 职能部门：导出学院任务分配表
      const indicators = dashboardStore.filteredIndicators.length > 0
        ? dashboardStore.filteredIndicators
        : strategicStore.indicators

      const collegeIndicators = indicators.filter(i => isSecondaryCollege(i.responsibleDept))

      if (collegeIndicators.length === 0) {
        ElMessage.warning('没有可导出的数据')
        return
      }

      exportData = collegeIndicators.map((item, index) => ({
        '序号': index + 1,
        '学院': item.responsibleDept,
        '核心指标': item.indicator,
        '指标类型': item.type,
        '权重': item.weight,
        '完成进度': `${item.progress}%`,
        '里程碑进度': item.milestoneProgress,
        '审批状态': item.approvalStatus === 'approved' ? '已通过' :
                     item.approvalStatus === 'pending' ? '待审批' :
                     item.approvalStatus === 'rejected' ? '已驳回' : '草稿',
        '备注': item.description || ''
      }))

      fileName = `学院任务分配表_${authStore.user?.department}_${new Date().toLocaleDateString()}.xlsx`
      sheetName = '学院任务'

    } else {
      // 二级学院：导出承接任务汇总
      const indicators = dashboardStore.filteredIndicators.length > 0
        ? dashboardStore.filteredIndicators
        : strategicStore.indicators

      if (indicators.length === 0) {
        ElMessage.warning('没有可导出的数据')
        return
      }

      exportData = indicators.map((item, index) => ({
        '序号': index + 1,
        '任务来源': item.ownerDept || '战略发展部',
        '战略任务': item.task,
        '核心指标': item.indicator,
        '指标类型': item.type,
        '指标类别': item.type2,
        '权重': item.weight,
        '完成进度': `${item.progress}%`,
        '里程碑进度': item.milestoneProgress,
        '审批状态': item.approvalStatus === 'approved' ? '已通过' :
                     item.approvalStatus === 'pending' ? '待审批' :
                     item.approvalStatus === 'rejected' ? '已驳回' : '草稿',
        '备注': item.description || ''
      }))

      fileName = `承接任务汇总_${authStore.user?.department}_${new Date().toLocaleDateString()}.xlsx`
      sheetName = '承接任务'
    }

    const xlsx = await loadXLSX()
    const worksheet = xlsx.utils.json_to_sheet(exportData)
    const workbook = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(workbook, worksheet, sheetName)

    // 自动列宽
    const colWidths = Object.keys(exportData[0] || {}).map(key => ({
      wch: Math.max(
        key.length + 2,
        ...exportData.map(row => String(row[key] || '').length)
      )
    }))
    worksheet['!cols'] = colWidths

    xlsx.writeFile(workbook, fileName)

    ElMessage.success('导出成功')
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败，请重试')
  }
}

// 三级联动交互处理函数

// 桑基图节点点击
const handleSankeyNodeClick = (nodeName: string) => {
  const authStore = useAuthStore()
  const userRole = authStore.user?.role
  
  // 职能部门不能点击上级部门（战略发展部）
  if (userRole === 'functional_dept' && nodeName === '战略发展部') {
    return
  }
  
  // 二级学院不能点击上级部门（战略发展部和职能部门）
  if (userRole === 'secondary_college') {
    const functionalDepts = orgStore.getAllFunctionalDepartmentNames()
    if (nodeName === '战略发展部' || functionalDepts.includes(nodeName)) {
      return
    }
  }
  
  const isCollege = isSecondaryCollege(nodeName)
  dashboardStore.drillDownToDepartment(nodeName, isCollege ? 'college' : 'functional')
}

// 桑基图链接点击
const handleSankeyLinkClick = (source: string, target: string) => {
  const isCollege = isSecondaryCollege(target)
  dashboardStore.drillDownToDepartment(target, isCollege ? 'college' : 'functional')
}

// 任务来源点击筛选
const handleSourceClick = (source: string) => {
  dashboardStore.applyFilter({ sourceOwner: source })
  ElMessage.info(`已筛选来源：${source}`)
}

// 应用筛选（集成新筛选组件）
const _handleFilterApply = () => {
  ElMessage.success('筛选已应用')
}

// KPI 卡片数据（带趋势）
const _kpiCards = computed(() => {
  const data = dashboardData.value
  const _indicators = dashboardStore.visibleIndicators
  
  // 计算上期数据（模拟趋势）
  const lastMonthScore = Math.max(0, data.totalScore - Math.floor(Math.random() * 10) + 5)
  const scoreTrend = data.totalScore - lastMonthScore
  
    return [
      {
        label: '战略执行总分',
        helpText: helpTexts.totalScore,
        value: data.totalScore,
        unit: '分',
        trend: Math.abs(scoreTrend),
        isUp: scoreTrend >= 0,
        predict: Math.min(120, data.totalScore + 8),
        desc: '年度目标: 120分',
        percent: Math.round((data.totalScore / 120) * 100),
        icon: 'Aim',
        gradient: 'primary'
      },
      {
        label: '核心指标完成率',
        helpText: helpTexts.completionRate,
        value: data.completionRate,
        unit: '%',
        trend: 3.2,
        isUp: true,
        predict: Math.min(100, data.completionRate + 12),
        desc: `已完成 ${data.completedIndicators}/${data.totalIndicators} 项`,
        percent: data.completionRate,
        icon: 'DataAnalysis',
        gradient: 'success'
      },
      {
        label: '严重预警任务',
        helpText: helpTexts.warningCount,
        value: data.alertIndicators.severe,
        unit: '项',
        trend: 2,
        isUp: false,
        predict: Math.max(0, data.alertIndicators.severe - 3),
        desc: '需重点关注推进',
        percent: Math.max(0, 100 - (data.alertIndicators.severe / Math.max(1, data.totalIndicators)) * 100),
        icon: 'Warning',
        gradient: 'danger'
      },
      {
        label: '发展性指标得分',
        helpText: helpTexts.developmentScore,
        value: data.developmentScore,
        unit: '分',
        trend: 1.5,
        isUp: true,
        predict: Math.min(20, data.developmentScore + 3),
        desc: '满分20分',
        percent: (data.developmentScore / 20) * 100,
        icon: 'TrendCharts',
        gradient: 'purple'
      }
    ]
})

// 滞后任务列表
const delayedTasks = computed(() => {
  const indicators = dashboardStore.visibleIndicators
  return indicators
    .filter(i => i.progress < 50)
    .sort((a, b) => a.progress - b.progress)
    .slice(0, 5)
    .map(i => ({
      id: i.id,
      name: i.name || i.indicator || '未命名任务',
      dept: i.responsibleDept,
      progress: i.progress,
      days: Math.floor((50 - i.progress) / 5) + 1,
      reminded: false
    }))
})

// 催办任务
const handleUrge = (task: any) => {
  if (task.reminded) {return}
  task.reminded = true
  ElMessage.success(`已向 ${task.dept} 发送催办通知`)
}

// 雷达图数据（支持历史数据）
const radarData = computed(() => {
  const indicators = dashboardStore.visibleIndicatorsWithHistory
  
  // 按类型分组计算平均进度
  const typeGroups: Record<string, number[]> = {}
  indicators.forEach(i => {
    const type = i.type || '其他'
    if (!typeGroups[type]) {typeGroups[type] = []}
    typeGroups[type].push(i.progress)
  })
  
  const dimensions = Object.entries(typeGroups).slice(0, 5).map(([name, values]) => ({
    name,
    value: Math.round(values.reduce((a, b) => a + b, 0) / values.length)
  }))
  
  // 确保至少有5个维度
  const defaultDimensions = ['教学质量', '科研产出', '人才培养', '社会服务', '资源建设']
  while (dimensions.length < 5) {
    dimensions.push({ name: defaultDimensions[dimensions.length], value: 60 + Math.floor(Math.random() * 30) })
  }
  
  return dimensions
})

// 部门排名数据 - 使用 departmentSummary 数据
const benchmarkData = computed(() => {
  const summary = dashboardStore.departmentSummary
  if (!summary || summary.length === 0) {
    return []
  }
  // 按进度排序，显示所有部门
  return [...summary]
    .sort((a, b) => b.progress - a.progress)
    .map(item => ({
      name: item.dept.length > 8 ? item.dept.slice(0, 8) + '...' : item.dept,
      fullName: item.dept,
      value: item.progress,
      total: item.totalIndicators,
      completed: item.completedIndicators
    }))
})

// 雷达图统计数据
const _radarStats = computed(() => {
  const data = radarData.value
  if (!data || data.length === 0) {return { avgMatch: 0, volatility: 0 }}
  const avg = data.reduce((a, b) => a + b.value, 0) / data.length
  // 计算波动离散度（标准差的简化版）
  const variance = data.reduce((sum, d) => sum + Math.pow(d.value - avg, 2), 0) / data.length
  const volatility = Math.sqrt(variance) / 100
  return {
    avgMatch: avg.toFixed(1),
    volatility: volatility.toFixed(2)
  }
})

// 初始化雷达图
const initRadarChart = async () => {
  if (!radarChartRef.value) {return}
  
  const data = radarData.value
  if (!data || data.length === 0) {
    console.warn('No radar data available')
    return
  }
  
  const ec = await loadEcharts()
  radarChartInstance = ec.init(radarChartRef.value)
  
  radarChartInstance.setOption({
    backgroundColor: 'transparent',
    radar: {
      indicator: data.map(d => ({ name: d.name, max: 100 })),
      splitArea: { show: false },
      splitLine: { lineStyle: { color: 'rgba(64, 158, 255, 0.15)', width: 1 } },
      axisLine: { lineStyle: { color: 'rgba(64, 158, 255, 0.2)' } },
      name: { textStyle: { color: '#909399', fontWeight: 700, fontSize: 11 } },
      shape: 'circle',
      radius: '65%'
    },
    series: [{
      type: 'radar',
      data: [
        {
          value: data.map(() => 80),
          name: '全校平均',
          lineStyle: { color: '#409eff', width: 1, type: 'dashed' },
          areaStyle: { color: 'rgba(64, 158, 255, 0.05)' },
          symbol: 'none'
        },
        {
          value: data.map(d => d.value),
          name: '当前部门',
          lineStyle: { color: '#f56c6c', width: 2 },
          areaStyle: { color: 'rgba(245, 108, 108, 0.25)' },
          symbol: 'circle',
          symbolSize: 4,
          itemStyle: { color: '#f56c6c' }
        }
      ]
    }],
    tooltip: {
      trigger: 'item'
    }
  })
}

// Benchmark 图表视图模式
const _benchmarkViewMode = ref<'completion' | 'benchmark'>('completion')

// 动态计算图表高度（每个部门30px，最小400px）
const _benchmarkChartHeight = computed(() => {
  const dataLength = benchmarkData.value.length
  return Math.max(400, dataLength * 30)
})

// 初始化排名对标图 - 改为堆叠柱状图
const initBenchmarkChart = async () => {
  if (!benchmarkChartRef.value) {return}

  // 根据下钻状态选择数据源
  const data = isDrillDown.value ? monthlyStackedData.value : stackedBarData.value
  const _xAxisLabel = isDrillDown.value ? `${drilledDept.value} - 月度趋势` : '职能部门'

  if (!data || data.length === 0) {
    // 数据为空时，清空图表
    if (benchmarkChartInstance) {
      benchmarkChartInstance.dispose()
      benchmarkChartInstance = null
    }
    return
  }

  // 设置容器高度（固定高度用于堆叠柱状图）
  benchmarkChartRef.value.style.height = `350px`

  // 如果已有实例，先销毁再重新创建，确保完全刷新
  if (benchmarkChartInstance) {
    benchmarkChartInstance.dispose()
  }
  const ec = await loadEcharts()
  benchmarkChartInstance = ec.init(benchmarkChartRef.value)

  benchmarkChartInstance.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) {return ''}
        const dataIndex = params[0].dataIndex
        const dataItem = data[dataIndex]
        const name = dataItem?.fullName || dataItem?.name || params[0].name

        let tooltip = `<strong>${name}</strong><br/>`

        if (isDrillDown.value) {
          // 月度视图显示该月的统计
          tooltip += `${params[0].name}<br/>`
          tooltip += `<span style="color: ${statusColors.ahead}">●</span> 超前: ${dataItem?.ahead || 0}<br/>`
          tooltip += `<span style="color: ${statusColors.normal}">●</span> 正常: ${dataItem?.normal || 0}<br/>`
          tooltip += `<span style="color: ${statusColors.warning}">●</span> 预警: ${dataItem?.warning || 0}<br/>`
          tooltip += `<span style="color: ${statusColors.delayed}">●</span> 延期: ${dataItem?.delayed || 0}<br/>`
          tooltip += `总计: ${dataItem?.total || 0}`
        } else {
          // 部门视图显示统计
          tooltip += `${selectedMonth.value}月完成情况<br/>`
          tooltip += `<span style="color: ${statusColors.ahead}">■</span> 超前: ${dataItem?.ahead || 0}<br/>`
          tooltip += `<span style="color: ${statusColors.normal}">■</span> 正常: ${dataItem?.normal || 0}<br/>`
          tooltip += `<span style="color: ${statusColors.warning}">■</span> 预警: ${dataItem?.warning || 0}<br/>`
          tooltip += `<span style="color: ${statusColors.delayed}">■</span> 延期: ${dataItem?.delayed || 0}<br/>`
          tooltip += `总计: ${dataItem?.total || 0}<br/>`
          tooltip += `<span style="color: #409eff; font-size: 11px;">点击查看月度趋势</span>`
        }
        return tooltip
      }
    },
    legend: {
      data: ['超前完成', '正常', '预警', '延期'],
      bottom: 0,
      left: 'center',
      itemWidth: 12,
      itemHeight: 12,
      textStyle: {
        fontSize: 11,
        color: '#606266'
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: data.map(d => d.name),
      axisLabel: {
        color: '#606266',
        fontSize: 11,
        interval: 0,
        rotate: isDrillDown.value ? 0 : 30
      },
      axisLine: {
        lineStyle: { color: '#e4e7ed' }
      }
    },
    yAxis: {
      type: 'value',
      name: isDrillDown.value ? '指标数量' : '指标数量',
      axisLabel: {
        color: '#909399',
        fontSize: 11
      },
      splitLine: {
        lineStyle: {
          color: '#f2f3f5',
          type: 'dashed'
        }
      }
    },
    series: [
      {
        name: '超前完成',
        type: 'bar',
        stack: 'total',
        barWidth: isDrillDown.value ? 40 : 30,
        itemStyle: {
          color: statusColors.ahead,
          borderRadius: isDrillDown.value ? [0, 0, 0, 0] : [4, 0, 0, 4]
        },
        data: data.map(d => d.ahead || 0)
      },
      {
        name: '正常',
        type: 'bar',
        stack: 'total',
        barWidth: isDrillDown.value ? 40 : 30,
        itemStyle: {
          color: statusColors.normal
        },
        data: data.map(d => d.normal || 0)
      },
      {
        name: '预警',
        type: 'bar',
        stack: 'total',
        barWidth: isDrillDown.value ? 40 : 30,
        itemStyle: {
          color: statusColors.warning
        },
        data: data.map(d => d.warning || 0)
      },
      {
        name: '延期',
        type: 'bar',
        stack: 'total',
        barWidth: isDrillDown.value ? 40 : 30,
        itemStyle: {
          color: statusColors.delayed,
          borderRadius: isDrillDown.value ? [0, 0, 0, 0] : [0, 4, 4, 0]
        },
        data: data.map(d => d.delayed || 0)
      }
    ]
  })

  // 添加点击事件
  benchmarkChartInstance.off('click')
  benchmarkChartInstance.on('click', (params: any) => {
    if (params.componentType === 'series') {
      const dataItem = data[params.dataIndex]

      if (isDrillDown.value) {
        // 下钻状态：点击月份显示该月的指标详情
        if (dataItem?.month !== undefined) {
          // 如果点击的是同一月份，关闭卡片
          if (selectedMonthInDrillDown.value === dataItem.month) {
            handleCloseMonthIndicatorCard()
          } else {
            // 选中新月份
            selectedMonthInDrillDown.value = dataItem.month
            selectedStatusFilter.value = null
            showMonthIndicatorCard.value = true
          }
        }
      } else {
        // 部门视图：点击部门进入下钻
        if (dataItem?.fullName) {
          drilledDept.value = dataItem.fullName
          isDrillDown.value = true
          // 下钻后默认不显示月份卡片，需要点击月份
          selectedMonthInDrillDown.value = null
          showMonthIndicatorCard.value = false
          nextTick(() => {
            initBenchmarkChart()
          })
        }
      }
    }
  })
}

// 处理月份变化
const handleMonthChange = () => {
  // 关闭月份指标卡片
  showMonthIndicatorCard.value = false
  selectedMonthInDrillDown.value = null

  if (isDrillDown.value) {
    // 如果在下钻状态，返回部门视图
    isDrillDown.value = false
    drilledDept.value = ''
  }
  nextTick(() => {
    initBenchmarkChart()
  })
}

// 返回部门视图
const handleBackToDepts = () => {
  // 关闭月份指标卡片
  showMonthIndicatorCard.value = false
  selectedMonthInDrillDown.value = null

  isDrillDown.value = false
  drilledDept.value = ''
  nextTick(() => {
    initBenchmarkChart()
  })
}

// 监听下钻状态和月份变化，重新渲染图表
watch([isDrillDown, selectedMonth], () => {
  nextTick(() => {
    initBenchmarkChart()
  })
})

// 监听年份变化，重新渲染所有图表
watch(() => timeContext.currentYear, () => {
  nextTick(() => {
    initBenchmarkChart()
    initCollegeChart()
    initCollegeRankingChart()
  })
})

// 监听指标数据变化，重新渲染学院相关图表
// 解决异步加载数据后图表不更新的问题
watch(
  () => strategicStore.indicators.length,
  (newLength, _oldLength) => {
    if (newLength > 0) {
      nextTick(() => {
        initCollegeChart()
        initCollegeRankingChart()
      })
    }
  },
  { immediate: true }
)

// 监听部门汇总数据变化，重新渲染职能部门堆叠柱状图
// 解决 departmentSummary 依赖多个 store 数据异步加载的问题
watch(
  () => dashboardStore.departmentSummary.length,
  (newLength) => {
    if (newLength > 0) {
      nextTick(() => {
        initBenchmarkChart()
      })
    }
  },
  { immediate: true }
)

// 监听加载状态变化，当加载完成时重新渲染图表
watch(
  () => strategicStore.loading,
  (isLoading, wasLoading) => {
    // 当从加载中变为加载完成时，重新渲染图表
    if (wasLoading && !isLoading && strategicStore.indicators.length > 0) {
      nextTick(() => {
        initCollegeChart()
        initCollegeRankingChart()
      })
    }
  }
)

// 监听部门/角色切换，重新渲染所有图表
// 直接监听 authStore 的 effectiveRole 和 effectiveDepartment，确保响应性
watch(
  [
    () => authStore.effectiveRole,
    () => authStore.effectiveDepartment,
    () => props.viewingRole
  ],
  () => {
    nextTick(() => {
      initBenchmarkChart()
      initCollegeChart()
      initCollegeRankingChart()
      initRadarChart()
    })
  }
)

// 监听学院看板月份和下钻状态变化
watch([collegeSelectedMonth, isCollegeDrillDown], () => {
  nextTick(() => {
    initCollegeChart()
  })
})

// 监听分院排名月份和部门筛选变化
watch([collegeRankingMonth, selectedOwnerDeptFilter], () => {
  nextTick(() => {
    initCollegeRankingChart()
  })
})

// 窗口大小变化时重绘图表
const handleResize = () => {
  radarChartInstance?.resize()
  benchmarkChartInstance?.resize()
  collegeChartInstance?.resize()
  collegeRankingChartInstance?.resize()
}

// ============ 学院看板图表配置（职能部门视角）============

// 初始化学院看板堆叠柱状图
const initCollegeChart = async () => {
  if (!collegeChartRef.value) {return}
  if (currentRole.value === 'secondary_college') {
    // 二级学院不显示此图表，清空已有实例
    if (collegeChartInstance) {
      collegeChartInstance.dispose()
      collegeChartInstance = null
    }
    return
  }

  const data = isCollegeDrillDown.value ? collegeMonthlyStackedData.value : collegeBarData.value

  if (!data || data.length === 0) {
    // 数据为空时，清空图表并显示空状态
    if (collegeChartInstance) {
      collegeChartInstance.dispose()
      collegeChartInstance = null
    }
    return
  }

  collegeChartRef.value.style.height = `350px`
  
  // 如果已有实例，先销毁再重新创建，确保完全刷新
  if (collegeChartInstance) {
    collegeChartInstance.dispose()
  }
  const ec = await loadEcharts()
  collegeChartInstance = ec.init(collegeChartRef.value)

  collegeChartInstance.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) {return ''}
        const dataIndex = params[0].dataIndex
        const dataItem = data[dataIndex]
        const name = dataItem?.fullName || dataItem?.name || params[0].name

        let tooltip = `<strong>${name}</strong><br/>`

        if (isCollegeDrillDown.value) {
          tooltip += `${params[0].name}<br/>`
          tooltip += `<span style="color: ${statusColors.ahead}">●</span> 超前: ${dataItem?.ahead || 0}<br/>`
          tooltip += `<span style="color: ${statusColors.normal}">●</span> 正常: ${dataItem?.normal || 0}<br/>`
          tooltip += `<span style="color: ${statusColors.warning}">●</span> 预警: ${dataItem?.warning || 0}<br/>`
          tooltip += `<span style="color: ${statusColors.delayed}">●</span> 延期: ${dataItem?.delayed || 0}<br/>`
          tooltip += `总计: ${dataItem?.total || 0}`
        } else {
          tooltip += `${collegeSelectedMonth.value}月完成情况<br/>`
          tooltip += `<span style="color: ${statusColors.ahead}">■</span> 超前: ${dataItem?.ahead || 0}<br/>`
          tooltip += `<span style="color: ${statusColors.normal}">■</span> 正常: ${dataItem?.normal || 0}<br/>`
          tooltip += `<span style="color: ${statusColors.warning}">■</span> 预警: ${dataItem?.warning || 0}<br/>`
          tooltip += `<span style="color: ${statusColors.delayed}">■</span> 延期: ${dataItem?.delayed || 0}<br/>`
          tooltip += `总计: ${dataItem?.total || 0}<br/>`
          tooltip += `<span style="color: #409eff; font-size: 11px;">点击查看月度趋势</span>`
        }
        return tooltip
      }
    },
    legend: {
      data: ['超前完成', '正常', '预警', '延期'],
      bottom: 0,
      left: 'center',
      itemWidth: 12,
      itemHeight: 12,
      textStyle: {
        fontSize: 11,
        color: '#606266'
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: data.map(d => d.name),
      axisLabel: {
        color: '#606266',
        fontSize: 11,
        interval: 0,
        rotate: isCollegeDrillDown.value ? 0 : 30
      },
      axisLine: {
        lineStyle: { color: '#e4e7ed' }
      }
    },
    yAxis: {
      type: 'value',
      name: '指标数量',
      axisLabel: {
        color: '#909399',
        fontSize: 11
      },
      splitLine: {
        lineStyle: {
          color: '#f2f3f5',
          type: 'dashed'
        }
      }
    },
    series: [
      {
        name: '超前完成',
        type: 'bar',
        stack: 'total',
        barWidth: isCollegeDrillDown.value ? 40 : 30,
        itemStyle: {
          color: statusColors.ahead,
          borderRadius: isCollegeDrillDown.value ? [0, 0, 0, 0] : [4, 0, 0, 4]
        },
        data: data.map(d => d.ahead || 0)
      },
      {
        name: '正常',
        type: 'bar',
        stack: 'total',
        barWidth: isCollegeDrillDown.value ? 40 : 30,
        itemStyle: {
          color: statusColors.normal
        },
        data: data.map(d => d.normal || 0)
      },
      {
        name: '预警',
        type: 'bar',
        stack: 'total',
        barWidth: isCollegeDrillDown.value ? 40 : 30,
        itemStyle: {
          color: statusColors.warning
        },
        data: data.map(d => d.warning || 0)
      },
      {
        name: '延期',
        type: 'bar',
        stack: 'total',
        barWidth: isCollegeDrillDown.value ? 40 : 30,
        itemStyle: {
          color: statusColors.delayed,
          borderRadius: isCollegeDrillDown.value ? [0, 0, 0, 0] : [0, 4, 4, 0]
        },
        data: data.map(d => d.delayed || 0)
      }
    ]
  })

  // 点击事件
  collegeChartInstance.off('click')
  collegeChartInstance.on('click', (params: any) => {
    if (params.componentType === 'series') {
      const dataItem = data[params.dataIndex]

      if (isCollegeDrillDown.value) {
        // 下钻状态：点击月份显示该月的指标详情
        if (dataItem?.month !== undefined) {
          if (selectedMonthInCollegeDrillDown.value === dataItem.month) {
            handleCloseCollegeMonthIndicatorCard()
          } else {
            selectedMonthInCollegeDrillDown.value = dataItem.month
            selectedStatusFilter.value = null
            showCollegeMonthIndicatorCard.value = true
          }
        }
      } else {
        // 学院视图：点击学院进入下钻
        if (dataItem?.fullName) {
          drilledCollege.value = dataItem.fullName
          isCollegeDrillDown.value = true
          selectedMonthInCollegeDrillDown.value = null
          showCollegeMonthIndicatorCard.value = false
          nextTick(() => {
            initCollegeChart()
          })
        }
      }
    }
  })
}

// 处理学院看板月份变化
const handleCollegeMonthChange = () => {
  showCollegeMonthIndicatorCard.value = false
  selectedMonthInCollegeDrillDown.value = null
  if (isCollegeDrillDown.value) {
    isCollegeDrillDown.value = false
    drilledCollege.value = ''
  }
  nextTick(() => {
    initCollegeChart()
  })
}

// 返回学院视图
const handleBackToColleges = () => {
  showCollegeMonthIndicatorCard.value = false
  selectedMonthInCollegeDrillDown.value = null
  isCollegeDrillDown.value = false
  drilledCollege.value = ''
  nextTick(() => {
    initCollegeChart()
  })
}

// ============ 分院排名看板图表配置 ============

// 初始化分院排名条形图
const initCollegeRankingChart = async () => {
  if (!collegeRankingChartRef.value) {return}
  if (currentRole.value === 'secondary_college') {
    // 二级学院不显示此图表，清空已有实例
    if (collegeRankingChartInstance) {
      collegeRankingChartInstance.dispose()
      collegeRankingChartInstance = null
    }
    return
  }

  const data = getCollegeRankingData.value
  if (!data || data.length === 0) {
    // 数据为空时，清空图表
    if (collegeRankingChartInstance) {
      collegeRankingChartInstance.dispose()
      collegeRankingChartInstance = null
    }
    return
  }

  const chartHeight = Math.max(350, data.length * 35)
  collegeRankingChartRef.value.style.height = `${chartHeight}px`

  // 如果已有实例，先销毁再重新创建，确保完全刷新
  if (collegeRankingChartInstance) {
    collegeRankingChartInstance.dispose()
  }
  const ec = await loadEcharts()
  collegeRankingChartInstance = ec.init(collegeRankingChartRef.value)

  collegeRankingChartInstance.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const item = params[0]
        const dataItem = data[item.dataIndex]
        const fullName = dataItem?.fullName || item.name
        return `<strong>${fullName}</strong><br/>
                分数: ${item.value}<br/>
                完成: ${dataItem?.completed || 0}/${dataItem?.total || 0} 项<br/>
                <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #e4e7ed;">
                  <span style="color: #67c23a; margin-right: 8px;">超前 ${dataItem?.ahead || 0}</span>
                  <span style="color: #409eff; margin-right: 8px;">正常 ${dataItem?.normal || 0}</span>
                  <span style="color: #e6a23c; margin-right: 8px;">预警 ${dataItem?.warning || 0}</span>
                  <span style="color: #f56c6c;">延期 ${dataItem?.delayed || 0}</span>
                </div>`
      }
    },
    grid: {
      left: '3%',
      right: '10%',
      bottom: '10%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      max: (_value: any) => {
        const max = Math.max(...data.map(d => d.value))
        return Math.ceil(max * 1.2)
      },
      splitLine: { show: false },
      axisLabel: {
        color: '#909399',
        fontSize: 11
      },
      axisLine: { show: false },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'category',
      data: data.map(d => d.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        fontSize: 12,
        color: '#606266'
      },
      inverse: true
    },
    series: [{
      name: '分数',
      type: 'bar',
      barWidth: 20,
      barGap: '30%',
      itemStyle: {
        borderRadius: [0, 4, 4, 0],
        color: (params: any) => {
          const value = params.value as number
          if (value >= 80) {return '#67c23a'}
          if (value >= 60) {return '#409eff'}
          if (value >= 40) {return '#e6a23c'}
          return '#f56c6c'
        }
      },
      label: {
        show: true,
        position: 'right',
        formatter: '{c}',
        fontSize: 12,
        color: '#606266'
      },
      data: data.map(d => d.value)
    }]
  })
}

// 处理分院排名月份变化
const handleCollegeRankingMonthChange = () => {
  nextTick(() => {
    initCollegeRankingChart()
  })
}

// 处理分院排名部门筛选变化
const handleOwnerDeptFilterChange = () => {
  nextTick(() => {
    initCollegeRankingChart()
  })
}

// 监听数据变化，重新渲染图表
watch([benchmarkData, radarData], () => {
  nextTick(() => {
    initBenchmarkChart()
    initRadarChart()
  })
})

// 监听选中部门变化，重新调整图表大小
watch(showIndicatorCard, () => {
  // 在动画过程中持续调整图表大小
  const resizeChart = () => {
    benchmarkChartInstance?.resize()
  }

  // 动画开始时立即调整
  resizeChart()

  // 动画过程中多次调整，确保平滑
  setTimeout(resizeChart, 100)
  setTimeout(resizeChart, 200)
  setTimeout(resizeChart, 300)
  setTimeout(() => {
    resizeChart()
    // 动画结束后重新初始化图表
    initBenchmarkChart()
  }, 400)
})

// 监听下钻后月份指标卡片变化，重新调整图表大小
watch(showMonthIndicatorCard, () => {
  const resizeChart = () => {
    benchmarkChartInstance?.resize()
  }

  resizeChart()
  setTimeout(resizeChart, 100)
  setTimeout(resizeChart, 200)
  setTimeout(resizeChart, 300)
  setTimeout(() => {
    resizeChart()
    initBenchmarkChart()
  }, 400)
})

// 监听学院看板月份指标卡片变化，重新调整图表大小
watch(showCollegeMonthIndicatorCard, () => {
  const resizeChart = () => {
    collegeChartInstance?.resize()
  }

  resizeChart()
  setTimeout(resizeChart, 100)
  setTimeout(resizeChart, 200)
  setTimeout(resizeChart, 300)
  setTimeout(() => {
    resizeChart()
    initCollegeChart()
  }, 400)
})

// 生命周期
onMounted(async () => {
  await nextTick()
  await initRadarChart()
  await initBenchmarkChart()
  await initCollegeChart()
  await initCollegeRankingChart()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  radarChartInstance?.dispose()
  benchmarkChartInstance?.dispose()
  collegeChartInstance?.dispose()
  collegeRankingChartInstance?.dispose()
})
</script>

<template>
  <div class="dashboard-view">
    <!-- 顶部工具栏 -->
    <div class="dashboard-toolbar">
      <div class="toolbar-right">
        <el-button type="primary" :icon="Download" @click="handleExport">导出报表</el-button>
      </div>
    </div>

    <!-- 降级模式提示 - Requirements 1.4, 10.5 -->
    <el-alert
      v-if="isFallbackMode"
      title="降级模式"
      type="warning"
      show-icon
      :closable="false"
      class="fallback-mode-alert"
    >
      <template #default>
        <span class="fallback-alert-content">
          当前使用离线数据，部分功能可能受限。
          <el-button link type="primary" size="small" @click="reloadData()">
            <el-icon><Refresh /></el-icon>
            重新连接
          </el-button>
        </span>
      </template>
    </el-alert>

    <!-- 加载状态骨架屏 - Requirement 1.5 -->
    <template v-if="isDataLoading || showSkeleton">
      <!-- AI 摘要骨架屏 -->
      <section class="ai-summary-card skeleton-card">
        <div class="summary-icon">
          <el-skeleton-item variant="circle" style="width: 48px; height: 48px;" />
        </div>
        <div class="summary-content" style="flex: 1;">
          <el-skeleton :rows="2" animated />
        </div>
        <div class="summary-stats">
          <el-skeleton-item variant="rect" style="width: 80px; height: 40px;" />
        </div>
      </section>

      <!-- 图表区域骨架屏 -->
      <el-row :gutter="16" class="chart-section">
        <el-col v-for="i in 3" :key="i" :xs="24" :md="8">
          <el-card shadow="hover" class="chart-card">
            <template #header>
              <el-skeleton-item variant="text" style="width: 120px;" />
            </template>
            <el-skeleton :rows="6" animated />
          </el-card>
        </el-col>
      </el-row>

      <!-- 部门排名骨架屏 -->
      <div class="chart-section deep-charts benchmark-section">
        <div class="benchmark-col">
          <el-card shadow="hover" class="chart-card glass-card">
            <template #header>
              <el-skeleton-item variant="text" style="width: 200px;" />
            </template>
            <el-skeleton :rows="8" animated />
          </el-card>
        </div>
      </div>
    </template>

    <!-- 数据为空状态 - Requirement 1.6 -->
    <template v-else-if="isDataEmpty">
      <section class="empty-state-container">
        <el-empty 
          description="暂无数据" 
          :image-size="200"
        >
          <template #description>
            <div class="empty-description">
              <p>当前没有可显示的指标数据</p>
              <p class="empty-hint">请检查数据源或联系管理员</p>
            </div>
          </template>
          <el-button type="primary" @click="reloadData()">
            <el-icon><Refresh /></el-icon>
            重新加载
          </el-button>
        </el-empty>
      </section>
    </template>

    <!-- 错误状态提示 -->
    <template v-else-if="pageHasError">
      <section class="error-state-container">
        <el-alert
          :title="pageErrorMessage || '数据加载失败'"
          type="error"
          show-icon
          :closable="false"
        >
          <template #default>
            <div class="error-actions">
              <el-button type="primary" size="small" @click="reloadData()">
                <el-icon><Refresh /></el-icon>
                重试
              </el-button>
            </div>
          </template>
        </el-alert>
      </section>
    </template>

    <!-- 正常数据展示 -->
    <template v-else>
    <!-- AI 智能摘要卡片 -->
    <section class="ai-summary-card">
      <div class="summary-icon">
        <el-icon :size="28"><Aim /></el-icon>
      </div>
      <div class="summary-content">
          <div class="summary-header">
            <span class="summary-tag">AI Intelligence Briefing</span>
            <span class="summary-time">| UPDATE: {{ new Date().toLocaleDateString() }}</span>
          </div>
        <p class="summary-text">
          全校战略执行总分 <span class="highlight-primary">{{ dashboardData.totalScore }}</span>。
          <template v-if="dashboardData.alertIndicators.severe > 0">
            本月存在 <span class="highlight-danger">{{ dashboardData.alertIndicators.severe }} 项严重预警</span> 任务需重点关注。
          </template>
          <template v-else>
            整体执行状态良好，<span class="highlight-success">无严重预警</span>。
          </template>
          完成率达 <span class="highlight-success">{{ dashboardData.completionRate }}%</span>，
          {{ dashboardData.completionRate >= 80 ? '进度符合预期' : '建议加快推进滞后任务' }}。
          <button class="drill-btn">立即下钻诊断 →</button>
        </p>
      </div>
      <div class="summary-stats">
        <div class="mini-stat">
          <div class="mini-label">健康度</div>
          <div class="mini-value" :class="dashboardData.completionRate >= 70 ? 'success' : 'warning'">
            {{ Math.min(100, dashboardData.completionRate + 10) }}%
          </div>
        </div>
        <div class="mini-stat">
          <div class="mini-label">响应率</div>
          <div class="mini-value primary">{{ (2.4 - dashboardData.alertIndicators.severe * 0.1).toFixed(1) }}h</div>
        </div>
      </div>
    </section>
    <!-- 面包屑导航 -->
    <BreadcrumbNav 
      v-if="dashboardStore.breadcrumbs.length > 1"
      :items="dashboardStore.breadcrumbs" 
      @navigate="handleBreadcrumbNavigate" 
    />

    <!-- KPI 核心矩阵（升级版）- 暂时隐藏 -->
    <!--
    <el-row :gutter="16" class="stat-cards">
      <el-col v-for="(kpi, idx) in kpiCards" :key="idx" :xs="24" :sm="12" :md="6">
        <div class="kpi-card" :class="'kpi-' + kpi.gradient">
          <div class="kpi-header">
            <div class="header-left" style="display: flex; align-items: center; gap: 4px;">
              <span class="kpi-label">{{ kpi.label }}</span>
              <el-tooltip :content="kpi.helpText" placement="top" effect="light">
                <el-icon class="help-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </div>
            <div class="kpi-trend" :class="kpi.isUp ? 'up' : 'down'">
              <el-icon v-if="kpi.isUp"><Top /></el-icon>
              <el-icon v-else><Bottom /></el-icon>
              {{ kpi.trend }}%
            </div>
          </div>
          <div class="kpi-body">
            <span class="kpi-value">{{ kpi.value }}</span>
            <span class="kpi-unit">{{ kpi.unit }}</span>
          </div>
          <div class="kpi-footer">
            <span class="kpi-predict">预测: {{ kpi.predict }}{{ kpi.unit }}</span>
            <span class="kpi-desc">{{ kpi.desc }}</span>
          </div>
          <div class="kpi-progress">
            <div class="kpi-progress-bar" :style="{ width: kpi.percent + '%' }"></div>
          </div>
        </div>
      </el-col>
    </el-row>
    -->

    <!-- 中间深度图表层 -->
    <div class="chart-section deep-charts benchmark-section" :class="{ 'has-detail': showIndicatorCard || showMonthIndicatorCard }">
      <!-- 部门排名对标（仅战略发展部显示） -->
      <div v-if="currentRole === 'strategic_dept'" class="benchmark-col">
        <el-card shadow="hover" class="chart-card glass-card benchmark-card">
          <template #header>
            <div class="card-header benchmark-header">
              <div class="header-left">
                <div style="display: flex; align-items: center; gap: 4px;">
                  <span class="card-title benchmark-title">
                    {{ isDrillDown ? `${drilledDept} - 月度趋势` : '指标完成情况分布' }}
                    <span class="title-tag-italic">{{ isDrillDown ? 'TREND' : 'DISTRIBUTION' }}</span>
                  </span>
                  <el-tooltip :content="isDrillDown ? '显示该部门每月的指标完成情况' : '显示各职能部门的指标完成情况分布'" placement="top" effect="light">
                    <el-icon class="help-icon"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </div>
                <span class="card-subtitle">
                  {{ isDrillDown ? '1月 - 当前月度趋势分析' : `${selectedMonth}月 · 按状态统计 · 点击柱形查看趋势` }}
                </span>
              </div>
              <div class="header-right">
                <!-- 下钻状态显示返回按钮 -->
                <el-button
                  v-if="isDrillDown"
                  type="primary"
                  size="small"
                  class="back-btn"
                  @click="handleBackToDepts"
                >
                  <el-icon><Top /></el-icon>
                  返回部门视图
                </el-button>
                <!-- 月份筛选器 -->
                <div v-else class="month-filter">
                  <span class="filter-label">月份:</span>
                  <el-select
                    v-model="selectedMonth"
                    size="small"
                    class="month-select"
                    @change="handleMonthChange"
                  >
                    <el-option
                      v-for="m in 12"
                      :key="m"
                      :label="`${m}月`"
                      :value="m"
                    />
                  </el-select>
                </div>
              </div>
            </div>
          </template>
          <div ref="benchmarkChartRef" class="benchmark-chart"></div>
        </el-card>
      </div>

      <!-- 指标完成情况卡片（选中部门后显示，下钻时隐藏） -->
      <div v-if="currentRole !== 'secondary_college' && !isDrillDown" class="indicator-col" :class="{ 'visible': showIndicatorCard }">
        <div class="indicator-card-wrapper">
          <el-card v-show="selectedBenchmarkDept" shadow="hover" class="chart-card glass-card indicator-status-card">
          <template #header>
            <div class="card-header benchmark-header">
              <div class="header-left">
                <div style="display: flex; align-items: center; gap: 4px;">
                  <span class="card-title benchmark-title">指标完成情况 <span class="title-tag-italic">STATUS</span></span>
                  <el-tooltip content="展示选中部门接收的各项指标及其完成状态" placement="top" effect="light">
                    <el-icon class="help-icon"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </div>
                <span class="card-subtitle">{{ selectedBenchmarkDept }} · {{ selectedDeptIndicators.length }} 项指标</span>
              </div>
              <div class="header-right">
                <el-button link type="primary" size="small" @click="handleCloseIndicatorCard">
                  <el-icon><Close /></el-icon>
                  关闭
                </el-button>
              </div>
            </div>
          </template>
          <div class="indicator-status-list">
            <!-- 状态统计摘要 -->
            <div v-if="selectedDeptIndicators.length > 0" class="status-summary">
              <span 
                class="status-summary-item ahead" 
                :class="{ active: selectedStatusFilter === 'ahead' }"
                @click="handleStatusFilterClick('ahead')"
              >
                <span class="status-dot"></span>超前 {{ selectedDeptStats.ahead }}
              </span>
              <span 
                class="status-summary-item normal"
                :class="{ active: selectedStatusFilter === 'normal' }"
                @click="handleStatusFilterClick('normal')"
              >
                <span class="status-dot"></span>正常 {{ selectedDeptStats.normal }}
              </span>
              <span 
                class="status-summary-item warning"
                :class="{ active: selectedStatusFilter === 'warning' }"
                @click="handleStatusFilterClick('warning')"
              >
                <span class="status-dot"></span>预警 {{ selectedDeptStats.warning }}
              </span>
              <span 
                class="status-summary-item delayed"
                :class="{ active: selectedStatusFilter === 'delayed' }"
                @click="handleStatusFilterClick('delayed')"
              >
                <span class="status-dot"></span>延期 {{ selectedDeptStats.delayed }}
              </span>
            </div>
            <div v-if="selectedDeptIndicators.length === 0" class="empty-indicator-list">
              <el-empty description="该部门暂无接收的指标" :image-size="80" />
            </div>
            <div v-else-if="filteredDeptIndicators.length === 0" class="empty-indicator-list">
              <el-empty description="没有符合筛选条件的指标" :image-size="80" />
            </div>
            <div v-else class="indicator-scroll-container">
              <el-popover
                v-for="indicator in filteredDeptIndicators"
                :key="indicator.id"
                placement="left"
                :width="320"
                trigger="hover"
                popper-class="indicator-detail-popover"
              >
                <template #reference>
                  <div class="indicator-status-item" :class="getStatusClass(indicator.status)">
                    <div class="indicator-info">
                      <div class="indicator-name" :title="indicator.name">{{ indicator.name }}</div>
                      <div class="indicator-meta">
                        <span class="indicator-type-tag" :class="indicator.type1 === '定性' ? 'type-qualitative' : 'type-quantitative'">{{ indicator.type1 }}</span>
                        <span class="indicator-progress">进度: {{ indicator.progress }}%</span>
                      </div>
                    </div>
                    <div class="indicator-status-badge" :class="getStatusClass(indicator.status)">
                      {{ getStatusText(indicator.status) }}
                    </div>
                  </div>
                </template>
                <div class="indicator-detail-content">
                  <h4 class="detail-title">{{ indicator.name }}</h4>
                  <div class="detail-row">
                    <span class="detail-label">指标类型</span>
                    <span class="detail-value">{{ indicator.type1 }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">当前进度</span>
                    <span class="detail-value">
                      <el-progress 
                        :percentage="indicator.progress" 
                        :stroke-width="8"
                        :color="indicator.progress >= 80 ? '#67c23a' : indicator.progress >= 50 ? '#e6a23c' : '#f56c6c'"
                        style="width: 120px; display: inline-flex;"
                      />
                    </span>
                  </div>
                  <div v-if="indicator.targetProgress !== null || indicator.milestoneIndex" class="detail-row">
                    <span class="detail-label">目标进度</span>
                    <span class="detail-value">{{ indicator.targetProgress !== null ? indicator.targetProgress + '%' : '-' }}{{ indicator.milestoneIndex ? ' (' + indicator.milestoneIndex + ')' : '' }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">权重</span>
                    <span class="detail-value">{{ indicator.weight }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">所属战略任务</span>
                    <span class="detail-value task-content">{{ indicator.taskContent || '未关联' }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">完成状态</span>
                    <span class="detail-value">
                      <span class="status-tag" :class="getStatusClass(indicator.status)">
                        {{ getStatusText(indicator.status) }}
                      </span>
                    </span>
                  </div>
                </div>
              </el-popover>
            </div>
          </div>
        </el-card>
        </div>
      </div>

      <!-- 下钻后月份指标卡片（点击月份柱子后显示） -->
      <div v-if="currentRole === 'strategic_dept' && isDrillDown" class="indicator-col" :class="{ 'visible': showMonthIndicatorCard }">
        <div class="indicator-card-wrapper">
          <el-card v-show="selectedMonthInDrillDown !== null" shadow="hover" class="chart-card glass-card indicator-status-card">
          <template #header>
            <div class="card-header benchmark-header">
              <div class="header-left">
                <div style="display: flex; align-items: center; gap: 4px;">
                  <span class="card-title benchmark-title">
                    {{ drilledDept }} - {{ selectedMonthInDrillDown }}月指标
                    <span class="title-tag-italic">DETAIL</span>
                  </span>
                  <el-tooltip content="展示选中部门在该月份的各项指标及其完成状态" placement="top" effect="light">
                    <el-icon class="help-icon"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </div>
                <span class="card-subtitle">
                  {{ selectedMonthInDrillDown }}月完成情况 · {{ monthIndicators.length }} 项指标
                </span>
              </div>
              <div class="header-right">
                <el-button link type="primary" size="small" @click="handleCloseMonthIndicatorCard">
                  <el-icon><Close /></el-icon>
                  关闭
                </el-button>
              </div>
            </div>
          </template>
          <div class="indicator-status-list">
            <!-- 状态统计摘要 -->
            <div v-if="monthIndicators.length > 0" class="status-summary">
              <span
                class="status-summary-item ahead"
                :class="{ active: selectedStatusFilter === 'ahead' }"
                @click="handleStatusFilterClick('ahead')"
              >
                <span class="status-dot"></span>超前 {{ monthIndicatorStats.ahead }}
              </span>
              <span
                class="status-summary-item normal"
                :class="{ active: selectedStatusFilter === 'normal' }"
                @click="handleStatusFilterClick('normal')"
              >
                <span class="status-dot"></span>正常 {{ monthIndicatorStats.normal }}
              </span>
              <span
                class="status-summary-item warning"
                :class="{ active: selectedStatusFilter === 'warning' }"
                @click="handleStatusFilterClick('warning')"
              >
                <span class="status-dot"></span>预警 {{ monthIndicatorStats.warning }}
              </span>
              <span
                class="status-summary-item delayed"
                :class="{ active: selectedStatusFilter === 'delayed' }"
                @click="handleStatusFilterClick('delayed')"
              >
                <span class="status-dot"></span>延期 {{ monthIndicatorStats.delayed }}
              </span>
            </div>
            <div v-if="monthIndicators.length === 0" class="empty-indicator-list">
              <el-empty description="该月份暂无指标数据" :image-size="80" />
            </div>
            <div v-else-if="filteredMonthIndicators.length === 0" class="empty-indicator-list">
              <el-empty description="没有符合筛选条件的指标" :image-size="80" />
            </div>
            <div v-else class="indicator-scroll-container">
              <el-popover
                v-for="indicator in filteredMonthIndicators"
                :key="indicator.id"
                placement="left"
                :width="320"
                trigger="hover"
                popper-class="indicator-detail-popover"
              >
                <template #reference>
                  <div class="indicator-status-item" :class="getStatusClass(indicator.status)">
                    <div class="indicator-info">
                      <div class="indicator-name" :title="indicator.name">{{ indicator.name }}</div>
                      <div class="indicator-meta">
                        <span class="indicator-type-tag" :class="indicator.type1 === '定性' ? 'type-qualitative' : 'type-quantitative'">{{ indicator.type1 }}</span>
                        <span class="indicator-progress">进度: {{ indicator.progress }}%</span>
                      </div>
                    </div>
                    <div class="indicator-status-badge" :class="getStatusClass(indicator.status)">
                      {{ getStatusText(indicator.status) }}
                    </div>
                  </div>
                </template>
                <div class="indicator-detail-content">
                  <h4 class="detail-title">{{ indicator.name }}</h4>
                  <div class="detail-row">
                    <span class="detail-label">指标类型</span>
                    <span class="detail-value">{{ indicator.type1 }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">当前进度</span>
                    <span class="detail-value">
                      <el-progress
                        :percentage="indicator.progress"
                        :stroke-width="8"
                        :color="indicator.progress >= 80 ? '#67c23a' : indicator.progress >= 50 ? '#e6a23c' : '#f56c6c'"
                        style="width: 120px; display: inline-flex;"
                      />
                    </span>
                  </div>
                  <div v-if="indicator.targetProgress !== null || indicator.milestoneIndex" class="detail-row">
                    <span class="detail-label">目标进度</span>
                    <span class="detail-value">{{ indicator.targetProgress !== null ? indicator.targetProgress + '%' : '-' }}{{ indicator.milestoneIndex ? ' (' + indicator.milestoneIndex + ')' : '' }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">权重</span>
                    <span class="detail-value">{{ indicator.weight }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">所属战略任务</span>
                    <span class="detail-value task-content">{{ indicator.taskContent || '未关联' }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">完成状态</span>
                    <span class="detail-value">
                      <span class="status-tag" :class="getStatusClass(indicator.status)">
                        {{ getStatusText(indicator.status) }}
                      </span>
                    </span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">统计月份</span>
                    <span class="detail-value">{{ selectedMonthInDrillDown }}月</span>
                  </div>
                </div>
              </el-popover>
            </div>
          </div>
        </el-card>
        </div>
      </div>
    </div>

    <!-- 学院看板（职能部门 + 战略发展部视角） -->
    <div v-if="currentRole === 'functional_dept' || currentRole === 'strategic_dept'" class="chart-section deep-charts college-section" :class="{ 'has-detail': showCollegeMonthIndicatorCard }">
      <div class="college-col">
        <el-card shadow="hover" class="chart-card glass-card college-card">
          <template #header>
            <div class="card-header college-header">
              <div class="header-left">
                <div style="display: flex; align-items: center; gap: 4px;">
                  <span class="card-title college-title">
                    {{ isCollegeDrillDown ? `${drilledCollege} - 月度趋势` : '学院指标完成情况' }}
                    <span class="title-tag-italic">{{ isCollegeDrillDown ? 'TREND' : 'COLLEGE' }}</span>
                  </span>
                  <el-tooltip :content="isCollegeDrillDown ? '显示该学院每月的指标完成情况' : '显示各学院的指标完成情况分布'" placement="top" effect="light">
                    <el-icon class="help-icon"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </div>
                <span class="card-subtitle">
                  {{ isCollegeDrillDown ? '1月 - 当前月度趋势分析' : `${collegeSelectedMonth}月 · 按状态统计 · 点击柱形查看趋势` }}
                </span>
              </div>
              <div class="header-right">
                <!-- 下钻状态显示返回按钮 -->
                <el-button
                  v-if="isCollegeDrillDown"
                  type="primary"
                  size="small"
                  class="back-btn"
                  @click="handleBackToColleges"
                >
                  <el-icon><Top /></el-icon>
                  返回学院视图
                </el-button>
                <!-- 月份筛选器 -->
                <div v-else class="month-filter">
                  <span class="filter-label">月份:</span>
                  <el-select
                    v-model="collegeSelectedMonth"
                    size="small"
                    class="month-select"
                    @change="handleCollegeMonthChange"
                  >
                    <el-option
                      v-for="m in 12"
                      :key="m"
                      :label="`${m}月`"
                      :value="m"
                    />
                  </el-select>
                </div>
              </div>
            </div>
          </template>
          <div ref="collegeChartRef" class="college-chart"></div>
        </el-card>
      </div>

      <!-- 学院月份指标卡片（点击月份柱子后显示） -->
      <div v-if="isCollegeDrillDown" class="indicator-col" :class="{ 'visible': showCollegeMonthIndicatorCard }">
        <div class="indicator-card-wrapper">
          <el-card v-show="selectedMonthInCollegeDrillDown !== null" shadow="hover" class="chart-card glass-card indicator-status-card">
          <template #header>
            <div class="card-header benchmark-header">
              <div class="header-left">
                <div style="display: flex; align-items: center; gap: 4px;">
                  <span class="card-title benchmark-title">
                    {{ drilledCollege }} - {{ selectedMonthInCollegeDrillDown }}月指标
                    <span class="title-tag-italic">DETAIL</span>
                  </span>
                  <el-tooltip content="展示选中学院在该月份的各项指标及其完成状态" placement="top" effect="light">
                    <el-icon class="help-icon"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </div>
                <span class="card-subtitle">
                  {{ selectedMonthInCollegeDrillDown }}月完成情况 · {{ collegeMonthIndicators.length }} 项指标
                </span>
              </div>
              <div class="header-right">
                <el-button link type="primary" size="small" @click="handleCloseCollegeMonthIndicatorCard">
                  <el-icon><Close /></el-icon>
                  关闭
                </el-button>
              </div>
            </div>
          </template>
          <div class="indicator-status-list">
            <!-- 状态统计摘要 -->
            <div v-if="collegeMonthIndicators.length > 0" class="status-summary">
              <span
                class="status-summary-item ahead"
                :class="{ active: selectedStatusFilter === 'ahead' }"
                @click="handleStatusFilterClick('ahead')"
              >
                <span class="status-dot"></span>超前 {{ collegeMonthIndicatorStats.ahead }}
              </span>
              <span
                class="status-summary-item normal"
                :class="{ active: selectedStatusFilter === 'normal' }"
                @click="handleStatusFilterClick('normal')"
              >
                <span class="status-dot"></span>正常 {{ collegeMonthIndicatorStats.normal }}
              </span>
              <span
                class="status-summary-item warning"
                :class="{ active: selectedStatusFilter === 'warning' }"
                @click="handleStatusFilterClick('warning')"
              >
                <span class="status-dot"></span>预警 {{ collegeMonthIndicatorStats.warning }}
              </span>
              <span
                class="status-summary-item delayed"
                :class="{ active: selectedStatusFilter === 'delayed' }"
                @click="handleStatusFilterClick('delayed')"
              >
                <span class="status-dot"></span>延期 {{ collegeMonthIndicatorStats.delayed }}
              </span>
            </div>
            <div v-if="collegeMonthIndicators.length === 0" class="empty-indicator-list">
              <el-empty description="该月份暂无指标数据" :image-size="80" />
            </div>
            <div v-else-if="filteredCollegeMonthIndicators.length === 0" class="empty-indicator-list">
              <el-empty description="没有符合筛选条件的指标" :image-size="80" />
            </div>
            <div v-else class="indicator-scroll-container">
              <el-popover
                v-for="indicator in filteredCollegeMonthIndicators"
                :key="indicator.id"
                placement="left"
                :width="320"
                trigger="hover"
                popper-class="indicator-detail-popover"
              >
                <template #reference>
                  <div class="indicator-status-item" :class="getStatusClass(indicator.status)">
                    <div class="indicator-info">
                      <div class="indicator-name" :title="indicator.name">{{ indicator.name }}</div>
                      <div class="indicator-meta">
                        <span class="indicator-type-tag" :class="indicator.type1 === '定性' ? 'type-qualitative' : 'type-quantitative'">{{ indicator.type1 }}</span>
                        <span class="indicator-progress">进度: {{ indicator.progress }}%</span>
                      </div>
                    </div>
                    <div class="indicator-status-badge" :class="getStatusClass(indicator.status)">
                      {{ getStatusText(indicator.status) }}
                    </div>
                  </div>
                </template>
                <div class="indicator-detail-content">
                  <h4 class="detail-title">{{ indicator.name }}</h4>
                  <div class="detail-row">
                    <span class="detail-label">指标类型</span>
                    <span class="detail-value">{{ indicator.type1 }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">当前进度</span>
                    <span class="detail-value">
                      <el-progress
                        :percentage="indicator.progress"
                        :stroke-width="8"
                        :color="indicator.progress >= 80 ? '#67c23a' : indicator.progress >= 50 ? '#e6a23c' : '#f56c6c'"
                        style="width: 120px; display: inline-flex;"
                      />
                    </span>
                  </div>
                  <div v-if="indicator.targetProgress !== null || indicator.milestoneIndex" class="detail-row">
                    <span class="detail-label">目标进度</span>
                    <span class="detail-value">{{ indicator.targetProgress !== null ? indicator.targetProgress + '%' : '-' }}{{ indicator.milestoneIndex ? ' (' + indicator.milestoneIndex + ')' : '' }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">权重</span>
                    <span class="detail-value">{{ indicator.weight }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">来源部门</span>
                    <span class="detail-value">{{ indicator.ownerDept }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">完成状态</span>
                    <span class="detail-value">
                      <span class="status-tag" :class="getStatusClass(indicator.status)">
                        {{ getStatusText(indicator.status) }}
                      </span>
                    </span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">统计月份</span>
                    <span class="detail-value">{{ selectedMonthInCollegeDrillDown }}月</span>
                  </div>
                </div>
              </el-popover>
            </div>
          </div>
        </el-card>
        </div>
      </div>
    </div>

    <!-- 分院排名看板（战略发展部 + 职能部门） -->
    <div v-if="currentRole !== 'secondary_college'" class="chart-section deep-charts college-ranking-section">
      <el-col :span="24">
        <el-card shadow="hover" class="chart-card glass-card">
          <template #header>
            <div class="card-header">
              <div class="header-left">
                <div style="display: flex; align-items: center; gap: 4px;">
                  <span class="card-title">
                    分院排名
                    <span class="title-tag-italic">RANKING</span>
                  </span>
                  <el-tooltip content="展示各二级学院的指标完成分数排名，分数 = Σ(权重 × 进度)" placement="top" effect="light">
                    <el-icon class="help-icon"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </div>
                <span class="card-subtitle">{{ collegeRankingMonth }}月 · 按分数排名</span>
              </div>
              <div class="header-right">
                <div class="filter-group">
                  <!-- 月份筛选 -->
                  <div class="month-filter">
                    <span class="filter-label">月份:</span>
                    <el-select
                      v-model="collegeRankingMonth"
                      size="small"
                      class="month-select"
                      @change="handleCollegeRankingMonthChange"
                    >
                      <el-option
                        v-for="m in 12"
                        :key="m"
                        :label="`${m}月`"
                        :value="m"
                      />
                    </el-select>
                  </div>
                  <!-- 职能部门筛选（仅战略发展部可见） -->
                  <div v-if="currentRole === 'strategic_dept'" class="dept-filter">
                    <span class="filter-label">来源部门:</span>
                    <el-select
                      v-model="selectedOwnerDeptFilter"
                      size="small"
                      class="dept-select"
                      @change="handleOwnerDeptFilterChange"
                    >
                      <el-option label="全部" value="all" />
                      <el-option
                        v-for="dept in availableFunctionalDepts"
                        :key="dept"
                        :label="dept"
                        :value="dept"
                      />
                    </el-select>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <div ref="collegeRankingChartRef" class="college-ranking-chart"></div>
        </el-card>
      </el-col>
    </div>

    <!-- 图表区域 -->
    <el-row :gutter="16" class="chart-section">
      <!-- 得分构成 -->
      <el-col :xs="24" :md="8">
        <el-card shadow="hover" class="chart-card card-animate">
          <template #header>
            <div class="card-header">
              <div style="display: flex; align-items: center; gap: 4px;">
                <span class="card-title">得分构成</span>
                <el-tooltip :content="helpTexts.scoreComposition" placement="top" effect="light">
                  <el-icon class="help-icon"><QuestionFilled /></el-icon>
                </el-tooltip>
              </div>
            </div>
          </template>
          <ScoreCompositionChart 
            :basic-score="dashboardData.basicScore" 
            :development-score="dashboardData.developmentScore"
          />
        </el-card>
      </el-col>

      <!-- 预警分布 -->
      <el-col :xs="24" :md="8">
        <el-card shadow="hover" class="chart-card card-animate">
          <template #header>
            <div class="card-header">
              <div style="display: flex; align-items: center; gap: 4px;">
                <span class="card-title">预警分布</span>
                <el-tooltip :content="helpTexts.alertDistribution" placement="top" effect="light">
                  <el-icon class="help-icon"><QuestionFilled /></el-icon>
                </el-tooltip>
              </div>
            </div>
          </template>
          <AlertDistributionChart 
            :severe="dashboardData.alertIndicators.severe"
            :moderate="dashboardData.alertIndicators.moderate"
            :normal="dashboardData.alertIndicators.normal"
            @click="handleAlertClick"
          />
        </el-card>
      </el-col>

      <!-- 完成率统计 -->
      <el-col :xs="24" :md="8">
        <el-card shadow="hover" class="chart-card card-animate">
          <template #header>
            <div class="card-header">
              <div style="display: flex; align-items: center; gap: 4px;">
                <span class="card-title">完成情况</span>
                <el-tooltip :content="helpTexts.completionRate" placement="top" effect="light">
                  <el-icon class="help-icon"><QuestionFilled /></el-icon>
                </el-tooltip>
              </div>
            </div>
          </template>
          <div class="completion-stats">
            <div class="completion-ring">
              <el-progress 
                type="circle" 
                :percentage="dashboardData.completionRate" 
                :width="140"
                :stroke-width="12"
              >
                <template #default="{ percentage }">
                  <div class="completion-text">
                    <span class="percentage">{{ percentage }}%</span>
                    <span class="label">完成率</span>
                  </div>
                </template>
              </el-progress>
            </div>
            <div class="completion-detail">
              <div class="detail-item">
                <span class="detail-label">总指标数</span>
                <span class="detail-value">{{ dashboardData.totalIndicators }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">已完成</span>
                <span class="detail-value success">{{ dashboardData.completedIndicators }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">进行中</span>
                <span class="detail-value">{{ dashboardData.totalIndicators - dashboardData.completedIndicators }}</span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 滞后任务响应清单（二级学院不显示） -->
    <el-card v-if="currentRole !== 'secondary_college'" shadow="hover" class="task-list-card glass-card">
      <template #header>
        <div class="card-header task-card-header">
          <div class="header-left">
            <div class="header-icon danger">
              <el-icon><Warning /></el-icon>
            </div>
              <div class="header-title-group">
                <div style="display: flex; align-items: center; gap: 4px;">
                  <span class="card-title task-title">TOP 滞后任务响应清单</span>
                  <el-tooltip :content="helpTexts.delayedTasks" placement="top" effect="light">
                    <el-icon class="help-icon"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </div>
                <span class="card-subtitle">HIGH PRIORITY PENDING ACTIONS</span>
              </div>
          </div>
          <el-button link type="primary" size="small" class="view-all-btn">VIEW ALL ISSUES →</el-button>
        </div>
      </template>
      <el-table :data="delayedTasks" style="width: 100%" :show-header="true" class="task-table">
        <el-table-column label="战略任务内容" min-width="240">
          <template #default="{ row }">
            <div class="task-name-primary">{{ row.name }}</div>
            <div class="task-ref-id">REF_ID: {{ row.id }}</div>
          </template>
        </el-table-column>
        <el-table-column label="责任主体" width="140" align="center">
          <template #default="{ row }">
            <span class="dept-badge">{{ row.dept }}</span>
          </template>
        </el-table-column>
        <el-table-column label="当前进度" width="160" align="center">
          <template #default="{ row }">
            <div class="progress-cell-new">
              <div class="progress-bar-wrapper">
                <div class="progress-bar-fill" :style="{ width: row.progress + '%' }"></div>
              </div>
              <span class="delayed-tag">DELAYED {{ row.days }}D</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="闭环管理" width="130" align="center">
          <template #default="{ row }">
            <button 
              class="urge-btn"
              :class="{ disabled: row.reminded }"
              :disabled="row.reminded"
              @click="handleUrge(row)"
            >
              {{ row.reminded ? '已催办' : '一键催办' }}
            </button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="delayedTasks.length === 0" description="暂无滞后任务，执行状态良好！" />
    </el-card>

    <!-- 三级联动图表区域 -->

    <!-- 战略发展部 - 组织级视图 -->
    <template v-if="currentRole === 'strategic_dept' && dashboardStore.currentOrgLevel === 'strategy'">
      <el-row :gutter="16" style="margin-top: 16px;">
        <!-- 全校任务流转图 -->
        <el-col :span="24">
          <el-card shadow="hover" class="chart-card card-animate">
            <template #header>
              <div class="card-header">
                <div style="display: flex; align-items: center; gap: 4px;">
                  <span class="card-title">全校任务流转图</span>
                  <el-tooltip content="显示战略处到职能部门到学院的任务分发情况，点击节点可下钻" placement="top" effect="light">
                    <el-icon class="help-icon"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </div>
              </div>
            </template>
            <TaskSankeyChart
              :data="dashboardStore.sankeyData"
              title=""
              @node-click="handleSankeyNodeClick"
              @link-click="handleSankeyLinkClick"
            />
          </el-card>
        </el-col>
      </el-row>
    </template>

    <!-- 职能部门视图 -->
    <template v-if="currentRole === 'functional_dept'">
      <el-row :gutter="16" style="margin-top: 16px;">
        <!-- 本部门任务下发流向 -->
        <el-col :span="24">
          <el-card shadow="hover" class="chart-card card-animate">
            <template #header>
              <div class="card-header">
                <div style="display: flex; align-items: center; gap: 4px;">
                  <span class="card-title">本部门任务下发流向</span>
                  <el-tooltip content="显示本部门向各学院分发的任务情况" placement="top" effect="light">
                    <el-icon class="help-icon"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </div>
              </div>
            </template>
            <TaskSankeyChart
              :data="dashboardStore.sankeyData"
              title=""
              @node-click="handleSankeyNodeClick"
            />
          </el-card>
        </el-col>
      </el-row>
    </template>

    <!-- 二级学院视图 -->
    <template v-if="currentRole === 'secondary_college'">
      <el-row :gutter="16" style="margin-top: 16px;">
        <!-- 任务来源分布 -->
        <el-col :xs="24" :md="10">
          <el-card shadow="hover" class="chart-card card-animate">
            <template #header>
              <div class="card-header">
                <div style="display: flex; align-items: center; gap: 4px;">
                  <span class="card-title">任务来源分布</span>
                  <el-tooltip content="显示本学院承接的任务来自哪些职能部门，点击可筛选" placement="top" effect="light">
                    <el-icon class="help-icon"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </div>
              </div>
            </template>
            <SourcePieChart
              :data="dashboardStore.taskSourceDistribution"
              title=""
              @click="handleSourceClick"
            />
          </el-card>
        </el-col>

        <!-- 承接任务汇总 -->
        <el-col :xs="24" :md="14">
          <el-card shadow="hover" class="chart-card card-animate">
            <template #header>
              <div class="card-header">
                <div style="display: flex; align-items: center; gap: 4px;">
                  <span class="card-title">承接任务汇总</span>
                  <el-tooltip content="本学院承接的所有任务进度汇总" placement="top" effect="light">
                    <el-icon class="help-icon"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </div>
              </div>
            </template>
            <DepartmentProgressChart :departments="dashboardStore.departmentSummary" />
          </el-card>
        </el-col>
      </el-row>
    </template>
    </template><!-- 结束 v-else 正常数据展示 -->
  </div>
</template>

<style scoped>
/* ========================================
   DashboardView 升级版样式
   采用测试看板的设计元素
   ======================================== */

.dashboard-view {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

/* ========== 降级模式提示样式 - Requirements 1.4, 10.5 ========== */
.fallback-mode-alert {
  margin-bottom: var(--spacing-md);
  border-radius: var(--radius-md);
}

.fallback-mode-alert :deep(.el-alert__content) {
  width: 100%;
}

.fallback-alert-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: 13px;
}

.fallback-alert-content .el-button {
  margin-left: var(--spacing-xs);
}

/* ========== AI 智能摘要卡片 ========== */
.ai-summary-card {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-lg);
  padding: var(--spacing-xl);
  background: var(--bg-white);
  border-radius: var(--radius-xl);
  border-left: 4px solid var(--color-primary);
  box-shadow: var(--shadow-card);
  position: relative;
  overflow: hidden;
}

.ai-summary-card::before {
  content: '';
  position: absolute;
  right: -50px;
  top: -50px;
  width: 150px;
  height: 150px;
  background: var(--color-primary-light);
  border-radius: 50%;
  opacity: 0.3;
}

.summary-icon {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
  border-radius: var(--radius-lg);
  color: white;
}

.summary-content {
  flex: 1;
  min-width: 0;
}

.summary-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.summary-tag {
  font-size: 11px;
  font-weight: 800;
  color: var(--color-primary);
  text-transform: uppercase;
  letter-spacing: 2px;
}

.summary-time {
  font-size: 11px;
  color: var(--text-placeholder);
  letter-spacing: -0.5px;
}

.summary-text {
  font-size: 15px;
  line-height: 1.8;
  color: var(--text-regular);
  margin: 0;
  font-weight: 500;
}

.highlight-primary {
  color: var(--color-primary);
  font-weight: 800;
}

.highlight-danger {
  color: var(--color-danger);
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 4px;
  text-decoration-color: rgba(245, 108, 108, 0.3);
}

.highlight-success {
  color: var(--color-success);
  font-weight: 700;
}

.drill-btn {
  margin-left: var(--spacing-sm);
  color: var(--color-primary);
  font-weight: 700;
  background: none;
  border: none;
  border-bottom: 1px solid rgba(64, 158, 255, 0.3);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.drill-btn:hover {
  color: var(--color-primary-dark);
  border-bottom-color: var(--color-primary);
}

.summary-stats {
  display: flex;
  gap: var(--spacing-md);
  flex-shrink: 0;
}

.mini-stat {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--bg-page);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  text-align: center;
  min-width: 80px;
}

.mini-label {
  font-size: 10px;
  color: var(--text-placeholder);
  text-transform: uppercase;
  font-weight: 700;
  margin-bottom: 4px;
  letter-spacing: 0.5px;
}

.mini-value {
  font-size: 20px;
  font-weight: 800;
}

.mini-value.success { color: var(--color-success); }
.mini-value.warning { color: var(--color-warning); }
.mini-value.primary { color: var(--color-primary); }

/* ========== 工具栏 ========== */
.dashboard-toolbar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--bg-white);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-light);
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

/* ========== KPI 核心矩阵卡片 ========== */
.stat-cards {
  margin-bottom: var(--spacing-lg);
}

.stat-cards .el-col {
  margin-bottom: var(--spacing-lg);
}

.kpi-card {
  background: var(--bg-white);
  border-radius: var(--radius-xl);
  padding: var(--spacing-xl);
  box-shadow: var(--shadow-card);
  transition: all var(--transition-normal);
  border: 1px solid var(--border-color);
  position: relative;
  overflow: hidden;
}

.kpi-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-hover);
  border-color: var(--color-primary-light);
}

.kpi-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-xl);
}

.kpi-label {
  font-size: 10px;
  font-weight: 800;
  color: var(--text-placeholder);
  text-transform: uppercase;
  letter-spacing: 1.5px;
}

.kpi-trend {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  border-radius: var(--radius-md);
  font-size: 10px;
  font-weight: 800;
}

.kpi-trend.up {
  background: rgba(103, 194, 58, 0.1);
  color: var(--color-success);
}

.kpi-trend.down {
  background: rgba(245, 108, 108, 0.1);
  color: var(--color-danger);
}

.kpi-body {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-xs);
}

.kpi-value {
  font-size: 40px;
  font-weight: 800;
  color: var(--text-main);
  line-height: 1;
  letter-spacing: -2px;
}

.kpi-unit {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-placeholder);
}

.kpi-footer {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: var(--spacing-xl);
}

.kpi-predict {
  font-size: 11px;
  color: var(--color-primary);
  font-weight: 700;
}

.kpi-desc {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 500;
}

.kpi-progress {
  height: 6px;
  background: var(--bg-page);
  border-radius: 3px;
  overflow: hidden;
}

.kpi-progress-bar {
  height: 100%;
  border-radius: 3px;
  transition: width 1s ease;
}

/* KPI 卡片渐变色 */
.kpi-primary .kpi-progress-bar {
  background: linear-gradient(90deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
  box-shadow: 0 0 10px rgba(64, 158, 255, 0.4);
}

.kpi-success .kpi-progress-bar {
  background: linear-gradient(90deg, #67c23a 0%, #529b2e 100%);
  box-shadow: 0 0 10px rgba(103, 194, 58, 0.4);
}

.kpi-danger .kpi-progress-bar {
  background: linear-gradient(90deg, #f56c6c 0%, #c45656 100%);
  box-shadow: 0 0 10px rgba(245, 108, 108, 0.4);
}

.kpi-purple .kpi-progress-bar {
  background: linear-gradient(90deg, #9333ea 0%, #7c3aed 100%);
  box-shadow: 0 0 10px rgba(147, 51, 234, 0.4);
}

/* ========== 玻璃拟态卡片 ========== */
.glass-card {
  background: var(--bg-white);
  border: 1px solid var(--border-color);
}

.glass-card:hover {
  border-color: var(--color-primary-light);
}

/* ========== 学院看板样式 ========== */
.college-section {
  display: grid;
  grid-template-columns: 1fr 0fr;
  gap: 16px;
  transition: grid-template-columns 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  margin-bottom: var(--spacing-lg);
}

.college-section.has-detail {
  grid-template-columns: 1fr 1fr;
}

.college-col {
  min-width: 0;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.college-col .college-card {
  overflow: hidden;
}

.college-col .college-chart {
  width: 100% !important;
}

.college-chart {
  height: 350px;
}

/* 学院卡片边框样式 */
.college-card {
  border-left: 3px solid #E6A23C; /* 橙色边框区分学院看板 */
}

/* 学院卡片头部样式 - 与 benchmark-header 一致 */
.college-header {
  flex-direction: row !important;
  align-items: flex-start;
  justify-content: space-between;
}

.college-title {
  font-weight: 700;
  font-size: 15px;
  color: var(--text-primary);
}

.title-tag-italic {
  font-style: italic;
  font-size: 10px;
  color: var(--text-secondary);
  margin-left: 6px;
}

/* ========== 分院排名看板样式 ========== */
.college-ranking-section {
  margin-bottom: var(--spacing-lg);
}

/* 分院排名看板 header 使用水平布局，筛选区域在右上角 */
.college-ranking-section .card-header {
  flex-direction: row !important;
  justify-content: space-between;
  align-items: flex-start;
}

.college-ranking-section .card-header .header-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.college-ranking-chart {
  min-height: 350px;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 16px;
}

.dept-filter {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 移除来源部门下拉框的双重边框 */
.dept-filter .dept-select.el-select {
  width: 150px;
  padding: 0 !important;
  border: none !important;
}

.dept-filter .dept-select :deep(.el-select__wrapper) {
  box-shadow: 0 0 0 1px var(--border-color) inset !important;
}

/* ========== 深度图表区域 ========== */
.deep-charts .card-header {
  flex-direction: column;
  align-items: flex-start;
}

.deep-charts .card-header .header-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Benchmark 区域使用 Grid 布局 */
.benchmark-section {
  display: grid;
  grid-template-columns: 1fr 0fr;
  gap: 16px;
  transition: grid-template-columns 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  margin-bottom: var(--spacing-lg);
}

.benchmark-section.has-detail {
  grid-template-columns: 1fr 1fr;
}

.benchmark-col {
  min-width: 0;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.benchmark-col .benchmark-card {
  overflow: hidden;
}

.benchmark-col .benchmark-chart {
  width: 100% !important;
}

.indicator-col {
  min-width: 0;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.indicator-card-wrapper {
  transform: translateX(80px);
  opacity: 0;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.indicator-col.visible .indicator-card-wrapper {
  transform: translateX(0);
  opacity: 1;
}

.title-tag {
  display: inline-block;
  padding: 2px 8px;
  background: var(--color-primary);
  color: white;
  font-size: 10px;
  font-weight: 700;
  border-radius: var(--radius-sm);
  margin-left: var(--spacing-sm);
  letter-spacing: 1px;
}

/* Benchmark 卡片样式 */
.benchmark-card {
  border-left: 3px solid var(--color-primary);
}

.benchmark-header {
  flex-direction: row !important;
  align-items: flex-start;
  justify-content: space-between;
}

.benchmark-title {
  font-size: 18px;
  font-weight: 800;
  font-style: italic;
  color: var(--text-main);
}

.title-tag-italic {
  font-style: italic;
  font-weight: 800;
  color: var(--color-primary);
  margin-left: var(--spacing-sm);
  letter-spacing: 1px;
}

.view-toggle {
  display: flex;
  gap: 8px;
}

.toggle-btn {
  padding: 8px 16px;
  border: none;
  border-radius: var(--radius-lg);
  font-size: 10px;
  font-weight: 800;
  cursor: pointer;
  transition: all var(--transition-fast);
  background: var(--bg-page);
  color: var(--text-secondary);
  text-transform: uppercase;
}

.toggle-btn:hover {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.toggle-btn.active {
  background: var(--color-primary);
  color: white;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
}

/* 雷达卡片样式 */
.radar-card {
  border-left: 3px solid var(--color-primary);
}

.radar-title {
  font-size: 18px;
  font-weight: 800;
  font-style: italic;
  color: var(--text-main);
}

.radar-header {
  flex-direction: column;
  align-items: flex-start;
}

.card-subtitle {
  font-size: 10px;
  color: var(--text-placeholder);
  text-transform: uppercase;
  letter-spacing: 1.5px;
  font-weight: 700;
  margin-top: 2px;
  line-height: 1.2;
}

.benchmark-chart {
  width: 100%;
  height: 350px;
}

.radar-chart {
  width: 100%;
  height: 260px;
}

.radar-stats {
  display: flex;
  justify-content: center;
  gap: var(--spacing-2xl);
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--border-color);
  margin-top: var(--spacing-md);
}

.radar-stat {
  text-align: center;
  padding: 0 var(--spacing-xl);
}

.radar-stat.border-left {
  border-left: 1px solid var(--border-color);
}

.radar-stat-label {
  font-size: 10px;
  color: var(--text-placeholder);
  text-transform: uppercase;
  font-weight: 700;
  margin-bottom: 4px;
  letter-spacing: 0.5px;
}

.radar-stat-value {
  font-size: 24px;
  font-weight: 800;
}

.radar-stat-value.primary { color: var(--color-primary); }
.radar-stat-value.success { color: var(--color-success); }
.radar-stat-value.danger { color: var(--color-danger); }

/* ========== 图表区域 ========== */
.chart-section .el-col {
  margin-bottom: var(--spacing-lg);
}

.chart-card {
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  transition: all var(--transition-normal);
  position: relative;
}

.chart-card:hover {
  box-shadow: var(--shadow-hover);
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-main);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.header-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
}

.header-icon.danger {
  background: rgba(245, 108, 108, 0.15);
  color: var(--color-danger);
}

.help-icon {
  color: var(--text-placeholder);
  cursor: help;
  font-size: 14px;
  transition: color var(--transition-fast);
}

.help-icon:hover {
  color: var(--color-primary);
}

/* ========== 完成情况统计 ========== */
.completion-stats {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-lg);
  padding: var(--spacing-sm) 0;
}

.completion-ring {
  display: flex;
  justify-content: center;
}

.completion-text {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.completion-text .percentage {
  font-size: 24px;
  font-weight: bold;
  color: var(--text-main);
}

.completion-text .label {
  font-size: 12px;
  color: var(--text-secondary);
}

.completion-detail {
  display: flex;
  justify-content: center;
  gap: var(--spacing-2xl);
  width: 100%;
}

.detail-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
}

.detail-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.detail-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-main);
}

.detail-value.success {
  color: var(--color-success);
}

/* ========== 滞后任务清单 ========== */
.bottom-section {
  margin-top: var(--spacing-lg);
}

.bottom-section .el-col {
  margin-bottom: var(--spacing-lg);
}

.task-list-card {
  border-radius: var(--radius-xl);
}

.task-list-card :deep(.el-card__header) {
  padding: 16px 20px;
}

.task-card-header {
  align-items: flex-start;
}

.header-title-group {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.task-title {
  font-style: italic;
  font-weight: 800;
  letter-spacing: -0.5px;
  line-height: 1.2;
  font-size: 18px;
}

.view-all-btn {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--color-primary) !important;
}

.task-table {
  --el-table-border-color: var(--border-color);
}

.task-table :deep(.el-table__header th) {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-placeholder);
  background: transparent;
  border-bottom: 1px solid var(--border-color);
  padding: 16px 0;
}

.task-table :deep(.el-table__row) {
  transition: background var(--transition-fast);
}

.task-table :deep(.el-table__row:hover > td) {
  background: var(--bg-page) !important;
}

.task-name-primary {
  font-weight: 700;
  color: var(--color-primary);
  margin-bottom: 6px;
  font-size: 14px;
  line-height: 1.4;
}

.task-ref-id {
  font-size: 11px;
  color: var(--text-placeholder);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-family: 'Consolas', monospace;
}

.dept-badge {
  display: inline-block;
  padding: 6px 16px;
  background: var(--bg-page);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-regular);
}

.progress-cell-new {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.progress-bar-wrapper {
  width: 80px;
  height: 4px;
  background: var(--bg-page);
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #f56c6c 0%, #c45656 100%);
  border-radius: 2px;
  transition: width 0.5s ease;
}

.delayed-tag {
  font-size: 11px;
  font-weight: 800;
  font-style: italic;
  color: var(--color-danger);
  letter-spacing: 0.5px;
}

.urge-btn {
  padding: 8px 20px;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all var(--transition-fast);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
}

.urge-btn:hover:not(.disabled) {
  transform: scale(1.02);
  box-shadow: 0 6px 16px rgba(64, 158, 255, 0.4);
}

.urge-btn:active:not(.disabled) {
  transform: scale(0.98);
}

.urge-btn.disabled {
  background: var(--bg-page);
  color: var(--text-placeholder);
  box-shadow: none;
  cursor: not-allowed;
}

/* ========== 部门卡片 ========== */
.department-card {
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  transition: all var(--transition-normal);
}

.department-card:hover {
  box-shadow: var(--shadow-hover);
}

.department-card :deep(.el-progress) {
  transition: all var(--transition-fast);
}

.department-card :deep(.department-item:hover) {
  background: var(--bg-page);
  border-radius: var(--radius-sm);
}

/* ========== 指标完成情况卡片 ========== */
.indicator-status-card {
  border-left: 3px solid var(--color-success);
}

.indicator-status-list {
  height: 350px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 状态统计摘要 */
.status-summary {
  display: flex;
  gap: 12px;
  padding: 10px 12px;
  background: var(--bg-page);
  border-radius: var(--radius-md);
  margin-bottom: 12px;
  flex-shrink: 0;
}

.status-summary-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.status-summary-item:hover {
  background: rgba(0, 0, 0, 0.05);
}

.status-summary-item.active {
  transform: scale(1.05);
}

.status-summary-item .status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-summary-item.ahead .status-dot {
  background: var(--color-success);
}

.status-summary-item.ahead {
  color: var(--color-success);
}

.status-summary-item.ahead.active {
  background: rgba(103, 194, 58, 0.15);
}

.status-summary-item.normal .status-dot {
  background: var(--color-primary);
}

.status-summary-item.normal {
  color: var(--color-primary);
}

.status-summary-item.normal.active {
  background: rgba(64, 158, 255, 0.15);
}

.status-summary-item.warning .status-dot {
  background: var(--color-warning);
}

.status-summary-item.warning {
  color: var(--color-warning);
}

.status-summary-item.warning.active {
  background: rgba(230, 162, 60, 0.15);
}

.status-summary-item.delayed .status-dot {
  background: var(--color-danger);
}

.status-summary-item.delayed {
  color: var(--color-danger);
}

.status-summary-item.delayed.active {
  background: rgba(245, 108, 108, 0.15);
}

.indicator-scroll-container {
  flex: 1;
  overflow-y: auto;
  padding-right: 8px;
}

.indicator-scroll-container::-webkit-scrollbar {
  width: 6px;
}

.indicator-scroll-container::-webkit-scrollbar-thumb {
  background: rgba(144, 147, 153, 0.3);
  border-radius: 3px;
}

.indicator-scroll-container::-webkit-scrollbar-thumb:hover {
  background: rgba(144, 147, 153, 0.5);
}

.empty-indicator-list {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.indicator-status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  margin-bottom: 8px;
  background: var(--bg-page);
  border-radius: var(--radius-md);
  border-left: 3px solid transparent;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.indicator-status-item:hover {
  background: var(--color-primary-light);
  transform: translateX(4px);
}

.indicator-status-item.status-normal {
  border-left-color: var(--color-primary);
}

.indicator-status-item.status-ahead {
  border-left-color: var(--color-success);
}

.indicator-status-item.status-warning {
  border-left-color: var(--color-warning);
}

.indicator-status-item.status-delayed {
  border-left-color: var(--color-danger);
}

.indicator-info {
  flex: 1;
  min-width: 0;
  margin-right: 12px;
}

.indicator-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
  line-height: 1.4;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.indicator-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}

.indicator-type-tag {
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 11px;
}

/* 定量指标 - 蓝色 */
.indicator-type-tag.type-quantitative {
  background: rgba(64, 158, 255, 0.15);
  color: #409eff;
  border: 1px solid rgba(64, 158, 255, 0.3);
}

/* 定性指标 - 紫色 */
.indicator-type-tag.type-qualitative {
  background: rgba(147, 51, 234, 0.15);
  color: #9333ea;
  border: 1px solid rgba(147, 51, 234, 0.3);
}

.indicator-progress {
  color: var(--text-secondary);
}

.indicator-status-badge {
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: var(--radius-md);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.indicator-status-badge.status-normal {
  background: rgba(64, 158, 255, 0.1);
  color: var(--color-primary);
}

.indicator-status-badge.status-ahead {
  background: rgba(103, 194, 58, 0.1);
  color: var(--color-success);
}

.indicator-status-badge.status-warning {
  background: rgba(230, 162, 60, 0.1);
  color: var(--color-warning);
}

.indicator-status-badge.status-delayed {
  background: rgba(245, 108, 108, 0.1);
  color: var(--color-danger);
}

/* ========== 指标详情弹出层 ========== */
.indicator-detail-content {
  padding: 4px;
}

.indicator-detail-content .detail-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main);
  margin: 0 0 12px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
  line-height: 1.5;
}

.indicator-detail-content .detail-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
  font-size: 13px;
}

.indicator-detail-content .detail-label {
  color: var(--text-secondary);
  flex-shrink: 0;
  width: 80px;
}

.indicator-detail-content .detail-value {
  color: var(--text-main);
  font-weight: 500;
  text-align: right;
  flex: 1;
}

.indicator-detail-content .detail-value.task-content {
  font-size: 12px;
  line-height: 1.4;
  max-width: 200px;
}

.indicator-detail-content .status-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.indicator-detail-content .status-tag.status-normal {
  background: rgba(64, 158, 255, 0.1);
  color: var(--color-primary);
}

.indicator-detail-content .status-tag.status-ahead {
  background: rgba(103, 194, 58, 0.1);
  color: var(--color-success);
}

.indicator-detail-content .status-tag.status-warning {
  background: rgba(230, 162, 60, 0.1);
  color: var(--color-warning);
}

.indicator-detail-content .status-tag.status-delayed {
  background: rgba(245, 108, 108, 0.1);
  color: var(--color-danger);
}

/* ========== 月份筛选器样式 ========== */
.month-filter {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 600;
}

.month-select {
  width: 100px;
}

.month-select :deep(.el-input__wrapper) {
  border-radius: var(--radius-md);
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

/* ========== 加载状态骨架屏样式 - Requirement 1.5 ========== */
.skeleton-card {
  background: var(--bg-white);
  border-radius: var(--radius-xl);
  padding: var(--spacing-xl);
  box-shadow: var(--shadow-card);
}

.skeleton-card .el-skeleton {
  --el-skeleton-color: var(--bg-page);
  --el-skeleton-to-color: #f5f7fa;
}

/* ========== 空状态样式 - Requirement 1.6 ========== */
.empty-state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  background: var(--bg-white);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-card);
  padding: var(--spacing-2xl);
}

.empty-description {
  text-align: center;
}

.empty-description p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.empty-description .empty-hint {
  margin-top: var(--spacing-sm);
  font-size: 12px;
  color: var(--text-placeholder);
}

/* ========== 错误状态样式 ========== */
.error-state-container {
  margin: var(--spacing-xl) 0;
}

.error-state-container .el-alert {
  border-radius: var(--radius-lg);
}

.error-actions {
  margin-top: var(--spacing-md);
}

/* ========== 响应式适配 ========== */
@media (max-width: 768px) {
  .ai-summary-card {
    flex-direction: column;
  }
  
  .summary-stats {
    width: 100%;
    justify-content: center;
  }
  
  .kpi-value {
    font-size: 28px;
  }
  
  .benchmark-chart {
    height: 280px;
  }
  
  .radar-chart {
    height: 220px;
  }
  
  .empty-state-container {
    min-height: 300px;
    padding: var(--spacing-xl);
  }
}
</style>