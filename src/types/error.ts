/**
 * 统一错误响应类型定义
 * 
 * 定义前后端统一的错误响应格式，用于错误追踪和处理
 * 
 * **Validates: Requirements 3.1.1, 3.1.5**
 */

/**
 * 统一的 API 错误响应格式
 * 
 * @property code - 错误码，如 "AUTH_001"
 * @property message - 用户友好的错误消息
 * @property details - 详细错误信息（开发环境可用）
 * @property requestId - 请求 ID，用于日志关联和问题追踪
 * @property timestamp - ISO 8601 格式时间戳
 */
export interface ApiErrorResponse {
  /** 错误码，格式为 "模块_编号"，如 "AUTH_001" */
  code: string
  /** 用户友好的错误消息 */
  message: string
  /** 详细错误信息，仅在开发环境返回 */
  details?: Record<string, unknown>
  /** 请求 ID，用于日志关联和问题追踪 */
  requestId: string
  /** ISO 8601 格式时间戳 */
  timestamp: string
}

/**
 * 错误码前缀枚举
 * 用于标识错误所属的模块
 */
export enum ErrorCodePrefix {
  /** 认证授权相关错误 */
  AUTH = 'AUTH',
  /** 数据验证相关错误 */
  VAL = 'VAL',
  /** 业务逻辑相关错误 */
  BIZ = 'BIZ',
  /** 系统错误 */
  SYS = 'SYS',
  /** 网络错误 */
  NET = 'NET',
  /** 频率限制错误 */
  RATE = 'RATE',
}

/**
 * 错误严重级别
 */
export enum ErrorSeverity {
  /** 信息级别，不影响功能 */
  INFO = 'info',
  /** 警告级别，可能影响部分功能 */
  WARNING = 'warning',
  /** 错误级别，功能无法正常使用 */
  ERROR = 'error',
  /** 严重错误，系统可能不稳定 */
  CRITICAL = 'critical',
}

/**
 * 扩展的错误信息，包含更多上下文
 */
export interface ExtendedErrorInfo extends ApiErrorResponse {
  /** 错误严重级别 */
  severity: ErrorSeverity
  /** 是否可重试 */
  retryable: boolean
  /** 建议的重试延迟（毫秒） */
  retryAfter?: number
  /** 原始错误对象（仅开发环境） */
  originalError?: unknown
}

/**
 * 验证错误详情
 */
export interface ValidationErrorDetail {
  /** 字段名 */
  field: string
  /** 错误消息 */
  message: string
  /** 当前值 */
  value?: unknown
  /** 约束条件 */
  constraint?: string
}

/**
 * 验证错误响应
 */
export interface ValidationErrorResponse extends ApiErrorResponse {
  /** 验证错误详情列表 */
  details: {
    errors: ValidationErrorDetail[]
  }
}

/**
 * 检查是否为 ApiErrorResponse 类型
 */
export function isApiErrorResponse(error: unknown): error is ApiErrorResponse {
  if (typeof error !== 'object' || error === null) {
    return false
  }
  
  const obj = error as Record<string, unknown>
  return (
    typeof obj.code === 'string' &&
    typeof obj.message === 'string' &&
    typeof obj.requestId === 'string' &&
    typeof obj.timestamp === 'string'
  )
}

/**
 * 检查是否为验证错误响应
 */
export function isValidationErrorResponse(error: unknown): error is ValidationErrorResponse {
  if (!isApiErrorResponse(error)) {
    return false
  }
  
  const obj = error as ValidationErrorResponse
  return (
    obj.details !== undefined &&
    typeof obj.details === 'object' &&
    Array.isArray((obj.details as { errors?: unknown }).errors)
  )
}
