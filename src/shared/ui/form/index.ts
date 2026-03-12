/**
 * Form Components
 *
 * Reusable form components following FSD architecture
 * - DataForm: Generic data form component
 * - YearSelector: Year selection component
 * - DashboardFilters: Dashboard filter component
 * - IndicatorFillForm: Indicator fill form component
 * - IndicatorFillHistory: Indicator fill history component
 * - MilestoneTimeline: Milestone timeline component
 */

// Export form components here
export { default as DataForm } from './DataForm.vue'
export { default as YearSelector } from './YearSelector.vue'
export { default as DashboardFilters } from './DashboardFilters.vue'

// Indicator form components
export { default as IndicatorFillForm } from './indicator/IndicatorFillForm.vue'
export { default as IndicatorFillHistory } from './indicator/IndicatorFillHistory.vue'
export { default as MilestoneTimeline } from './indicator/MilestoneTimeline.vue'
