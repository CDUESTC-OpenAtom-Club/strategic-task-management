/**
 * API Error Handler
 *
 * Centralized error handling with:
 * - Error type detection
 * - Error message formatting
 * - Error severity classification
 * - Retry condition checking
 */

import type { AxiosError } from 'axios'

interface ApiErrorPayload {
  message?: string
  code?: string | number
}

type ApiErrorCode = string | number

/**
 * API Error interface
 */
export interface ApiError {
  /** Error message */
  message: string
  /** Error code (backend code or fallback network code) */
  code?: ApiErrorCode
  /** HTTP status code */
  status?: number
  /** Additional error details */
  details?: unknown
  /** Error severity level */
  severity?: 'low' | 'medium' | 'high'
  /** Whether the error is retryable */
  retryable?: boolean
  /** Request ID for tracking */
  requestId?: string
}

/**
 * Handle API errors and transform to unified format
 */
export function handleApiError(error: AxiosError): ApiError {
  const requestIdHeader = error.config?.headers?.['X-Request-ID']
  const requestId = typeof requestIdHeader === 'string' ? requestIdHeader : undefined

  // Server responded with error status
  if (error.response) {
    const status = error.response.status
    const responseData = error.response.data as ApiErrorPayload | undefined
    const serverMessage = responseData?.message
    const serverCode = responseData?.code

    return {
      message: typeof serverMessage === 'string' ? serverMessage : getDefaultErrorMessage(status),
      code: serverCode ?? error.code,
      status,
      details: error.response.data,
      severity: getErrorSeverity(error),
      retryable: isRetryableError(error),
      requestId
    }
  }

  // Request made but no response (network error)
  if (error.request) {
    return {
      message: getNetworkErrorMessage(error),
      code: error.code || 'NETWORK_ERROR',
      severity: 'high',
      retryable: true,
      requestId
    }
  }

  // Error in request setup
  return {
    message: error.message || '请求失败',
    code: error.code || 'REQUEST_ERROR',
    severity: 'medium',
    retryable: false,
    requestId
  }
}

/**
 * Get default error message based on HTTP status code
 */
function getDefaultErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return '请求参数错误'
    case 401:
      return '未授权，请重新登录'
    case 403:
      return '没有权限访问'
    case 404:
      return '请求的资源不存在'
    case 408:
      return '请求超时'
    case 409:
      return '请求冲突'
    case 422:
      return '请求参数验证失败'
    case 429:
      return '请求过于频繁，请稍后重试'
    case 500:
      return '服务器内部错误'
    case 502:
      return '网关错误'
    case 503:
      return '服务暂时不可用'
    case 504:
      return '网关超时'
    default:
      return `请求失败 (${status})`
  }
}

/**
 * Get network error message
 */
function getNetworkErrorMessage(error: AxiosError): string {
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return '请求超时，请检查网络连接'
  }

  if (error.code === 'ERR_NETWORK') {
    return '网络连接失败，请检查网络'
  }

  if (error.message?.includes('timeout')) {
    return '请求超时，请稍后重试'
  }

  return '网络连接失败，请检查网络'
}

/**
 * Get error severity level
 */
function getErrorSeverity(error: AxiosError): 'low' | 'medium' | 'high' {
  // Network errors - high severity
  if (!error.response) {
    return 'high'
  }

  const status = error.response.status

  // 4xx client errors - low severity (user can fix)
  if (status >= 400 && status < 500) {
    // Auth errors are medium severity
    if (status === 401 || status === 403) {
      return 'medium'
    }
    return 'low'
  }

  // 5xx server errors - high severity
  if (status >= 500) {
    return 'high'
  }

  return 'medium'
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: AxiosError): boolean {
  // Network errors are retryable
  if (!error.response) {
    return true
  }

  const status = error.response.status

  // 5xx server errors are retryable
  if (status >= 500) {
    return true
  }

  // 408 Request Timeout is retryable
  if (status === 408) {
    return true
  }

  // 429 Too Many Requests is retryable (after delay)
  if (status === 429) {
    return true
  }

  // Other errors are not retryable
  return false
}

/**
 * Check if error is network error
 */
export function isNetworkError(error: AxiosError): boolean {
  return !error.response && Boolean(error.request)
}

/**
 * Check if error is server error (5xx)
 */
export function isServerError(error: AxiosError): boolean {
  const status = error.response?.status
  return status !== undefined && status >= 500 && status < 600
}

/**
 * Check if error is client error (4xx)
 */
export function isClientError(error: AxiosError): boolean {
  const status = error.response?.status
  return status !== undefined && status >= 400 && status < 500
}

/**
 * Check if error is authentication error
 */
export function isAuthError(error: AxiosError): boolean {
  const status = error.response?.status
  return status === 401 || status === 403
}

/**
 * Format error message for display
 */
export function formatErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const apiError = handleApiError(error)
    return apiError.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return '未知错误'
}

/**
 * Type guard: check if error is Axios error
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
 * Check if error is API error
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as ApiError).message === 'string'
  )
}
