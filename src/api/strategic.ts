/**
 * 战略任务和指标 API 服务
 * 从后端获取数据库中的数据
 * 使用简化的 apiClient，在业务层实现必要的重试逻辑
 *
 * **Validates: Requirements 2.4, 2.6**
 */
import { apiClient } from '@/shared/api/client'
/* eslint-disable no-restricted-syntax -- Backend types use strategic_task terminology */
import type { ApiResponse, StrategicTask, StrategicIndicator } from '@/types'
/* eslint-enable no-restricted-syntax */
// 导入统一的 IndicatorVO 接口，避免重复定义
import type { IndicatorVO, TaskVO } from './types/backend-aligned'

// Re-export TaskVO from backend-aligned types
// eslint-disable-next-line no-restricted-syntax -- Backend VO uses strategic_task terminology
export type { TaskVO as StrategicTaskVO } from './types/backend-aligned'

// Re-export IndicatorVO for consistency
export type { IndicatorVO } from './types/backend-aligned'

// 考核周期 VO (已移至 backend-aligned.ts)
export type { AssessmentCycleVO } from './types/backend-aligned'

/**
 * 将后端 VO 转换为前端 StrategicTask 类型
 */
// eslint-disable-next-line no-restricted-syntax -- Converter function for backend VO
function convertTaskVOToStrategicTask(vo: TaskVO): StrategicTask {
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

  // 转换进度审批状态（保持大写，与数据库约束一致）
  const convertProgressApprovalStatus = (status?: string): 'NONE' | 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' => {
    if (!status) {return 'NONE'}
    // 直接返回大写值，不再转换
    const upperStatus = status.toUpperCase()
    if (['NONE', 'DRAFT', 'PENDING', 'APPROVED', 'REJECTED'].includes(upperStatus)) {
      return upperStatus as 'NONE' | 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED'
    }
    return 'NONE'
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
    type1: (vo.type1 as '定性' | '定量') ?? '定量',
    type2: (vo.type2 as '发展性' | '基础性') ?? (vo.level === 'STRAT_TO_FUNC' ? '发展性' : '基础性'),
    progress: vo.progress ?? calculateProgress(milestones),
    createTime: new Date(vo.createdAt).toLocaleDateString('zh-CN'),
    weight: vo.weightPercent,
    remark: vo.remark || '',
    canWithdraw: vo.canWithdraw ?? (vo.level === 'STRAT_TO_FUNC'),
    taskContent: vo.taskName,
    taskId: vo.taskId,  // 添加 taskId 映射
    milestones,
    targetValue: vo.targetValue ?? 100,
    actualValue: vo.actualValue,
    unit: vo.unit ?? '%',
    responsibleDept: vo.responsibleDept ?? vo.targetOrgName,
    responsiblePerson: vo.responsiblePerson ?? '',
    // 修复：将后端返回的状态转换为大写，匹配 IndicatorStatus 枚举
    status: (vo.status?.toUpperCase() as 'DRAFT' | 'ACTIVE' | 'ARCHIVED' | 'DISTRIBUTED' | 'PENDING' | 'APPROVED') ?? 'ACTIVE',
    isStrategic: vo.isStrategic ?? (vo.level === 'STRAT_TO_FUNC'),
    ownerDept: vo.ownerDept ?? vo.ownerOrgName,
    year: vo.year,
    parentIndicatorId: vo.parentIndicatorId ? String(vo.parentIndicatorId) : undefined,
    progressApprovalStatus: convertProgressApprovalStatus(vo.progressApprovalStatus),
    pendingProgress: vo.pendingProgress,
    pendingRemark: vo.pendingRemark,
    pendingAttachments,
    statusAudit,
    distributionStatus: vo.distributionStatus
  } as StrategicIndicator  // 添加类型断言确保类型正确
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
    const response = await apiClient.get<ApiResponse<AssessmentCycleVO[]>>('/cycles')
    if (response.success && response.data) {
      const cycle = response.data.find(c => c.year === year)
      return { ...response, data: cycle || null }
    }
    return { ...response, data: null }
  },

  /**
   * 获取指定年份的战略任务（通过 cycle）
   */
  // eslint-disable-next-line no-restricted-syntax -- Backend API returns TaskVO
  async getTasksByYear(year: number): Promise<ApiResponse<TaskVO[]>> {
    // 获取所有任务，然后按年份过滤
    // eslint-disable-next-line no-restricted-syntax -- Backend API returns TaskVO
    const response = await apiClient.get<ApiResponse<TaskVO[]>>('/tasks')
    if (response.success && response.data) {
      // 如果 task.year 为 null，则认为它适用于所有年份
      const filteredTasks = response.data.filter(t => !t.year || t.year === year)
      return { ...response, data: filteredTasks }
    }
    return response
  },

  /**
   * 获取所有战略任务
   */
  // eslint-disable-next-line no-restricted-syntax -- Backend API returns TaskVO
  async getAllTasks(): Promise<ApiResponse<TaskVO[]>> {
    // eslint-disable-next-line no-restricted-syntax -- Backend API returns TaskVO
    return apiClient.get<ApiResponse<TaskVO[]>>('/tasks')
  },

  /**
   * 获取指定年份的指标（包含里程碑）
   */
  async getIndicatorsByYear(year: number): Promise<ApiResponse<IndicatorVO[]>> {
    // 直接使用后端的年份过滤参数
    return apiClient.get<ApiResponse<IndicatorVO[]>>('/indicators', { year })
  },

  /**
   * 获取所有指标
   * @param year 可选的年份过滤参数
   */
  async getAllIndicators(year?: number): Promise<ApiResponse<IndicatorVO[]>> {
    const params = year ? { year } : {}
    return apiClient.get<ApiResponse<IndicatorVO[]>>('/indicators', params)
  },

  /**
   * 获取指定任务的指标
   */
  async getIndicatorsByTask(taskId: string): Promise<ApiResponse<IndicatorVO[]>> {
    return apiClient.get<ApiResponse<IndicatorVO[]>>(`/indicators/task/${taskId}`)
  },

  // 转换函数导出
  // eslint-disable-next-line no-restricted-syntax -- Converter function for backend VO
  convertTaskVOToStrategicTask,
  convertIndicatorVOToStrategicIndicator
}

export default strategicApi
