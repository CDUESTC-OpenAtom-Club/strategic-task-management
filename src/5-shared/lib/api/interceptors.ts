/**
 * @deprecated Compatibility entrypoint.
 * Canonical paths:
 * - `@/shared/api/interceptors/requestInterceptors`
 * - `@/shared/api/interceptors/responseInterceptors`
 * Remove after 2026-05-31.
 */

import type { AxiosInstance } from 'axios'
import {
  createRequestInterceptor,
  createRequestErrorInterceptor,
  type RequestInterceptorConfig as InterceptorConfig
} from '@/shared/api/interceptors/requestInterceptors'
import {
  createResponseInterceptor,
  createResponseErrorInterceptor
} from '@/shared/api/interceptors/responseInterceptors'

export type { InterceptorConfig }

export function setupRequestInterceptors(
  client: AxiosInstance,
  config: InterceptorConfig = {}
): void {
  client.interceptors.request.use(createRequestInterceptor(config), createRequestErrorInterceptor())
}

export function setupResponseInterceptors(
  client: AxiosInstance,
  config: InterceptorConfig = {}
): void {
  client.interceptors.response.use(
    createResponseInterceptor(config),
    createResponseErrorInterceptor(config)
  )
}
