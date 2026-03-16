/**
 * Strategic Store
 *
 * Manages strategic indicators and tasks.
 * Note: This store should eventually be migrated to features/task/model/store.ts
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { StrategicIndicator } from '@/5-shared/types'
import { indicatorApi } from '@/3-features/indicator/api'
import { logger } from '@/5-shared/lib/utils/logger'

export const useStrategicStore = defineStore('strategic', () => {
  // ============ State ============

  const indicators = ref<StrategicIndicator[]>([])
  const loading = ref(false)
  const loadingState = ref({
    indicators: false,
    tasks: false
  })
  const error = ref<string | null>(null)

  // ============ Getters ============

  const activeIndicators = computed(() => indicators.value.filter(i => i.status === 'active'))

  const strategicIndicators = computed(() => indicators.value.filter(i => i.isStrategic === true))

  // ============ Actions ============

  async function loadIndicatorsByYear(year: number) {
    loading.value = true
    loadingState.value.indicators = true
    error.value = null

    try {
      logger.debug(`[Strategic Store] Loading indicators for year ${year}`)
      const response = await indicatorApi.getAllIndicators(year)

      if (response.success && response.data) {
        indicators.value = response.data
        logger.debug(`[Strategic Store] Loaded ${response.data.length} indicators`)
      } else {
        throw new Error(response.message || 'Failed to load indicators')
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      logger.error('[Strategic Store] Failed to load indicators:', err)
      throw err
    } finally {
      loading.value = false
      loadingState.value.indicators = false
    }
  }

  async function updateIndicator(id: string, data: Partial<StrategicIndicator>) {
    try {
      logger.debug(`[Strategic Store] Updating indicator ${id}`)
      const response = await indicatorApi.updateIndicator(id, data)

      if (response.success) {
        // Update local state
        const index = indicators.value.findIndex(i => i.id === id)
        if (index !== -1 && response.data) {
          indicators.value[index] = { ...indicators.value[index], ...response.data }
        }
        logger.debug(`[Strategic Store] Indicator ${id} updated successfully`)
      } else {
        throw new Error(response.message || 'Failed to update indicator')
      }

      return response
    } catch (err) {
      logger.error('[Strategic Store] Failed to update indicator:', err)
      throw err
    }
  }

  async function deleteIndicator(id: string) {
    try {
      logger.debug(`[Strategic Store] Deleting indicator ${id}`)
      const response = await indicatorApi.deleteIndicator(id)

      if (response.success) {
        // Remove from local state
        const index = indicators.value.findIndex(i => i.id === id)
        if (index !== -1) {
          indicators.value.splice(index, 1)
        }
        logger.debug(`[Strategic Store] Indicator ${id} deleted successfully`)
      } else {
        throw new Error(response.message || 'Failed to delete indicator')
      }

      return response
    } catch (err) {
      logger.error('[Strategic Store] Failed to delete indicator:', err)
      throw err
    }
  }

  function clearError() {
    error.value = null
  }

  return {
    indicators,
    loading,
    loadingState,
    error,
    activeIndicators,
    strategicIndicators,
    loadIndicatorsByYear,
    updateIndicator,
    deleteIndicator,
    clearError
  }
})
