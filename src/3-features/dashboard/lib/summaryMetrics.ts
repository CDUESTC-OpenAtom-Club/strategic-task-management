import type { DashboardData, Indicator } from '@/shared/types'

export type DashboardIndicatorStatus = 'normal' | 'ahead' | 'warning' | 'delayed'

type NormalizedMilestone = {
  dueDate: Date
  targetProgress: number
}

const parseMilestones = (indicator: Indicator): NormalizedMilestone[] => {
  const rawMilestones = Array.isArray(indicator.milestones) ? indicator.milestones : []

  return rawMilestones
    .map(milestone => {
      const record = milestone as Record<string, unknown>
      const rawDate = record.dueDate ?? record.targetDate ?? record.deadline
      const rawTarget =
        record.targetProgress ?? record.progressTarget ?? record.target ?? record.expectedProgress

      const dueDate = rawDate ? new Date(String(rawDate)) : null
      const targetProgress = Number(rawTarget)

      if (!dueDate || Number.isNaN(dueDate.getTime()) || !Number.isFinite(targetProgress)) {
        return null
      }

      dueDate.setHours(23, 59, 59, 999)

      return {
        dueDate,
        targetProgress
      }
    })
    .filter((milestone): milestone is NormalizedMilestone => milestone !== null)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
}

export const getIndicatorStatusAtMonth = (
  indicator: Indicator,
  month: number,
  year: number
): DashboardIndicatorStatus => {
  const milestones = parseMilestones(indicator)
  if (milestones.length === 0) {
    return 'normal'
  }

  const monthEnd = new Date(year, month, 0)
  monthEnd.setHours(23, 59, 59, 999)

  const milestonesUpToMonth = milestones.filter(milestone => milestone.dueDate <= monthEnd)
  if (milestonesUpToMonth.length === 0) {
    return 'normal'
  }

  const currentProgress = Number(indicator.progress ?? 0)

  for (const milestone of milestonesUpToMonth) {
    if (milestone.dueDate < monthEnd && currentProgress < milestone.targetProgress) {
      return 'delayed'
    }
  }

  const lastMilestoneInMonth = milestonesUpToMonth[milestonesUpToMonth.length - 1]
  if (currentProgress >= lastMilestoneInMonth.targetProgress) {
    return 'ahead'
  }

  return 'warning'
}

export const buildDashboardSummary = (
  indicators: Indicator[],
  month: number,
  year: number
): DashboardData => {
  const totalIndicators = indicators.length
  const basicIndicators = indicators.filter(i => i.type2 === '基础性')
  const developmentIndicators = indicators.filter(i => i.type2 === '发展性')

  const basicScore =
    basicIndicators.length > 0
      ? Math.round(
          basicIndicators.reduce((sum, i) => sum + Number(i.progress ?? 0), 0) /
            basicIndicators.length
        )
      : 0
  const developmentScore =
    developmentIndicators.length > 0
      ? Math.round(
          (developmentIndicators.reduce((sum, i) => sum + Number(i.progress ?? 0), 0) /
            developmentIndicators.length) *
            0.2
        )
      : 0

  const statusCounts = indicators.reduce(
    (counts, indicator) => {
      const status = getIndicatorStatusAtMonth(indicator, month, year)
      counts[status] += 1
      return counts
    },
    {
      ahead: 0,
      normal: 0,
      warning: 0,
      delayed: 0
    }
  )

  const completedIndicators = statusCounts.ahead + statusCounts.normal
  const warningCount = statusCounts.warning + statusCounts.delayed

  return {
    totalScore: basicScore + developmentScore,
    basicScore,
    developmentScore,
    completionRate:
      totalIndicators > 0 ? Math.round((completedIndicators / totalIndicators) * 100) : 0,
    warningCount,
    totalIndicators,
    completedIndicators,
    alertIndicators: {
      severe: statusCounts.delayed,
      moderate: statusCounts.warning,
      normal: statusCounts.ahead + statusCounts.normal
    }
  }
}
