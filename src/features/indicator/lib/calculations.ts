/**
 * Strategic Indicator Feature - Calculation Logic
 *
 * Business calculations for indicators (completion rate, weight validation, etc.)
 */

import type { Indicator } from '@/entities/indicator/model/types'

/**
 * Calculate completion rate
 *
 * @param targetValue - Target value
 * @param actualValue - Actual value
 * @returns Completion rate percentage (0-100)
 */
export function calculateCompletionRate(
  targetValue: number | undefined,
  actualValue: number | undefined
): number {
  if (!targetValue || targetValue === 0) {
    return 0
  }

  if (!actualValue) {
    return 0
  }

  return Math.min((actualValue / targetValue) * 100, 100)
}

/**
 * Calculate weighted completion rate for multiple indicators
 *
 * @param indicators - List of indicators with weights
 * @returns Weighted average completion rate
 */
export function calculateWeightedCompletionRate(indicators: Indicator[]): number {
  let totalWeight = 0
  let weightedSum = 0

  indicators.forEach(indicator => {
    const weight = indicator.weight || 0
    const completionRate = calculateCompletionRate(indicator.targetValue, indicator.actualValue)

    totalWeight += weight
    weightedSum += completionRate * weight
  })

  if (totalWeight === 0) {
    return 0
  }

  return weightedSum / totalWeight
}

/**
 * Validate that weights sum to 1.0 (or 100%)
 *
 * @param indicators - List of indicators with weights
 * @param tolerance - Acceptable tolerance (default 0.01)
 * @returns True if weights are valid
 */
export function validateWeightSum(indicators: Indicator[], tolerance: number = 0.01): boolean {
  const totalWeight = indicators.reduce((sum, indicator) => sum + (indicator.weight || 0), 0)

  return Math.abs(totalWeight - 1.0) <= tolerance
}

/**
 * Calculate remaining weight available
 *
 * @param indicators - List of indicators with weights
 * @returns Remaining weight (0-1)
 */
export function calculateRemainingWeight(indicators: Indicator[]): number {
  const totalWeight = indicators.reduce((sum, indicator) => sum + (indicator.weight || 0), 0)

  return Math.max(1.0 - totalWeight, 0)
}

/**
 * Normalize weights to sum to 1.0
 *
 * @param indicators - List of indicators with weights
 * @returns Indicators with normalized weights
 */
export function normalizeWeights(indicators: Indicator[]): Indicator[] {
  const totalWeight = indicators.reduce((sum, indicator) => sum + (indicator.weight || 0), 0)

  if (totalWeight === 0) {
    // Equal distribution
    const equalWeight = 1.0 / indicators.length
    return indicators.map(indicator => ({
      ...indicator,
      weight: equalWeight
    }))
  }

  // Proportional normalization
  return indicators.map(indicator => ({
    ...indicator,
    weight: (indicator.weight || 0) / totalWeight
  }))
}

/**
 * Calculate progress percentage
 *
 * @param current - Current value
 * @param target - Target value
 * @returns Progress percentage (0-100)
 */
export function calculateProgress(current: number | undefined, target: number | undefined): number {
  if (!target || target === 0) {
    return 0
  }

  if (!current) {
    return 0
  }

  return Math.min((current / target) * 100, 100)
}

/**
 * Format weight as percentage
 *
 * @param weight - Weight value (0-1)
 * @param precision - Decimal places (default 1)
 * @returns Formatted percentage string
 */
export function formatWeightAsPercentage(
  weight: number | undefined,
  precision: number = 1
): string {
  if (weight === undefined) {
    return '0%'
  }

  return `${(weight * 100).toFixed(precision)}%`
}

/**
 * Calculate aggregate statistics for indicators
 *
 * @param indicators - List of indicators
 * @returns Aggregate statistics
 */
export function calculateAggregateStatistics(indicators: Indicator[]): {
  totalCount: number
  completedCount: number
  averageCompletion: number
  totalWeight: number
  weightedCompletion: number
} {
  const totalCount = indicators.length
  const completedCount = indicators.filter(i => (i.completionRate || 0) >= 100).length

  const totalCompletion = indicators.reduce((sum, i) => sum + (i.completionRate || 0), 0)
  const averageCompletion = totalCount > 0 ? totalCompletion / totalCount : 0

  const totalWeight = indicators.reduce((sum, i) => sum + (i.weight || 0), 0)

  const weightedCompletion = calculateWeightedCompletionRate(indicators)

  return {
    totalCount,
    completedCount,
    averageCompletion,
    totalWeight,
    weightedCompletion
  }
}
