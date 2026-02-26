/**
 * Task Feature Module
 *
 * 导出任务(战略任务)相关的所有公共API
 *
 * **Validates: Requirements 3.2, 3.5**
 */

// API
export { strategicApi } from './api/strategicApi'
export type {
  StrategicTaskVO,
  IndicatorVO,
  MilestoneVO,
  AssessmentCycleVO
} from './api/strategicApi'
