/**
 * Utils 统一导出
 *
 * 本文件提供所有工具函数的统一入口
 * 支持按需导入和命名空间导入
 *
 * @module utils
 */

// ============================================================================
// 基础工具函数
// ============================================================================
export * from './formatters'

// ============================================================================
// 子模块重新导出
// ============================================================================

// 认证辅助函数
export * from './authHelpers'

// 数据映射器
export * from './dataMappers'

// 颜色工具
export { getColorByIndex, getGradientColor, isSecondaryCollege } from './colors'

// 日志工具
export { logger, type LogLevel } from './logger'

// 缓存工具
export {
  cacheManager,
  generateCacheKey,
  refreshCache,
  refreshCachePattern,
  getFromCache
} from './cache'

// 性能监控
export { performanceMonitor, recordApiLatency } from './performance'

// Token 管理
export { tokenManager, TokenRefreshError } from './tokenManager'

// ============================================================================
// 新增: 从 composables 移动过来的工具
// ============================================================================

export * from './timeoutManager'
