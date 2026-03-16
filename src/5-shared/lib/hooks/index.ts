/**
 * Composables Module
 *
 * Vue 3 Composition API composables for reactive state management.
 *
 * Note: Pure utility functions have been moved to shared/lib/:
 * - useDataValidator → @/5-shared/lib/validation/dataValidator
 * - useTimeoutManager → @/5-shared/lib/utils/timeoutManager
 */

// Dashboard composables (feature-specific)
export * from './dashboard'

// Layout composables
export * from './layout'

// General Vue composables
export { useErrorHandler } from './useErrorHandler'
export { useLoadingState } from './useLoadingState'
export { usePermission } from './usePermission'
export { useECharts } from './useECharts'
