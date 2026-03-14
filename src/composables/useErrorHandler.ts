/**
 * 错误处理组合式函数
 * 
 * 提供统一的错误处理能力，包括API错误处理、友好消息显示、错误日志记录
 * 
 * @requirements 2.5 - If indicator data is missing required fields, Error_Handler SHALL log error and show friendly prompt
 * @requirements 10.3 - When network error occurs, Error_Handler SHALL show network error prompt
 * @requirements 10.4 - When data loading fails, Error_Handler SHALL show error details and suggested actions
 */

import { ref, type Ref } from 'vue'
import { ElMessage } from 'element-plus'

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 错误信息
 */
export interface ErrorInfo {
  /** 错误代码 */
  code: string
  /** 错误消息 */
  message: string
  /** 错误详情 */
  details?: unknown
  /** 错误发生时间 */
  timestamp: Date
  /** 请求ID（用于追踪） */
  requestId?: string
}

/**
 * 错误处理器选项
 */
export interface ErrorHandlerOptions {
  /** 是否显示通知，默认 true */
  showNotification?: boolean
  /** 是否记录到控制台，默认 true */
  logToConsole?: boolean
  /** 是否上报服务器，默认 false */
  reportToServer?: boolean
  /** 最大错误历史记录数，默认 50 */
  maxHistorySize?: number
}

/**
 * 错误类型枚举
 */
export type ErrorType = 
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'AUTH_ERROR'
  | 'SERVER_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND_ERROR'
  | 'UNKNOWN_ERROR'

/**
 * 错误处理策略
 */
export interface ErrorStrategy {
  /** 处理动作 */
  action: 'fallback' | 'retry' | 'redirect' | 'display'
  /** 用户友好消息 */
  userMessage: string
  /** 是否可重试 */
  retryable: boolean
  /** 最大重试次数 */
  maxRetries?: number
}

/**
 * 验证错误（来自 DataValidator）
 */
export interface ValidationError {
  /** 字段名 */
  field: string
  /** 错误消息 */
  message: string
  /** 当前值 */
  value: unknown
}

/**
 * 错误处理器返回值
 */
export interface ErrorHandlerReturn {
  /** 最后一次错误 */
  lastError: Ref<ErrorInfo | null>
  /** 错误历史记录 */
  errorHistory: Ref<ErrorInfo[]>
  
  // 方法
  /** 处理API错误 */
  handleApiError: (error: unknown) => ErrorInfo
  /** 处理验证错误 */
  handleValidationError: (errors: ValidationError[]) => void
  /** 显示友好错误提示 */
  showErrorMessage: (message: string, type?: 'error' | 'warning') => void
  /** 记录错误日志 */
  logError: (error: ErrorInfo) => void
  /** 获取用户友好的错误消息 */
  getFriendlyMessage: (error: unknown) => string
  /** 判断是否可重试 */
  isRetryable: (error: unknown) => boolean
  /** 获取错误类型 */
  getErrorType: (error: unknown) => ErrorType
  /** 获取错误处理策略 */
  getErrorStrategy: (errorType: ErrorType) => ErrorStrategy
  /** 清除错误历史 */
  clearHistory: () => void
}


// ============================================================================
// 常量定义
// ============================================================================

/** 默认最大错误历史记录数 */
const DEFAULT_MAX_HISTORY_SIZE = 50

/**
 * 错误处理策略配置
 * 
 * 定义各类错误的处理方式、用户提示和重试策略
 * 
 * @requirement 10.3 - Network error handling
 * @requirement 10.4 - Data loading failure handling
 */
const ERROR_HANDLING_STRATEGIES: Record<ErrorType, ErrorStrategy> = {
  // 网络错误 - 触发降级
  NETWORK_ERROR: {
    action: 'fallback',
    userMessage: '网络连接失败，正在使用离线数据',
    retryable: true
  },

  // 超时错误 - 提示重试
  TIMEOUT_ERROR: {
    action: 'retry',
    userMessage: '请求超时，请稍后重试',
    retryable: true,
    maxRetries: 3
  },

  // 认证错误 - 跳转登录
  AUTH_ERROR: {
    action: 'redirect',
    userMessage: '登录已过期，请重新登录',
    retryable: false
  },

  // 服务器错误 - 触发降级
  SERVER_ERROR: {
    action: 'fallback',
    userMessage: '服务器繁忙，正在使用缓存数据',
    retryable: true
  },
  
  // 数据验证错误 - 显示详情
  VALIDATION_ERROR: {
    action: 'display',
    userMessage: '输入数据有误，请检查后重试',
    retryable: false
  },
  
  // 资源未找到错误
  NOT_FOUND_ERROR: {
    action: 'display',
    userMessage: '请求的资源不存在',
    retryable: false
  },
  
  // 未知错误
  UNKNOWN_ERROR: {
    action: 'display',
    userMessage: '发生未知错误，请稍后重试',
    retryable: true
  }
}

/**
 * HTTP 状态码到错误类型的映射
 */
const HTTP_STATUS_TO_ERROR_TYPE: Record<number, ErrorType> = {
  400: 'VALIDATION_ERROR',
  401: 'AUTH_ERROR',
  403: 'AUTH_ERROR',
  404: 'NOT_FOUND_ERROR',
  408: 'TIMEOUT_ERROR',
  500: 'SERVER_ERROR',
  502: 'SERVER_ERROR',
  503: 'SERVER_ERROR',
  504: 'TIMEOUT_ERROR'
}


// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 检查是否为 Axios 错误
 */
function isAxiosError(error: unknown): error is {
  isAxiosError: boolean
  response?: {
    status: number
    data?: {
      message?: string
      code?: string
      error?: string
    }
  }
  message: string
  code?: string
  request?: unknown
} {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    (error as { isAxiosError: boolean }).isAxiosError === true
  )
}

/**
 * 检查是否为网络错误
 */
function isNetworkError(error: unknown): boolean {
  if (isAxiosError(error)) {
    // 没有响应且有请求，说明是网络问题
    return !error.response && !!error.request
  }
  
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return (
      message.includes('network') ||
      message.includes('failed to fetch') ||
      message.includes('net::err') ||
      message.includes('econnrefused') ||
      message.includes('enotfound')
    )
  }
  
  return false
}

/**
 * 检查是否为超时错误
 */
function isTimeoutError(error: unknown): boolean {
  if (isAxiosError(error)) {
    return error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
  }
  
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return message.includes('timeout') || message.includes('timed out')
  }
  
  return false
}

/**
 * 生成唯一的请求ID
 */
function generateRequestId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * 从错误对象中提取消息
 */
function extractErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error
  }
  
  if (isAxiosError(error)) {
    // 优先使用服务器返回的消息
    if (error.response?.data?.message) {
      return error.response.data.message
    }
    if (error.response?.data?.error) {
      return error.response.data.error
    }
    
    // 根据状态码提供友好的错误消息
    if (error.response?.status) {
      switch (error.response.status) {
        case 400:
          // 如果响应没有返回具体消息，返回原始 Axios 消息
          if (!error.response?.data?.message && !error.response?.data?.error) {
            return error.message
          }
          return '请求参数有误，请检查输入内容'
        case 401:
          return '登录已过期，请重新登录'
        case 403:
          return '您没有权限执行此操作'
        case 404:
          return '请求的资源不存在'
        case 409:
          return '操作冲突，该资源可能已被修改'
        case 422:
          return '数据验证失败，请检查输入内容'
        case 429:
          return '操作过于频繁，请稍后再试'
        case 500:
          return '服务器内部错误，请稍后重试'
        case 502:
          return '网关错误，服务暂时不可用'
        case 503:
          return '服务暂时不可用，请稍后重试'
        case 504:
          return '服务器响应超时，请稍后重试'
      }
    }
    
    // 网络错误
    if (!error.response && error.request) {
      return '无法连接到服务器，请检查网络连接'
    }
    
    // 超时错误
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return '请求超时，请检查网络连接或稍后重试'
    }
    
    return error.message
  }
  
  if (error instanceof Error) {
    return error.message
  }
  
  if (typeof error === 'object' && error !== null) {
    if ('message' in error && typeof (error as { message: unknown }).message === 'string') {
      return (error as { message: string }).message
    }
  }
  
  return '发生未知错误，请稍后重试'
}

/**
 * 从错误对象中提取错误代码
 */
function extractErrorCode(error: unknown): string {
  if (isAxiosError(error)) {
    if (error.response?.data?.code) {
      return String(error.response.data.code)
    }
    if (error.response?.status) {
      return `HTTP_${error.response.status}`
    }
    if (error.code) {
      return error.code
    }
  }
  
  if (typeof error === 'object' && error !== null) {
    if ('code' in error && typeof (error as { code: unknown }).code === 'string') {
      return (error as { code: string }).code
    }
  }
  
  return 'UNKNOWN'
}


// ============================================================================
// 主组合式函数
// ============================================================================

/**
 * 错误处理组合式函数
 * 
 * 提供统一的错误处理能力，包括：
 * - API错误处理和分类
 * - 友好错误消息显示
 * - 错误日志记录
 * - 重试判断
 * 
 * @param options - 错误处理器选项
 * @returns 错误处理方法集合
 * 
 * @requirement 2.5 - Log error and show friendly prompt for missing required fields
 * @requirement 10.3 - Show network error prompt
 * @requirement 10.4 - Show error details and suggested actions
 * 
 * @example
 * ```typescript
 * const { handleApiError, showErrorMessage, getFriendlyMessage } = useErrorHandler()
 * 
 * try {
 *   await fetchData()
 * } catch (error) {
 *   const errorInfo = handleApiError(error)
 *   // 错误已自动显示通知和记录日志
 * }
 * ```
 */
export function useErrorHandler(options: ErrorHandlerOptions = {}): ErrorHandlerReturn {
  const {
    showNotification = true,
    logToConsole = true,
    reportToServer = false,
    maxHistorySize = DEFAULT_MAX_HISTORY_SIZE
  } = options

  // ============================================================================
  // 响应式状态
  // ============================================================================

  /** 最后一次错误 */
  const lastError: Ref<ErrorInfo | null> = ref(null)
  
  /** 错误历史记录 */
  const errorHistory: Ref<ErrorInfo[]> = ref([])

  // ============================================================================
  // 核心方法
  // ============================================================================

  /**
   * 获取错误类型
   * 
   * 根据错误对象判断错误类型
   * 
   * @param error - 错误对象
   * @returns 错误类型
   */
  function getErrorType(error: unknown): ErrorType {
    // 检查网络错误
    if (isNetworkError(error)) {
      return 'NETWORK_ERROR'
    }
    
    // 检查超时错误
    if (isTimeoutError(error)) {
      return 'TIMEOUT_ERROR'
    }
    
    // 检查 Axios 错误的 HTTP 状态码
    if (isAxiosError(error) && error.response?.status) {
      const status = error.response.status
      if (HTTP_STATUS_TO_ERROR_TYPE[status]) {
        return HTTP_STATUS_TO_ERROR_TYPE[status]
      }
      
      // 4xx 客户端错误
      if (status >= 400 && status < 500) {
        return 'VALIDATION_ERROR'
      }
      
      // 5xx 服务器错误
      if (status >= 500) {
        return 'SERVER_ERROR'
      }
    }
    
    return 'UNKNOWN_ERROR'
  }

  /**
   * 获取错误处理策略
   * 
   * @param errorType - 错误类型
   * @returns 错误处理策略
   */
  function getErrorStrategy(errorType: ErrorType): ErrorStrategy {
    return ERROR_HANDLING_STRATEGIES[errorType]
  }

  /**
   * 获取用户友好的错误消息
   * 
   * 将技术性错误转换为用户可理解的消息
   * 
   * @param error - 错误对象
   * @returns 用户友好的错误消息
   * 
   * @requirement 10.3 - Show network error prompt
   * @requirement 10.4 - Show error details and suggested actions
   */
  function getFriendlyMessage(error: unknown): string {
    const errorType = getErrorType(error)
    const strategy = getErrorStrategy(errorType)
    
    // 对于验证错误，尝试提取具体的错误消息
    if (errorType === 'VALIDATION_ERROR') {
      const extractedMessage = extractErrorMessage(error)
      if (extractedMessage && extractedMessage !== '发生未知错误') {
        return extractedMessage
      }
    }
    
    return strategy.userMessage
  }

  /**
   * 判断是否可重试
   * 
   * @param error - 错误对象
   * @returns 是否可以重试
   */
  function isRetryable(error: unknown): boolean {
    const errorType = getErrorType(error)
    const strategy = getErrorStrategy(errorType)
    return strategy.retryable
  }

  /**
   * 记录错误日志
   * 
   * @param error - 错误信息
   * 
   * @requirement 2.5 - Log error for missing required fields
   */
  function logError(error: ErrorInfo): void {
    // 添加到历史记录
    errorHistory.value.unshift(error)
    
    // 限制历史记录大小
    if (errorHistory.value.length > maxHistorySize) {
      errorHistory.value = errorHistory.value.slice(0, maxHistorySize)
    }
    
    // 更新最后一次错误
    lastError.value = error
    
    // 控制台日志
    if (logToConsole) {
      console.error('[ErrorHandler]', {
        code: error.code,
        message: error.message,
        details: error.details,
        timestamp: error.timestamp,
        requestId: error.requestId
      })
    }
    
    // 上报服务器（如果启用）
    if (reportToServer) {
      // TODO: 实现错误上报逻辑
      // reportErrorToServer(error)
    }
  }

  /**
   * 显示友好错误提示
   * 
   * 使用 Element Plus 的 ElMessage 组件显示错误提示
   * 
   * @param message - 错误消息
   * @param type - 消息类型，默认 'error'
   * 
   * @requirement 10.3 - Show network error prompt
   * @requirement 10.4 - Show error details and suggested actions
   */
  function showErrorMessage(message: string, type: 'error' | 'warning' = 'error'): void {
    if (!showNotification) {
      return
    }
    
    ElMessage({
      message,
      type,
      duration: type === 'error' ? 5000 : 3000,
      showClose: true
    })
  }

  /**
   * 处理API错误
   * 
   * 统一处理API调用产生的错误，包括：
   * - 错误分类
   * - 生成错误信息
   * - 记录日志
   * - 显示通知
   * 
   * @param error - 错误对象
   * @returns 错误信息
   * 
   * @requirement 2.5 - Log error and show friendly prompt
   * @requirement 10.3 - Show network error prompt
   * @requirement 10.4 - Show error details and suggested actions
   */
  function handleApiError(error: unknown): ErrorInfo {
    const errorType = getErrorType(error)
    const friendlyMessage = getFriendlyMessage(error)
    
    // 构建错误信息
    const errorInfo: ErrorInfo = {
      code: extractErrorCode(error),
      message: friendlyMessage,
      details: error,
      timestamp: new Date(),
      requestId: generateRequestId()
    }
    
    // 记录错误日志
    logError(errorInfo)
    
    // 显示错误提示
    const strategy = getErrorStrategy(errorType)
    const messageType = strategy.action === 'fallback' ? 'warning' : 'error'
    showErrorMessage(friendlyMessage, messageType)
    
    return errorInfo
  }

  /**
   * 处理验证错误
   * 
   * 处理来自 DataValidator 的验证错误
   * 
   * @param errors - 验证错误列表
   * 
   * @requirement 2.5 - Log error and show friendly prompt for missing required fields
   */
  function handleValidationError(errors: ValidationError[]): void {
    if (errors.length === 0) {
      return
    }
    
    // 构建错误消息
    const errorMessages = errors.map(e => `${e.field}: ${e.message}`).join('; ')
    const firstError = errors[0]
    const friendlyMessage = errors.length === 1 && firstError
      ? firstError.message
      : `数据验证失败: ${errors.length} 个字段有问题`
    
    // 构建错误信息
    const errorInfo: ErrorInfo = {
      code: 'VALIDATION_ERROR',
      message: friendlyMessage,
      details: {
        errors,
        summary: errorMessages
      },
      timestamp: new Date(),
      requestId: generateRequestId()
    }
    
    // 记录错误日志
    logError(errorInfo)
    
    // 显示错误提示
    showErrorMessage(friendlyMessage, 'warning')
  }

  /**
   * 清除错误历史
   */
  function clearHistory(): void {
    errorHistory.value = []
    lastError.value = null
  }

  // ============================================================================
  // 返回值
  // ============================================================================

  return {
    // 状态
    lastError,
    errorHistory,
    
    // 方法
    handleApiError,
    handleValidationError,
    showErrorMessage,
    logError,
    getFriendlyMessage,
    isRetryable,
    getErrorType,
    getErrorStrategy,
    clearHistory
  }
}
