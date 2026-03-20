/**
 * useIndicatorStatus - 指标状态计算 Composable
 *
 * 职责:
 * - 计算指标状态（正常、超前、预警、延期）
 * - 获取当前目标进度
 * - 提供状态相关的工具函数
 *
 * @module composables/dashboard
 */

import type { StrategicIndicator } from '@/shared/types'
import type { IndicatorStatus, STATUS_COLORS as _STATUS_COLORS } from './useDashboardState'

/**
 * 计算指标状态
 */
export function getIndicatorStatus(indicator: StrategicIndicator): IndicatorStatus {
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

  // 找到离今天最近的未来里程碑
  const nextMilestone = sortedMilestones.find(m => {
    const deadlineDate = new Date(m.deadline)
    deadlineDate.setHours(23, 59, 59, 999)
    return deadlineDate >= today
  })

  if (!nextMilestone) {
    // 没有未来的里程碑，检查最后一个里程碑是否完成
    const lastMilestone = sortedMilestones[sortedMilestones.length - 1]
    if (lastMilestone && currentProgress >= lastMilestone.targetProgress) {
      return 'ahead'
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

/**
 * 获取状态显示文本
 */
export function getStatusText(status: IndicatorStatus): string {
  const statusMap: Record<IndicatorStatus, string> = {
    normal: '正常',
    ahead: '超前完成',
    warning: '预警',
    delayed: '延期'
  }
  return statusMap[status]
}

/**
 * 获取状态对应的颜色类
 */
export function getStatusClass(status: IndicatorStatus): string {
  const classMap: Record<IndicatorStatus, string> = {
    normal: 'status-normal',
    ahead: 'status-ahead',
    warning: 'status-warning',
    delayed: 'status-delayed'
  }
  return classMap[status]
}

/**
 * 获取当月目标进度
 */
export function getCurrentTargetProgress(indicator: StrategicIndicator): number | null {
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

  return null
}

/**
 * 计算进度百分比
 */
export function getProgressPercentage(current: number, target: number): number {
  if (target === 0) {return 0}
  return Math.min(100, Math.round((current / target) * 100))
}

/**
 * 批量计算指标状态
 */
export function calculateIndicatorStatuses(indicators: StrategicIndicator[]) {
  return indicators.map(indicator => ({
    indicator,
    status: getIndicatorStatus(indicator),
    currentTarget: getCurrentTargetProgress(indicator)
  }))
}
