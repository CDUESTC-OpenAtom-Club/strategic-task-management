/**
 * Strategic Indicator Feature - Pinia Store
 * 
 * State management for strategic indicator feature.
 * Handles indicator list, filters, and CRUD operations.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Indicator, IndicatorFilters } from '@/entities/indicator/model/types'
import type { IndicatorListState, IndicatorStatistics } from './types'
import * as indicatorApi from '../api/query'
import * as indicatorMutations from '../api/mutations'

export const useIndicatorStore = defineStore('strategic-indicator', () => {
  // State
  const indicators = ref<Indicator[]>([])
  const total = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const currentIndicator = ref<Indicator | null>(null)
  const filters = ref<IndicatorFilters>({
    page: 0,
    size: 20
  })

  // Computed
  const listState = computed<IndicatorListState>(() => ({
    items: indicators.value,
    total: total.value,
    loading: loading.value,
    error: error.value
  }))

  const statistics = computed<IndicatorStatistics>(() => {
    const byStatus: Record<string, number> = {}
    const byLevel: Record<string, number> = {}
    let totalTarget = 0
    let totalActual = 0

    indicators.value.forEach(indicator => {
      // Count by status
      byStatus[indicator.status] = (byStatus[indicator.status] || 0) + 1
      
      // Count by level
      const level = indicator.level || 'UNKNOWN'
      byLevel[level] = (byLevel[level] || 0) + 1
      
      // Calculate completion
      if (indicator.targetValue && indicator.actualValue) {
        totalTarget += indicator.targetValue
        totalActual += indicator.actualValue
      }
    })

    const completionRate = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0

    return {
      total: indicators.value.length,
      byStatus,
      byLevel,
      completionRate
    }
  })

  // Actions
  async function fetchIndicators(newFilters?: Partial<IndicatorFilters>) {
    loading.value = true
    error.value = null

    try {
      if (newFilters) {
        filters.value = { ...filters.value, ...newFilters }
      }

      const response = await indicatorApi.queryIndicators(filters.value)
      indicators.value = response.content
      total.value = response.totalElements
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取指标列表失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchIndicatorById(id: number) {
    loading.value = true
    error.value = null

    try {
      const indicator = await indicatorApi.getIndicatorById(id)
      currentIndicator.value = indicator
      return indicator
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取指标详情失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function createIndicator(data: Partial<Indicator>) {
    loading.value = true
    error.value = null

    try {
      const newIndicator = await indicatorMutations.createIndicator(data)
      indicators.value.unshift(newIndicator)
      total.value += 1
      return newIndicator
    } catch (err) {
      error.value = err instanceof Error ? err.message : '创建指标失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateIndicator(id: number, data: Partial<Indicator>) {
    loading.value = true
    error.value = null

    try {
      const updated = await indicatorMutations.updateIndicator(id, data)
      
      // Update in list
      const index = indicators.value.findIndex(i => i.id === id)
      if (index !== -1) {
        indicators.value[index] = updated
      }
      
      // Update current if it's the same
      if (currentIndicator.value?.id === id) {
        currentIndicator.value = updated
      }
      
      return updated
    } catch (err) {
      error.value = err instanceof Error ? err.message : '更新指标失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deleteIndicator(id: number) {
    loading.value = true
    error.value = null

    try {
      await indicatorMutations.deleteIndicator(id)
      
      // Remove from list
      indicators.value = indicators.value.filter(i => i.id !== id)
      total.value -= 1
      
      // Clear current if it's the same
      if (currentIndicator.value?.id === id) {
        currentIndicator.value = null
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '删除指标失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function distributeIndicator(id: number, targetOrgIds: number[], message?: string, deadline?: string) {
    loading.value = true
    error.value = null

    try {
      const result = await indicatorMutations.distributeIndicator(id, {
        targetOrgIds,
        message,
        deadline
      })
      
      // Refresh the indicator
      await fetchIndicatorById(id)
      
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : '下发指标失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function withdrawIndicator(id: number, reason?: string) {
    loading.value = true
    error.value = null

    try {
      await indicatorMutations.withdrawIndicator(id, reason)
      
      // Refresh the indicator
      await fetchIndicatorById(id)
    } catch (err) {
      error.value = err instanceof Error ? err.message : '撤回指标失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function submitForApproval(id: number, comment?: string) {
    loading.value = true
    error.value = null

    try {
      const result = await indicatorMutations.submitIndicatorForApproval(id, comment)
      
      // Refresh the indicator
      await fetchIndicatorById(id)
      
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : '提交审批失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  function resetFilters() {
    filters.value = {
      page: 0,
      size: 20
    }
  }

  function clearError() {
    error.value = null
  }

  return {
    // State
    indicators,
    total,
    loading,
    error,
    currentIndicator,
    filters,
    
    // Computed
    listState,
    statistics,
    
    // Actions
    fetchIndicators,
    fetchIndicatorById,
    createIndicator,
    updateIndicator,
    deleteIndicator,
    distributeIndicator,
    withdrawIndicator,
    submitForApproval,
    resetFilters,
    clearError
  }
})
