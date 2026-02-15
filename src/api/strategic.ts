/**
 * 战略任务和指标 API 服务
 * 从后端获取数据库中的数据
 */
import { apiService } from './index'
import type { ApiResponse, StrategicTask, StrategicIndicator } from '@/types'

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
  parentIndicatorId?: number
  parentIndicatorDesc?: string
  level: 'STRAT_TO_FUNC' | 'FUNC_TO_COLLEGE'
  ownerOrgId: number
  ownerOrgName: string
  targetOrgId: number
  targetOrgName: string
  indicatorDesc: string
  weightPercent: number
  sortOrder: number
  year: number
  status: 'ACTIVE' | 'ARCHIVED'
  remark?: string
  createdAt: string
  updatedAt: string
  childIndicators?: IndicatorVO[]
  milestones?: MilestoneVO[]
  // 新增字段 (前端数据对齐 2026-01-19)
  isQualitative?: boolean
  type1?: string
  type2?: string
  canWithdraw?: boolean
  targetValue?: number
  actualValue?: number
  unit?: string
  responsiblePerson?: string
  progress?: number
  statusAudit?: string
  progressApprovalStatus?: 'NONE' | 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED'
  pendingProgress?: number
  pendingRemark?: string
  pendingAttachments?: string
  isStrategic?: boolean
  responsibleDept?: string
  ownerDept?: string
}

// 后端返回的里程碑 VO
export interface MilestoneVO {
  milestoneId: number
  indicatorId: number
  indicatorDesc: string
  milestoneName: string
  milestoneDesc?: string
  dueDate: string
  weightPercent: number
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED' | 'CANCELED'
  sortOrder: number
  inheritedFromId?: number
  createdAt: string
  updatedAt: string
  // 新增字段 (前端数据对齐 2026-01-19)
  targetProgress?: number
  isPaired?: boolean
}

// 考核周期 VO
export interface AssessmentCycleVO {
  cycleId: number
  cycleName: string
  year: number
  startDate: string
  endDate: string
  description?: string
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
    if (status === 'COMPLETED') return 'completed'
    if (status === 'DELAYED' || status === 'CANCELED') return 'overdue'
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
    if (!status) return 'none'
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
  if (milestones.length === 0) return 0
  const completed = milestones.filter(m => m.status === 'completed').length
  return Math.round((completed / milestones.length) * 100)
}

export const strategicApi = {
  /**
   * 获取所有考核周期
   */
  async getAllCycles(): Promise<ApiResponse<AssessmentCycleVO[]>> {
    return apiService.get<AssessmentCycleVO[]>('/cycles')
  },

  /**
   * 获取指定年份的考核周期
   */
  async getCycleByYear(year: number): Promise<ApiResponse<AssessmentCycleVO | null>> {
    try {
      const response = await apiService.get<AssessmentCycleVO[]>('/cycles')
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
      const response = await apiService.get<StrategicTaskVO[]>('/tasks')
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
    return apiService.get<StrategicTaskVO[]>('/tasks')
  },

  /**
   * 获取指定年份的指标（包含里程碑）
   */
  async getIndicatorsByYear(year: number): Promise<ApiResponse<IndicatorVO[]>> {
    try {
      // 获取所有指标，然后按年份过滤
      const response = await apiService.get<IndicatorVO[]>('/indicators')
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
   */
  async getAllIndicators(): Promise<ApiResponse<IndicatorVO[]>> {
    return apiService.get<IndicatorVO[]>('/indicators')
  },

  /**
   * 获取指定任务的指标
   */
  async getIndicatorsByTask(taskId: string): Promise<ApiResponse<IndicatorVO[]>> {
    return apiService.get<IndicatorVO[]>(`/indicators/task/${taskId}`)
  },

  // 转换函数导出
  convertTaskVOToStrategicTask,
  convertIndicatorVOToStrategicIndicator
}

export default strategicApi
