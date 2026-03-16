/**
 * Shared Services Layer
 *
 * 提供跨功能的业务逻辑服务
 * 遵循 FSD 架构原则，将业务逻辑从组件和 Store 中分离
 */

// Dashboard Services
export { DashboardDataService, useDashboardDataService } from './dashboard/DashboardDataService'
export {
  DashboardCalculationService,
  useDashboardCalculationService
} from './dashboard/DashboardCalculationService'

// Data Validation Services
export { PageDataChecker, pageDataChecker } from './pageDataChecker'
export type { DataIssue, PageCheckResult, CheckReport } from './pageDataChecker'

// Strategic Services (待添加)
// export { StrategicDataService, useStrategicDataService } from './strategic/StrategicDataService'
