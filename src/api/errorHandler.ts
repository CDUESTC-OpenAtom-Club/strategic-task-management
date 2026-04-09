import type { AxiosError } from 'axios'
import { ErrorSeverity } from '@/shared/types/error'

export interface ApiErrorResponse {
  code: string
  message: string
  requestId: string
  timestamp: string
  details?: unknown
}

function isAxiosError(error: unknown): error is AxiosError {
  return typeof error === 'object' && error !== null && 'isAxiosError' in error
}

export function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function toCode(error: unknown): string {
  if (isAxiosError(error)) {
    const responseCode = (error.response?.data as { code?: string } | undefined)?.code
    if (typeof responseCode === 'string' && responseCode.trim()) {
      return responseCode
    }
    if (typeof error.code === 'string' && error.code.trim()) {
      return error.code
    }
    if (typeof error.response?.status === 'number') {
      return `HTTP_${error.response.status}`
    }
  }

  if (typeof (error as { code?: unknown })?.code === 'string') {
    return (error as { code: string }).code
  }

  return 'UNKNOWN_ERROR'
}

export function formatErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { message?: string; error?: string } | undefined
    if (typeof data?.message === 'string' && data.message.trim()) {
      return data.message
    }
    if (typeof data?.error === 'string' && data.error.trim()) {
      return data.error
    }
    if (typeof error.message === 'string' && error.message.trim()) {
      return error.message
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return '未知错误'
}

export function isRetryableError(error: unknown): boolean {
  if (isAxiosError(error)) {
    if (!error.response) {
      return true
    }
    return (
      error.response.status >= 500 || error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
    )
  }
  return false
}

export function getErrorSeverity(error: unknown): ErrorSeverity {
  if (isAxiosError(error)) {
    const status = Number(error.response?.status)
    if (!error.response || status >= 500) {
      return ErrorSeverity.ERROR
    }
    if (status >= 400) {
      return ErrorSeverity.WARNING
    }
  }
  return ErrorSeverity.INFO
}

export function transformError(error: unknown): ApiErrorResponse {
  return {
    code: toCode(error),
    message: formatErrorMessage(error),
    requestId: generateRequestId(),
    timestamp: new Date().toISOString(),
    details: isAxiosError(error) ? error.response?.data : undefined
  }
}

export function toExtendedError(error: unknown): ApiErrorResponse & {
  severity: ErrorSeverity
  retryable: boolean
} {
  const normalizedRequestId =
    typeof (error as { requestId?: unknown })?.requestId === 'string'
      ? (error as { requestId: string }).requestId
      : generateRequestId()
  const normalizedTimestamp =
    typeof (error as { timestamp?: unknown })?.timestamp === 'string'
      ? (error as { timestamp: string }).timestamp
      : new Date().toISOString()
  const normalizedMessage =
    typeof (error as { message?: unknown })?.message === 'string'
      ? (error as { message: string }).message
      : ''
  const normalizedCode =
    typeof (error as { code?: unknown })?.code === 'string'
      ? (error as { code: string }).code
      : toCode(error)

  return {
    ...transformError(error),
    code: normalizedCode,
    message: normalizedMessage || formatErrorMessage(error),
    requestId: normalizedRequestId,
    timestamp: normalizedTimestamp,
    severity: getErrorSeverity(error),
    retryable: isRetryableError(error)
  }
}
