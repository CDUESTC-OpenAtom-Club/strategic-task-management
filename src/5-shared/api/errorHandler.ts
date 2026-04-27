/**
 * 简化的错误处理器
 *
 * Phase 3 重构: 从 300+ 行简化到核心功能
 * 内部管理系统不需要复杂的错误分类系统
 */

import type { AxiosError } from 'axios'

interface RequestIdHeaderCarrier {
  headers?: Record<string, string>
  _requestId?: string
}

interface NormalizedErrorLike {
  message?: string
  code?: string | number
  status?: number
  retryable?: boolean
  requestId?: string
  severity?: 'low' | 'medium' | 'high'
}

interface AxiosErrorResponseData {
  message?: unknown
  code?: string | number
}

/**
 * 生成唯一的请求 ID
 */
export function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  // 降级方案
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * 为请求配置添加请求ID
 */
export function addRequestId(config: RequestIdHeaderCarrier): void {
  const requestId = generateRequestId()
  config.headers = config.headers || {}
  config.headers['X-Request-ID'] = requestId
  config._requestId = requestId
}

/**
 * 将未知值安全地转换为可读字符串
 */
export function stringifyMessage(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  try {
    const str = JSON.stringify(value)
    return str && str !== '{}' && str !== '[]' ? str : String(value)
  } catch {
    return String(value)
  }
}

/**
 * 格式化错误消息
 */
export function formatErrorMessage(error: unknown): string {
  // Axios 错误
  if (isAxiosError(error)) {
    const serverMessage = (error.response?.data as AxiosErrorResponseData | undefined)?.message
    if (serverMessage) {
      return stringifyMessage(serverMessage)
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

function isNormalizedErrorLike(error: unknown): error is NormalizedErrorLike {
  return typeof error === 'object' && error !== null
}

/**
 * 转换错误为扩展错误信息 (用于响应拦截器)
 */
export function transformError(error: unknown): {
  message: string
  code?: string
  status?: number
} {
  if (isAxiosError(error)) {
    const responseCode = (error.response?.data as AxiosErrorResponseData | undefined)?.code
    return {
      message: formatErrorMessage(error),
      code: typeof responseCode === 'string' ? responseCode : error.code,
      status: error.response?.status
    }
  }

  if (isNormalizedErrorLike(error)) {
    return {
      message: typeof error.message === 'string' ? error.message : '未知错误',
      code: typeof error.code === 'string' ? error.code : undefined,
      status: typeof error.status === 'number' ? error.status : undefined
    }
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: (error as Error & { code?: string }).code
    }
  }

  return {
    message: '未知错误'
  }
}

/**
 * 转换为扩展错误信息 (用于响应拦截器)
 */
export function toExtendedError(error: unknown): {
  message: string
  code?: string | number
  status?: number
  requestId?: string
  severity: 'low' | 'medium' | 'high'
  retryable?: boolean
}
export function toExtendedError(
  error: unknown,
  originalError?: unknown
): {
  message: string
  code?: string | number
  status?: number
  requestId?: string
  severity: 'low' | 'medium' | 'high'
  retryable?: boolean
} {
  const normalized = isNormalizedErrorLike(error) ? error : undefined
  const severity = normalized?.severity || getErrorSeverity(originalError ?? error)
  const message =
    typeof normalized?.message === 'string' && normalized.message
      ? normalized.message
      : formatErrorMessage(originalError ?? error)
  const requestId = normalized?.requestId || crypto.randomUUID?.() || Math.random().toString(36)

  return {
    message,
    code: normalized?.code,
    status: normalized?.status,
    severity,
    requestId,
    retryable:
      typeof normalized?.retryable === 'boolean'
        ? normalized.retryable
        : isRetryableError(originalError ?? error)
  }
}
