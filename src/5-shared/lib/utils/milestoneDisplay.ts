import type { MilestoneUI } from '@/shared/types'

export type MilestoneDisplayStatus = 'completed' | 'overdue' | 'pending'

export interface MilestoneDisplayState {
  status: MilestoneDisplayStatus
  label: '已完成' | '已逾期' | '进行中'
  tagType: 'success' | 'danger' | 'warning'
  timelineType: 'success' | 'danger' | 'primary'
  progressStatus: 'success' | 'exception' | ''
}

function normalizeDateValue(rawValue?: string): Date | null {
  if (!rawValue) {
    return null
  }

  const date = new Date(rawValue)
  return Number.isNaN(date.getTime()) ? null : date
}

export function resolveMilestoneDisplayState(
  milestone: MilestoneUI,
  currentProgress = 0,
  currentDate = new Date()
): MilestoneDisplayState {
  const normalizedProgress = Number.isFinite(Number(currentProgress))
    ? Number(currentProgress)
    : 0
  const targetProgress = Number.isFinite(Number(milestone.targetProgress))
    ? Number(milestone.targetProgress)
    : 0

  if (normalizedProgress >= targetProgress) {
    return {
      status: 'completed',
      label: '已完成',
      tagType: 'success',
      timelineType: 'success',
      progressStatus: 'success'
    }
  }

  const deadline = normalizeDateValue(milestone.deadline)
  if (deadline) {
    const endOfDeadline = new Date(deadline)
    endOfDeadline.setHours(23, 59, 59, 999)
    if (currentDate.getTime() > endOfDeadline.getTime()) {
      return {
        status: 'overdue',
        label: '已逾期',
        tagType: 'danger',
        timelineType: 'danger',
        progressStatus: 'exception'
      }
    }
  }

  return {
    status: 'pending',
    label: '进行中',
    tagType: 'warning',
    timelineType: 'primary',
    progressStatus: ''
  }
}
