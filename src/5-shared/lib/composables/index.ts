/**
 * Shared Library - Composables
 *
 * This is a unified export file for all composables.
 * All composables are organized in their respective feature directories.
 *
 * Migration Map:
 * - useECharts → @/5-shared/lib/charts
 * - useErrorHandler → @/5-shared/lib/error-handling
 * - useLoadingState → @/5-shared/lib/loading
 * - useTimeoutManager → @/5-shared/lib/timing
 * - usePermission → @/5-shared/lib/authorization
 * - useDataValidator → @/5-shared/lib/validation
 * - Layout composables → @/5-shared/lib/layout
 *
 * @deprecated Import from the specific directory instead
 */

// Re-export from feature-specific directories
export * from '../charts'
export * from '../error-handling'
export * from '../loading'
export * from '../timing'
export * from '../authorization'
export * from '../validation'
export * from '../layout'
