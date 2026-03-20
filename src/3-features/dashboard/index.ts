/**
 * Dashboard Feature Module
 *
 * 导出仪表板相关的所有公共API
 *
 * **Validates: Requirements 3.2, 3.5**
 */

// Views
export { default as DashboardView } from './ui/DashboardView.vue'
export { default as DashboardFilters } from './ui/DashboardFilters.vue'
export { default as DepartmentProgressChart } from './ui/DepartmentProgressChart.vue'

// Store
export { useDashboardStore } from './model/store'
