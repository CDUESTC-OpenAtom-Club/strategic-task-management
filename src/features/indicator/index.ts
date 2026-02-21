/**
 * Indicator Feature Module
 *
 * 导出指标相关的所有公共API
 *
 * **Validates: Requirements 3.2, 3.5**
 */

// API
export { indicatorApi } from './api/indicatorApi'
export { milestoneApi } from './api/milestoneApi'
export type {
  IndicatorVO,
  IndicatorCreateRequest,
  MilestoneVO
} from './api/indicatorApi'

// Views
export { default as IndicatorDistributionView } from './views/IndicatorDistributionView.vue'
export { default as IndicatorFillView } from './views/IndicatorFillView.vue'
export { default as IndicatorListView } from './views/IndicatorListView.vue'

// Components
export { default as IndicatorDetailDialog } from './components/IndicatorDetailDialog.vue'
export { default as IndicatorFillForm } from './components/IndicatorFillForm.vue'
export { default as IndicatorFillHistory } from './components/IndicatorFillHistory.vue'
export { default as MilestoneTimeline } from './components/MilestoneTimeline.vue'
