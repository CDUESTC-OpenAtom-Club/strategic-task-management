/**
 * Milestone Intelligence - Status Calculator
 *
 * Calculates milestone and indicator progress status based on milestone data.
 */

import type { StrategicIndicator } from '@/shared/types'
import type { ProgressStatusType, MilestoneStatusType, MilestoneCalculationOptions } from './types'
import { PROGRESS_WARNING_DAYS, UPCOMING_MILESTONE_DAYS } from './constants'
import { safeGet } from '@/shared/lib/validation/dataValidator'

/**
 * Calculates overall milestone status of an indicator
 *
 * @param indicator The indicator to evaluate
 * @param options Calculation options
 * @returns Milestone status type
 */
export function calculateMilestoneStatus(
  indicator: StrategicIndicator,
  options?: MilestoneCalculationOptions
): MilestoneStatusType {
  const { upcomingDaysThreshold = UPCOMING_MILESTONE_DAYS } = options || {}

  if (!indicator.milestones || indicator.milestones.length === 0) {
    return 'success'
  }

  const currentDate = new Date()

  const hasOverdueMilestone = indicator.milestones.some(milestone => {
    const deadline = safeGet(milestone, 'deadline', '')
    const status = safeGet(milestone, 'status', 'pending')

    if (!deadline) {
      return false
    }

    const deadlineDate = new Date(deadline)
    if (isNaN(deadlineDate.getTime())) {
      return false
    }

    return status === 'pending' && deadlineDate < currentDate
  })

  const hasUpcomingMilestone = indicator.milestones.some(milestone => {
    const status = safeGet(milestone, 'status', 'pending')
    const deadline = safeGet(milestone, 'deadline', '')

    if (status === 'completed') {
      return false
    }

    if (!deadline) {
      return false
    }

    const deadlineDate = new Date(deadline)
    if (isNaN(deadlineDate.getTime())) {
      return false
    }

    const daysUntilDeadline = Math.ceil(
      (deadlineDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    return daysUntilDeadline > 0 && daysUntilDeadline <= upcomingDaysThreshold
  })

  if (hasOverdueMilestone) {
    return 'exception'
  } else if (hasUpcomingMilestone) {
    return 'warning'
  } else {
    return 'success'
  }
}

/**
 * Gets milestone progress text description
 *
 * @param indicator The indicator to evaluate
 * @returns Progress text description
 */
export function getMilestoneProgressText(indicator: StrategicIndicator): string {
  if (!indicator.milestones || indicator.milestones.length === 0) {
    return `当前进度: ${indicator.progress}%`
  }

  const pendingMilestones = indicator.milestones.filter(m => {
    const status = safeGet(m, 'status', 'pending')
    return status === 'pending'
  }).length

  const currentDate = new Date()
  const overdueMilestonesCount = indicator.milestones.filter(m => {
    const status = safeGet(m, 'status', 'pending')
    const deadline = safeGet(m, 'deadline', '')

    if (status !== 'pending') {
      return false
    }

    if (!deadline) {
      return false
    }

    const deadlineDate = new Date(deadline)
    if (isNaN(deadlineDate.getTime())) {
      return false
    }

    return deadlineDate < currentDate
  }).length

  if (overdueMilestonesCount > 0) {
    return `逾期: ${overdueMilestonesCount} 个里程碑`
  } else if (pendingMilestones > 0) {
    return `待完成: ${pendingMilestones} 个里程碑`
  } else {
    return '所有里程碑已完成'
  }
}

/**
 * Calculates detailed indicator progress status based on milestones
 *
 * @param indicator The indicator to evaluate
 * @param options Calculation options
 * @returns Progress status type
 */
export function getIndicatorProgressStatus(
  indicator: StrategicIndicator,
  options?: MilestoneCalculationOptions
): ProgressStatusType {
  const { warningDaysThreshold = PROGRESS_WARNING_DAYS } = options || {}

  const milestones = indicator.milestones || []
  if (milestones.length === 0) {
    return 'normal'
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const currentProgress = indicator.progress || 0

  const validMilestones = milestones.filter(m => {
    const deadline = safeGet(m, 'deadline', '')
    if (!deadline) {
      return false
    }

    const date = new Date(deadline)
    return !isNaN(date.getTime())
  })

  if (validMilestones.length === 0) {
    return 'normal'
  }

  const sortedMilestones = [...validMilestones].sort((a, b) => {
    const deadlineA = safeGet(a, 'deadline', '')
    const deadlineB = safeGet(b, 'deadline', '')
    return new Date(deadlineA).getTime() - new Date(deadlineB).getTime()
  })

  for (const milestone of sortedMilestones) {
    const deadline = safeGet(milestone, 'deadline', '')
    const targetProgress = safeGet(milestone, 'targetProgress', 0)

    const deadlineDate = new Date(deadline)
    deadlineDate.setHours(23, 59, 59, 999)

    if (deadlineDate < today && currentProgress < targetProgress) {
      return 'delayed'
    }
  }

  const nextMilestone = sortedMilestones.find(m => {
    const deadline = safeGet(m, 'deadline', '')
    const deadlineDate = new Date(deadline)
    deadlineDate.setHours(23, 59, 59, 999)
    return deadlineDate >= today
  })

  if (!nextMilestone) {
    const lastMilestone = sortedMilestones[sortedMilestones.length - 1]
    const lastTargetProgress = safeGet(lastMilestone, 'targetProgress', 0)
    if (lastMilestone && currentProgress >= lastTargetProgress) {
      return 'ahead'
    }
    return 'normal'
  }

  const nextTargetProgress = safeGet(nextMilestone, 'targetProgress', 0)
  if (currentProgress >= nextTargetProgress) {
    return 'ahead'
  }

  const nextDeadline = new Date(safeGet(nextMilestone, 'deadline', ''))
  nextDeadline.setHours(23, 59, 59, 999)
  const daysUntilDeadline = Math.ceil(
    (nextDeadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (daysUntilDeadline <= warningDaysThreshold && currentProgress < nextTargetProgress) {
    return 'warning'
  }

  return 'normal'
}

/**
 * Gets CSS class name for progress status
 *
 * @param indicator The indicator to evaluate
 * @param options Calculation options
 * @returns CSS class name
 */
export function getProgressStatusClass(
  indicator: StrategicIndicator,
  options?: MilestoneCalculationOptions
): string {
  const status = getIndicatorProgressStatus(indicator, options)
  const classMap: Record<ProgressStatusType, string> = {
    delayed: 'progress-delayed',
    warning: 'progress-warning',
    ahead: 'progress-ahead',
    normal: ''
  }

  return classMap[status]
}
