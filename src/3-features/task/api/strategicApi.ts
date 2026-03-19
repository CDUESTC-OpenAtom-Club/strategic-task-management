/**
 * 战略任务和指标 API 服务
 * 从后端获取数据库中的数据
 * 使用简化的 apiClient，在业务层实现必要的重试逻辑
 *
 * **Validates: Requirements 2.4, 2.6**
 */
import { apiClient } from '@/5-shared/lib/api'
import { withRetry } from '@/5-shared/lib/api/wrappers'
import { buildQueryKey, fetchWithCache, invalidateQueries } from '@/5-shared/lib/utils/cache'
import { logger } from '@/5-shared/lib/utils/logger'
/* eslint-disable no-restricted-syntax -- Backend types use strategic_task terminology */
import type {
  ApiResponse,
  StrategicTask,
  StrategicIndicator,
  CreateStrategicTaskRequest,
  UpdateStrategicTaskRequest,
  PendingApproval
} from '@/5-shared/types'
/* eslint-enable no-restricted-syntax */
// 导入统一的 IndicatorVO 接口，避免重复定义
import type { IndicatorVO, AssessmentCycle as AssessmentCycleVO } from '@/5-shared/types/backend-aligned'

interface StrategicTaskVO {
  taskId?: number
  id?: number
  planId?: number | null
  taskName: string
  taskDesc?: string | null
  taskType?: string
  createdAt: string
  year?: number
  cycleId?: number | null
  createdByOrgName?: string
  createdByOrgId?: number | null
}

interface BackendTaskCreateRequest {
  taskName: string
  taskType: string
  planId: number
  cycleId: number
  orgId: number
  createdByOrgId: number
  sortOrder?: number
  taskDesc?: string | null
  remark?: string | null
}

interface CyclePageResponse<T> {
  content: T[]
}

function invalidateTaskCaches(taskId?: number | string, year?: number): void {
  const targets: Array<string | readonly [string, string, Record<string, string | number>]> = [
    'task.list',
    'task.scope',
    'plan.detail',
    'dashboard.overview'
  ]
  if (typeof year === 'number') {
    targets.push(buildQueryKey('task', 'list', { year }))
  }
  if (taskId !== undefined) {
    targets.push(`task.detail.${taskId}`)
  }
  invalidateQueries(targets)
}

/**
 * 将后端 VO 转换为前端 StrategicTask 类型
 */
// eslint-disable-next-line no-restricted-syntax -- Converter function for backend VO
function convertTaskVOToStrategicTask(vo: StrategicTaskVO): StrategicTask {
  const taskId = vo.taskId ?? vo.id ?? 0
  const taskYear = vo.year ?? new Date().getFullYear()
  return {
    id: String(taskId),
    title: vo.taskName,
    desc: vo.taskDesc || '',
    createTime: new Date(vo.createdAt).toLocaleDateString('zh-CN'),
    cycle: `${taskYear}年度`,
    startDate: new Date(`${taskYear}-01-01`),
    endDate: new Date(`${taskYear}-12-31`),
    status: 'active',
    createdBy: vo.createdByOrgName || '',
    indicators: [],
    year: taskYear,
    isRecurring: vo.taskType === 'BASIC' || vo.taskType === 'DEVELOPMENT'
  }
}

/**
 * 将后端 VO 转换为前端 StrategicIndicator 类型
 */
function convertIndicatorVOToStrategicIndicator(vo: IndicatorVO): StrategicIndicator {
  // 转换里程碑状态
  const convertMilestoneStatus = (status: string): 'pending' | 'completed' | 'overdue' => {
    if (status === 'COMPLETED') {
      return 'completed'
    }
    if (status === 'DELAYED' || status === 'CANCELED') {
      return 'overdue'
    }
    return 'pending' // NOT_STARTED, IN_PROGRESS 都映射为 pending
  }

  // 转换里程碑
  const milestones =
    vo.milestones?.map(m => ({
      id: String(m.milestoneId),
      name: m.milestoneName,
      targetProgress: m.targetProgress ?? m.weightPercent,
      deadline: m.dueDate,
      status: convertMilestoneStatus(m.status),
      isPaired: m.isPaired ?? false,
      weightPercent: m.weightPercent,
      sortOrder: m.sortOrder
    })) || []

  // 转换进度审批状态
  const convertProgressApprovalStatus = (
    status?: string
  ): 'none' | 'draft' | 'pending' | 'approved' | 'rejected' => {
    if (!status) {
      return 'none'
    }
    const map: Record<string, 'none' | 'draft' | 'pending' | 'approved' | 'rejected'> = {
      NONE: 'none',
      DRAFT: 'draft',
      PENDING: 'pending',
      APPROVED: 'approved',
      REJECTED: 'rejected'
    }
    return map[status] || 'none'
  }

  // 解析 statusAudit JSON
  let statusAudit: Array<Record<string, unknown>> = []
  if (vo.statusAudit) {
    try {
      statusAudit = JSON.parse(vo.statusAudit)
    } catch {
      statusAudit = []
    }
  }

  // 解析 pendingAttachments JSON
  let pendingAttachments: string[] = []
  if (vo.pendingAttachments) {
    try {
      pendingAttachments = JSON.parse(vo.pendingAttachments)
    } catch {
      pendingAttachments = []
    }
  }

  return {
    id: String(vo.indicatorId),
    name: vo.indicatorDesc,
    // 使用后端返回的新字段，提供默认值
    isQualitative: vo.isQualitative ?? false,
    // indicatorType 是后端返回的 type 字段，定量/定性
    type1: (vo.type1 as '定性' | '定量') ?? (vo.indicatorType === '定量' ? '定量' : vo.indicatorType === '定性' ? '定性' : '定量'),
    type2:
      (vo.type2 as '发展性' | '基础性') ?? (vo.level === 'STRAT_TO_FUNC' ? '发展性' : '基础性'),
    progress: vo.progress ?? calculateProgress(milestones),
    createTime: new Date(vo.createdAt).toLocaleDateString('zh-CN'),
    weight: vo.weightPercent,
    remark: vo.remark || '',
    canWithdraw: vo.canWithdraw ?? vo.level === 'STRAT_TO_FUNC',
    taskContent: vo.taskName,
    milestones,
    targetValue: vo.targetValue ?? 100,
    actualValue: vo.actualValue,
    unit: vo.unit ?? '%',
    responsibleDept: vo.responsibleDept ?? vo.targetOrgName,
    responsiblePerson: vo.responsiblePerson ?? '',
    status: vo.status === 'ACTIVE' ? 'active' : 'archived',
    isStrategic: vo.isStrategic ?? vo.level === 'STRAT_TO_FUNC',
    ownerDept: vo.ownerDept ?? vo.ownerOrgName,
    year: vo.year,
    parentIndicatorId: vo.parentIndicatorId ? String(vo.parentIndicatorId) : undefined,
    progressApprovalStatus: convertProgressApprovalStatus(vo.progressApprovalStatus),
    pendingProgress: vo.pendingProgress,
    pendingRemark: vo.pendingRemark,
    pendingAttachments,
    statusAudit
  }
}

/**
 * 根据里程碑计算进度
 */
function calculateProgress(milestones: { status: string }[]): number {
  if (milestones.length === 0) {
    return 0
  }
  const completed = milestones.filter(m => m.status === 'completed').length
  return Math.round((completed / milestones.length) * 100)
}

export const strategicApi = {
  /**
   * 获取所有考核周期
   */
  async getAllCycles(): Promise<ApiResponse<AssessmentCycleVO[]>> {
    return apiClient.get<ApiResponse<AssessmentCycleVO[]>>('/cycles/list')
  },

  /**
   * 获取所有可用的年份（从周期表）
   */
  async getAvailableYears(): Promise<ApiResponse<number[]>> {
    try {
      const response = await apiClient.get<ApiResponse<AssessmentCycleVO[]>>('/cycles/list')
      if (!response.success || !response.data) {
        return {
          ...response,
          data: []
        }
      }

      const years = response.data
        .map(cycle => cycle.year)
        .filter((year): year is number => typeof year === 'number')
      const uniqueYears = [...new Set(years)].sort((left, right) => right - left)

      return {
        ...response,
        data: uniqueYears
      }
    } catch (error) {
      logger.error('[StrategicAPI] Failed to derive available years from /cycles/list', { error })
      return {
        success: false,
        data: [],
        message: 'Failed to fetch available years',
        timestamp: new Date()
      }
    }
  },

  /**
   * 获取指定年份的考核周期
   */
  async getCycleByYear(year: number): Promise<ApiResponse<AssessmentCycleVO | null>> {
    try {
      const response = await apiClient.get<ApiResponse<CyclePageResponse<AssessmentCycleVO>>>('/cycles', {
        params: { year, page: 0, size: 1 }
      })
      if (response.success && response.data) {
        const cycle = response.data.content?.[0] || null
        return { ...response, data: cycle }
      }
      return { ...response, data: null }
    } catch {
      return { success: false, data: null, message: 'Failed to get cycle', timestamp: new Date() }
    }
  },

  /**
   * 获取指定计划的战略任务
   */
  // eslint-disable-next-line no-restricted-syntax -- Backend API returns StrategicTaskVO
  async getTasksByPlanId(planId: number | string): Promise<ApiResponse<StrategicTaskVO[]>> {
    return apiClient.get<ApiResponse<StrategicTaskVO[]>>(`/tasks/by-plan/${planId}`)
  },

  /**
   * 获取指定年份的战略任务（通过 cycle）
   */
  // eslint-disable-next-line no-restricted-syntax -- Backend API returns StrategicTaskVO
  async getTasksByYear(year: number): Promise<ApiResponse<StrategicTaskVO[]>> {
    try {
      return fetchWithCache({
        key: buildQueryKey('task', 'list', { year }),
        policy: {
          ttlMs: 2 * 60 * 1000,
          scope: 'memory',
          dedupeWindowMs: 1000,
          tags: ['task.list', `task.list.${year}`]
        },
        fetcher: async () => {
          const cycleResponse = await this.getCycleByYear(year)
          if (!cycleResponse.success || !cycleResponse.data) {
            return {
              success: false,
              data: [],
              message: cycleResponse.message || `No cycle found for year ${year}`,
              timestamp: new Date()
            }
          }

          const cycleId =
            (cycleResponse.data as AssessmentCycleVO & { cycleId?: number; id?: number }).cycleId ||
            (cycleResponse.data as AssessmentCycleVO & { id?: number }).id

          if (!cycleId) {
            return {
              success: false,
              data: [],
              message: `Cycle ID missing for year ${year}`,
              timestamp: new Date()
            }
          }

          return apiClient.get<ApiResponse<StrategicTaskVO[]>>(`/tasks/by-cycle/${cycleId}`)
        }
      })
    } catch {
      return { success: false, data: [], message: 'Failed to get tasks', timestamp: new Date() }
    }
  },

  /**
   * 获取所有战略任务
   */
  // eslint-disable-next-line no-restricted-syntax -- Backend API returns StrategicTaskVO
  async getAllTasks(): Promise<ApiResponse<StrategicTaskVO[]>> {
    return fetchWithCache({
      key: buildQueryKey('task', 'list'),
      policy: {
        ttlMs: 2 * 60 * 1000,
        scope: 'memory',
        dedupeWindowMs: 1000,
        tags: ['task.list']
      },
      fetcher: () => apiClient.get<ApiResponse<StrategicTaskVO[]>>('/tasks')
    })
  },

  /**
   * 获取指定年份的指标（包含里程碑）
   */
  async getIndicatorsByYear(year: number): Promise<ApiResponse<IndicatorVO[]>> {
    try {
      // 获取所有指标，然后按年份过滤
      const response = await apiClient.get<ApiResponse<IndicatorVO[]>>('/indicators')
      if (response.success && response.data) {
        const filteredIndicators = response.data.filter(i => i.year === year)
        return { ...response, data: filteredIndicators }
      }
      return response
    } catch {
      return {
        success: false,
        data: [],
        message: 'Failed to get indicators',
        timestamp: new Date()
      }
    }
  },

  /**
   * 获取所有指标
   * @param year 可选的年份过滤参数
   */
  async getAllIndicators(year?: number): Promise<ApiResponse<IndicatorVO[]>> {
    const params = year ? { year } : {}
    return fetchWithCache({
      key: buildQueryKey('indicator', 'list', year ? { year } : undefined),
      policy: {
        ttlMs: 2 * 60 * 1000,
        scope: 'memory',
        dedupeWindowMs: 1000,
        tags: ['indicator.list', ...(typeof year === 'number' ? [`indicator.list.${year}`] : [])]
      },
      fetcher: () => apiClient.get<ApiResponse<IndicatorVO[]>>('/indicators', { params })
    })
  },

  /**
   * 获取指定任务的指标
   */
  async getIndicatorsByTask(taskId: string): Promise<ApiResponse<IndicatorVO[]>> {
    return apiClient.get<ApiResponse<IndicatorVO[]>>(`/indicators/task/${taskId}`)
  },

  /**
   * 创建新的战略任务
   */
  // eslint-disable-next-line no-restricted-syntax -- Backend API returns StrategicTaskVO
  async createTask(request: CreateStrategicTaskRequest): Promise<ApiResponse<StrategicTaskVO>> {
    logger.info('[API] Creating new strategic task', { request })

    try {
      const response = await withRetry(() =>
        // eslint-disable-next-line no-restricted-syntax -- Backend API returns StrategicTaskVO
        apiClient.post<ApiResponse<StrategicTaskVO>>('/tasks', request)
      )

      invalidateTaskCaches(response.data?.taskId, request.year)
      logger.info('[API] Successfully created task', { taskId: response.data?.taskId })
      return response
    } catch (error) {
      logger.error('[API] Failed to create task', { error, request })
      throw error
    }
  },

  /**
   * 更新现有的战略任务
   */
  // eslint-disable-next-line no-restricted-syntax -- Backend API returns StrategicTaskVO
  async updateTask(
    taskId: number,
    request: UpdateStrategicTaskRequest
  ): Promise<ApiResponse<StrategicTaskVO>> {
    logger.info('[API] Updating strategic task', { taskId, request })

    try {
      const response = await withRetry(() =>
        // eslint-disable-next-line no-restricted-syntax -- Backend API returns StrategicTaskVO
        apiClient.put<ApiResponse<StrategicTaskVO>>(`/tasks/${taskId}`, request)
      )

      invalidateTaskCaches(taskId, request.year)
      logger.info('[API] Successfully updated task', { taskId })
      return response
    } catch (error) {
      logger.error('[API] Failed to update task', { error, taskId, request })
      throw error
    }
  },

  async updateTaskName(
    taskId: number | string,
    taskName: string
  ): Promise<ApiResponse<StrategicTaskVO>> {
    logger.info('[API] Updating strategic task name', { taskId, taskName })

    try {
      return await withRetry(() =>
        apiClient.put<ApiResponse<StrategicTaskVO>>(`/tasks/${taskId}/name`, {
          taskId: Number(taskId),
          taskName
        })
      )
    } catch (error) {
      logger.error('[API] Failed to update task name', { error, taskId, taskName })
      throw error
    }
  },

  async createBackendTask(
    request: BackendTaskCreateRequest
  ): Promise<ApiResponse<StrategicTaskVO>> {
    logger.info('[API] Creating backend task for indicator binding', { request })

    try {
      const response = await withRetry(() =>
        apiClient.post<ApiResponse<StrategicTaskVO>>('/tasks', request)
      )
      invalidateTaskCaches(response.data?.taskId ?? response.data?.id)
      return response
    } catch (error) {
      logger.error('[API] Failed to create backend task for indicator binding', { error, request })
      throw error
    }
  },

  /**
   * 删除战略任务
   */
  async deleteTask(taskId: number): Promise<ApiResponse<void>> {
    logger.info('[API] Deleting strategic task', { taskId })

    try {
      const response = await withRetry(() =>
        apiClient.delete<ApiResponse<void>>(`/tasks/${taskId}`)
      )

      invalidateTaskCaches(taskId)
      logger.info('[API] Successfully deleted task', { taskId })
      return response
    } catch (error) {
      logger.error('[API] Failed to delete task', { error, taskId })
      throw error
    }
  },

  // 转换函数导出
  // eslint-disable-next-line no-restricted-syntax -- Converter function for backend VO
  convertTaskVOToStrategicTask,
  convertIndicatorVOToStrategicIndicator
}

export default strategicApi

/**
 * ==========================================
 * 审批流程 API
 * ==========================================
 */

/**
 * 审批通过
 * @param instanceId 审批实例ID
 * @param approverId 审批人ID
 * @param comment 审批意见（可选）
 */
async function approvePlan(
  instanceId: number,
  approverId: number,
  comment?: string
): Promise<ApiResponse<string>> {
  logger.info('[API] Approving plan', { instanceId, approverId })

  try {
    const response = await withRetry(() =>
      apiClient.post<ApiResponse<string>>(
        `/approval/instances/${instanceId}/approve?userId=${approverId}${
          comment ? `&comment=${encodeURIComponent(comment)}` : ''
        }`,
        { comment }
      )
    )

    logger.info('[API] Successfully approved plan', { instanceId })
    return response
  } catch (error) {
    logger.error('[API] Failed to approve plan', { error, instanceId, approverId })
    throw error
  }
}

/**
 * 审批拒绝
 * @param instanceId 审批实例ID
 * @param approverId 审批人ID
 * @param comment 拒绝原因（必填）
 */
async function rejectPlan(
  instanceId: number,
  approverId: number,
  comment: string
): Promise<ApiResponse<string>> {
  logger.info('[API] Rejecting plan', { instanceId, approverId })

  try {
    const response = await withRetry(() =>
      apiClient.post<ApiResponse<string>>(
        `/approval/instances/${instanceId}/reject?userId=${approverId}&comment=${encodeURIComponent(
          comment
        )}`,
        { comment }
      )
    )

    logger.info('[API] Successfully rejected plan', { instanceId })
    return response
  } catch (error) {
    logger.error('[API] Failed to reject plan', { error, instanceId, approverId })
    throw error
  }
}

/**
 * 获取用户待审批列表
 * @param userId 用户ID
 */
async function getPendingApprovals(userId: number): Promise<ApiResponse<PendingApproval[]>> {
  logger.info('[API] Getting pending approvals', { userId })

  try {
    const response = await withRetry(() =>
      apiClient.get<ApiResponse<PendingApproval[]>>('/approval/instances/my-pending', { userId })
    )

    logger.info('[API] Successfully got pending approvals', { count: response.data?.length || 0 })
    return response
  } catch (error) {
    logger.error('[API] Failed to get pending approvals', { error, userId })
    throw error
  }
}

/**
 * 获取计划审批状态
 * @param planId 计划ID
 */
async function getPlanApprovalStatus(instanceId: number): Promise<ApiResponse<unknown>> {
  logger.info('[API] Getting plan approval status', { instanceId })

  try {
    const response = await withRetry(() =>
      apiClient.get<ApiResponse<unknown>>(`/approval/instances/${instanceId}`)
    )

    logger.info('[API] Successfully got plan approval status', { instanceId })
    return response
  } catch (error) {
    logger.error('[API] Failed to get plan approval status', { error, instanceId })
    throw error
  }
}

/**
 * 获取待审批数量
 * @param userId 用户ID
 */
async function countPendingApprovals(userId: number): Promise<ApiResponse<number>> {
  logger.info('[API] Counting pending approvals', { userId })

  try {
    const response = await withRetry(() =>
      apiClient.get<ApiResponse<PendingApproval[]>>('/approval/instances/my-pending', { userId })
    )

    const count = response.data?.length || 0
    logger.info('[API] Successfully counted pending approvals', { count })
    return { ...response, data: count }
  } catch (error) {
    logger.error('[API] Failed to count pending approvals', { error, userId })
    throw error
  }
}

/**
 * 获取当前审批步骤描述
 * @param instanceId 审批实例ID
 */
async function getCurrentStep(instanceId: number): Promise<ApiResponse<string>> {
  logger.info('[API] Getting current step', { instanceId })

  try {
    const response = await withRetry(() =>
      apiClient.get<ApiResponse<{
        currentStepIndex?: number
        stepInstances?: Array<{ stepIndex?: number; stepName?: string }>
        title?: string
      }>>(`/approval/instances/${instanceId}`)
    )

    const currentStepIndex = response.data?.currentStepIndex
    const stepName =
      response.data?.stepInstances?.find(step => step.stepIndex === currentStepIndex)?.stepName ||
      response.data?.title ||
      '未知步骤'

    logger.info('[API] Successfully got current step', { instanceId, stepName })
    return { ...response, data: stepName }
  } catch (error) {
    logger.error('[API] Failed to get current step', { error, instanceId })
    throw error
  }
}

/**
 * 获取审批时间轴（基于审批实例详情）
 */
async function getApprovalTimeline(
  instanceId: number
): Promise<
  ApiResponse<{
    instanceId: number
    currentStepIndex?: number
    timeline: Array<{
      stepIndex: number
      stepName: string
      status: string
      approverName?: string
      approvedAt?: string | null
      comment?: string | null
    }>
  }>
> {
  logger.info('[API] Getting approval timeline', { instanceId })

  try {
    const response = await withRetry(() =>
      apiClient.get<ApiResponse<{
        currentStepIndex?: number
        stepInstances?: Array<{
          stepIndex?: number
          stepName?: string
          status?: string
          approverName?: string
          approvedAt?: string
          comment?: string
        }>
      }>>(`/approval/instances/${instanceId}`)
    )

    const timeline =
      response.data?.stepInstances
        ?.map(step => ({
          stepIndex: step.stepIndex ?? 0,
          stepName: step.stepName || '未知步骤',
          status: step.status || 'PENDING',
          approverName: step.approverName,
          approvedAt: step.approvedAt ?? null,
          comment: step.comment ?? null
        }))
        .sort((a, b) => a.stepIndex - b.stepIndex) ?? []

    return {
      ...response,
      data: {
        instanceId,
        currentStepIndex: response.data?.currentStepIndex,
        timeline
      }
    }
  } catch (error) {
    logger.error('[API] Failed to get approval timeline', { error, instanceId })
    throw error
  }
}

// 导出审批相关API
export const approvalApi = {
  approvePlan,
  rejectPlan,
  getPendingApprovals,
  getPlanApprovalStatus,
  countPendingApprovals,
  getCurrentStep,
  getApprovalTimeline
}
