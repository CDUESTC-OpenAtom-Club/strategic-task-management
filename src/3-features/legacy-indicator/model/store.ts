/**
 * Indicator Feature Store
 *
 * Manages indicator state and operations
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { StrategicIndicator } from '@/5-shared/types'
import { logger } from '@/5-shared/lib/utils/logger'

export const useIndicatorStore = defineStore('indicator', () => {
  const indicators = ref<StrategicIndicator[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchIndicators = async () => {
    loading.value = true
    error.value = null
    try {
      // API call will be implemented when needed
      logger.debug('[indicatorStore] Fetching indicators')
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      logger.error('[indicatorStore] Failed to fetch indicators:', err)
    } finally {
      loading.value = false
    }
  }

  return {
    indicators,
    loading,
    error,
    fetchIndicators
  }
})
