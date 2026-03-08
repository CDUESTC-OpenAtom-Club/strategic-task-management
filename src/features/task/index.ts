/**
 * Task Feature Module
 *
 * 导出任务(战略任务)相关的所有公共API
 *
 * **Validates: Requirements 3.2, 3.5**
 */

// API
export { strategicApi } from './api/strategicApi'
/* eslint-disable no-restricted-syntax -- Backend VO types use strategic_task terminology */
export type {
  StrategicTaskVO,
  IndicatorVO,
  MilestoneVO,
  AssessmentCycleVO
} from './api/strategicApi'
/* eslint-enable no-restricted-syntax */
