/**
 * useTimeoutManager - 定时器生命周期管理
 *
 * 自动追踪和清理 setTimeout 定时器，防止内存泄漏
 *
 * @example
 * ```ts
 * const { addTimeout, addDelayedSequence } = useTimeoutManager()
 *
 * // 单个定时器
 * addTimeout(() => {
 *   console.log('Delayed action')
 * }, 1000)
 *
 * // 延迟序列（用于动画调整）
 * const resizeChart = () => chart?.resize()
 * addDelayedSequence(resizeChart, [100, 200, 300])
 * ```
 *
 * @composable
 */
import { onUnmounted } from 'vue'
import { logger } from '@/utils/logger'

export interface TimeoutManager {
  /**
   * 添加一个定时器
   * @param handler - 延迟执行的回调函数
   * @param delay - 延迟时间（毫秒）
   */
  addTimeout: (handler: () => void, delay: number) => void

  /**
   * 添加一系列延迟执行的回调
   * 适用于需要多次调整的场景（如图表动画）
   *
   * @param handler - 延迟执行的回调函数
   * @param delays - 延迟时间数组（毫秒）
   */
  addDelayedSequence: (handler: () => void, delays: number[]) => void

  /**
   * 清除所有定时器
   * 通常不需要手动调用，组件卸载时会自动清理
   */
  clearAll: () => void

  /**
   * 获取当前活跃的定时器数量
   * 主要用于调试和监控
   */
  getActiveCount: () => number
}

export function useTimeoutManager(): TimeoutManager {
  const timers: Set<ReturnType<typeof setTimeout>> = new Set()

  const addTimeout = (handler: () => void, delay: number): void => {
    const timer = setTimeout(() => {
      try {
        handler()
      } catch (error) {
        console.error('[useTimeoutManager] Error in timeout handler:', error)
      } finally {
        // 执行完成后自动清理
        timers.delete(timer)
      }
    }, delay)
    timers.add(timer)
  }

  /**
   * 添加一系列延迟执行的回调
   * 适用于动画场景的多次调整
   */
  const addDelayedSequence = (
    handler: () => void,
    delays: number[]
  ): void => {
    delays.forEach(delay => {
      addTimeout(handler, delay)
    })
  }

  const clearAll = (): void => {
    timers.forEach(timer => clearTimeout(timer))
    timers.clear()
  }

  const getActiveCount = (): number => timers.size

  // 组件卸载时自动清理所有定时器
  onUnmounted(() => {
    if (timers.size > 0) {
      logger.debug(`[useTimeoutManager] Cleaning up ${timers.size} timeout(s)`)
    }
    clearAll()
  })

  return {
    addTimeout,
    addDelayedSequence,
    clearAll,
    getActiveCount
  }
}
