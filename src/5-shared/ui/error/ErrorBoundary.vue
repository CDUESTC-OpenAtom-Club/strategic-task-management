<script setup lang="ts">
/**
 * ErrorBoundary - Vue error boundary component
 *
 * Catches errors in child components and displays a fallback UI
 * instead of crashing the entire application.
 *
 * @example
 * ```vue
 * <ErrorBoundary @error="handleError">
 *   <SomeComponent />
 *   <template #fallback>
 *     <div>Something went wrong</div>
 *   </template>
 * </ErrorBoundary>
 * ```
 */

import { ref, onErrorCaptured, provide } from 'vue'
import { useRouter } from 'vue-router'
import { logger } from '@/shared/lib/utils/logger'

export interface ErrorBoundaryProps {
  /** Whether to show technical error details */
  showDetails?: boolean
  /** Custom error message */
  errorMessage?: string
  /** Whether to show retry button */
  showRetry?: boolean
  /** Whether to show home button */
  showHome?: boolean
}

const props = withDefaults(defineProps<ErrorBoundaryProps>(), {
  showDetails: false,
  errorMessage: '页面加载出错，请稍后重试',
  showRetry: true,
  showHome: true
})

const emit = defineEmits<{
  error: [error: Error]
  retry: []
}>()

const router = useRouter()
const error = ref<Error | null>(null)
const errorInfo = ref<string>('')

onErrorCaptured((err: Error, instance, info: string) => {
  error.value = err
  errorInfo.value = info

  logger.error('[ErrorBoundary] Caught error:', {
    message: err.message,
    stack: err.stack,
    componentInfo: info,
    componentName: instance?.$options?.name || 'Unknown'
  })

  emit('error', err)

  // Prevent error from propagating further
  return false
})

const handleRetry = () => {
  error.value = null
  errorInfo.value = ''
  emit('retry')
}

const handleGoHome = () => {
  error.value = null
  errorInfo.value = ''
  router.push('/dashboard')
}

const handleGoBack = () => {
  error.value = null
  errorInfo.value = ''
  router.back()
}
</script>

<template>
  <div class="error-boundary">
    <!-- Normal content -->
    <slot v-if="!error" />

    <!-- Error fallback -->
    <slot v-else name="fallback">
      <div class="error-boundary-fallback">
        <div class="error-icon">
          <el-icon :size="48" color="var(--el-color-danger)">
            <WarningFilled />
          </el-icon>
        </div>

        <h3 class="error-title">页面错误</h3>
        <p class="error-message">{{ errorMessage }}</p>

        <!-- Technical details (collapsible) -->
        <el-collapse v-if="showDetails && error" class="error-details">
          <el-collapse-item title="错误详情" name="details">
            <pre class="error-stack">{{ error.message }}</pre>
            <pre v-if="error.stack" class="error-stack">{{ error.stack }}</pre>
          </el-collapse-item>
        </el-collapse>

        <!-- Action buttons -->
        <div class="error-actions">
          <el-button v-if="showRetry" type="primary" @click="handleRetry"> 重试 </el-button>
          <el-button @click="handleGoBack">返回上一页</el-button>
          <el-button v-if="showHome" @click="handleGoHome">回到首页</el-button>
        </div>
      </div>
    </slot>
  </div>
</template>

<script lang="ts">
import { WarningFilled } from '@element-plus/icons-vue'

export default {
  name: 'ErrorBoundary',
  components: {
    WarningFilled
  }
}
</script>

<style scoped>
.error-boundary {
  width: 100%;
}

.error-boundary-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 40px 20px;
  text-align: center;
}

.error-icon {
  margin-bottom: 16px;
}

.error-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0 0 8px 0;
}

.error-message {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin: 0 0 24px 0;
  max-width: 400px;
}

.error-details {
  width: 100%;
  max-width: 600px;
  margin-bottom: 24px;
}

.error-stack {
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 12px;
  color: var(--el-text-color-regular);
  background: var(--el-fill-color-light);
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  text-align: left;
}

.error-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}
</style>
