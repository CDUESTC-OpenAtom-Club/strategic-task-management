/**
 * Milestone Intelligence - Types
 *
 * Type definitions for the milestone intelligence module.
 * This module provides smart milestone management capabilities.
 */

import type { StrategicIndicator, Milestone } from '@/shared/types'

/**
 * Progress status types for indicators based on milestones
 */
export type ProgressStatusType = 'delayed' | 'warning' | 'ahead' | 'normal'

/**
 * Milestone status types for overall indicator status
 */
export type MilestoneStatusType = 'success' | 'warning' | 'exception'

/**
 * Milestone status values used by the frontend milestone UI and validation rules.
 * Aligns with backend MilestoneStatus enum: pending/completed/overdue
 */
export type MilestoneStatusValue = 'pending' | 'completed' | 'overdue'

/**
 * Milestone tooltip item for display
 */
export interface MilestoneTooltipItem {
  id: string | number
  name: string
  expectedDate: string
  progress: number
  status: MilestoneStatusValue
  isValid: boolean
}

/**
 * Options for milestone calculation
 */
export interface MilestoneCalculationOptions {
  /**
   * Number of days to consider for warning threshold
   * @default 5
   */
  warningDaysThreshold?: number

  /**
   * Number of days to consider for upcoming threshold
   * @default 30
   */
  upcomingDaysThreshold?: number
}

/**
 * Type guard to check if an object has milestones
 */
export function hasMilestones(
  indicator: StrategicIndicator
): indicator is StrategicIndicator & { milestones: Milestone[] } {
  return Array.isArray(indicator.milestones) && indicator.milestones.length > 0
}
