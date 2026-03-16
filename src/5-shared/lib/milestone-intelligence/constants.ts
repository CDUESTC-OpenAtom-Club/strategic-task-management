/**
 * Milestone Intelligence - Constants
 *
 * Constants used by the milestone intelligence module.
 */

import type { ProgressStatusType, MilestoneStatusType } from './types'

/**
 * Warning days threshold - number of days before a milestone deadline to show warning status
 */
export const PROGRESS_WARNING_DAYS = 5

/**
 * Upcoming milestone threshold - number of days to consider a milestone as upcoming
 */
export const UPCOMING_MILESTONE_DAYS = 30

/**
 * Status type colors for display
 */
export const PROGRESS_STATUS_COLORS: Record<ProgressStatusType, string> = {
  delayed: 'red',
  warning: 'yellow',
  ahead: 'green',
  normal: 'default'
}

/**
 * Milestone status colors for display
 */
export const MILESTONE_STATUS_COLORS: Record<MilestoneStatusType, string> = {
  success: 'green',
  warning: 'yellow',
  exception: 'red'
}

/**
 * Status type display labels
 */
export const PROGRESS_STATUS_LABELS: Record<ProgressStatusType, string> = {
  delayed: '延期',
  warning: '预警',
  ahead: '超前',
  normal: '正常'
}

/**
 * Milestone status display labels
 */
export const MILESTONE_STATUS_LABELS: Record<MilestoneStatusType, string> = {
  success: '正常',
  warning: '预警',
  exception: '逾期'
}
