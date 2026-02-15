/**
 * 加载状态管理组合式函数
 * 
 * 提供统一的加载状态管理能力，支持超时检测和重试逻辑
 * 
 * @requirements 1.5 - Loading state display during data loading
 * @requirements 10.1 - Show skeleton screen or loading animation during page data loading
 * @requirements 10.2 - Show timeout prompt and provide retry option when API call times out
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue'

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 加载状态选项
 */
export interface LoadingStateOptions {
  /** 超时时间(ms)，默认 30000ms (30秒) */
  timeout?: number
  /** 最大重试次数，默认 3 次 */
  retryCount?: number
  /** 是否显示骨架屏，默认 true */
  showSkeleton?: boolean
}

/**
 * 加载状态返回值
 */
export interface LoadingStateReturn {
  /** 是否正在加载 */
  isLoading: Ref<boolean>
  /** 是否有错误 */
  hasError: Ref<boolean>
  /** 错误消息 */
  errorMessage: Ref<string>
  /** 是否超时 */
  isTimeout: Ref<boolean>
  /** 当前重试次数 */
  retryAttempts: Ref<number>
  /** 是否可以重试 */
  canRetry: ComputedRef<boolean>
  /** 是否显示骨架屏 */
  showSkeleton: ComputedRef<boolean>
  
  // 方法
  /** 开始加载 */
  startLoading: () => void
  /** 结束加载 */
  endLoading: () => void
  /** 设置错误 */
  setError: (message: string) => void
  /** 清除错误 */
  clearError: () => void
  /** 重置所有状态 */
  reset: () => void
  /** 重试操作 */
  retry: <T>(operation: () => Promise<T>) => Promise<T>
  /** 带超时的操作 */
  withTimeout: <T>(operation: () => Promise<T>, timeout?: number) => Promise<T>
}

// ============================================================================
// 常量定义
// ============================================================================

/** 默认超时时间 (30秒) */
const DEFAULT_TIMEOUT = 30000

/** 默认最大重试次数 */
const DEFAULT_RETRY_COUNT = 3


// ============================================================================
// 主组合式函数
// ============================================================================

/**
 * 加载状态管理组合式函数
 * 
 * 提供统一的加载状态管理能力，包括：
 * - 加载状态跟踪
 * - 错误状态管理
 * - 超时检测
 * - 自动重试机制
 * 
 * @param options - 加载状态选项
 * @returns 加载状态和控制方法
 * 
 * @example
 * ```typescript
 * const { isLoading, hasError, startLoading, endLoading, retry } = useLoadingState()
 * 
 * // 基本使用
 * startLoading()
 * try {
 *   await fetchData()
 * } finally {
 *   endLoading()
 * }
 * 
 * // 带超时的操作
 * const data = await withTimeout(() => fetchData(), 5000)
 * 
 * // 带重试的操作
 * const data = await retry(() => fetchData())
 * ```
 */
export function useLoadingState(options: LoadingStateOptions = {}): LoadingStateReturn {
  const {
    timeout = DEFAULT_TIMEOUT,
    retryCount = DEFAULT_RETRY_COUNT,
    showSkeleton: showSkeletonOption = true
  } = options

  // ============================================================================
  // 响应式状态
  // ============================================================================

  /** 是否正在加载 */
  const isLoading = ref(false)
  
  /** 是否有错误 */
  const hasError = ref(false)
  
  /** 错误消息 */
  const errorMessage = ref('')
  
  /** 是否超时 */
  const isTimeout = ref(false)
  
  /** 当前重试次数 */
  const retryAttempts = ref(0)
  
  /** 超时定时器ID */
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null

  // ============================================================================
  // 计算属性
  // ============================================================================

  /** 是否可以重试 */
  const canRetry = computed(() => {
    return hasError.value && retryAttempts.value < retryCount
  })

  /** 是否显示骨架屏 */
  const showSkeletonComputed = computed(() => {
    return showSkeletonOption && isLoading.value && !hasError.value
  })

  // ============================================================================
  // 基础方法
  // ============================================================================

  /**
   * 清除超时定时器
   */
  function clearTimeoutTimer(): void {
    if (timeoutTimer !== null) {
      clearTimeout(timeoutTimer)
      timeoutTimer = null
    }
  }

  /**
   * 开始加载
   * 
   * 设置加载状态为 true，清除之前的错误状态
   * 
   * @requirement 1.5 - Loading state display during data loading
   */
  function startLoading(): void {
    isLoading.value = true
    hasError.value = false
    errorMessage.value = ''
    isTimeout.value = false
    clearTimeoutTimer()
  }

  /**
   * 结束加载
   * 
   * 设置加载状态为 false，清除超时定时器
   */
  function endLoading(): void {
    isLoading.value = false
    clearTimeoutTimer()
  }

  /**
   * 设置错误
   * 
   * @param message - 错误消息
   */
  function setError(message: string): void {
    hasError.value = true
    errorMessage.value = message
    isLoading.value = false
    clearTimeoutTimer()
  }

  /**
   * 清除错误
   * 
   * 重置错误状态和超时状态
   */
  function clearError(): void {
    hasError.value = false
    errorMessage.value = ''
    isTimeout.value = false
  }

  /**
   * 重置所有状态
   * 
   * 将所有状态重置为初始值
   */
  function reset(): void {
    isLoading.value = false
    hasError.value = false
    errorMessage.value = ''
    isTimeout.value = false
    retryAttempts.value = 0
    clearTimeoutTimer()
  }


  // ============================================================================
  // 高级方法
  // ============================================================================

  /**
   * 带超时的操作
   * 
   * 执行异步操作，如果超过指定时间则抛出超时错误
   * 
   * @param operation - 要执行的异步操作
   * @param customTimeout - 自定义超时时间(ms)，不传则使用默认值
   * @returns 操作结果
   * @throws 超时时抛出 TimeoutError
   * 
   * @requirement 10.2 - Show timeout prompt and provide retry option when API call times out
   * 
   * @example
   * ```typescript
   * try {
   *   const data = await withTimeout(() => fetchData(), 5000)
   * } catch (error) {
   *   if (isTimeout.value) {
   *     console.log('请求超时，请重试')
   *   }
   * }
   * ```
   */
  async function withTimeout<T>(
    operation: () => Promise<T>,
    customTimeout?: number
  ): Promise<T> {
    const timeoutMs = customTimeout ?? timeout
    
    startLoading()
    
    return new Promise<T>((resolve, reject) => {
      // 设置超时定时器
      timeoutTimer = setTimeout(() => {
        isTimeout.value = true
        setError(`请求超时（${timeoutMs / 1000}秒），请稍后重试`)
        reject(new Error(`Operation timed out after ${timeoutMs}ms`))
      }, timeoutMs)
      
      // 执行操作
      operation()
        .then((result) => {
          clearTimeoutTimer()
          endLoading()
          resolve(result)
        })
        .catch((error) => {
          clearTimeoutTimer()
          // 如果不是超时错误，设置错误状态
          if (!isTimeout.value) {
            const message = error instanceof Error ? error.message : '操作失败'
            setError(message)
          }
          reject(error)
        })
    })
  }

  /**
   * 重试操作
   * 
   * 执行异步操作，失败时自动重试，直到成功或达到最大重试次数
   * 
   * @param operation - 要执行的异步操作
   * @returns 操作结果
   * @throws 达到最大重试次数后仍失败则抛出最后一次的错误
   * 
   * @requirement 10.2 - Show timeout prompt and provide retry option when API call times out
   * 
   * @example
   * ```typescript
   * try {
   *   const data = await retry(() => fetchData())
   *   console.log('获取数据成功:', data)
   * } catch (error) {
   *   console.log(`重试 ${retryAttempts.value} 次后仍然失败`)
   * }
   * ```
   */
  async function retry<T>(operation: () => Promise<T>): Promise<T> {
    // 重置重试计数
    retryAttempts.value = 0
    clearError()
    
    let lastError: Error | null = null
    
    while (retryAttempts.value <= retryCount) {
      try {
        // 使用 withTimeout 执行操作
        const result = await withTimeout(operation)
        return result
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        retryAttempts.value++
        
        // 如果还可以重试，等待一段时间后继续
        if (retryAttempts.value <= retryCount) {
          // 指数退避：每次重试等待时间翻倍
          const delay = Math.min(1000 * Math.pow(2, retryAttempts.value - 1), 10000)
          await new Promise(resolve => setTimeout(resolve, delay))
          clearError()
        }
      }
    }
    
    // 所有重试都失败了
    const finalMessage = `操作失败，已重试 ${retryCount} 次: ${lastError?.message || '未知错误'}`
    setError(finalMessage)
    throw lastError || new Error(finalMessage)
  }

  // ============================================================================
  // 返回值
  // ============================================================================

  return {
    // 状态
    isLoading,
    hasError,
    errorMessage,
    isTimeout,
    retryAttempts,
    canRetry,
    showSkeleton: showSkeletonComputed,
    
    // 方法
    startLoading,
    endLoading,
    setError,
    clearError,
    reset,
    retry,
    withTimeout
  }
}
