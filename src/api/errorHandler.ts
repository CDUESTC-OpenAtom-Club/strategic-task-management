/**
 * 简化的错误处理器
 *
 * Phase 3 重构: 从 300+ 行简化到核心功能
 * 内部管理系统不需要复杂的错误分类系统
 */

import type { AxiosError } from 'axios'

/**
 * 生成唯一的请求 ID
 */
export function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  // 降级方案
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * 格式化错误消息
 */
export function formatErrorMessage(error: unknown): string {
  // Axios 错误
  if (isAxiosError(error)) {
    const serverMessage = error.response?.data?.message
    if (serverMessage) {
      return serverMessage
    }

    // 网络错误
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return '请求超时,请检查网络连接'
    }

    if (!error.response) {
      return '网络连接失败,请检查网络'
    }

    // HTTP 错误
    switch (error.response.status) {
      case 400:
        return '请求参数错误'
      case 401:
        return '未授权,请重新登录'
      case 403:
        return '没有权限访问'
      case 404:
        return '请求的资源不存在'
      case 500:
        return '服务器内部错误'
      case 502:
      case 503:
      case 504:
        return '服务暂时不可用,请稍后重试'
      default:
        return `请求失败 (${error.response.status})`
    }
  }

  // 其他错误
  if (error instanceof Error) {
    return error.message
  }

  return '未知错误'
}

/**
 * 判断是否可重试的错误
 */
export function isRetryableError(error: unknown): boolean {
  if (!isAxiosError(error)) {
    return false
  }

  // 网络错误可以重试
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return true
  }

  // 5xx 服务器错误可以重试
  if (error.response && error.response.status >= 500) {
    return true
  }

  return false
}

/**
 * 获取错误严重程度
 */
export function getErrorSeverity(error: unknown): 'low' | 'medium' | 'high' {
  if (!isAxiosError(error)) {
    return 'medium'
  }

  // 网络错误 - 高严重度
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return 'high'
  }

  if (!error.response) {
    return 'high'
  }

  // 4xx 客户端错误 - 低严重度
  if (error.response.status >= 400 && error.response.status < 500) {
    return 'low'
  }

  // 5xx 服务器错误 - 高严重度
  if (error.response.status >= 500) {
    return 'high'
  }

  return 'medium'
}

/**
 * 类型守卫: 检查是否为 Axios 错误
 */
function isAxiosError(error: unknown): error is AxiosError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    (error as AxiosError).isAxiosError === true
  )
}

/**
 * 转换错误为扩展错误信息 (用于响应拦截器)
 */
export function transformError(error: unknown): { message: string; code?: string; status?: number } {
  if (isAxiosError(error)) {
    return {
      message: formatErrorMessage(error),
      code: error.code,
      status: error.response?.status
    }
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: (error as any).code
    }
  }

  return {
    message: '未知错误'
  }
}

/**
 * 转换为扩展错误信息 (用于响应拦截器)
 */
export function toExtendedError(error: unknown): { message: string; requestId?: string; severity: 'low' | 'medium' | 'high' } {
  const severity = getErrorSeverity(error)
  const message = formatErrorMessage(error)

  return {
    message,
    severity,
    requestId: crypto.randomUUID?.() || Math.random().toString(36)
  }
}
