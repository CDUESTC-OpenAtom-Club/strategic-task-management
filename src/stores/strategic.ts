import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { StrategicTask, StrategicIndicator, Milestone, StatusAuditEntry } from '@/types'
import { useTimeContextStore } from './timeContext'
import strategicApi from '@/api/strategic'
import { useDataValidator, type ValidationResult } from '@/composables/useDataValidator'
import { logger } from '@/utils/logger'
import { ElMessage } from 'element-plus'
import { convertToUpdateRequest, hasBackendUpdates as hasBackendUpdatesUtil } from '@/utils/dataMappers'

/**
 * 数据健康状态接口
 * @requirement 8.4 - Store data consistency check
 */
export interface DataHealthStatus {
  /** 健康状态: healthy=正常, warning=有警告, critical=严重问题 */
  status: 'healthy' | 'warning' | 'critical'
  /** 数据来源: api=后端API, fallback=降级数据, local=本地数据 */
  dataSource: 'api' | 'fallback' | 'local'
  /** 指标数量 */
  indicatorCount: number
  /** 任务数量 */
  taskCount: number
  /** 验证问题数量 */
  validationIssues: number
  /** 最后验证时间 */
  lastValidated: Date | null
}

export const useStrategicStore = defineStore('strategic', () => {
  // ============ State ============
  // 初始化为空数组，从API加载数据
  const tasks = ref<StrategicTask[]>([])
  const indicators = ref<StrategicIndicator[]>([])
  
  // Loading 状态
  const loading = ref(false)
  const error = ref<string | null>(null)
  const useApiData = ref(true) // 是否使用 API 数据

  // 数据来源标记
  const dataSource = ref<'api' | 'fallback' | 'local'>('local')

  // 数据加载状态（更详细）
  const loadingState = ref({
    indicators: false,
    tasks: false,
    error: null as string | null
  })

  // 数据验证状态
  const validationState = ref({
    lastValidated: null as Date | null,
    isValid: true,
    issues: [] as Array<{
      severity: 'error' | 'warning' | 'info'
      field: string
      message: string
    }>
  })

  // ============ Getters ============
  const activeTasks = computed(() => tasks.value.filter(t => t.status === 'active'))
  const activeIndicators = computed(() => indicators.value.filter(i => i.status === 'active'))

  const getTaskById = (id: string) => tasks.value.find(t => t.id === id)
  const getIndicatorById = (id: string) => indicators.value.find(i => i.id === id)

  const getIndicatorsByTask = (taskId: string) => {
    const task = getTaskById(taskId)
    return task?.indicators || []
  }

  // 获取逾期的里程碑
  const getOverdueMilestones = computed(() => {
    const now = new Date()
    const overdue: Array<{ indicator: StrategicIndicator; milestone: Milestone }> = []
    
    indicators.value.forEach(indicator => {
      indicator.milestones.forEach(milestone => {
        if (milestone.status === 'pending') {
          const deadline = new Date(milestone.deadline)
          if (deadline < now) {
            overdue.push({ indicator, milestone })
          }
        }
      })
    })
    
    return overdue
  })

  // 获取即将到期的里程碑（30天内）
  const getUpcomingMilestones = computed(() => {
    const now = new Date()
    const upcoming: Array<{ indicator: StrategicIndicator; milestone: Milestone }> = []
    
    indicators.value.forEach(indicator => {
      indicator.milestones.forEach(milestone => {
        if (milestone.status !== 'completed') {
          const deadline = new Date(milestone.deadline)
          const daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          if (daysUntilDeadline > 0 && daysUntilDeadline <= 30) {
            upcoming.push({ indicator, milestone })
          }
        }
      })
    })
    
    return upcoming
  })

  // ============ 时间上下文相关 ============
  const getTimeContext = () => useTimeContextStore()

  // 按当前年份过滤的任务
  const tasksByCurrentYear = computed(() => {
    const timeContext = getTimeContext()
    return tasks.value.filter(t => t.year === timeContext.currentYear)
  })

  // 按当前年份过滤的指标
  const indicatorsByCurrentYear = computed(() => {
    const timeContext = getTimeContext()
    return indicators.value.filter(i => i.year === timeContext.currentYear)
  })

  // ============ Actions ============
  
  /**
   * 从 API 加载指标数据
   */
  const loadIndicatorsFromApi = async (year: number): Promise<StrategicIndicator[]> => {
    try {
      logger.info(`[Strategic Store] Loading indicators for year ${year} from API...`)
      const response = await strategicApi.getIndicatorsByYear(year)
      if (response.success && response.data) {
        const converted = response.data.map(vo => strategicApi.convertIndicatorVOToStrategicIndicator(vo))
        logger.info(`[Strategic Store] Loaded ${converted.length} indicators from API`)
        return converted
      }
      logger.warn(`[Strategic Store] API returned no data for year ${year}`)
      return []
    } catch (err) {
      logger.error(`[Strategic Store] Failed to load indicators for year ${year} from API:`, err)
      throw err
    }
  }

  /**
   * 从 API 加载任务数据
   */
  const loadTasksFromApi = async (year: number): Promise<StrategicTask[]> => {
    try {
      logger.info(`[Strategic Store] Loading tasks for year ${year} from API...`)
      const response = await strategicApi.getTasksByYear(year)
      if (response.success && response.data) {
        const converted = response.data.map(vo => strategicApi.convertTaskVOToStrategicTask(vo))
        logger.info(`[Strategic Store] Loaded ${converted.length} tasks from API`)
        return converted
      }
      logger.warn(`[Strategic Store] API returned no data for year ${year}`)
      return []
    } catch (err) {
      logger.error(`[Strategic Store] Failed to load tasks for year ${year} from API:`, err)
      throw err
    }
  }

  /**
   * 根据年份加载对应数据（优先使用 API）
   */
  const loadIndicatorsByYear = async (year: number) => {
    loading.value = true
    error.value = null
    loadingState.value.indicators = true
    loadingState.value.tasks = true
    loadingState.value.error = null

    // 尝试从 API 加载数据
    if (useApiData.value) {
      try {
        logger.info(`[Strategic Store] Loading data for year ${year} from API...`)
        
        // 并行加载任务和指标
        const [apiIndicators, apiTasks] = await Promise.all([
          loadIndicatorsFromApi(year),
          loadTasksFromApi(year)
        ])

        indicators.value = apiIndicators
        tasks.value = apiTasks
        dataSource.value = 'api' // 数据来源：API
        
        logger.info(`[Strategic Store] Successfully loaded ${apiIndicators.length} indicators and ${apiTasks.length} tasks from API`)
        
        loading.value = false
        loadingState.value.indicators = false
        loadingState.value.tasks = false
        return
      } catch (err) {
        logger.error(`[Strategic Store] API failed:`, err)
        error.value = err instanceof Error ? err.message : 'API 请求失败'
        loadingState.value.error = err instanceof Error ? err.message : 'API 请求失败'
        dataSource.value = 'fallback' // 数据来源：降级
        
        // API失败，清空数据
        indicators.value = []
        tasks.value = []
      }
    }
    
    loading.value = false
    loadingState.value.indicators = false
    loadingState.value.tasks = false
  }

  // 监听年份变化，动态切换数据
  const timeContext = getTimeContext()
  watch(
    () => timeContext.currentYear,
    (newYear) => {
      logger.info(`[Strategic Store] Year changed to ${newYear}, reloading data...`)
      loadIndicatorsByYear(newYear)
    }
  )

  // 初始化：根据当前年份加载对应数据
  loadIndicatorsByYear(timeContext.currentYear)

  // ============ CRUD Actions ============
  
  const addTask = (task: StrategicTask) => {
    tasks.value.push(task)
  }

  const updateTask = (id: string, updates: Partial<StrategicTask>) => {
    const task = getTaskById(id)
    if (task) {
      Object.assign(task, updates)
    }
  }

  const deleteTask = (id: string) => {
    const index = tasks.value.findIndex(t => t.id === id)
    if (index !== -1) {
      tasks.value.splice(index, 1)
    }
  }

  const addIndicator = (indicator: StrategicIndicator) => {
    indicators.value.push(indicator)
  }

  const updateIndicator = async (id: string, updates: Partial<StrategicIndicator>) => {
    const index = indicators.value.findIndex(i => i.id === id)
    if (index === -1) return

    const indicator = indicators.value[index]
    if (!indicator) return

    // 保存原始状态用于回滚
    const originalState = { ...indicator }

    // 先更新本地状态
    Object.assign(indicator, updates)
    // 强制触发响应式更新（创建新数组引用）
    indicators.value = [...indicators.value]

    // 检查是否有需要同步到后端的字段
    if (hasBackendUpdatesUtil(updates)) {
      try {
        // 调用后端API更新指标
        const { default: indicatorApi } = await import('@/api/indicator')

        // 使用字段映射器构建后端更新请求
        const updateRequest = convertToUpdateRequest(updates)

        await indicatorApi.updateIndicator(id, updateRequest)
        logger.info(`[Strategic Store] Successfully synced indicator ${id} to backend`, updateRequest)
      } catch (err) {
        logger.error(`[Strategic Store] Failed to sync indicator ${id} to backend:`, err)
        // 如果后端同步失败，回滚本地状态
        Object.assign(indicator, originalState)
        indicators.value = [...indicators.value]
        ElMessage.error('数据更新失败，请稍后重试')
        throw err
      }
    }
  }

  const deleteIndicator = (id: string) => {
    const index = indicators.value.findIndex(i => i.id === id)
    if (index !== -1) {
      indicators.value.splice(index, 1)
    }
  }

  const updateMilestoneStatus = (indicatorId: string, milestoneId: string, status: 'pending' | 'completed' | 'overdue') => {
    const indicator = getIndicatorById(indicatorId)
    if (indicator) {
      const milestone = indicator.milestones.find(m => m.id === milestoneId)
      if (milestone) {
        milestone.status = status
      }
    }
  }

  // 添加审计日志条目
  const addStatusAuditEntry = (
    indicatorId: string,
    entry: Omit<StatusAuditEntry, 'id' | 'timestamp'>
  ) => {
    const indicator = getIndicatorById(indicatorId)
    if (indicator) {
      if (!indicator.statusAudit) {
        indicator.statusAudit = []
      }
      indicator.statusAudit.push({
        ...entry,
        id: `audit-${indicatorId}-${Date.now()}`,
        timestamp: new Date()
      })
    }
  }

  // 根据学院获取子指标
  const getChildIndicatorsByCollege = (college: string) => {
    return indicators.value.filter(i => {
      if (i.isStrategic) return false
      // 支持字符串或数组格式的 responsibleDept
      if (Array.isArray(i.responsibleDept)) {
        return i.responsibleDept.includes(college)
      }
      return i.responsibleDept === college
    })
  }

  /**
   * 验证当前 Store 中的数据
   */
  const validateCurrentData = (): ValidationResult => {
    const { validateIndicator, mergeResults, createEmptyResult } = useDataValidator({
      strict: false,
      logErrors: true
    })

    // 验证所有指标
    const indicatorResults: ValidationResult[] = indicators.value.map(indicator => {
      return validateIndicator(indicator)
    })

    // 合并所有验证结果
    const mergedResult = indicatorResults.length > 0 
      ? mergeResults(...indicatorResults)
      : createEmptyResult()

    // 构建问题列表
    const issues: Array<{ severity: 'error' | 'warning' | 'info'; field: string; message: string }> = []
    
    // 添加错误
    for (const err of mergedResult.errors) {
      issues.push({
        severity: 'error',
        field: err.field,
        message: err.message
      })
    }
    
    // 添加警告
    for (const warn of mergedResult.warnings) {
      issues.push({
        severity: 'warning',
        field: warn.field,
        message: warn.message
      })
    }

    // 更新验证状态
    validationState.value = {
      lastValidated: new Date(),
      isValid: mergedResult.isValid,
      issues
    }

    return mergedResult
  }

  /**
   * 获取数据健康状态
   */
  const getDataHealth = (): DataHealthStatus => {
    // 计算健康状态
    let status: 'healthy' | 'warning' | 'critical' = 'healthy'
    
    const errorCount = validationState.value.issues.filter(i => i.severity === 'error').length
    const warningCount = validationState.value.issues.filter(i => i.severity === 'warning').length
    
    if (errorCount > 0) {
      status = 'critical'
    } else if (warningCount > 0 || dataSource.value === 'fallback') {
      status = 'warning'
    }
    
    // 如果数据来源是降级数据，至少是 warning 状态
    if (dataSource.value === 'fallback' && status === 'healthy') {
      status = 'warning'
    }

    return {
      status,
      dataSource: dataSource.value,
      indicatorCount: indicators.value.length,
      taskCount: tasks.value.length,
      validationIssues: validationState.value.issues.length,
      lastValidated: validationState.value.lastValidated
    }
  }

  return {
    // State
    tasks,
    indicators,
    loading,
    error,
    useApiData,
    dataSource,
    loadingState,
    validationState,

    // Getters
    activeTasks,
    activeIndicators,
    getTaskById,
    getIndicatorById,
    getIndicatorsByTask,
    getOverdueMilestones,
    getUpcomingMilestones,
    getChildIndicatorsByCollege,
    tasksByCurrentYear,
    indicatorsByCurrentYear,

    // Actions
    addTask,
    updateTask,
    deleteTask,
    addIndicator,
    updateIndicator,
    deleteIndicator,
    updateMilestoneStatus,
    addStatusAuditEntry,
    loadIndicatorsByYear,
    loadIndicatorsFromApi,
    loadTasksFromApi,
    
    // 数据验证和健康检查
    validateCurrentData,
    getDataHealth
  }
})
