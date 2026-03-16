/**
 * Unified API Client
 *
 * Production-ready HTTP client with:
 * - Request/response interceptors
 * - Authentication token handling
 * - Unified error handling
 * - Request/response transformation
 * - Request retry logic
 * - Request cancellation
 * - Loading state management
 *
 * **Validates: Requirements 2.1, 2.3, 2.6, 2.7**
 */

import axios, { type AxiosInstance, type AxiosRequestConfig, type CancelTokenSource } from 'axios'
import { setupRequestInterceptors, setupResponseInterceptors } from './interceptors'
import { createRetryInterceptor } from '@/shared/api/retry'

/**
 * API Client configuration
 */
export interface ApiClientConfig {
  /** Base URL for API requests */
  baseURL?: string
  /** Request timeout in milliseconds */
  timeout?: number
  /** Enable automatic retry for failed requests */
  enableRetry?: boolean
  /** Maximum number of retry attempts */
  maxRetries?: number
  /** Enable request/response logging */
  enableLogging?: boolean
}

/**
 * Request options with cancellation support
 */
export interface RequestOptions extends AxiosRequestConfig {
  /** Cancel token for request cancellation */
  cancelToken?: CancelTokenSource
}

/**
 * Unified API Client class
 */
export class ApiClient {
  private client: AxiosInstance
  private cancelTokens: Map<string, CancelTokenSource> = new Map()

  constructor(config: ApiClientConfig = {}) {
    const {
      baseURL = '/api/v1',
      timeout = 30000,
      enableRetry = true,
      maxRetries = 3,
      enableLogging = import.meta.env.DEV
    } = config

    // Create axios instance
    this.client = axios.create({
      baseURL,
      timeout,
      headers: {
        'Content-Type': 'application/json'
      },
      withCredentials: true // Allow HttpOnly cookies for refresh tokens
    })

    // Setup interceptors
    setupRequestInterceptors(this.client, { enableLogging })
    setupResponseInterceptors(this.client, { enableLogging })

    // Setup retry logic
    if (enableRetry) {
      createRetryInterceptor(this.client, { maxRetries })
    }
  }

  /**
   * GET request
   */
  async get<T>(
    url: string,
    params?: Record<string, unknown>,
    options?: RequestOptions
  ): Promise<T> {
    const config = this.buildConfig(options, { params })
    const response = await this.client.get<T>(url, config)
    return response.data
  }

  /**
   * POST request
   */
  async post<T>(url: string, data?: unknown, options?: RequestOptions): Promise<T> {
    const config = this.buildConfig(options)
    const response = await this.client.post<T>(url, data, config)
    return response.data
  }

  /**
   * PUT request
   */
  async put<T>(url: string, data?: unknown, options?: RequestOptions): Promise<T> {
    const config = this.buildConfig(options)
    const response = await this.client.put<T>(url, data, config)
    return response.data
  }

  /**
   * DELETE request
   */
  async delete<T>(url: string, options?: RequestOptions): Promise<T> {
    const config = this.buildConfig(options)
    const response = await this.client.delete<T>(url, config)
    return response.data
  }

  /**
   * PATCH request
   */
  async patch<T>(url: string, data?: unknown, options?: RequestOptions): Promise<T> {
    const config = this.buildConfig(options)
    const response = await this.client.patch<T>(url, data, config)
    return response.data
  }

  /**
   * Upload file
   */
  async upload<T>(
    url: string,
    file: File,
    additionalData?: Record<string, unknown>,
    options?: RequestOptions
  ): Promise<T> {
    const formData = new FormData()
    formData.append('file', file)

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, String(value))
      })
    }

    const config = this.buildConfig(options, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })

    const response = await this.client.post<T>(url, formData, config)
    return response.data
  }

  /**
   * Download file
   */
  async download(url: string, filename?: string, options?: RequestOptions): Promise<void> {
    const config = this.buildConfig(options, {
      responseType: 'blob'
    })

    const response = await this.client.get(url, config)
    const blob = new Blob([response.data])
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = filename || 'download'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(downloadUrl)
  }

  /**
   * Create cancel token for request cancellation
   */
  createCancelToken(key: string): CancelTokenSource {
    // Cancel existing request with same key
    this.cancelRequest(key)

    // Create new cancel token
    const cancelToken = axios.CancelToken.source()
    this.cancelTokens.set(key, cancelToken)
    return cancelToken
  }

  /**
   * Cancel request by key
   */
  cancelRequest(key: string): void {
    const cancelToken = this.cancelTokens.get(key)
    if (cancelToken) {
      cancelToken.cancel(`Request cancelled: ${key}`)
      this.cancelTokens.delete(key)
    }
  }

  /**
   * Cancel all pending requests
   */
  cancelAllRequests(): void {
    this.cancelTokens.forEach((cancelToken, key) => {
      cancelToken.cancel(`Request cancelled: ${key}`)
    })
    this.cancelTokens.clear()
  }

  /**
   * Get the underlying axios instance
   */
  getAxiosInstance(): AxiosInstance {
    return this.client
  }

  /**
   * Build request config
   */
  private buildConfig(
    options?: RequestOptions,
    additionalConfig?: AxiosRequestConfig
  ): AxiosRequestConfig {
    const config: AxiosRequestConfig = {
      ...additionalConfig,
      ...options
    }

    // Add cancel token if provided
    if (options?.cancelToken) {
      config.cancelToken = options.cancelToken.token
    }

    return config
  }
}

/**
 * Create API client instance
 */
export function createApiClient(config?: ApiClientConfig): ApiClient {
  return new ApiClient(config)
}

/**
 * Default API client instance
 */
export const apiClient = createApiClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: Number(import.meta.env.VITE_REQUEST_TIMEOUT) || 30000,
  enableRetry: true,
  maxRetries: 3,
  enableLogging: import.meta.env.DEV
})
