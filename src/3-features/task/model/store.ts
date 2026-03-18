/**
 * Task Feature Store
 *
 * Migrated from stores/strategic.ts
 * Focused on strategic task management
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { StrategicTask, TaskCreateRequest, TaskUpdateRequest } from './types'
import { useTimeContextStore } from '@/5-shared/lib/timeContext'
import { logger } from '@/5-shared/lib/utils/logger'
import { ElMessage } from 'element-plus'

export const useTaskStore = defineStore('task', () => {
  // ============ State ============
  const tasks = ref<StrategicTask[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const dataSource = ref<'api' | 'fallback' | 'local'>('local')

  // ============ Getters ============
  const activeTasks = computed(() => tasks.value.filter(t => t.status === 'ACTIVE'))

  const getTaskById = (id: string) => tasks.value.find(t => t.id.toString() === id)

  const getTasksByYear = (year: number) => tasks.value.filter(t => t.year === year)

  // 按当前年份过滤的任务
  const tasksByCurrentYear = computed(() => {
    const timeContext = useTimeContextStore()
    return tasks.value.filter(t => t.year === timeContext.currentYear)
  })

  // ============ Actions ============

  /**
   * �?API 加载任务数据（带重试机制�?
   */
  const loadTasksFromApi = async (year: number, retryCount = 0): Promise<StrategicTask[]> => {
    const maxRetries = 2

    try {
      logger.info(
        `[Task Store] Loading tasks for year ${year} from API... (attempt ${retryCount + 1}/${maxRetries + 1})`
      )

      // 动态导�?API
      const { default: strategicApi } = await import('@/3-features/task/api/strategicApi')
      const response = await strategicApi.getTasksByYear(year)

      if (response.success && response.data) {
        const converted = response.data.map(vo => strategicApi.convertTaskVOToStrategicTask(vo))
        logger.info(`[Task Store] Loaded ${converted.length} tasks from API`)
        return converted
      }

      if (!response.success) {
        throw new Error(response.message || 'API 返回失败')
      }

      logger.warn(`[Task Store] API returned no data for year ${year}`)
      return []
    } catch (err: unknown) {
      const error = err as { message?: string; code?: string }
      const isTimeout = error.message?.includes('timeout') || error.code === 'ECONNABORTED'

      if (isTimeout && retryCount < maxRetries) {
        logger.warn(`[Task Store] Request timeout, retrying... (${retryCount + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)))
        return loadTasksFromApi(year, retryCount + 1)
      }

      logger.error(`[Task Store] Failed to load tasks for year ${year} from API:`, err)
      throw err
    }
  }

  /**
   * 根据年份加载任务数据
   */
  const loadTasksByYear = async (
    year: number,
    options: { force?: boolean; background?: boolean } = {}
  ) => {
    if (!options.force && tasks.value.length > 0 && tasks.value.every(task => task.year === year)) {
      dataSource.value = 'api'
      return tasks.value
    }

    loading.value = true
    error.value = null

    try {
      logger.info(`[Task Store] Loading tasks for year ${year} from API...`)
      const apiTasks = await loadTasksFromApi(year)
      tasks.value = apiTasks
      dataSource.value = 'api'
      logger.info(`[Task Store] Successfully loaded ${apiTasks.length} tasks from API`)
      return apiTasks
    } catch (err: unknown) {
      logger.error(`[Task Store] API failed:`, err)

      let errorMsg = 'API 请求失败'
      const error = err as any

      if (error.message?.includes('timeout') || error.code === 'ECONNABORTED') {
        errorMsg = '请求超时，服务器响应时间过长'
      } else if (error.code === 503 || error.code === 500 || error.code === 504) {
        errorMsg = '服务器内部错误，请稍后重试或联系管理员'
      } else {
        errorMsg = error.details?.message || error.message || 'API 请求失败'
      }

      error.value = errorMsg
      dataSource.value = 'fallback'
      tasks.value = []
      return []
    } finally {
      loading.value = false
    }
  }

  // 监听年份变化，动态切换数�?
  const timeContext = useTimeContextStore()
  watch(
    () => timeContext.currentYear,
    newYear => {
      logger.info(`[Task Store] Year changed to ${newYear}, reloading tasks...`)
      void loadTasksByYear(newYear, { force: true })
    }
  )

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
    const index = tasks.value.findIndex(t => t.id.toString() === id)
    if (index !== -1) {
      tasks.value.splice(index, 1)
    }
  }

  /**
   * 创建新的战略任务并同步到后端
   */
  const createTask = async (request: TaskCreateRequest): Promise<StrategicTask> => {
    logger.info('[Task Store] Creating new strategic task', { request })

    try {
      const { default: strategicApi } = await import('@/3-features/task/api/strategicApi')
      const response = await strategicApi.createTask(request)

      if (response.success && response.data) {
        const newTask = strategicApi.convertTaskVOToStrategicTask(response.data)
        tasks.value.push(newTask)
        logger.info('[Task Store] Successfully created and added task', { taskId: newTask.id })
        return newTask
      } else {
        throw new Error(response.message || 'Failed to create task')
      }
    } catch (error) {
      logger.error('[Task Store] Failed to create task', { error, request })
      ElMessage.error('任务创建失败，请稍后重试')
      throw error
    }
  }

  /**
   * 更新现有战略任务并同步到后端
   */
  const updateTaskWithBackend = async (
    taskId: number,
    request: TaskUpdateRequest
  ): Promise<StrategicTask> => {
    logger.info('[Task Store] Updating strategic task', { taskId, request })

    try {
      const { default: strategicApi } = await import('@/3-features/task/api/strategicApi')
      const response = await strategicApi.updateTask(taskId, request)

      if (response.success && response.data) {
        const updatedTask = strategicApi.convertTaskVOToStrategicTask(response.data)
        const index = tasks.value.findIndex(t => t.id === taskId)
        if (index !== -1) {
          tasks.value[index] = updatedTask
        }
        logger.info('[Task Store] Successfully updated task', { taskId })
        return updatedTask
      } else {
        throw new Error(response.message || 'Failed to update task')
      }
    } catch (error) {
      logger.error('[Task Store] Failed to update task', { error, taskId, request })
      ElMessage.error('任务更新失败，请稍后重试')
      throw error
    }
  }

  /**
   * 删除战略任务并同步到后端
   */
  const deleteTaskWithBackend = async (taskId: number): Promise<void> => {
    logger.info('[Task Store] Deleting strategic task', { taskId })

    try {
      const { default: strategicApi } = await import('@/3-features/task/api/strategicApi')
      const response = await strategicApi.deleteTask(taskId)

      if (response.success) {
        const index = tasks.value.findIndex(t => t.id === taskId)
        if (index !== -1) {
          tasks.value.splice(index, 1)
        }
        logger.info('[Task Store] Successfully deleted task', { taskId })
      } else {
        throw new Error(response.message || 'Failed to delete task')
      }
    } catch (error) {
      logger.error('[Task Store] Failed to delete task', { error, taskId })
      ElMessage.error('任务删除失败，请稍后重试')
      throw error
    }
  }

  return {
    // State
    tasks,
    loading,
    error,
    dataSource,

    // Getters
    activeTasks,
    getTaskById,
    getTasksByYear,
    tasksByCurrentYear,

    // Actions
    loadTasksByYear,
    loadTasksFromApi,
    addTask,
    updateTask,
    deleteTask,
    createTask,
    updateTaskWithBackend,
    deleteTaskWithBackend
  }
})
