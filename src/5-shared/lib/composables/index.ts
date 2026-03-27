// @ts-nocheck
/**
 * Shared Library - Composables
 *
 * This is a unified export file for all composables.
 * All composables are organized in their respective feature directories.
 *
 * Migration Map:
 * - useECharts → @/shared/lib/charts
 * - useErrorHandler → @/shared/lib/error-handling
 * - useLoadingState → @/shared/lib/loading
 * - useTimeoutManager → @/shared/lib/timing
 * - usePermission → @/shared/lib/permissions
 * - useDataValidator → @/shared/lib/validation
 * - App layout composables → @/app/layouts
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
