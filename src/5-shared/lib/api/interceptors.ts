/**
 * API Interceptors
 *
 * Request and response interceptors with:
 * - Authentication token injection
 * - Request ID generation
 * - Error transformation
 * - Response normalization
 * - 401 auto-refresh handling
 */

import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'
import { ElMessage } from 'element-plus'
import { handleApiError } from './errorHandler'
import { logger } from '../utils/logger'
import { adaptV1Path } from '@/shared/api/v1PathAdapter'

/**
 * Interceptor configuration
 */
export interface InterceptorConfig {
  enableLogging?: boolean
}

/**
 * Extended request config with metadata
 */
interface ExtendedRequestConfig extends InternalAxiosRequestConfig {
  _startTime?: number
  _requestId?: string
  _retry?: boolean
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Get authentication token
 */
function getAuthToken(): string | null {
  // Try to get from localStorage first
  const token = localStorage.getItem('token')
  if (token) {
    return token
  }

  // Try to get from auth store (dynamic import to avoid circular dependency)
  try {
    const authStore = (window as any).__AUTH_STORE__
    return authStore?.token || null
  } catch {
    return null
  }
}

/**
 * Setup request interceptors
 */
export function setupRequestInterceptors(
  client: AxiosInstance,
  config: InterceptorConfig = {}
): void {
  const { enableLogging = false } = config

  client.interceptors.request.use(
    (axiosConfig: InternalAxiosRequestConfig) => {
      const config = axiosConfig as ExtendedRequestConfig

      // Add request ID for tracking
      config._requestId = generateRequestId()
      config.headers['X-Request-ID'] = config._requestId

      // Rewrite legacy endpoints to backend OpenAPI v1 endpoints.
      if (config.url) {
        const adapted = adaptV1Path(config.url)
        if (adapted.changed) {
          logger.debug(`[API PathAdapter] ${config.url} -> ${adapted.adaptedPath}`, {
            reason: adapted.reason
          })
        } else if (adapted.unsupported) {
          logger.warn(`[API PathAdapter] Unmapped contract path: ${config.url}`, {
            reason: adapted.reason
          })
        }
        config.url = adapted.adaptedPath
      }

      // Add timestamp for performance monitoring
      config._startTime = Date.now()

      // Inject authentication token
      const token = getAuthToken()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }

      // Log request (development only)
      if (enableLogging) {
        logger.debug(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
          params: config.params,
          data: config.data,
          requestId: config._requestId
        })
      }

      return config
    },
    error => {
      if (enableLogging) {
        logger.error('[API Request Error]', error)
      }
      return Promise.reject(error)
    }
  )
}

/**
 * Setup response interceptors
 */
export function setupResponseInterceptors(
  client: AxiosInstance,
  config: InterceptorConfig = {}
): void {
  const { enableLogging = false } = config

  client.interceptors.response.use(
    (response: AxiosResponse) => {
      const requestConfig = response.config as ExtendedRequestConfig

      // Log response (development only)
      if (enableLogging) {
        const duration = requestConfig._startTime ? Date.now() - requestConfig._startTime : 0
        logger.debug(`[API Response] ${response.status} ${response.config.url} (${duration}ms)`, {
          data: response.data,
          requestId: requestConfig._requestId
        })
      }

      // Normalize response format
      return normalizeResponse(response)
    },
    async (error: AxiosError) => {
      const requestConfig = error.config as ExtendedRequestConfig | undefined

      // Log error (development only)
      if (enableLogging) {
        const duration = requestConfig?._startTime ? Date.now() - requestConfig._startTime : 0
        logger.error(
          `[API Error] ${error.response?.status || 'Network Error'} ${error.config?.url} (${duration}ms)`,
          {
            message: error.message,
            code: error.code,
            requestId: requestConfig?._requestId
          }
        )
      }

      // Handle specific error cases
      return handleErrorResponse(error, client, enableLogging)
    }
  )
}

/**
 * Normalize response format
 */
function normalizeResponse(response: AxiosResponse): AxiosResponse {
  const data = response.data

  // Already normalized format: { success, data, message }
  if (data && typeof data === 'object' && 'success' in data) {
    return response
  }

  // Backend format: { code: 0, data: {...}, message: "..." }
  if (data && typeof data === 'object' && 'code' in data) {
    if (data.code === 0) {
      return {
        ...response,
        data: {
          success: true,
          data: data.data,
          message: data.message
        }
      }
    } else {
      throw new Error(data.message || 'Request failed')
    }
  }

  // Raw data format - wrap it
  return {
    ...response,
    data: {
      success: true,
      data: data
    }
  }
}

/**
 * Handle error response
 */
async function handleErrorResponse(
  error: AxiosError,
  client: AxiosInstance,
  enableLogging: boolean
): Promise<never> {
  const requestConfig = error.config as ExtendedRequestConfig | undefined

  // Handle 401 Unauthorized with auto-refresh
  if (error.response?.status === 401 && requestConfig) {
    return handle401Error(error, requestConfig, client, enableLogging)
  }

  // Handle 403 Forbidden
  if (error.response?.status === 403) {
    handle403Error(error)
  }

  // Handle 500 Server Error
  if (error.response?.status === 500) {
    handle500Error(error)
  }

  // Handle network errors
  if (!error.response && error.request) {
    handleNetworkError()
  }

  // Transform and reject error
  const apiError = handleApiError(error)
  return Promise.reject(apiError)
}

/**
 * Handle 401 Unauthorized error with token refresh
 */
async function handle401Error(
  error: AxiosError,
  requestConfig: ExtendedRequestConfig,
  client: AxiosInstance,
  enableLogging: boolean
): Promise<never> {
  const isLoginRequest = requestConfig.url?.includes('/auth/login')
  const isRefreshRequest = requestConfig.url?.includes('/auth/refresh')

  // Don't retry login or refresh requests
  if (isLoginRequest || isRefreshRequest) {
    return Promise.reject(handleApiError(error))
  }

  // Prevent infinite retry loop
  if (requestConfig._retry) {
    if (enableLogging) {
      logger.warn('[API Auth] Token refresh failed, redirecting to login')
    }

    // Clear auth state and redirect to login
    localStorage.removeItem('token')
    window.location.href = '/login'

    return Promise.reject(handleApiError(error))
  }

  // Mark as retry attempt
  requestConfig._retry = true

  try {
    if (enableLogging) {
      logger.debug('[API Auth] Attempting to refresh token...')
    }

    // Refresh token
    const newToken = await refreshAccessToken()

    if (enableLogging) {
      logger.debug('[API Auth] Token refreshed successfully, retrying request')
    }

    // Update token in storage
    localStorage.setItem('token', newToken)

    // Update request with new token
    requestConfig.headers.Authorization = `Bearer ${newToken}`

    // Retry original request
    return client.request(requestConfig)
  } catch (refreshError) {
    if (enableLogging) {
      logger.error('[API Auth] Token refresh failed:', refreshError)
    }

    // Clear auth state and redirect to login
    localStorage.removeItem('token')
    window.location.href = '/login'

    return Promise.reject(handleApiError(error))
  }
}

/**
 * Refresh access token
 */
async function refreshAccessToken(): Promise<string> {
  try {
    const refreshToken = localStorage.getItem('refreshToken')
    if (!refreshToken) {
      throw new Error('Missing refresh token')
    }

    const response = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refreshToken })
    })

    if (!response.ok) {
      throw new Error('Token refresh failed')
    }

    const data = await response.json()
    const newAccessToken = data?.data?.accessToken || data?.accessToken || data?.token
    if (!newAccessToken) {
      throw new Error('Token refresh failed')
    }
    if (data?.data?.refreshToken) {
      localStorage.setItem('refreshToken', data.data.refreshToken)
    }
    return newAccessToken
  } catch (error) {
    throw new Error('Failed to refresh access token')
  }
}

/**
 * Handle 403 Forbidden error
 */
function handle403Error(error: AxiosError): void {
  const isHealthCheck =
    error.config?.url?.includes('/actuator/health') || error.config?.url?.includes('/auth/health')
  const isHealthCheckRequest = error.config?.headers?.['X-Health-Check'] === 'true'

  // Don't show notification for health check requests
  if (!isHealthCheck && !isHealthCheckRequest) {
    ElMessage.error({
      message: '权限不足，无法执行此操作',
      duration: 3000,
      showClose: true
    })
  }
}

/**
 * Handle 500 Server Error
 */
function handle500Error(error?: AxiosError): void {
  const isHealthCheck =
    error?.config?.url?.includes('/actuator/health') || error?.config?.url?.includes('/auth/health')
  const isHealthCheckRequest = error?.config?.headers?.['X-Health-Check'] === 'true'

  if (!isHealthCheck && !isHealthCheckRequest) {
    ElMessage.error({
      message: '服务器内部错误，请稍后重试或联系管理员',
      duration: 5000,
      showClose: true
    })
  }
}

/**
 * Handle network error
 */
function handleNetworkError(): void {
  ElMessage.error({
    message: '无法连接到服务器，请检查网络连接',
    duration: 5000,
    showClose: true
  })
}
