/**
 * Strategic Store
 *
 * Manages strategic indicators and tasks.
 * Note: This store should eventually be migrated to features/task/model/store.ts
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { StrategicIndicator, StrategicTask } from '@/shared/types'
import { indicatorApi } from '@/features/indicator/api'
import { milestoneApi } from '@/entities/milestone/api/milestoneApi'
import { strategicApi } from '@/features/task/api/strategicApi'
import { logger } from '@/shared/lib/utils/logger'
import { useOrgStore } from '@/features/organization/model/store'
import type { Department } from '@/features/organization/api'

type BackendIndicatorListPayload =
  | StrategicIndicator[]
  | {
      items?: Array<Record<string, unknown>>
      totalPages?: number
    }

type TaskTypeLookupItem = {
  taskType?: string
  taskName?: string
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

function normalizeMilestoneStatus(status: unknown): 'pending' | 'completed' | 'overdue' {
  const normalized = String(status || '').trim().toUpperCase()
  if (normalized === 'COMPLETED') {
    return 'completed'
  }
  if (normalized === 'DELAYED' || normalized === 'CANCELED' || normalized === 'OVERDUE') {
    return 'overdue'
  }
  return 'pending'
}

function normalizeMilestones(rawMilestones: unknown): StrategicIndicator['milestones'] {
  if (!Array.isArray(rawMilestones)) {
    return []
  }

  return rawMilestones.map((milestone, index) => {
    const item = getRecord(milestone)
    return {
      id: getString(item, 'id', 'milestoneId') || `milestone-${index}`,
      name: getString(item, 'name', 'milestoneName') || `里程碑${index + 1}`,
      targetProgress: getNumber(item, 'targetProgress', 'weightPercent'),
      deadline: getString(item, 'deadline', 'dueDate'),
      status: normalizeMilestoneStatus(item.status),
      isPaired: getBoolean(item, 'isPaired') ?? false,
      weightPercent: getNumber(item, 'weightPercent', 'targetProgress'),
      sortOrder: getNumber(item, 'sortOrder') || index
    }
  })
}

function normalizeType2FromTaskType(taskType: unknown): '发展性' | '基础性' | '其他' {
  const normalized = String(taskType || '').trim().toUpperCase()
  if (normalized === 'DEVELOPMENT') {
    return '发展性'
  }
  if (normalized === 'BASIC') {
    return '基础性'
  }
  return '其他'
}

function toStrategicIndicator(raw: unknown): StrategicIndicator {
  const item = getRecord(raw)
  const id = getString(item, 'id', 'indicatorId')
  const taskId = getString(item, 'taskId', 'task_id', 'planId', 'strategicTaskId')
  const taskContentRaw = getString(item, 'taskContent', 'taskName', 'indicatorName', 'indicatorDesc')
  const taskContent = taskContentRaw || (taskId ? `计划-${taskId}` : '')
  const createdAt = getString(item, 'createdAt', 'createTime') || new Date().toISOString()
  const parsedYear = Number(getString(item, 'year'))
  const year = Number.isFinite(parsedYear) && parsedYear > 0 ? parsedYear : new Date(createdAt).getFullYear()
  const level = getString(item, 'level')
  const status = getString(item, 'status').toUpperCase() || 'DRAFT'
  const isStrategic = getBoolean(item, 'isStrategic')
  // 历史数据中 isStrategic 可能全部为 false，但 FIRST/STRAT_TO_FUNC 仍代表战略指标。
  // 为避免任务下发页被误过滤为空，这里以层级语义优先兜底。
  const normalizedIsStrategic =
    isStrategic === true || level === 'FIRST' || level === 'STRAT_TO_FUNC'

  const normalizedIndicator: StrategicIndicator = {
    id: id || String(Date.now()),
    name: getString(item, 'name', 'indicatorName', 'indicatorDesc') || `指标${id || ''}`,
    isQualitative: getBoolean(item, 'isQualitative') ?? false,
    type1: (getString(item, 'type1', 'indicatorType1', 'indicatorType') || '定量') as '定性' | '定量',
    // type2 已从后端库表移除，前端仅做展示兼容，不再作为业务判断依据
    type2: (getString(item, 'type2', 'indicatorType2') || '其他') as '发展性' | '基础性',
    progress: getNumber(item, 'progress'),
    createTime: createdAt,
    weight: getNumber(item, 'weight', 'weightPercent'),
    remark: getString(item, 'remark'),
    canWithdraw: getBoolean(item, 'canWithdraw') ?? status === 'DISTRIBUTED',
    taskContent: taskContent,
    milestones: normalizeMilestones(item.milestones),
    targetValue: getNumber(item, 'targetValue') || 100,
    actualValue: getNumber(item, 'actualValue', 'progress'),
    unit: getString(item, 'unit') || '%',
    responsibleDept: getString(item, 'responsibleDept', 'departmentName', 'targetOrgName', 'targetOrgId'),
    responsiblePerson: getString(item, 'responsiblePerson'),
    status: status as StrategicIndicator['status'],
    isStrategic: normalizedIsStrategic,
    ownerDept: getString(item, 'ownerDept', 'ownerOrgName', 'ownerOrgId'),
    year,
    parentIndicatorId: getString(item, 'parentIndicatorId', 'parentId') || undefined,
    progressApprovalStatus: getString(item, 'progressApprovalStatus').toUpperCase() || 'NONE',
    pendingProgress: getNumber(item, 'pendingProgress') || undefined,
    pendingRemark: getString(item, 'pendingRemark') || undefined,
    pendingAttachments: Array.isArray(item.pendingAttachments) ? item.pendingAttachments : [],
    statusAudit: Array.isArray(item.statusAudit) ? item.statusAudit : []
  }

  // 保留后端 taskId（运行时字段），供页面按唯一主键关联任务类型。
  if (taskId) {
    ;(normalizedIndicator as StrategicIndicator & { taskId?: string }).taskId = taskId
  }

  return normalizedIndicator
}

function buildTaskLookup(rawTasks: unknown): Map<string, TaskTypeLookupItem> {
  if (!Array.isArray(rawTasks)) {
    return new Map()
  }

  const lookup = new Map<string, TaskTypeLookupItem>()
  rawTasks.forEach(task => {
    const item = getRecord(task)
    const taskId = getString(item, 'taskId', 'id')
    if (!taskId) {
      return
    }

    lookup.set(taskId, {
      taskType: getString(item, 'taskType'),
      taskName: getString(item, 'taskName', 'name')
    })
  })
  return lookup
}

function applyTaskMetadata(
  list: StrategicIndicator[],
  taskLookup: Map<string, TaskTypeLookupItem>
): StrategicIndicator[] {
  if (taskLookup.size === 0) {
    return list
  }

  return list.map(indicator => {
    const taskId = String((indicator as StrategicIndicator & { taskId?: string | number }).taskId || '').trim()
    if (!taskId) {
      return indicator
    }

    const taskInfo = taskLookup.get(taskId)
    if (!taskInfo) {
      return indicator
    }

    const normalizedType2 = normalizeType2FromTaskType(taskInfo.taskType)
    return {
      ...indicator,
      type2: normalizedType2 === '其他' ? indicator.type2 : normalizedType2,
      taskContent: taskInfo.taskName || indicator.taskContent
    }
  })
}

async function hydrateIndicatorMilestones(list: StrategicIndicator[]): Promise<StrategicIndicator[]> {
  const indicatorsWithoutMilestones = list.filter(indicator => !indicator.milestones?.length)
  if (indicatorsWithoutMilestones.length === 0) {
    return list
  }

  // 批量查询：1 个请求替代 N 个请求，消除 N+1 问题
  const indicatorIds = indicatorsWithoutMilestones
    .map(i => Number(i.id))
    .filter(id => Number.isFinite(id))

  const milestoneMap = new Map<string, StrategicIndicator['milestones']>()

  if (indicatorIds.length > 0) {
    try {
      const response = await milestoneApi.getMilestonesByIndicatorIds(indicatorIds)
      if (response?.success && response.data) {
        // response.data 是 Record<number, Milestone[]>
        for (const [idStr, rawMilestones] of Object.entries(response.data)) {
          milestoneMap.set(idStr, normalizeMilestones(rawMilestones))
        }
      }
    } catch (err) {
      logger.warn('[Strategic Store] Batch milestones fetch failed, falling back to empty', err)
    }
  }

  return list.map(indicator => ({
    ...indicator,
    milestones: milestoneMap.get(String(indicator.id)) ?? indicator.milestones ?? []
  }))
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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message
  }

  return '操作失败，请稍后重试'
}

function buildDepartmentResolver(departments: Department[]) {
  const idToName = new Map<string, string>()
  const aliasToCanonical = new Map<string, string>()

  departments.forEach(dept => {
    const canonical = String(dept.name || '').trim()
    const id = String(dept.id || '').trim()

    if (!canonical) {
      return
    }

    if (id) {
      idToName.set(id, canonical)
    }

    // 完整名称本身可被解析
    aliasToCanonical.set(canonical, canonical)

    // 兼容合并名称：例如 "党委办公室 | 党委统战部"
    canonical
      .split('|')
      .map(part => part.trim())
      .filter(Boolean)
      .forEach(part => {
        aliasToCanonical.set(part, canonical)
      })
  })

  return (value: string): string => {
    const raw = String(value || '').trim()
    if (!raw) {
      return ''
    }

    const mappedById = idToName.get(raw)
    if (mappedById) {
      return mappedById
    }

    const mappedByAlias = aliasToCanonical.get(raw)
    if (mappedByAlias) {
      return mappedByAlias
    }

    return raw
  }
}

function normalizeIndicatorDepartments(
  list: StrategicIndicator[],
  resolveDept: (value: string) => string
): StrategicIndicator[] {
  return list.map(item => ({
    ...item,
    ownerDept: resolveDept(item.ownerDept || ''),
    responsibleDept: resolveDept(item.responsibleDept || '')
  }))
}

function resolveDepartmentIdByName(
  departments: Department[],
  value: string | undefined | null
): number | null {
  const raw = String(value || '').trim()
  if (!raw) {
    return null
  }

  const directMatch = departments.find(dept => dept.name === raw || dept.id === raw)
  if (directMatch) {
    return Number(directMatch.id)
  }

  const aliasMatch = departments.find(dept =>
    dept.name
      .split('|')
      .map(part => part.trim())
      .filter(Boolean)
      .includes(raw)
  )
  if (aliasMatch) {
    return Number(aliasMatch.id)
  }

  return null
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
  const loadingYearPromise = ref<Promise<StrategicIndicator[]> | null>(null)
  const loadingYear = ref<number | null>(null)

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
    if (loadingYearPromise.value && loadingYear.value === year) {
      return loadingYearPromise.value
    }

    loading.value = true
    loadingState.value.indicators = true
    loadingState.value.error = null
    error.value = null

    loadingYear.value = year
    const request = (async () => {
      try {
        logger.debug(`[Strategic Store] Loading indicators for year ${year}`)
        const [response, tasksResponse] = await Promise.all([
          indicatorApi.getAllIndicators(year, { page: 0, size: 1000 }),
          strategicApi.getTasksByYear(year)
        ])

        if (response.success && response.data) {
          const normalized = normalizeIndicators(response.data as BackendIndicatorListPayload)
          const taskLookup = buildTaskLookup(tasksResponse.data)
          const aligned = applyTaskMetadata(normalized, taskLookup)
          const hydrated = await hydrateIndicatorMilestones(aligned)

          // 统一部门字段：ID/别名 -> 标准部门名（含合并名称），避免跨页面筛选不命中
          const orgStore = useOrgStore()
          if (!orgStore.loaded || orgStore.departments.length === 0) {
            try {
              await orgStore.loadDepartments()
            } catch (orgError) {
              logger.warn('[Strategic Store] 组织数据加载失败，跳过部门归一化', orgError)
            }
          }
          const resolveDept = buildDepartmentResolver(orgStore.departments)
          indicators.value = normalizeIndicatorDepartments(hydrated, resolveDept)

          dataSource.value = 'api'
          logger.debug(`[Strategic Store] Loaded ${indicators.value.length} indicators`)
          return indicators.value
        }

        throw new Error(response.message || 'Failed to load indicators')
      } catch (err) {
        error.value = err instanceof Error ? err.message : 'Unknown error'
        loadingState.value.error = error.value
        dataSource.value = 'fallback'
        logger.error('[Strategic Store] Failed to load indicators:', err)
        throw err
      } finally {
        loading.value = false
        loadingState.value.indicators = false
        loadingYearPromise.value = null
        loadingYear.value = null
      }
    })()

    loadingYearPromise.value = request
    return request
  }

  async function updateIndicator(id: string, data: Record<string, unknown>) {
    console.log('[Strategic Store] updateIndicator called with id:', id, 'data:', data)
    try {
      // logger.debug(`[Strategic Store] Updating indicator ${id}`, data)

      const isPersistedId = /^\d+$/.test(id)
      console.log('[Strategic Store] isPersistedId:', isPersistedId, 'id:', id)
      if (!isPersistedId) {
        throw new Error(`指标 ${id} 尚未持久化，无法更新后端数据`)
      }

      const index = indicators.value.findIndex(i => String(i.id) === String(id))
      const response = await indicatorApi.updateIndicator(id, data)
      console.log('[Strategic Store] Raw API response:', JSON.stringify(response))
      console.log('[Strategic Store] API response keys:', Object.keys(response))
      console.log('[Strategic Store] API response.success:', response.success)
      console.log('[Strategic Store] API response.code:', response.code)
      console.log('[Strategic Store] API response.message:', response.message)
      console.log('[Strategic Store] API response.data:', response.data)
      // logger.debug(`[Strategic Store] API response:`, response)

      if (response.success) {
        if (index !== -1 && response.data) {
          const normalized = toStrategicIndicator(response.data)
          indicators.value[index] = {
            ...indicators.value[index],
            ...normalized
          }
        }
        // logger.debug(`[Strategic Store] Indicator ${id} updated successfully`)
      } else {
        throw new Error(response.message || 'Failed to update indicator')
      }

      return response
    } catch (err) {
      console.error('[Strategic Store] updateIndicator error:', err)
      console.error('[Strategic Store] Error stack:', err instanceof Error ? err.stack : 'N/A')
      logger.error('[Strategic Store] Failed to update indicator:', err)
      throw new Error(getErrorMessage(err))
    }
  }

  async function deleteIndicator(id: string) {
    try {
      logger.debug(`[Strategic Store] Deleting indicator ${id}`)

      const isPersistedId = /^\d+$/.test(id)
      if (!isPersistedId) {
        throw new Error(`指标 ${id} 尚未持久化，无法删除后端数据`)
      }

      const response = await indicatorApi.deleteIndicator(id)

      if (response.success) {
        // Remove from local state
        const index = indicators.value.findIndex(i => String(i.id) === id)
        if (index !== -1) {
          indicators.value.splice(index, 1)
        }
        logger.debug(`[Strategic Store] Indicator ${id} deleted successfully`)
      } else {
        const msg = String(response.message || '')
        // 后端已删除/不存在：前端视作删除成功，避免重复删除时阻断流程
        if (msg.includes('not found') || msg.includes('already deleted') || msg.includes('不存在')) {
          const index = indicators.value.findIndex(i => String(i.id) === id)
          if (index !== -1) {
            indicators.value.splice(index, 1)
          }
          logger.warn(
            `[Strategic Store] Indicator ${id} was already removed in backend, treated as success`
          )
          return {
            ...response,
            success: true
          }
        }
        throw new Error(response.message || 'Failed to delete indicator')
      }

      return response
    } catch (err) {
      logger.error('[Strategic Store] Failed to delete indicator:', err)
      throw err
    }
  }

  async function addIndicator(
    indicator: StrategicIndicator & {
      taskId?: string | number
    }
  ) {
    try {
      logger.debug('[Strategic Store] Creating indicator', indicator)

      const orgStore = useOrgStore()
      if (!orgStore.loaded || orgStore.departments.length === 0) {
        await orgStore.loadDepartments()
      }

      const ownerOrgId =
        resolveDepartmentIdByName(orgStore.departments, indicator.ownerDept) ||
        resolveDepartmentIdByName(orgStore.departments, '战略发展部')
      const targetOrgId =
        resolveDepartmentIdByName(orgStore.departments, indicator.responsibleDept) || ownerOrgId

      if (!ownerOrgId || !targetOrgId) {
        throw new Error('缺少指标归属部门信息，无法创建指标')
      }

      const taskId =
        indicator.taskId !== undefined && indicator.taskId !== null && `${indicator.taskId}`.trim()
          ? Number(indicator.taskId)
          : undefined
      const parentIndicatorId =
        indicator.parentIndicatorId !== undefined &&
        indicator.parentIndicatorId !== null &&
        `${indicator.parentIndicatorId}`.trim()
          ? Number(indicator.parentIndicatorId)
          : undefined

      const response = await indicatorApi.createIndicator({
        indicatorDesc: indicator.name,
        taskId: Number.isFinite(taskId) ? taskId : undefined,
        parentIndicatorId: Number.isFinite(parentIndicatorId) ? parentIndicatorId : undefined,
        ownerOrgId,
        targetOrgId,
        weightPercent: Number(indicator.weight) || 0,
        sortOrder: 0,
        remark: indicator.remark || undefined,
        progress: Number(indicator.progress) || 0
      })

      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to create indicator')
      }

      const normalized = toStrategicIndicator(response.data)
      indicators.value.unshift(normalized)
      return response
    } catch (err) {
      logger.error('[Strategic Store] Failed to create indicator:', err)
      throw err
    }
  }

  async function withdrawIndicator(id: string, reason?: string) {
    try {
      logger.debug(`[Strategic Store] Withdrawing indicator ${id}`)

      if (!/^\d+$/.test(id)) {
        throw new Error(`指标 ${id} 尚未持久化，无法撤回`)
      }

      const response = await indicatorApi.withdrawIndicator(id)
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to withdraw indicator')
      }

      const index = indicators.value.findIndex(i => String(i.id) === String(id))
      if (index !== -1) {
        const normalized = toStrategicIndicator(response.data)
        indicators.value[index] = {
          ...indicators.value[index],
          ...normalized,
          remark: reason || normalized.remark || indicators.value[index].remark
        }
      }

      return response
    } catch (err) {
      logger.error('[Strategic Store] Failed to withdraw indicator:', err)
      throw err
    }
  }

  function addStatusAuditEntry(id: string, entry: Record<string, unknown>) {
    const index = indicators.value.findIndex(i => String(i.id) === String(id))
    if (index === -1) {
      return
    }

    const currentAudit = Array.isArray(indicators.value[index].statusAudit)
      ? indicators.value[index].statusAudit
      : []

    indicators.value[index] = {
      ...indicators.value[index],
      statusAudit: [
        ...currentAudit,
        {
          id: String(entry.id || `audit-${id}-${Date.now()}`),
          timestamp:
            entry.timestamp instanceof Date
              ? entry.timestamp.toISOString()
              : String(entry.timestamp || new Date().toISOString()),
          ...entry
        }
      ]
    }
  }

  function getIndicatorById(id: string) {
    return indicators.value.find(item => String(item.id) === String(id))
  }

  function addDraftIndicator(
    indicator: StrategicIndicator & {
      taskId?: string | number
    }
  ) {
    indicators.value.unshift({
      ...indicator,
      id: String(indicator.id)
    })
  }

  function replaceIndicatorId(
    oldId: string,
    newId: string,
    patch: Partial<StrategicIndicator> = {}
  ) {
    const index = indicators.value.findIndex(item => String(item.id) === String(oldId))
    if (index === -1) {
      return
    }

    indicators.value[index] = {
      ...indicators.value[index],
      ...patch,
      id: newId
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
    getIndicatorById,
    addIndicator,
    addDraftIndicator,
    replaceIndicatorId,
    updateIndicator,
    deleteIndicator,
    withdrawIndicator,
    addStatusAuditEntry,
    clearError
  }
})
