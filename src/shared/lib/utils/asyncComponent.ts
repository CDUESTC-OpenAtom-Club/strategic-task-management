/**
 * 异步组件加载工具
 *
 * 功能:
 * - 提供统一的异步组件加载方式
 * - 自动处理加载状态
 * - 错误重试机制
 * - 性能监控
 */

import { defineAsyncComponent, type AsyncComponentLoader } from 'vue'
import { ElSkeleton } from 'element-plus'
import { logger } from './logger'

export interface AsyncComponentOptions {
  /** 加载延迟时间 (ms) */
  delay?: number
  /** 超时时间 (ms) */
  timeout?: number
  /** 最大重试次数 */
  maxRetries?: number
  /** 是否显示骨架屏 */
  showSkeleton?: boolean
}

/**
 * 创建异步组件
 */
export function createAsyncComponent(
  loader: AsyncComponentLoader,
  options: AsyncComponentOptions = {}
) {
  const { delay = 200, timeout = 10000, maxRetries = 2, showSkeleton = true } = options

  return defineAsyncComponent({
    loader: createRetryLoader(loader, maxRetries),
    delay,
    timeout,
    loadingComponent: showSkeleton ? createLoadingComponent() : undefined,
    errorComponent: createErrorComponent(),
    onError(error, retry, fail) {
      // 失败处理逻辑
      logger.error('[AsyncComponent] 组件加载失败', {
        error: error.message,
        stack: error.stack
      })

      // 网络错误或超时可以重试
      if (
        error.message.includes('fetch') ||
        error.message.includes('timeout') ||
        error.message.includes('network')
      ) {
        logger.debug('[AsyncComponent] 尝试重新加载组件')
        retry()
      } else {
        // 其他错误直接失败
        fail()
      }
    },
    suspensible: false // 不使用Suspense，手动处理加载状态
  })
}

/**
 * 创建带重试的加载器
 */
function createRetryLoader(loader: AsyncComponentLoader, maxRetries: number): AsyncComponentLoader {
  return async () => {
    let lastError: Error | undefined

    for (let i = 0; i <= maxRetries; i++) {
      try {
        const startTime = performance.now()
        const component = await loader()
        const loadTime = performance.now() - startTime

        // 记录组件加载性能
        if (loadTime > 1000) {
          logger.warn(`[AsyncComponent] 组件加载耗时: ${loadTime.toFixed(2)}ms`)
        }

        return component
      } catch (error) {
        lastError = error as Error

        if (i < maxRetries) {
          // 等待一段时间后重试
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
          logger.debug(`[AsyncComponent] 重试加载组件 (${i + 1}/${maxRetries})`)
        }
      }
    }

    throw lastError
  }
}

/**
 * 创建加载组件
 */
function createLoadingComponent() {
  return {
    template: `
      <div class="async-component-loading">
        <el-skeleton :rows="5" animated />
      </div>
    `,
    setup() {
      return () =>
        h('div', { class: 'async-component-loading' }, [h(ElSkeleton, { rows: 5, animated: true })])
    }
  }
}

/**
 * 创建错误组件
 */
function createErrorComponent() {
  return {
    template: `
      <div class="async-component-error">
        <el-empty description="组件加载失败">
          <el-button type="primary" @click="retry">重新加载</el-button>
        </el-empty>
      </div>
    `,
    setup() {
      // 简化版，实际可以添加重试逻辑
      return {}
    }
  }
}

/**
 * 批量创建异步组件
 */
export function createAsyncComponents<T extends Record<string, AsyncComponentLoader>>(
  loaders: T,
  options?: AsyncComponentOptions
): Record<keyof T, ReturnType<typeof createAsyncComponent>> {
  const result = {} as Record<keyof T, ReturnType<typeof createAsyncComponent>>

  for (const [key, loader] of Object.entries(loaders)) {
    result[key as keyof T] = createAsyncComponent(loader, options)
  }

  return result
}

/**
 * 预加载组件（用于路由预加载）
 */
export function preloadComponent(loader: AsyncComponentLoader): Promise<void> {
  return new Promise((resolve, reject) => {
    loader()
      .then(() => {
        logger.debug('[AsyncComponent] 组件预加载成功')
        resolve()
      })
      .catch(error => {
        logger.error('[AsyncComponent] 组件预加载失败', error)
        reject(error)
      })
  })
}
