/**
 * Milestone Intelligence Module
 *
 * Provides intelligent milestone management capabilities for indicators.
 *
 * Features:
 * - Milestone status calculation
 * - Indicator progress analysis
 * - Tooltip data generation
 * - Date formatting and validation
 *
 * Usage:
 * ```typescript
 * import {
 *   calculateMilestoneStatus,
 *   getIndicatorProgressStatus,
 *   getMilestonesTooltip,
 *   getMilestoneProgressText
 * } from '@/shared/lib/milestone-intelligence'
 *
 * const status = calculateMilestoneStatus(indicator)
 * const tooltip = getMilestonesTooltip(indicator)
 * ```
 */

// Type definitions
export * from './types'

// Constants
export * from './constants'

// Status calculator
export {
  calculateMilestoneStatus,
  getMilestoneProgressText,
  getIndicatorProgressStatus,
  getProgressStatusClass
} from './milestoneStatusCalculator'

// Tooltip builder
export { getMilestonesTooltip, getIndicatorMilestoneProgressText } from './milestoneTooltipBuilder'
