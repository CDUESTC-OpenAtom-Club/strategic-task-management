import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
/* eslint-disable no-restricted-syntax -- Backend-aligned types use strategic_task terminology */
import type { StrategicTask, StrategicIndicator, Milestone, StatusAuditEntry, CreateStrategicTaskRequest, UpdateStrategicTaskRequest } from '@/types'
/* eslint-enable no-restricted-syntax */
import { useTimeContextStore } from './timeContext'
import strategicApi from '@/api/strategic'
import { useDataValidator, type ValidationResult } from '@/composables/useDataValidator'
import { logger } from '@/utils/logger'
import { ElMessage } from 'element-plus'
import { convertToUpdateRequest, hasBackendUpdates as hasBackendUpdatesUtil } from '@/utils/dataMappers/indicatorMapper'

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
  /* eslint-disable no-restricted-syntax -- Backend-aligned types in state */
  const tasks = ref<StrategicTask[]>([])
  const indicators = ref<StrategicIndicator[]>([])
  /* eslint-enable no-restricted-syntax */
  
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
   * 从 API 加载指标数据（带重试机制）
   */
  const loadIndicatorsFromApi = async (year: number, retryCount = 0): Promise<StrategicIndicator[]> => {
    const maxRetries = 2
    
    try {
      logger.info(`[Strategic Store] Loading indicators for year ${year} from API... (attempt ${retryCount + 1}/${maxRetries + 1})`)
      const response = await strategicApi.getIndicatorsByYear(year)
      if (response.success && response.data) {
        const converted = response.data.map(vo => strategicApi.convertIndicatorVOToStrategicIndicator(vo))
        logger.info(`[Strategic Store] Loaded ${converted.length} indicators from API`)
        
        // 调试：检查 canWithdraw 字段
        const zhanlue = converted.filter(i => i.ownerDept === '战略发展部')
        const canWithdrawStats = {
          total: zhanlue.length,
          canWithdrawFalse: zhanlue.filter(i => i.canWithdraw === false).length,
          canWithdrawTrue: zhanlue.filter(i => i.canWithdraw === true).length
        }
        logger.info(`[Strategic Store] 战略发展部 canWithdraw 统计:`, canWithdrawStats)
        
        // 显示一个 canWithdraw = false 的指标
        const falseOne = zhanlue.find(i => i.canWithdraw === false)
        if (falseOne) {
          logger.info(`[Strategic Store] canWithdraw=false 示例:`, {
            id: falseOne.id,
            name: falseOne.name,
            canWithdraw: falseOne.canWithdraw,
            responsibleDept: falseOne.responsibleDept
          })
        } else {
          logger.warn(`[Strategic Store] ⚠️ 没有找到 canWithdraw=false 的指标！`)
        }
        
        return converted
      }
      
      // 如果接口返回失败，抛出错误
      if (!response.success) {
        throw new Error(response.message || 'API 返回失败')
      }
      
      logger.warn(`[Strategic Store] API returned no data for year ${year}`)
      return []
    } catch (err: unknown) {
      // 检查是否是超时错误且还有重试次数
      const error = err as { message?: string; code?: string }
      const isTimeout = error.message?.includes('timeout') || error.code === 'ECONNABORTED'
      if (isTimeout && retryCount < maxRetries) {
        logger.warn(`[Strategic Store] Request timeout, retrying... (${retryCount + 1}/${maxRetries})`)
        // 等待一段时间后重试（指数退避）
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)))
        return loadIndicatorsFromApi(year, retryCount + 1)
      }
      
      logger.error(`[Strategic Store] Failed to load indicators for year ${year} from API:`, err)
      throw err
    }
  }

  /**
   * 从 API 加载任务数据（带重试机制）
   */
  // eslint-disable-next-line no-restricted-syntax -- Backend API returns StrategicTask
  const loadTasksFromApi = async (year: number, retryCount = 0): Promise<StrategicTask[]> => {
    const maxRetries = 2
    
    try {
      logger.info(`[Strategic Store] Loading tasks for year ${year} from API... (attempt ${retryCount + 1}/${maxRetries + 1})`)
      const response = await strategicApi.getTasksByYear(year)
      if (response.success && response.data) {
        // eslint-disable-next-line no-restricted-syntax -- Converter function for backend VO
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
    } catch (err: unknown) {
      // 检查是否是超时错误且还有重试次数
      const error = err as { message?: string; code?: string }
      const isTimeout = error.message?.includes('timeout') || error.code === 'ECONNABORTED'
      if (isTimeout && retryCount < maxRetries) {
        logger.warn(`[Strategic Store] Request timeout, retrying... (${retryCount + 1}/${maxRetries})`)
        // 等待一段时间后重试（指数退避）
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)))
        return loadTasksFromApi(year, retryCount + 1)
      }
      
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
      } catch (err: unknown) {
        logger.error(`[Strategic Store] API failed:`, err)
        
        // 构建用户友好的错误消息
        let errorMsg = 'API 请求失败'
        
        if (err.message?.includes('timeout') || err.code === 'ECONNABORTED') {
          errorMsg = '请求超时，服务器响应时间过长。可能原因：数据量较大或网络连接不稳定。'
        } else if (err.code === 503 || err.code === 500 || err.code === 504) {
          const errorDetail = JSON.stringify(err.details || '')
          if (errorDetail.includes('JDBC') || errorDetail.includes('Connection') || errorDetail.includes('timeout')) {
            errorMsg = '数据库连接失败，请检查后端数据库配置或网络连通性。'
          } else {
            errorMsg = '服务器内部错误，请稍后重试或联系管理员。'
          }
        } else {
          errorMsg = err.details?.message || err.message || 'API 请求失败'
        }
        
        error.value = errorMsg
        loadingState.value.error = errorMsg
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
  
  // eslint-disable-next-line no-restricted-syntax -- Backend-aligned type
  const addTask = (task: StrategicTask) => {
    tasks.value.push(task)
  }

  // eslint-disable-next-line no-restricted-syntax -- Backend-aligned type
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
  // eslint-disable-next-line no-restricted-syntax -- Backend API returns StrategicTask
  const createTask = async (request: CreateStrategicTaskRequest): Promise<StrategicTask> => {
    logger.info('[Strategic Store] Creating new strategic task', { request })
    
    try {
      // 调用后端API创建任务
      const response = await strategicApi.createTask(request)
      
      if (response.success && response.data) {
        // 转换后端返回的数据为前端格式
        // eslint-disable-next-line no-restricted-syntax -- Converter function for backend VO
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
  // eslint-disable-next-line no-restricted-syntax -- Backend API returns StrategicTask
  const updateTaskWithBackend = async (taskId: number, request: UpdateStrategicTaskRequest): Promise<StrategicTask> => {
    logger.info('[Strategic Store] Updating strategic task', { taskId, request })
    
    try {
      // 调用后端API更新任务
      const response = await strategicApi.updateTask(taskId, request)
      
      if (response.success && response.data) {
        // 转换后端返回的数据为前端格式
        // eslint-disable-next-line no-restricted-syntax -- Converter function for backend VO
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
      logger.info(`[Strategic Store] addIndicator called with taskContent: ${indicator.taskContent}`)
      
      // 先进行乐观更新：添加到本地状态
      const tempId = indicator.id
      indicators.value.push(indicator)

      try {
        // 调用后端 API 持久化数据（创建时带 distributionStatus: 'DRAFT'）
        const { default: indicatorApi } = await import('@/api/indicator')
        const { useOrgStore } = await import('@/stores/org')
        const orgStore = useOrgStore()

        // 根据 taskContent 查找对应的真实 taskId
        let taskId = 1 // 默认值
        
        logger.info(`[Strategic Store] indicator.taskContent = "${indicator.taskContent}", type: ${typeof indicator.taskContent}`)
        
        if (indicator.taskContent) {
          logger.info(`[Strategic Store] Looking for taskId for taskContent: ${indicator.taskContent}`)
          logger.info(`[Strategic Store] Total indicators in store: ${indicators.value.length}`)
          
          // 优先从现有指标中查找匹配的 taskContent，获取其 taskId
          // 这样可以确保新指标使用与现有指标相同的 taskId
          const existingIndicator = indicators.value.find(i => i.taskContent === indicator.taskContent)
          if (existingIndicator && existingIndicator.taskId) {
            taskId = Number(existingIndicator.taskId)
            logger.info(`[Strategic Store] Found taskId ${taskId} from existing indicator (id: ${existingIndicator.id}) for taskContent: ${indicator.taskContent}`)
          } else {
            logger.warn(`[Strategic Store] No existing indicator found with taskContent: ${indicator.taskContent}`)
            
            // 如果现有指标中找不到，再从 activeTasks 中查找
            logger.info(`[Strategic Store] Searching in activeTasks (${activeTasks.value.length} tasks)`)
            activeTasks.value.forEach(t => {
              logger.info(`[Strategic Store]   - Task: id=${t.id}, title=${t.title}`)
            })
            
            const matchingTask = activeTasks.value.find(t => t.title === indicator.taskContent)
            if (matchingTask) {
              taskId = Number(matchingTask.id)
              logger.info(`[Strategic Store] Found task with id ${taskId} for taskContent: ${indicator.taskContent}`)
            } else {
              // 如果都找不到，使用默认 taskId = 1
              logger.warn(`[Strategic Store] No matching task found for taskContent: ${indicator.taskContent}, using default taskId: 1`)
            }
          }
        } else {
          // 如果没有 taskContent，使用第一个活动任务的 ID
          const activeTask = activeTasks.value.length > 0 ? activeTasks.value[0] : null
          taskId = activeTask ? Number(activeTask.id) : 1
          logger.info(`[Strategic Store] No taskContent provided, using taskId: ${taskId}`)
        }

        // 根据 responsibleDept 获取对应的 orgId
        const targetDept = orgStore.getDepartmentByName(indicator.responsibleDept || '战略发展部')
        const targetOrgId = targetDept?.id || 35

        // 根据 ownerDept 获取对应的 orgId
        const ownerDept = orgStore.getDepartmentByName(indicator.ownerDept || '战略发展部')
        const ownerOrgId = ownerDept?.id || 35

        // 记录最终使用的 taskId 和 taskContent
        logger.info(`[Strategic Store] Creating indicator with taskId: ${taskId}, taskContent: ${indicator.taskContent}`)

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
          // 添加必需的组织ID字段
          ownerOrgId, // 使用当前部门的 ID
          targetOrgId, // 根据 responsibleDept 动态获取
          level: 'PRIMARY', // 一级指标
          // 里程碑数据
          milestones: indicator.milestones?.map((ms, index) => ({
            milestoneId: null, // 新建里程碑，ID 为 null
            milestoneName: ms.name,
            targetProgress: ms.targetProgress || 0,
            dueDate: ms.deadline,
            status: ms.status === 'completed' ? 'COMPLETED' : ms.status === 'overdue' ? 'DELAYED' : 'NOT_STARTED',
            weightPercent: ms.weightPercent || 0,
            sortOrder: ms.sortOrder !== undefined ? ms.sortOrder : index
          })) || []
        }

        logger.info(`[Strategic Store] Request payload:`, JSON.stringify(request, null, 2))

        const response = await indicatorApi.createIndicator(request)

        if (response.success && response.data) {
          const createdIndicatorId = response.data.indicatorId

          // 如果有里程碑，创建里程碑
          if (indicator.milestones && indicator.milestones.length > 0) {
            try {
              const { default: milestoneApi } = await import('@/api/milestone')
              
              // 批量创建里程碑
              for (const ms of indicator.milestones) {
                await milestoneApi.createMilestone({
                  indicatorId: createdIndicatorId,
                  milestoneName: ms.name,
                  targetProgress: ms.targetProgress || 0,
                  dueDate: ms.deadline,
                  status: ms.status === 'completed' ? 'COMPLETED' : ms.status === 'overdue' ? 'DELAYED' : 'NOT_STARTED',
                  sortOrder: ms.sortOrder || 0
                })
              }
              logger.info(`[Strategic Store] Created ${indicator.milestones.length} milestones for indicator ${createdIndicatorId}`)
            } catch (milestoneErr) {
              logger.error('[Strategic Store] Failed to create milestones:', milestoneErr)
              // 里程碑创建失败不影响指标创建
            }
          }

          // 用后端返回的完整数据替换本地指标
          const index = indicators.value.findIndex(i => i.id === tempId)
          if (index !== -1) {
            // 从后端 VO 转换为前端 StrategicIndicator
            const { default: strategicApi } = await import('@/api/strategic')
            const convertedIndicator = strategicApi.convertIndicatorVOToStrategicIndicator(response.data)
            // 如果创建了里程碑，需要重新加载指标以获取里程碑数据
            if (indicator.milestones && indicator.milestones.length > 0) {
              // 重新从后端获取完整数据（包含里程碑）
              const reloadResponse = await indicatorApi.getIndicatorById(createdIndicatorId)
              if (reloadResponse.success && reloadResponse.data) {
                indicators.value[index] = strategicApi.convertIndicatorVOToStrategicIndicator(reloadResponse.data)
              } else {
                indicators.value[index] = convertedIndicator
              }
            } else {
              indicators.value[index] = convertedIndicator
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
        logger.debug(`[Strategic Store] Original updates for indicator ${id}:`, updates)
        const updateRequest = convertToUpdateRequest(updates)
        logger.debug(`[Strategic Store] Converted update request for indicator ${id}:`, updateRequest)

        await indicatorApi.updateIndicator(id, updateRequest)
        logger.info(`[Strategic Store] Successfully synced indicator ${id} to backend`, updateRequest)
        
        // ❌ 移除重新加载逻辑，避免覆盖本地更新
        // 前端已经更新了本地状态，不需要重新从后端加载
        // 如果需要同步，应该在批量操作完成后统一重新加载
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
  /**
   * 撤回已下发的指标
   * 将指标状态从 DISTRIBUTED 改回 DRAFT，允许重新编辑
   * 
   * @param id 指标ID
   */
  const withdrawIndicator = async (id: string) => {
    const index = indicators.value.findIndex(i => i.id === id)
    if (index === -1) {
      ElMessage.error('指标不存在')
      return
    }

    const indicator = indicators.value[index]
    
    // 保存原始状态用于回滚
    const originalState = { ...indicator }

    try {
      const { default: indicatorApi } = await import('@/api/indicator')
      const response = await indicatorApi.withdrawIndicator(id)
      
      if (response.success && response.data) {
        // 从后端 VO 转换为前端 StrategicIndicator
        const { default: strategicApi } = await import('@/api/strategic')
        const convertedIndicator = strategicApi.convertIndicatorVOToStrategicIndicator(response.data)
        
        // 更新本地状态
        indicators.value[index] = convertedIndicator
        indicators.value = [...indicators.value]
        
        logger.info(`[Strategic Store] Successfully withdrew indicator ${id}`)
        ElMessage.success('指标撤回成功')
      } else {
        throw new Error(response.message || 'Failed to withdraw indicator')
      }
    } catch (err) {
      logger.error(`[Strategic Store] Failed to withdraw indicator ${id}:`, err)
      // 回滚：恢复原始状态
      indicators.value[index] = originalState
      indicators.value = [...indicators.value]
      ElMessage.error('指标撤回失败，请稍后重试')
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
      withdrawIndicator,
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