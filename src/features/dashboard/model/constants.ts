/**
 * Dashboard Feature - Constants
 *
 * Constants for dashboard feature.
 */

/**
 * Alert level thresholds
 */
export const ALERT_THRESHOLDS = {
  SEVERE: 30,
  MODERATE: 60,
  NORMAL: 100
} as const

/**
 * Progress status thresholds
 */
export const PROGRESS_STATUS = {
  EXCELLENT: 80,
  GOOD: 60,
  WARNING: 30,
  CRITICAL: 0
} as const

/**
 * Dashboard refresh intervals (in milliseconds)
 */
export const REFRESH_INTERVALS = {
  FAST: 30000,    // 30 seconds
  NORMAL: 60000,  // 1 minute
  SLOW: 300000    // 5 minutes
} as const

/**
 * Organization levels
 */
export const ORG_LEVELS = {
  STRATEGY: 'strategy',
  FUNCTIONAL: 'functional',
  COLLEGE: 'college'
} as const

/**
 * Drill-down levels
 */
export const DRILL_DOWN_LEVELS = {
  ORGANIZATION: 'organization',
  DEPARTMENT: 'department',
  INDICATOR: 'indicator'
} as const

/**
 * Chart colors
 */
export const CHART_COLORS = {
  SUCCESS: '#67C23A',
  WARNING: '#E6A23C',
  DANGER: '#F56C6C',
  INFO: '#409EFF',
  PRIMARY: '#409EFF'
} as const

/**
 * Secondary college suffixes
 */
export const COLLEGE_SUFFIXES = [
  '学院',
  '系',
  '中心',
  '实验室'
] as const

/**
 * Default dashboard settings
 */
export const DEFAULT_DASHBOARD_SETTINGS = {
  pageSize: 20,
  autoRefresh: true,
  refreshInterval: REFRESH_INTERVALS.NORMAL,
  showCharts: true,
  showActivities: true,
  showAlerts: true
} as const
