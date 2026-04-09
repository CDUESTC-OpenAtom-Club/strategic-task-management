export * from '@/shared/lib/error-handling/useErrorHandler'

import {
  useErrorHandler as useSharedErrorHandler,
  type ErrorHandlerOptions,
  type ErrorHandlerReturn
} from '@/shared/lib/error-handling/useErrorHandler'

function isAxiosLike(error: unknown): error is {
  response?: { status?: number }
  request?: unknown
  code?: string
} {
  return typeof error === 'object' && error !== null
}

export function useErrorHandler(options: ErrorHandlerOptions = {}): ErrorHandlerReturn {
  const handler = useSharedErrorHandler(options)

  const getFriendlyMessage = (error: unknown): string => {
    if (isAxiosLike(error)) {
      if (!error.response && error.request) {
        return '网络连接失败，正在使用离线数据'
      }

      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return '请求超时，请稍后重试'
      }

      const status = Number(error.response?.status)
      if (status === 400) {
        const responseMessage =
          'data' in (error.response ?? {}) &&
          error.response &&
          typeof error.response === 'object' &&
          error.response.data &&
          typeof error.response.data === 'object' &&
          'message' in error.response.data &&
          typeof error.response.data.message === 'string'
            ? error.response.data.message
            : ''

        if (responseMessage) {
          return responseMessage
        }

        return 'message' in error && typeof error.message === 'string'
          ? error.message
          : handler.getFriendlyMessage(error)
      }
      if (status === 500 || status === 502 || status === 503) {
        return '服务器繁忙，正在使用缓存数据'
      }
    }

    return handler.getFriendlyMessage(error)
  }

  return {
    ...handler,
    getFriendlyMessage
  }
}
