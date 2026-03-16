/**
 * Milestone Intelligence Module
 * Barrel exports with explicit, tree-shake-friendly surface.
 */

// Re-export runtime constants and helpers explicitly
export { PROGRESS_WARNING_DAYS, UPCOMING_MILESTONE_DAYS, PROGRESS_STATUS_COLORS, MILESTONE_STATUS_COLORS, PROGRESS_STATUS_LABELS, MILESTONE_STATUS_LABELS } from './constants'

// Re-export types (type-only) and runtime helpers selectively to aid treeshaking
export type {
  ProgressStatusType,
  MilestoneStatusType,
  MilestoneCalculationOptions,
  MilestoneTooltipItem
} from './types'

export { calculateMilestoneStatus, getMilestoneProgressText, getIndicatorProgressStatus, getProgressStatusClass } from './milestoneStatusCalculator'
export { getMilestonesTooltip, getIndicatorMilestoneProgressText } from './milestoneTooltipBuilder'
