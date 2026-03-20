/**
 * Dashboard Composables - Backward Compatibility Layer
 *
 * This file provides backward compatibility for imports from the old composables/dashboard/ directory.
 * Shared-safe dashboard helpers exported from this directory.
 *
 * Migration Map:
 * - useIndicatorStatus → @/shared/lib/hooks/dashboard/useIndicatorStatus
 *
 * @deprecated Import from the concrete file instead
 */

export {
  getIndicatorStatus,
  getStatusText,
  getStatusClass,
  getCurrentTargetProgress,
  getProgressPercentage,
  calculateIndicatorStatuses
} from './useIndicatorStatus'

export { useDashboardState, STATUS_COLORS } from './useDashboardState'

export type { IndicatorStatus } from './useDashboardState'
