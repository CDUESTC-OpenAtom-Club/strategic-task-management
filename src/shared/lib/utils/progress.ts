/**
 * Progress Utility Functions
 *
 * Provides progress status calculation and color mapping
 */

export type ProgressStatus = 'normal' | 'warning' | 'danger' | 'success'

/**
 * Get progress status based on progress value
 * @param progress - Progress value (0-100)
 * @returns Progress status
 */
export function getProgressStatus(progress: number): ProgressStatus {
  if (progress >= 100) return 'success'
  if (progress < 30) return 'danger'
  if (progress < 60) return 'warning'
  return 'normal'
}

/**
 * Get progress color based on status
 * @param status - Progress status
 * @returns Color hex code
 */
export function getProgressColor(status: ProgressStatus): string {
  const colorMap: Record<ProgressStatus, string> = {
    success: '#67c23a',
    normal: '#409eff',
    warning: '#e6a23c',
    danger: '#f56c6c'
  }
  return colorMap[status]
}

/**
 * Get progress width as percentage string
 * @param progress - Progress value (0-100)
 * @returns Width percentage string
 */
export function getProgressWidth(progress: number): string {
  return `${Math.min(100, Math.max(0, progress))}%`
}

/**
 * Check if progress is complete
 * @param progress - Progress value (0-100)
 * @returns True if progress is 100 or more
 */
export function isProgressComplete(progress: number): boolean {
  return progress >= 100
}

/**
 * Check if progress is at risk (behind schedule)
 * @param progress - Current progress value (0-100)
 * @param expectedProgress - Expected progress value (0-100)
 * @returns True if progress is significantly behind expected
 */
export function isProgressAtRisk(progress: number, expectedProgress: number): boolean {
  return progress < expectedProgress - 10
}
