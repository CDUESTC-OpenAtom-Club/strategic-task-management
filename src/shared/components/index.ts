/**
 * Common Components 统一导出
 *
 * @module components/common
 */

// 通用表格组件
export { default as DataTable } from './DataTable.vue'
export type { TableColumn, PaginationConfig } from './DataTable.vue'

// 通用表单组件
export { default as DataForm } from './DataForm.vue'
export type { FormField, FormAction } from './DataForm.vue'

// 骨架屏组件
export { default as SkeletonLoader } from './SkeletonLoader.vue'

// 过渡动画组件
export { default as TransitionWrapper } from './TransitionWrapper.vue'

// 空状态组件
export { default as EmptyState } from './EmptyState.vue'

// 年份选择器
export { default as YearSelector } from './YearSelector.vue'

// 面包屑导航
export { default as BreadcrumbNav } from './BreadcrumbNav.vue'

// 筛选组件
export { default as DashboardFilters } from './DashboardFilters.vue'

// 帮助提示
export { default as HelpTooltip } from './HelpTooltip.vue'
