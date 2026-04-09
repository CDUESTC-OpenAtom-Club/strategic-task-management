import type { AxiosError } from 'axios'

export interface FallbackConfig {
  enabled: boolean
  forceMock: boolean
}

export function getFallbackConfig(): FallbackConfig {
  return {
    enabled: true,
    forceMock: false
  }
}

export function shouldFallback(error?: AxiosError | null): boolean {
  const config = getFallbackConfig()
  if (!config.enabled) {
    return false
  }
  if (!error) {
    return false
  }
  if (!error?.response) {
    return true
  }
  return error.response.status >= 500
}

export function getFallbackReason(error?: AxiosError | null): string {
  if (!error) {
    return '未知原因'
  }
  if (!error.response) {
    return `网络错误: ${error.message || 'Network Error'}`
  }
  return `服务器错误: HTTP ${error.response.status}`
}

export function getMockData<T>(
  url: string
): { success: boolean; data: T | null; message: string } | null {
  if (url.includes('indicator')) {
    return { success: true, data: [] as unknown as T, message: '降级数据' }
  }
  if (url.includes('dashboard')) {
    return { success: true, data: {} as T, message: '降级数据' }
  }
  if (url.includes('org')) {
    return { success: true, data: [] as unknown as T, message: '降级数据' }
  }
  return null
}

export class FallbackService {
  shouldFallback(error?: AxiosError | null): boolean {
    return shouldFallback(error)
  }

  getMockData<T>(url: string) {
    return getMockData<T>(url)
  }

  logFallback(_url: string, _reason: string): void {}

  getFallbackReason(error?: AxiosError | null): string {
    return getFallbackReason(error)
  }

  isForceMock(): boolean {
    return false
  }
}

export const fallbackService = new FallbackService()

export default fallbackService
