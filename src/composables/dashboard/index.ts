/**
 * Dashboard Composables 统一导出
 *
 * @module composables/dashboard
 */

export { useDashboardState, STATUS_COLORS } from './useDashboardState'
export {
  getIndicatorStatus,
  getStatusText,
  getStatusClass,
  getCurrentTargetProgress,
  getProgressPercentage,
  calculateIndicatorStatuses
} from './useIndicatorStatus'

export type { IndicatorStatus } from './useDashboardState'
