/**
 * 战略任务和指标 API 服务
 * 从后端获取数据库中的数据
 * 使用简化的 apiClient，在业务层实现必要的重试逻辑
 *
 * **Validates: Requirements 2.4, 2.6**
 */
import { apiClient } from '@/shared/api/client'
import type { 
  ApiResponse, 
  StrategicTask, 
  StrategicIndicator,
  CreateStrategicTaskRequest,
  UpdateStrategicTaskRequest
} from '@/types'
import { logger } from '@/utils/logger'

// 后端返回的战略任务 VO
export interface StrategicTaskVO {
  taskId: number
  cycleId: number
  cycleName: string
  year: number
  taskName: string
  taskDesc: string
  taskType: 'BASIC' | 'DEVELOPMENT' | 'KEY' | 'SPECIAL' | 'QUANTITATIVE' | 'REGULAR'
  orgId: number
  orgName: string
  createdByOrgId: number
  createdByOrgName: string
  sortOrder: number
  remark?: string
  createdAt: string
  updatedAt: string
}

// 后端返回的指标 VO
export interface IndicatorVO {
  indicatorId: number
  taskId: number
  taskName: string
  indicatorName: string
  indicatorDesc: string
  isQualitative: boolean
  type1: '定性' | '定量'
  type2: '发展性' | '基础性'
  progress: number
  createdAt: string
  weightPercent: number
  remark: string
  canWithdraw: boolean
  targetValue: number
  actualValue: number
  unit: string
  responsibleDept: string
  responsiblePerson: string
  status: 'ACTIVE' | 'ARCHIVED'
  isStrategic: boolean
  ownerDept: string
  year: number
  parentIndicatorId?: number
  level: 'STRAT_TO_FUNC' | 'FUNC_TO_SEC'
  progressApprovalStatus: 'NONE' | 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED'
  pendingProgress?: number
  pendingRemark?: string
  pendingAttachments?: string
  statusAudit?: string
  milestones?: MilestoneVO[]
}

// 后端返回的里程碑 VO
export interface MilestoneVO {
  milestoneId: number
  indicatorId: number
  milestoneName: string
  milestoneDesc: string
  targetProgress: number
  dueDate: string
  weightPercent: number
  sortOrder: number
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED' | 'CANCELED'
  isPaired: boolean
}

// 后端返回的考核周期 VO
export interface AssessmentCycleVO {
  cycleId: number
  cycleName: string
  year: number
  startDate: string
  endDate: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/**
 * 指数退避重试辅助函数
 * 在业务层实现重试逻辑，而不是在 apiClient 中
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error: any) {
      lastError = error
      
      // 如果是 4xx 错误，不重试
      if (error.code >= 400 && error.code < 500) {
        throw error
      }

      // 最后一次尝试，直接抛出错误
      if (attempt === maxRetries) {
        throw error
      }

      // 指数退避延迟
      const delay = baseDelay * Math.pow(2, attempt)
      logger.warn(`[API] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`, { error: error.message })
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

/**
 * 将后端 VO 转换为前端 StrategicTask 类型
 */
function convertTaskVOToStrategicTask(vo: StrategicTaskVO): StrategicTask {
  return {
    id: String(vo.taskId),
    title: vo.taskName,
    desc: vo.taskDesc || '',
    createTime: new Date(vo.createdAt).toLocaleDateString('zh-CN'),
    cycle: `${vo.year}年度`,
    startDate: new Date(`${vo.year}-01-01`),
    endDate: new Date(`${vo.year}-12-31`),
    status: 'active',
    createdBy: vo.createdByOrgName,
    indicators: [],
    year: vo.year,
    isRecurring: vo.taskType === 'BASIC' || vo.taskType === 'DEVELOPMENT'
  }
}

/**
 * 将后端 VO 转换为前端 StrategicIndicator 类型
 */
function convertIndicatorVOToStrategicIndicator(vo: IndicatorVO): StrategicIndicator {
  // 转换里程碑状态
  const convertMilestoneStatus = (status: string): 'pending' | 'completed' | 'overdue' => {
    if (status === 'COMPLETED') {return 'completed'}
    if (status === 'DELAYED' || status === 'CANCELED') {return 'overdue'}
    return 'pending' // NOT_STARTED, IN_PROGRESS 都映射为 pending
  }

  // 转换里程碑
  const milestones = vo.milestones?.map(m => ({
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
  const convertProgressApprovalStatus = (status?: string): 'none' | 'draft' | 'pending' | 'approved' | 'rejected' => {
    if (!status) {return 'none'}
    const map: Record<string, 'none' | 'draft' | 'pending' | 'approved' | 'rejected'> = {
      'NONE': 'none',
      'DRAFT': 'draft',
      'PENDING': 'pending',
      'APPROVED': 'approved',
      'REJECTED': 'rejected'
    }
    return map[status] || 'none'
  }

  // 解析 statusAudit JSON
  let statusAudit: any[] = []
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
    type1: (vo.type1 as '定性' | '定量') ?? '定量',
    type2: (vo.type2 as '发展性' | '基础性') ?? (vo.level === 'STRAT_TO_FUNC' ? '发展性' : '基础性'),
    progress: vo.progress ?? calculateProgress(milestones),
    createTime: new Date(vo.createdAt).toLocaleDateString('zh-CN'),
    weight: vo.weightPercent,
    remark: vo.remark || '',
    canWithdraw: vo.canWithdraw ?? (vo.level === 'STRAT_TO_FUNC'),
    taskContent: vo.taskName,
    milestones,
    targetValue: vo.targetValue ?? 100,
    actualValue: vo.actualValue,
    unit: vo.unit ?? '%',
    responsibleDept: vo.responsibleDept ?? vo.targetOrgName,
    responsiblePerson: vo.responsiblePerson ?? '',
    status: vo.status === 'ACTIVE' ? 'active' : 'archived',
    isStrategic: vo.isStrategic ?? (vo.level === 'STRAT_TO_FUNC'),
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
  if (milestones.length === 0) {return 0}
  const completed = milestones.filter(m => m.status === 'completed').length
  return Math.round((completed / milestones.length) * 100)
}

export const strategicApi = {
  /**
   * 获取所有考核周期
   */
  async getAllCycles(): Promise<ApiResponse<AssessmentCycleVO[]>> {
    return apiClient.get<ApiResponse<AssessmentCycleVO[]>>('/cycles')
  },

  /**
   * 获取指定年份的考核周期
   */
  async getCycleByYear(year: number): Promise<ApiResponse<AssessmentCycleVO | null>> {
    try {
      const response = await apiClient.get<ApiResponse<AssessmentCycleVO[]>>('/cycles')
      if (response.success && response.data) {
        const cycle = response.data.find(c => c.year === year)
        return { ...response, data: cycle || null }
      }
      return { ...response, data: null }
    } catch {
      return { success: false, data: null, message: 'Failed to get cycle', timestamp: new Date() }
    }
  },

  /**
   * 获取指定年份的战略任务（通过 cycle）
   */
  async getTasksByYear(year: number): Promise<ApiResponse<StrategicTaskVO[]>> {
    try {
      // 先获取所有任务，然后按年份过滤
      const response = await apiClient.get<ApiResponse<StrategicTaskVO[]>>('/tasks')
      if (response.success && response.data) {
        const filteredTasks = response.data.filter(t => t.year === year)
        return { ...response, data: filteredTasks }
      }
      return response
    } catch {
      return { success: false, data: [], message: 'Failed to get tasks', timestamp: new Date() }
    }
  },

  /**
   * 获取所有战略任务
   */
  async getAllTasks(): Promise<ApiResponse<StrategicTaskVO[]>> {
    return apiClient.get<ApiResponse<StrategicTaskVO[]>>('/tasks')
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
      return { success: false, data: [], message: 'Failed to get indicators', timestamp: new Date() }
    }
  },

  /**
   * 获取所有指标
   * @param year 可选的年份过滤参数
   */
  async getAllIndicators(year?: number): Promise<ApiResponse<IndicatorVO[]>> {
    const params = year ? { year } : {}
    return apiClient.get<ApiResponse<IndicatorVO[]>>('/indicators', { params })
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
  async createTask(request: CreateStrategicTaskRequest): Promise<ApiResponse<StrategicTaskVO>> {
    logger.info('[API] Creating new strategic task', { request })
    
    try {
      const response = await withRetry(() => 
        apiClient.post<ApiResponse<StrategicTaskVO>>('/tasks', request)
      )
      
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
  async updateTask(taskId: number, request: UpdateStrategicTaskRequest): Promise<ApiResponse<StrategicTaskVO>> {
    logger.info('[API] Updating strategic task', { taskId, request })
    
    try {
      const response = await withRetry(() => 
        apiClient.put<ApiResponse<StrategicTaskVO>>(`/tasks/${taskId}`, request)
      )
      
      logger.info('[API] Successfully updated task', { taskId })
      return response
    } catch (error) {
      logger.error('[API] Failed to update task', { error, taskId, request })
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
      
      logger.info('[API] Successfully deleted task', { taskId })
      return response
    } catch (error) {
      logger.error('[API] Failed to delete task', { error, taskId })
      throw error
    }
  },

  // 转换函数导出
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
async function approvePlan(instanceId: number, approverId: number, comment?: string): Promise<ApiResponse<string>> {
  logger.info('[API] Approving plan', { instanceId, approverId })
  
  try {
    const response = await withRetry(() => 
      apiClient.post<ApiResponse<string>>(`/plans/approval/instances/${instanceId}/approve`, {
        approverId,
        comment
      })
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
async function rejectPlan(instanceId: number, approverId: number, comment: string): Promise<ApiResponse<string>> {
  logger.info('[API] Rejecting plan', { instanceId, approverId })
  
  try {
    const response = await withRetry(() => 
      apiClient.post<ApiResponse<string>>(`/plans/approval/instances/${instanceId}/reject`, {
        approverId,
        comment
      })
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
async function getPendingApprovals(userId: number): Promise<ApiResponse<any[]>> {
  logger.info('[API] Getting pending approvals', { userId })
  
  try {
    const response = await withRetry(() => 
      apiClient.get<ApiResponse<any[]>>('/plans/approval/pending', {
        params: { userId }
      })
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
async function getPlanApprovalStatus(planId: number): Promise<ApiResponse<any>> {
  logger.info('[API] Getting plan approval status', { planId })
  
  try {
    const response = await withRetry(() => 
      apiClient.get<ApiResponse<any>>(`/plans/approval/plans/${planId}/status`)
    )
    
    logger.info('[API] Successfully got plan approval status', { planId })
    return response
  } catch (error) {
    logger.error('[API] Failed to get plan approval status', { error, planId })
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
      apiClient.get<ApiResponse<number>>('/plans/approval/pending/count', {
        params: { userId }
      })
    )
    
    logger.info('[API] Successfully counted pending approvals', { count: response.data })
    return response
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
      apiClient.get<ApiResponse<string>>(`/plans/approval/instances/${instanceId}/current-step`)
    )
    
    logger.info('[API] Successfully got current step', { instanceId })
    return response
  } catch (error) {
    logger.error('[API] Failed to get current step', { error, instanceId })
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
  getCurrentStep
}
