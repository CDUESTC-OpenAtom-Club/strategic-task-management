/**
 * Composables Module - Backward Compatibility Layer
 *
 * This file provides backward compatibility for imports from the old composables directory.
 * All composables have been migrated to their appropriate FSD locations.
 *
 * Migration Map:
 * - useECharts → @/shared/lib/charts/useECharts
 * - useErrorHandler → @/shared/lib/error-handling/useErrorHandler
 * - useDataValidator → @/shared/lib/validation/useDataValidator
 * - useLoadingState → @/shared/lib/loading/useLoadingState
 * - usePermission → @/shared/lib/authorization/usePermission
 * - useTimeoutManager → @/shared/lib/timing/useTimeoutManager
 *
 * @deprecated Import from the new FSD locations instead
 */

// Charts
export * from '@/shared/lib/charts'

// Error handling
export * from '@/shared/lib/error-handling'

// Validation
export { useDataValidator } from '@/shared/lib/validation/useDataValidator'

// Loading state
export * from '@/shared/lib/loading'

// Authorization
export * from '@/shared/lib/authorization'

// Timing
export * from '@/shared/lib/timing'

// Dashboard composables (feature-specific, to be migrated in Phase 2)
export * from './dashboard'

// Layout composables (to be migrated in Phase 2)
export * from './layout'
