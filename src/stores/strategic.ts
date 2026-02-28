import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { StrategicTask, StrategicIndicator, Milestone, StatusAuditEntry, CreateStrategicTaskRequest, UpdateStrategicTaskRequest } from '@/types'
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
  /** 健康状态: healthy=正常, warning=有警告, critical严重问题 */
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
      
      // 如果接口返回失败，抛出错误
      if (!response.success) {
        throw new Error(response.message || 'API 返回失败')
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
      
      // 如果接口返回失败，抛出错误
      if (!response.success) {
        throw new Error(response.message || 'API 返回失败')
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
      } catch (err: any) {
        logger.error(`[Strategic Store] API failed:`, err)
        // 优先使用详细的错误消息
        const errorMsg = err.details?.message || err.message || 'API 请求失败'
        error.value = errorMsg
        loadingState.value.error = errorMsg
        dataSource.value = 'fallback' // 数据来源：降级
        
        // 如果是 503 或 500，且包含数据库错误信息，给出更明确的提示
        const errorDetail = JSON.stringify(err.details || '');
        if ((err.code === 503 || err.code === 500 || err.code === 504) && 
            (errorDetail.includes('JDBC') || errorDetail.includes('Connection') || errorDetail.includes('timeout') || err.message.includes('status code 500'))) {
          const dbError = '数据库连接失败，请检查后端数据库配置（.env）或网络连通性。';
          error.value = dbError;
          loadingState.value.error = dbError;
        }
        
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

  /**
   * 创建新的战略任务并同步到后端
   */
  const createTask = async (request: CreateStrategicTaskRequest): Promise<StrategicTask> => {
    logger.info('[Strategic Store] Creating new strategic task', { request })
    
    try {
      // 调用后端API创建任务
      const response = await strategicApi.createTask(request)
      
      if (response.success && response.data) {
        // 转换后端返回的数据为前端格式
        const newTask = strategicApi.convertTaskVOToStrategicTask(response.data)
        
        // 添加到本地状态
        tasks.value.push(newTask)
        
        logger.info('[Strategic Store] Successfully created and added task', { taskId: newTask.id })
        return newTask
      } else {
        throw new Error(response.message || 'Failed to create task')
      }
    } catch (error) {
      logger.error('[Strategic Store] Failed to create task', { error, request })
      ElMessage.error('任务创建失败，请稍后重试')
      throw error
    }
  }

  /**
   * 更新现有战略任务并同步到后端
   */
  const updateTaskWithBackend = async (taskId: number, request: UpdateStrategicTaskRequest): Promise<StrategicTask> => {
    logger.info('[Strategic Store] Updating strategic task', { taskId, request })
    
    try {
      // 调用后端API更新任务
      const response = await strategicApi.updateTask(taskId, request)
      
      if (response.success && response.data) {
        // 转换后端返回的数据为前端格式
        const updatedTask = strategicApi.convertTaskVOToStrategicTask(response.data)
        
        // 更新本地状态
        const index = tasks.value.findIndex(t => t.id === String(taskId))
        if (index !== -1) {
          tasks.value[index] = updatedTask
        }
        
        logger.info('[Strategic Store] Successfully updated task', { taskId })
        return updatedTask
      } else {
        throw new Error(response.message || 'Failed to update task')
      }
    } catch (error) {
      logger.error('[Strategic Store] Failed to update task', { error, taskId, request })
      ElMessage.error('任务更新失败，请稍后重试')
      throw error
    }
  }

  /**
   * 删除战略任务并同步到后端
   */
  const deleteTaskWithBackend = async (taskId: number): Promise<void> => {
    logger.info('[Strategic Store] Deleting strategic task', { taskId })
    
    try {
      // 调用后端API删除任务
      const response = await strategicApi.deleteTask(taskId)
      
      if (response.success) {
        // 从本地状态中移除
        const index = tasks.value.findIndex(t => t.id === String(taskId))
        if (index !== -1) {
          tasks.value.splice(index, 1)
        }
        
        logger.info('[Strategic Store] Successfully deleted task', { taskId })
      } else {
        throw new Error(response.message || 'Failed to delete task')
      }
    } catch (error) {
      logger.error('[Strategic Store] Failed to delete task', { error, taskId })
      ElMessage.error('任务删除失败，请稍后重试')
      throw error
    }
  }

    const addIndicator = async (indicator: StrategicIndicator) => {
      // 先进行乐观更新：添加到本地状态
      const tempId = indicator.id
      indicators.value.push(indicator)

      try {
        // 调用后端 API 持久化数据（创建时带 distributionStatus: 'DRAFT'）
        const { default: indicatorApi } = await import('@/api/indicator')

        // 获取当前活动的任务 ID，如果没有则使用第一个任务
        const activeTask = activeTasks.value.length > 0 ? activeTasks.value[0] : null
        const taskId = activeTask ? Number(activeTask.id) : 1

        // 将 StrategicIndicator 映射到 IndicatorCreateRequest
        const request = {
          taskId,
          indicatorDesc: indicator.name,
          weightPercent: indicator.weight || 0,
          sortOrder: 0,
          remark: indicator.remark || '',
          type: indicator.type2, // 基础性/发展性
          progress: indicator.progress || 0,
          year: indicator.year || new Date().getFullYear(),
          canWithdraw: indicator.canWithdraw !== false,
          // 草稿状态：告知后端这是草稿，尚未正式下发
          distributionStatus: 'DRAFT' as const,
        }

        const response = await indicatorApi.createIndicator(request)

        if (response.success && response.data) {
          // 用后端返回的真实 ID 更新本地指标，同时记录真实 ID
          const index = indicators.value.findIndex(i => i.id === tempId)
          if (index !== -1) {
            indicators.value[index] = {
              ...indicators.value[index],
              id: response.data.indicatorId.toString(),
              distributionStatus: response.data.distributionStatus ?? 'DRAFT',
            }
          }

          logger.info('[Strategic Store] Successfully created indicator:', response.data.indicatorId)
          ElMessage.success('指标创建成功')
        }
      } catch (err) {
        logger.error('[Strategic Store] Failed to create indicator:', err)

        // 回滚：从本地状态移除
        const index = indicators.value.findIndex(i => i.id === tempId)
        if (index !== -1) {
          indicators.value.splice(index, 1)
        }

        ElMessage.error('指标创建失败，请稍后重试')
        throw err
      }
    }

  const updateIndicator = async (id: string, updates: Partial<StrategicIndicator>) => {
    const index = indicators.value.findIndex(i => i.id === id)
    if (index === -1) {return}

    const indicator = indicators.value[index]
    if (!indicator) {return}

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
        
        // 重新加载这个指标的数据，确保前端和后端同步
        try {
          const response = await indicatorApi.getIndicatorById(id)
          if (response.success && response.data) {
            const { default: strategicApi } = await import('@/api/strategic')
            const updatedIndicator = strategicApi.convertIndicatorVOToStrategicIndicator(response.data)
            // 更新本地状态
            Object.assign(indicator, updatedIndicator)
            indicators.value = [...indicators.value]
            logger.info(`[Strategic Store] Reloaded indicator ${id} from backend, milestones count:`, updatedIndicator.milestones?.length || 0)
          }
        } catch (reloadErr) {
          logger.warn(`[Strategic Store] Failed to reload indicator ${id} after update:`, reloadErr)
        }
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

  const deleteIndicator = async (id: string) => {
    const index = indicators.value.findIndex(i => i.id === id)
    if (index === -1) {return}

    const indicator = indicators.value[index]

    // 乐观删除：先从本地状态移除
    indicators.value.splice(index, 1)

    // 只有真实后端 ID（纯数字）才需要调用后端删除接口
    // 临时 ID 格式如 "new-xxxxx" 或 "${timestamp}-${college}-xxx"，不调用后端
    const isRealBackendId = /^\d+$/.test(id)
    if (!isRealBackendId) {
      logger.info(`[Strategic Store] Deleted local-only draft indicator (id: ${id})`)
      return
    }

    try {
      const { default: indicatorApi } = await import('@/api/indicator')
      await indicatorApi.deleteIndicator(id)
      logger.info(`[Strategic Store] Successfully deleted indicator ${id} from backend`)
    } catch (err) {
      logger.error(`[Strategic Store] Failed to delete indicator ${id} from backend:`, err)
      // 回滚：把指标加回去
      indicators.value.splice(index, 0, indicator)
      ElMessage.error('指标删除失败，请稍后重试')
      throw err
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
      if (i.isStrategic) {return false}
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
   * 添加草稿指标（仅本地状态，不调用后端）
   * 
   * 用于 Step1（填写表单阶段），只保存到前端临时状态。
   * Step2（点击下发）时再通过 publishDistributionStatus 接口正式写入后端。
   * 
   * 对应前后端协作任务清单：前端任务 - Step1 只保存临时状态
   */
  const addDraftIndicator = (indicator: StrategicIndicator) => {
    indicators.value.push(indicator)
    logger.info(`[Strategic Store] Added local draft indicator: ${indicator.id}`)
  }

  /**
   * 将临时 ID 替换为后端真实 ID（不调用后端，仅更新本地状态）
   * 用于下发流程：先 createIndicator 拿到真实 ID，再替换临时 ID
   */
  const replaceIndicatorId = (tempId: string, realId: string, extraUpdates?: Partial<StrategicIndicator>) => {
    const index = indicators.value.findIndex(i => i.id === tempId)
    if (index !== -1) {
      indicators.value[index] = {
        ...indicators.value[index],
        id: realId,
        ...extraUpdates
      }
      indicators.value = [...indicators.value]
      logger.info(`[Strategic Store] Replaced temp indicator id ${tempId} → ${realId}`)
    }
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
      createTask,
      updateTaskWithBackend,
      deleteTaskWithBackend,
      addIndicator,
      addDraftIndicator,
      replaceIndicatorId,
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