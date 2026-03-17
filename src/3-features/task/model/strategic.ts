/**
 * Strategic Store
 *
 * Manages strategic indicators and tasks.
 * Note: This store should eventually be migrated to features/task/model/store.ts
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { StrategicIndicator, StrategicTask } from '@/5-shared/types'
import { indicatorApi } from '@/3-features/indicator/api'
import { logger } from '@/5-shared/lib/utils/logger'

type BackendIndicatorListPayload =
  | StrategicIndicator[]
  | {
      items?: Array<Record<string, unknown>>
      totalPages?: number
    }

function getRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object') {
    return value as Record<string, unknown>
  }
  return {}
}

function getString(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (value !== undefined && value !== null) {
      const text = String(value).trim()
      if (text) {
        return text
      }
    }
  }
  return ''
}

function getNumber(record: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = record[key]
    const num = Number(value)
    if (Number.isFinite(num)) {
      return num
    }
  }
  return 0
}

function getBoolean(record: Record<string, unknown>, ...keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'boolean') {
      return value
    }
    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true') {
        return true
      }
      if (value.toLowerCase() === 'false') {
        return false
      }
    }
  }
  return undefined
}

function toStrategicIndicator(raw: unknown): StrategicIndicator {
  const item = getRecord(raw)
  const id = getString(item, 'id', 'indicatorId')
  const createdAt = getString(item, 'createdAt', 'createTime') || new Date().toISOString()
  const parsedYear = Number(getString(item, 'year'))
  const year = Number.isFinite(parsedYear) && parsedYear > 0 ? parsedYear : new Date(createdAt).getFullYear()
  const level = getString(item, 'level')
  const status = getString(item, 'status').toUpperCase() || 'DRAFT'
  const isStrategic = getBoolean(item, 'isStrategic')

  return {
    id: id || String(Date.now()),
    name: getString(item, 'name', 'indicatorName', 'indicatorDesc') || `指标${id || ''}`,
    isQualitative: getBoolean(item, 'isQualitative') ?? false,
    type1: (getString(item, 'type1', 'indicatorType1') || '定量') as '定性' | '定量',
    type2: (getString(item, 'type2', 'indicatorType2') || '基础性') as '发展性' | '基础性',
    progress: getNumber(item, 'progress'),
    createTime: createdAt,
    weight: getNumber(item, 'weight', 'weightPercent'),
    remark: getString(item, 'remark', 'indicatorDesc'),
    canWithdraw: getBoolean(item, 'canWithdraw') ?? status === 'DISTRIBUTED',
    taskContent: getString(item, 'taskContent', 'taskName', 'indicatorName', 'indicatorDesc'),
    milestones: Array.isArray(item.milestones) ? item.milestones : [],
    targetValue: getNumber(item, 'targetValue') || 100,
    actualValue: getNumber(item, 'actualValue', 'progress'),
    unit: getString(item, 'unit') || '%',
    responsibleDept: getString(item, 'responsibleDept', 'departmentName', 'targetOrgName', 'targetOrgId'),
    responsiblePerson: getString(item, 'responsiblePerson'),
    status: status as StrategicIndicator['status'],
    isStrategic: isStrategic ?? (level === 'FIRST' || level === 'STRAT_TO_FUNC'),
    ownerDept: getString(item, 'ownerDept', 'ownerOrgName', 'ownerOrgId'),
    year,
    parentIndicatorId: getString(item, 'parentIndicatorId', 'parentId') || undefined,
    progressApprovalStatus: getString(item, 'progressApprovalStatus').toUpperCase() || 'NONE',
    pendingProgress: getNumber(item, 'pendingProgress') || undefined,
    pendingRemark: getString(item, 'pendingRemark') || undefined,
    pendingAttachments: Array.isArray(item.pendingAttachments) ? item.pendingAttachments : [],
    statusAudit: Array.isArray(item.statusAudit) ? item.statusAudit : []
  }
}

function normalizeIndicators(payload: BackendIndicatorListPayload | null | undefined): StrategicIndicator[] {
  if (!payload) {
    return []
  }

  if (Array.isArray(payload)) {
    return payload.map(item => toStrategicIndicator(item))
  }

  const rawItems = Array.isArray(payload.items) ? payload.items : []
  return rawItems.map(item => toStrategicIndicator(item))
}

export const useStrategicStore = defineStore('strategic', () => {
  // ============ State ============

  const indicators = ref<StrategicIndicator[]>([])
  const loading = ref(false)
  const loadingState = ref({
    indicators: false,
    tasks: false,
    error: null as string | null
  })
  const error = ref<string | null>(null)
  const dataSource = ref<'api' | 'fallback' | 'local'>('local')

  // ============ Getters ============

  const activeIndicators = computed(() => indicators.value.filter(i => i.status === 'active'))

  const strategicIndicators = computed(() => indicators.value.filter(i => i.isStrategic === true))

  // Legacy compatibility: several pages still expect a task collection on this store.
  const tasks = computed<StrategicTask[]>(() => {
    const taskMap = new Map<string, StrategicTask>()

    indicators.value.forEach(indicator => {
      const taskKey = indicator.taskContent || indicator.id || indicator.name
      if (!taskMap.has(taskKey)) {
        taskMap.set(taskKey, {
          id: taskKey,
          title: indicator.taskContent || indicator.name || '未命名任务',
          desc: indicator.remark || '',
          createTime: indicator.createTime || new Date().toISOString(),
          cycle: `${indicator.year || new Date().getFullYear()}年度`,
          startDate: new Date(`${indicator.year || new Date().getFullYear()}-01-01`),
          endDate: new Date(`${indicator.year || new Date().getFullYear()}-12-31`),
          status: 'active',
          createdBy: indicator.ownerDept || 'system',
          indicators: [],
          year: indicator.year || new Date().getFullYear(),
          isRecurring: false
        })
      }

      const task = taskMap.get(taskKey)
      if (task) {
        task.indicators.push(indicator)
      }
    })

    return [...taskMap.values()]
  })

  // ============ Actions ============

  async function loadIndicatorsByYear(year: number) {
    loading.value = true
    loadingState.value.indicators = true
    loadingState.value.error = null
    error.value = null

    try {
      logger.debug(`[Strategic Store] Loading indicators for year ${year}`)
      const response = await indicatorApi.getAllIndicators(year, { page: 0, size: 1000 })

      if (response.success && response.data) {
        indicators.value = normalizeIndicators(response.data as BackendIndicatorListPayload)
        dataSource.value = 'api'
        logger.debug(`[Strategic Store] Loaded ${indicators.value.length} indicators`)
      } else {
        throw new Error(response.message || 'Failed to load indicators')
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      loadingState.value.error = error.value
      dataSource.value = 'fallback'
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
    loadingState.value.error = null
  }

  return {
    indicators,
    tasks,
    loading,
    loadingState,
    error,
    dataSource,
    activeIndicators,
    strategicIndicators,
    loadIndicatorsByYear,
    updateIndicator,
    deleteIndicator,
    clearError
  }
})
