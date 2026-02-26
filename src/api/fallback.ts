/**
 * 前端数据降级服务
 *
 * ⚠️ 已禁用：现在所有数据都从后端真实数据库获取
 * 不再使用本地模拟数据，以确保数据的一致性和准确性
 *
 * 数据库连接：PostgreSQL @ 175.24.139.148:8386/strategic
 *
 * @deprecated 模拟数据已废弃，请使用后端API获取真实数据
 */
import type { AxiosError } from 'axios'
import type { ApiResponse } from '@/types'
import { logger } from '@/utils/logger'

/**
 * 降级配置
 */
export interface FallbackConfig {
  /** 是否启用降级（现在始终为 false） */
  enabled: boolean
  /** 强制使用模拟数据（现在始终为 false） */
  forceMock: boolean
}

/**
 * 获取降级配置
 */
export function getFallbackConfig(): FallbackConfig {
  return {
    enabled: false,  // 已禁用降级
    forceMock: false  // 已禁用强制模拟
  }
}

/**
 * 判断是否应该触发降级
 *
 * ⚠️ 现在始终返回 false，不再使用降级机制
 *
 * @param error Axios 错误对象
 * @returns 始终返回 false
 */
export function shouldFallback(error?: AxiosError | null): boolean {
  // 降级机制已禁用，所有数据从后端API获取
  return false
}

/**
 * 记录降级日志
 */
export function logFallback(url: string, reason: string): void {
  logger.warn(`[Fallback] 已禁用: ${url} - ${reason}`)
}

/**
 * 获取模拟数据
 *
 * ⚠️ 已废弃：现在所有数据都从后端真实数据库获取
 *
 * @returns 始终返回 null
 */
export function getMockData<T>(url: string): ApiResponse<T> | null {
  logger.warn(`[Fallback] 模拟数据已废弃，请使用后端API: ${url}`)
  return null
}

/**
 * 获取降级原因描述
 */
export function getFallbackReason(error?: AxiosError | null): string {
  if (!error) {
    return '降级机制已禁用'
  }

  if (!error.response) {
    return `网络错误: ${error.message || 'Network Error'}`
  }

  const status = error.response.status
  if (status >= 500) {
    return `服务器错误: HTTP ${status}`
  }

  return `请求失败: HTTP ${status}`
}

/**
 * 降级服务类
 *
 * ⚠️ 已禁用：现在所有数据都从后端真实数据库获取
 */
export class FallbackService {
  private config: FallbackConfig

  constructor() {
    this.config = getFallbackConfig()
  }

  /**
   * 判断是否应该降级
   */
  shouldFallback(error?: AxiosError | null): boolean {
    return false  // 降级已禁用
  }

  /**
   * 获取模拟数据
   */
  getMockData<T>(url: string): ApiResponse<T> | null {
    logger.warn(`[Fallback] 模拟数据已废弃: ${url}`)
    return null
  }

  /**
   * 记录降级日志
   */
  logFallback(url: string, reason: string): void {
    logger.warn(`[Fallback] 已禁用: ${url}`)
  }

  /**
   * 获取降级原因
   */
  getFallbackReason(error?: AxiosError | null): string {
    return getFallbackReason(error)
  }

  /**
   * 是否强制使用模拟数据
   */
  isForceMock(): boolean {
    return false  // 始终返回 false
  }
}

// 导出单例实例
export const fallbackService = new FallbackService()

export default fallbackService
