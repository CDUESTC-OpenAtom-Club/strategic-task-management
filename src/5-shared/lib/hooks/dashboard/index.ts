/**
 * Dashboard Composables - Backward Compatibility Layer
 *
 * This file provides backward compatibility for imports from the old composables/dashboard/ directory.
 * useIndicatorStatus has been migrated to @/3-features/dashboard/model/.
 *
 * Migration Map:
 * - useIndicatorStatus → @/3-features/dashboard/model/useIndicatorStatus
 *
 * @deprecated Import from @/3-features/dashboard/model instead
 */

// Re-export from feature location
export {
  getIndicatorStatus,
  getStatusText,
  getStatusClass,
  getCurrentTargetProgress,
  getProgressPercentage,
  calculateIndicatorStatuses
} from '@/3-features/dashboard/model/useIndicatorStatus'

// Still exported from here (to be merged with store in future refactoring)
export { useDashboardState, STATUS_COLORS } from './useDashboardState'

export type { IndicatorStatus } from './useDashboardState'
