import type { Indicator, StrategicTask, Milestone } from '@/types/entities'
import { mockIndicators } from './mockIndicators'
import { mockStrategicTasks } from './mockStrategicTasks'
import { mockMilestones } from './mockMilestones'

/**
 * 仪表板数据生成器
 * 基于真实的业务数据计算统计信息
 */

export interface DashboardStats {
  overview: {
    totalIndicators: number
    completedIndicators: number
    inProgressIndicators: number
    pendingIndicators: number
    averageProgress: number
    totalTasks: number
    completedTasks: number
    totalMilestones: number
    completedMilestones: number
  }
  departmentProgress: Array<{
    name: string
    progress: number
    indicators: number
    completed: number
    inProgress: number
  }>
  recentActivities: Array<{
    id: string
    type: 'indicator_update' | 'task_complete' | 'milestone_reached' | 'approval_pending'
    title: string
    user: string
    department: string
    time: string
  }>
  trend: {
    labels: string[]
    data: number[]
  }
  distribution: Array<{
    name: string
    value: number
    color: string
  }>
}

function calculateDepartmentStats(indicators: Indicator[]): DashboardStats['departmentProgress'] {
  const deptMap = new Map<string, { total: number; completed: number; inProgress: number; progressSum: number }>()

  indicators.forEach(indicator => {
    const dept = indicator.responsibleDept
    if (!deptMap.has(dept)) {
      deptMap.set(dept, { total: 0, completed: 0, inProgress: 0, progressSum: 0 })
    }
    const stats = deptMap.get(dept)!
    stats.total++
    stats.progressSum += indicator.progress

    if (indicator.progress >= 100) {
      stats.completed++
    } else if (indicator.progress > 0) {
      stats.inProgress++
    }
  })

  return Array.from(deptMap.entries()).map(([name, stats]) => ({
    name,
    progress: Math.round((stats.progressSum / stats.total) * 10) / 10,
    indicators: stats.total,
    completed: stats.completed,
    inProgress: stats.inProgress
  }))
}

function generateRecentActivities(
  indicators: Indicator[],
  milestones: Milestone[]
): DashboardStats['recentActivities'] {
  const activities: DashboardStats['recentActivities'] = []

  // 从指标审计日志生成活动
  indicators.forEach(indicator => {
    if (indicator.statusAudit && indicator.statusAudit.length > 0) {
      const latestAudit = indicator.statusAudit[indicator.statusAudit.length - 1]
      activities.push({
        id: `ACT-IND-${indicator.indicatorId}`,
        type: 'indicator_update',
        title: `更新了"${indicator.indicatorName}"指标`,
        user: latestAudit.operatorName || latestAudit.operator,
        department: latestAudit.operatorDept || indicator.responsibleDept,
        time: latestAudit.timestamp
      })
    }
  })

  // 从里程碑生成活动
  milestones.filter(m => m.status === 'COMPLETED').forEach(milestone => {
    activities.push({
      id: `ACT-MIL-${milestone.milestoneId}`,
      type: 'milestone_reached',
      title: `达到了"${milestone.milestoneName}"里程碑`,
      user: '系统',
      department: '',
      time: milestone.updatedAt
    })
  })

  // 待审批的指标
  indicators
    .filter(indicator => indicator.progressApprovalStatus === 'PENDING')
    .forEach(indicator => {
      activities.push({
        id: `ACT-APP-${indicator.indicatorId}`,
        type: 'approval_pending',
        title: `"${indicator.indicatorName}"待审批`,
        user: indicator.responsiblePerson || '未知',
        department: indicator.responsibleDept,
        time: indicator.updatedAt
      })
    })

  // 按时间排序，取最近的 10 条
  return activities
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 10)
}

function calculateOverview(
  indicators: Indicator[],
  tasks: StrategicTask[],
  milestones: Milestone[]
): DashboardStats['overview'] {
  const completedIndicators = indicators.filter(i => i.progress >= 100).length
  const inProgressIndicators = indicators.filter(i => i.progress > 0 && i.progress < 100).length
  const pendingIndicators = indicators.filter(i => i.progress === 0).length
  const totalProgress = indicators.reduce((sum, i) => sum + i.progress, 0)
  const averageProgress = indicators.length > 0 ? Math.round((totalProgress / indicators.length) * 10) / 10 : 0

  const completedMilestones = milestones.filter(m => m.status === 'COMPLETED').length

  return {
    totalIndicators: indicators.length,
    completedIndicators,
    inProgressIndicators,
    pendingIndicators,
    averageProgress,
    totalTasks: tasks.length,
    completedTasks: 0, // 简化处理
    totalMilestones: milestones.length,
    completedMilestones
  }
}

function generateDistribution(indicators: Indicator[]): DashboardStats['distribution'] {
  const typeMap = new Map<string, number>()

  indicators.forEach(indicator => {
    const type = indicator.indicatorType1 || '其他'
    typeMap.set(type, (typeMap.get(type) || 0) + 1)
  })

  const colors = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272']

  return Array.from(typeMap.entries()).map(([name, value], index) => ({
    name,
    value,
    color: colors[index % colors.length]
  }))
}

function generateTrend(): DashboardStats['trend'] {
  return {
    labels: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    data: [15, 25, 35, 42, 48, 55, 62, 68, 72, 76, 78, 82]
  }
}

export function generateMockDashboardData(): DashboardStats {
  return {
    overview: calculateOverview(mockIndicators, mockStrategicTasks, mockMilestones),
    departmentProgress: calculateDepartmentStats(mockIndicators),
    recentActivities: generateRecentActivities(mockIndicators, mockMilestones),
    trend: generateTrend(),
    distribution: generateDistribution(mockIndicators)
  }
}

export const mockDashboardData = generateMockDashboardData()
