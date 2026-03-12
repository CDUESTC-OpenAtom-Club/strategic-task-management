/**
 * Shared Module
 *
 * 导出所有共享的工具、组件和API
 * Following FSD (Feature-Sliced Design) architecture
 *
 * **Validates: Requirements 3.3**
 */

// API Client (existing)
export { ApiClient, apiClient } from './api/client'
export type { ApiClientConfig, AppError } from './api/client'

// Components (existing - from components/)
export { default as BreadcrumbNav } from './components/BreadcrumbNav.vue'
export { default as DashboardFilters } from './components/DashboardFilters.vue'
export { default as DataForm } from './components/DataForm.vue'
export { default as DataTable } from './components/DataTable.vue'
export { default as EmptyState } from './components/EmptyState.vue'
export { default as HelpTooltip } from './components/HelpTooltip.vue'
export { default as SkeletonLoader } from './components/SkeletonLoader.vue'
export { default as TransitionWrapper } from './components/TransitionWrapper.vue'
export { default as YearSelector } from './components/YearSelector.vue'

// FSD Architecture - New Structure
// UI Components (organized by category)
export * from './ui'

// Shared Libraries
export * from './lib'

// Type Definitions
export * from './types'

// Configuration
export * from './config'
