/**
 * Plan API 服务
 * 新数据结构: Plan -> Task -> Indicator -> IndicatorFill
 *
 * 这是配合后端数据库重构的新 API 层
 * 使用简化的 apiClient，在业务层实现必要的重试逻辑
 *
 * **Validates: Requirements 2.4, 2.6**
 */
import { apiClient } from '@/5-shared/lib/api'
import { withRetry } from '@/5-shared/lib/api/wrappers'
import type {
  ApiResponse,
  Plan,
  PlanFill,
  PlanFillStatus,
  PlanStatus,
  IndicatorFill,
  Indicator,
  IndicatorFillForm,
  PlanSubmitForm,
  AuditForm,
  Attachment
} from '@/5-shared/types'
import type { PlanVO, TaskVO } from '@/5-shared/types'
import { approvalApi, type ApprovalDetail } from '@/3-features/approval/api/approval'

// ============================================================
// 后端 VO 类型定义 (与后端约定)
// Note: PlanVO and TaskVO are now imported from backend-aligned.ts
// ============================================================

// 计划模块专用的指标 VO（简化版本，仅用于计划填报）
export interface PlanIndicatorVO {
  indicatorId: number
  taskId: number
  name: string
  definition: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface IndicatorFillVO {
  fillId: number
  indicatorId: number
  planFillId: number
  fillDate: string
  progress: number
  content: string
  attachments: string
  filledBy: string
  filledByName: string
  createdAt: string
  updatedAt: string
  status?: 'SUBMITTED' | 'APPROVED' | 'REJECTED'
  auditComment?: string
  auditedBy?: string
  auditedAt?: string
  milestoneId?: number
  milestoneName?: string
}

export interface PlanFillVO {
  fillId: number
  planId: number
  submitDate: string
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED'
  submittedBy: string
  submittedByName: string
  createdAt: string
  updatedAt: string
  totalIndicators: number
  completedIndicators: number
}

function normalizeApprovalStatus(status?: string): PlanFillStatus {
  if (status === 'APPROVED') {
    return 'approved'
  }
  if (status === 'REJECTED') {
    return 'rejected'
  }
  return 'submitted'
}

function convertApprovalDetailToPlanFill(detail: ApprovalDetail & Record<string, unknown>): PlanFill {
  return {
    id: detail.id,
    plan_id: detail.entityId,
    submit_date:
      (detail.startedAt as string) ||
      (detail.initiatedAt as string) ||
      (detail.createdAt as string) ||
      '',
    status: normalizeApprovalStatus(detail.status),
    submitted_by: String(detail.requesterId ?? detail.initiatedBy ?? ''),
    submitted_by_name:
      (detail.requesterName as string) ||
      (detail.title as string) ||
      (detail.requesterId ? `申请人 #${detail.requesterId}` : '待确认提交人'),
    fills: [],
    audit_logs: [],
    created_at:
      (detail.createdAt as string) ||
      (detail.startedAt as string) ||
      (detail.initiatedAt as string) ||
      '',
    updated_at:
      (detail.updatedAt as string) ||
      (detail.completedAt as string) ||
      (detail.startedAt as string) ||
      '',
    total_indicators: 0,
    completed_indicators: 0
  }
}

// ============================================================
// 假数据生成器 (用于前端开发，后端就绪后移除)
// ============================================================

const mockPlans: PlanVO[] = [
  {
    planId: 1,
    planName: '2025年度战略指标考核计划',
    cycle: '2025',
    orgId: 100,
    orgName: '战略发展部',
    status: 'PUBLISHED',
    createdAt: '2025-01-01T00:00:00',
    updatedAt: '2025-01-01T00:00:00',
    createdBy: 'admin',
    description: '2025年度全校战略指标考核计划'
  },
  {
    planId: 2,
    planName: '2025年第一季度指标填报',
    cycle: '2025-Q1',
    orgId: 200,
    orgName: '教务处',
    status: 'PENDING',
    createdAt: '2025-01-15T00:00:00',
    updatedAt: '2025-02-01T00:00:00',
    createdBy: 'dept_admin',
    description: '第一季度教学相关指标填报'
  }
]

const mockTasks: TaskVO[] = [
  {
    taskId: 1,
    planId: 1,
    taskName: '教学质量提升',
    taskType: 'QUALITATIVE',
    description: '定性指标：教学质量评估与提升',
    sortOrder: 1
  },
  {
    taskId: 2,
    planId: 1,
    taskName: '科研产出指标',
    taskType: 'QUANTITATIVE',
    description: '定量指标：科研项目与成果统计',
    sortOrder: 2
  },
  {
    taskId: 3,
    planId: 2,
    taskName: '学生满意度',
    taskType: 'QUANTITATIVE',
    description: '学生满意度调查统计',
    sortOrder: 1
  }
]

const mockIndicators: PlanIndicatorVO[] = [
  {
    indicatorId: 1,
    taskId: 1,
    name: '课程思政建设成效',
    definition: '评估课程思政建设的实施情况和效果',
    sortOrder: 1,
    createdAt: '2025-01-01T00:00:00',
    updatedAt: '2025-01-01T00:00:00'
  },
  {
    indicatorId: 2,
    taskId: 1,
    name: '教学方法创新',
    definition: '教学方法的改革与创新实践',
    sortOrder: 2,
    createdAt: '2025-01-01T00:00:00',
    updatedAt: '2025-01-01T00:00:00'
  },
  {
    indicatorId: 3,
    taskId: 2,
    name: '国家级项目立项数',
    definition: '当年获批国家级科研项目数量',
    sortOrder: 1,
    createdAt: '2025-01-01T00:00:00',
    updatedAt: '2025-01-01T00:00:00'
  },
  {
    indicatorId: 4,
    taskId: 2,
    name: '高水平论文发表数',
    definition: '发表在顶级期刊的论文数量',
    sortOrder: 2,
    createdAt: '2025-01-01T00:00:00',
    updatedAt: '2025-01-01T00:00:00'
  },
  {
    indicatorId: 5,
    taskId: 3,
    name: '本科生满意度',
    definition: '本科生对教学质量的满意度评分',
    sortOrder: 1,
    createdAt: '2025-01-15T00:00:00',
    updatedAt: '2025-01-15T00:00:00'
  }
]

const mockIndicatorFills: IndicatorFillVO[] = [
  {
    fillId: 1,
    indicatorId: 1,
    planFillId: 1,
    fillDate: '2025-01-15',
    progress: 75,
    content: '已完成5门课程的思政建设，学生反馈良好',
    attachments: '[]',
    filledBy: 'user001',
    filledByName: '张老师',
    createdAt: '2025-01-15T10:30:00',
    updatedAt: '2025-01-15T10:30:00',
    status: 'APPROVED',
    auditComment: '审核通过',
    auditedBy: 'admin',
    auditedAt: '2025-01-16T09:00:00'
  },
  {
    fillId: 2,
    indicatorId: 1,
    planFillId: 2,
    fillDate: '2025-02-15',
    progress: 85,
    content: '新增2门课程思政案例，组织一次教学研讨会',
    attachments: '[{"name":"研讨会照片.jpg","url":"/files/seminar.jpg"}]',
    filledBy: 'user001',
    filledByName: '张老师',
    createdAt: '2025-02-15T14:20:00',
    updatedAt: '2025-02-15T14:20:00',
    status: 'SUBMITTED',
    milestoneId: 1,
    milestoneName: '第一季度里程碑'
  },
  {
    fillId: 3,
    indicatorId: 3,
    planFillId: 1,
    fillDate: '2025-01-20',
    progress: 60,
    content: '已提交2项国家级项目申请',
    attachments: '[]',
    filledBy: 'user002',
    filledByName: '李老师',
    createdAt: '2025-01-20T16:00:00',
    updatedAt: '2025-01-20T16:00:00',
    status: 'APPROVED',
    auditComment: '符合预期',
    auditedBy: 'admin',
    auditedAt: '2025-01-21T10:30:00'
  },
  {
    fillId: 4,
    indicatorId: 5,
    planFillId: 2,
    fillDate: '2025-02-10',
    progress: 92,
    content: '本季度满意度调查结果良好',
    attachments: '[{"name":"满意度报告.pdf","url":"/files/report.pdf"}]',
    filledBy: 'user003',
    filledByName: '王老师',
    createdAt: '2025-02-10T11:00:00',
    updatedAt: '2025-02-10T11:00:00',
    status: 'PENDING'
  }
]

const mockPlanFills: PlanFillVO[] = [
  {
    fillId: 1,
    planId: 1,
    submitDate: '2025-01-31',
    status: 'APPROVED',
    submittedBy: 'user001',
    submittedByName: '张老师',
    createdAt: '2025-01-31T23:59:00',
    updatedAt: '2025-02-01T09:00:00',
    totalIndicators: 4,
    completedIndicators: 4
  },
  {
    fillId: 2,
    planId: 1,
    submitDate: '2025-02-15',
    status: 'SUBMITTED',
    submittedBy: 'user001',
    submittedByName: '张老师',
    createdAt: '2025-02-15T18:00:00',
    updatedAt: '2025-02-15T18:00:00',
    totalIndicators: 4,
    completedIndicators: 3
  }
]

// ============================================================
// 类型转换函数
// ============================================================

function convertStatus(status: string): PlanStatus {
  const map: Record<string, PlanStatus> = {
    DRAFT: 'draft',
    PENDING: 'pending',
    PUBLISHED: 'published',
    ARCHIVED: 'archived'
  }
  return map[status] || 'draft'
}

function convertFillStatus(status: string): PlanFillStatus {
  const map: Record<string, PlanFillStatus> = {
    SUBMITTED: 'submitted',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    PENDING: 'submitted' // PENDING 映射为 SUBMITTED
  }
  return map[status] || 'submitted'
}

function parseAttachments(attachmentsStr: string): Attachment[] {
  try {
    return JSON.parse(attachmentsStr || '[]')
  } catch {
    return []
  }
}

function convertPlanVOToPlan(vo: PlanVO, tasks: Task[]): Plan {
  return {
    id: vo.planId,
    name: vo.planName,
    cycle: vo.cycle,
    org_id: vo.orgId,
    status: convertStatus(vo.status),
    tasks,
    createdAt: vo.createdAt,
    updatedAt: vo.updatedAt,
    createdBy: vo.createdBy,
    description: vo.description
  }
}

function convertTaskVOToTask(vo: TaskVO, indicators: Indicator[]): Task {
  return {
    id: vo.taskId,
    plan_id: vo.planId,
    name: vo.taskName,
    type: vo.taskType.toLowerCase() as 'qualitative' | 'quantitative',
    description: vo.description,
    sortOrder: vo.sortOrder,
    indicators
  }
}

function convertIndicatorVOToIndicator(vo: PlanIndicatorVO): Indicator {
  // 查找该指标的最新填报记录
  const fills = mockIndicatorFills.filter(f => f.indicatorId === vo.indicatorId)
  const latestFill = fills.sort(
    (a, b) => new Date(b.fillDate).getTime() - new Date(a.fillDate).getTime()
  )[0]

  return {
    id: vo.indicatorId,
    task_id: vo.taskId,
    name: vo.name,
    definition: vo.definition,
    milestones: [], // 里程碑将单独获取
    createdAt: vo.createdAt,
    updatedAt: vo.updatedAt,
    latest_progress: latestFill?.progress,
    latest_fill_date: latestFill?.fillDate,
    latest_fill_id: latestFill?.fillId?.toString(),
    fill_count: fills.length
  }
}

function convertIndicatorFillVOToIndicatorFill(vo: IndicatorFillVO): IndicatorFill {
  return {
    id: vo.fillId,
    indicator_id: vo.indicatorId,
    plan_fill_id: vo.planFillId,
    fill_date: vo.fillDate,
    progress: vo.progress,
    content: vo.content,
    attachments: parseAttachments(vo.attachments),
    filled_by: vo.filledBy,
    filled_by_name: vo.filledByName,
    created_at: vo.createdAt,
    updated_at: vo.updatedAt,
    status: vo.status ? convertFillStatus(vo.status) : undefined,
    audit_comment: vo.auditComment,
    audited_by: vo.auditedBy,
    audited_at: vo.auditedAt,
    milestone_id: vo.milestoneId,
    milestone_name: vo.milestoneName
  }
}

function convertPlanFillVOToPlanFill(vo: PlanFillVO, fills: IndicatorFill[]): PlanFill {
  return {
    id: vo.fillId,
    plan_id: vo.planId,
    submit_date: vo.submitDate,
    status: convertFillStatus(vo.status),
    submitted_by: vo.submittedBy,
    submitted_by_name: vo.submittedByName,
    fills,
    audit_logs: [], // 审核日志将单独获取
    created_at: vo.createdAt,
    updated_at: vo.updatedAt,
    total_indicators: vo.totalIndicators,
    completed_indicators: vo.completedIndicators
  }
}

// ============================================================
// Plan API 服务
// ============================================================

export const planApi = {
  // 使用模拟数据标志（后端就绪后设为 false）
  useMockData: import.meta.env.VITE_USE_MOCK === 'true',

  /**
   * 获取所有 Plan
   */
  async getAllPlans(): Promise<ApiResponse<Plan[]>> {
    if (this.useMockData) {
      // 使用假数据
      const plans = mockPlans.map(planVO => {
        const tasks = mockTasks
          .filter(t => t.planId === planVO.planId)
          .map(taskVO => {
            const indicators = mockIndicators
              .filter(i => i.taskId === taskVO.taskId)
              .map(convertIndicatorVOToIndicator)
            return convertTaskVOToTask(taskVO, indicators)
          })
        return convertPlanVOToPlan(planVO, tasks)
      })

      return {
        code: 200,
        data: plans,
        message: '获取成功',
        timestamp: new Date().toISOString()
      }
    }

    // 真实 API 调用（后端就绪后启用）
    const response = await apiClient.get<ApiResponse<Plan[] | { items?: Plan[] }>>('/plans')

    if (Array.isArray(response.data)) {
      return response as ApiResponse<Plan[]>
    }

    if (
      response.data &&
      typeof response.data === 'object' &&
      'items' in response.data &&
      Array.isArray(response.data.items)
    ) {
      return {
        ...response,
        data: response.data.items
      }
    }

    return {
      ...response,
      data: []
    }
  },

  /**
   * 根据 org_id 获取 Plan 列表
   * 后端不支持 /plans/org/{orgId}，改为使用 /plans 配合过滤参数
   * 注意：后端返回分页格式，需要转换
   */
  async getPlansByOrg(orgId: number | string): Promise<ApiResponse<Plan[]>> {
    if (this.useMockData) {
      const allPlans = await this.getAllPlans()
      const filtered = allPlans.data?.filter(p => p.org_id === orgId) || []
      return {
        ...allPlans,
        data: filtered
      }
    }

    // 后端使用 /plans 端点，不支持按 orgId 过滤
    // 返回空数组或使用其他方式过滤
    return apiClient.get<ApiResponse<Plan[]>>('/plans', { page: 0, size: 1000 })
  },

  /**
   * 根据 status 获取 Plan 列表
   * 使用后端 /plans?status=xxx 接口
   */
  async getPlansByStatus(status: PlanStatus): Promise<ApiResponse<Plan[]>> {
    if (this.useMockData) {
      const allPlans = await this.getAllPlans()
      const filtered = allPlans.data?.filter(p => p.status === status) || []
      return {
        ...allPlans,
        data: filtered
      }
    }

    // 使用后端支持的状态过滤参数
    return apiClient.get<ApiResponse<Plan[]>>('/plans', { status, page: 0, size: 1000 })
  },

  /**
   * 获取单个 Plan 详情
   */
  async getPlanById(planId: number | string): Promise<ApiResponse<Plan | null>> {
    if (this.useMockData) {
      const planVO = mockPlans.find(p => p.planId === Number(planId))
      if (!planVO) {
        return {
          code: 1002,
          data: null,
          message: 'Plan not found',
          timestamp: new Date().toISOString()
        }
      }

      const tasks = mockTasks
        .filter(t => t.planId === planVO.planId)
        .map(taskVO => {
          const indicators = mockIndicators
            .filter(i => i.taskId === taskVO.taskId)
            .map(convertIndicatorVOToIndicator)
          return convertTaskVOToTask(taskVO, indicators)
        })

      return {
        code: 200,
        data: convertPlanVOToPlan(planVO, tasks),
        message: '获取成功',
        timestamp: new Date().toISOString()
      }
    }

    return apiClient.get<ApiResponse<Plan>>(`/plans/${planId}`)
  },

  /**
   * 创建 Plan
   */
  async createPlan(data: Partial<Plan>): Promise<ApiResponse<Plan>> {
    if (this.useMockData) {
      const newPlan: Plan = {
        id: mockPlans.length + 1,
        ...data,
        tasks: data.tasks || []
      } as Plan

      mockPlans.push({
        planId: newPlan.id as number,
        planName: newPlan.name,
        cycle: newPlan.cycle,
        orgId: newPlan.org_id as number,
        orgName: '',
        status: (newPlan.status?.toUpperCase() as 'DRAFT' | 'ACTIVE' | 'ARCHIVED') || 'DRAFT',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: newPlan.createdBy || 'current_user',
        description: newPlan.description
      })

      return {
        code: 200,
        data: newPlan,
        message: '创建成功',
        timestamp: new Date().toISOString()
      }
    }

    return withRetry(async () => {
      return apiClient.post<ApiResponse<Plan>>('/plans', data)
    })
  },

  /**
   * 更新 Plan
   */
  async updatePlan(planId: number | string, data: Partial<Plan>): Promise<ApiResponse<Plan>> {
    if (this.useMockData) {
      const index = mockPlans.findIndex(p => p.planId === Number(planId))
      if (index !== -1) {
        mockPlans[index] = { ...mockPlans[index], ...data }
        return {
          code: 200,
          data: convertPlanVOToPlan(mockPlans[index], []),
          message: '更新成功',
          timestamp: new Date().toISOString()
        }
      }
      return {
        code: 1002,
        data: null as never,
        message: 'Plan not found',
        timestamp: new Date().toISOString()
      }
    }

    return withRetry(async () => {
      return apiClient.put<ApiResponse<Plan>>(`/plans/${planId}`, data)
    })
  },

  /**
   * 删除 Plan
   */
  async deletePlan(planId: number | string): Promise<ApiResponse<void>> {
    if (this.useMockData) {
      const index = mockPlans.findIndex(p => p.planId === Number(planId))
      if (index !== -1) {
        mockPlans.splice(index, 1)
        return {
          success: true,
          data: undefined,
          message: '删除成功',
          timestamp: new Date().toISOString()
        }
      }
      return {
        code: 1002,
        data: undefined,
        message: 'Plan not found',
        timestamp: new Date().toISOString()
      }
    }

    return withRetry(async () => {
      return apiClient.delete<ApiResponse<void>>(`/plans/${planId}`)
    })
  },

  /**
   * 提交 Plan（整包提交）
   */
  async submitPlan(form: PlanSubmitForm): Promise<ApiResponse<PlanFill>> {
    if (this.useMockData) {
      const newPlanFill: PlanFill = {
        id: mockPlanFills.length + 1,
        plan_id: form.plan_id,
        submit_date: new Date().toISOString().split('T')[0],
        status: 'submitted',
        submitted_by: 'current_user',
        submitted_by_name: '当前用户',
        fills: [],
        audit_logs: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        total_indicators: 0,
        completed_indicators: 0
      }

      mockPlanFills.push({
        fillId: newPlanFill.id as number,
        planId: form.plan_id as number,
        submitDate: newPlanFill.submit_date,
        status: 'SUBMITTED',
        submittedBy: newPlanFill.submitted_by,
        submittedByName: newPlanFill.submitted_by_name,
        createdAt: newPlanFill.created_at,
        updatedAt: newPlanFill.updated_at,
        totalIndicators: newPlanFill.total_indicators,
        completedIndicators: newPlanFill.completed_indicators
      })

      return {
        code: 200,
        data: newPlanFill,
        message: '提交成功',
        timestamp: new Date().toISOString()
      }
    }

    return withRetry(async () => {
      return apiClient.post<ApiResponse<PlanFill>>(`/plans/${form.plan_id}/submit`, form)
    })
  }
}

// ============================================================
// IndicatorFill API 服务
// ============================================================

export const indicatorFillApi = {
  // 使用模拟数据标志（后端就绪后设为 false）
  useMockData: import.meta.env.VITE_USE_MOCK === 'true',

  /**
   * 获取指标的所有填报历史
   */
  async getIndicatorFillHistory(
    indicatorId: number | string
  ): Promise<ApiResponse<IndicatorFill[]>> {
    if (this.useMockData) {
      const fills = mockIndicatorFills
        .filter(f => f.indicatorId === Number(indicatorId))
        .map(convertIndicatorFillVOToIndicatorFill)
        .sort((a, b) => new Date(b.fill_date).getTime() - new Date(a.fill_date).getTime())

      return {
        code: 200,
        data: fills,
        message: '获取成功',
        timestamp: new Date().toISOString()
      }
    }

    return apiClient.get<ApiResponse<IndicatorFill[]>>(`/indicators/${indicatorId}/fills`)
  },

  /**
   * 获取单次填报记录详情
   */
  async getFillById(fillId: number | string): Promise<ApiResponse<IndicatorFill | null>> {
    if (this.useMockData) {
      const fillVO = mockIndicatorFills.find(f => f.fillId === Number(fillId))
      if (!fillVO) {
        return {
          code: 1002,
          data: null,
          message: 'Fill not found',
          timestamp: new Date().toISOString()
        }
      }

      return {
        code: 200,
        data: convertIndicatorFillVOToIndicatorFill(fillVO),
        message: '获取成功',
        timestamp: new Date().toISOString()
      }
    }

    return apiClient.get<ApiResponse<IndicatorFill>>(`/fills/${fillId}`)
  },

  /**
   * 创建/保存填报记录
   */
  async saveFill(form: IndicatorFillForm): Promise<ApiResponse<IndicatorFill>> {
    if (this.useMockData) {
      const newFill: IndicatorFill = {
        id: mockIndicatorFills.length + 1,
        indicator_id: form.indicator_id,
        plan_fill_id: 0, // 暂时关联到 plan_fill
        fill_date: new Date().toISOString().split('T')[0],
        progress: form.progress,
        content: form.content,
        attachments: form.attachments ? [] : [],
        filled_by: 'current_user',
        filled_by_name: '当前用户',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        milestone_id: form.milestone_id
      }

      mockIndicatorFills.push({
        fillId: newFill.id as number,
        indicatorId: form.indicator_id as number,
        planFillId: newFill.plan_fill_id as number,
        fillDate: newFill.fill_date,
        progress: newFill.progress,
        content: newFill.content,
        attachments: JSON.stringify(newFill.attachments),
        filledBy: newFill.filled_by,
        filledByName: newFill.filled_by_name,
        createdAt: newFill.created_at,
        updatedAt: newFill.updated_at,
        milestoneId: newFill.milestone_id as number
      })

      return {
        code: 200,
        data: newFill,
        message: '保存成功',
        timestamp: new Date().toISOString()
      }
    }

    return withRetry(async () => {
      return apiClient.post<ApiResponse<IndicatorFill>>('/fills', form)
    })
  },

  /**
   * 更新填报记录
   */
  async updateFill(
    fillId: number | string,
    form: Partial<IndicatorFillForm>
  ): Promise<ApiResponse<IndicatorFill>> {
    if (this.useMockData) {
      const index = mockIndicatorFills.findIndex(f => f.fillId === Number(fillId))
      if (index !== -1) {
        mockIndicatorFills[index] = {
          ...mockIndicatorFills[index],
          progress: form.progress ?? mockIndicatorFills[index].progress,
          content: form.content ?? mockIndicatorFills[index].content
        }

        return {
          code: 200,
          data: convertIndicatorFillVOToIndicatorFill(mockIndicatorFills[index]),
          message: '更新成功',
          timestamp: new Date().toISOString()
        }
      }
      return {
        code: 1002,
        data: null as never,
        message: 'Fill not found',
        timestamp: new Date().toISOString()
      }
    }

    return withRetry(async () => {
      return apiClient.put<ApiResponse<IndicatorFill>>(`/fills/${fillId}`, form)
    })
  },

  /**
   * 删除填报记录
   */
  async deleteFill(fillId: number | string): Promise<ApiResponse<void>> {
    if (this.useMockData) {
      const index = mockIndicatorFills.findIndex(f => f.fillId === Number(fillId))
      if (index !== -1) {
        mockIndicatorFills.splice(index, 1)
        return {
          success: true,
          data: undefined,
          message: '删除成功',
          timestamp: new Date().toISOString()
        }
      }
      return {
        code: 1002,
        data: undefined,
        message: 'Fill not found',
        timestamp: new Date().toISOString()
      }
    }

    return withRetry(async () => {
      return apiClient.delete<ApiResponse<void>>(`/fills/${fillId}`)
    })
  },

  /**
   * 提交填报记录（加入待审核队列）
   */
  async submitFill(fillId: number | string): Promise<ApiResponse<IndicatorFill>> {
    if (this.useMockData) {
      const fillVO = mockIndicatorFills.find(f => f.fillId === Number(fillId))
      if (fillVO) {
        fillVO.status = 'SUBMITTED'
        return {
          code: 200,
          data: convertIndicatorFillVOToIndicatorFill(fillVO),
          message: '提交成功',
          timestamp: new Date().toISOString()
        }
      }
      return {
        code: 1002,
        data: null as never,
        message: 'Fill not found',
        timestamp: new Date().toISOString()
      }
    }

    return withRetry(async () => {
      return apiClient.post<ApiResponse<IndicatorFill>>(`/fills/${fillId}/submit`, {})
    })
  }
}

// ============================================================
// PlanFill API 服务
// ============================================================

export const planFillApi = {
  // 使用模拟数据标志（后端就绪后设为 false）
  useMockData: import.meta.env.VITE_USE_MOCK === 'true',

  /**
   * 获取 Plan 的所有提交记录
   */
  async getPlanFills(planId: number | string): Promise<ApiResponse<PlanFill[]>> {
    if (this.useMockData) {
      const fills = mockPlanFills
        .filter(f => f.planId === Number(planId))
        .map(planFillVO => {
          const indicatorFills = mockIndicatorFills
            .filter(ifill => ifill.planFillId === planFillVO.fillId)
            .map(convertIndicatorFillVOToIndicatorFill)
          return convertPlanFillVOToPlanFill(planFillVO, indicatorFills)
        })
        .sort((a, b) => new Date(b.submit_date).getTime() - new Date(a.submit_date).getTime())

      return {
        code: 200,
        data: fills,
        message: '获取成功',
        timestamp: new Date().toISOString()
      }
    }

    return apiClient.get<ApiResponse<PlanFill[]>>(`/plans/${planId}/fills`)
  },

  /**
   * 获取待审核的 PlanFill 列表（审核人视角）
   */
  async getPendingPlanFills(auditorOrgId?: number | string): Promise<ApiResponse<PlanFill[]>> {
    if (this.useMockData) {
      const fills = mockPlanFills
        .filter(f => f.status === 'SUBMITTED')
        .map(planFillVO => {
          const indicatorFills = mockIndicatorFills
            .filter(ifill => ifill.planFillId === planFillVO.fillId)
            .map(convertIndicatorFillVOToIndicatorFill)
          return convertPlanFillVOToPlanFill(planFillVO, indicatorFills)
        })

      return {
        code: 200,
        data: fills,
        message: '获取成功',
        timestamp: new Date().toISOString()
      }
    }

    const response = await approvalApi.getPendingApprovals(Number(auditorOrgId))

    return {
      ...response,
      data: Array.isArray(response.data) ? response.data.map(convertApprovalDetailToPlanFill) : []
    }
  },

  /**
   * 审核 PlanFill
   */
  async auditPlanFill(fillId: number | string, form: AuditForm): Promise<ApiResponse<PlanFill>> {
    if (this.useMockData) {
      const planFillVO = mockPlanFills.find(f => f.fillId === Number(fillId))
      if (planFillVO) {
        planFillVO.status = form.action === 'approve' ? 'APPROVED' : 'REJECTED'

        // 同时更新关联的 IndicatorFill 状态
        mockIndicatorFills
          .filter(f => f.planFillId === Number(fillId))
          .forEach(fillVO => {
            fillVO.status = form.action === 'approve' ? 'APPROVED' : 'REJECTED'
            fillVO.auditComment = form.comment
            fillVO.auditedBy = 'current_user'
            fillVO.auditedAt = new Date().toISOString()
          })

        const indicatorFills = mockIndicatorFills
          .filter(ifill => ifill.planFillId === planFillVO.fillId)
          .map(convertIndicatorFillVOToIndicatorFill)

        return {
          code: 200,
          data: convertPlanFillVOToPlanFill(planFillVO, indicatorFills),
          message: form.action === 'approve' ? '审核通过' : '已驳回',
          timestamp: new Date().toISOString()
        }
      }
      return {
        code: 1002,
        data: null as never,
        message: 'Fill not found',
        timestamp: new Date().toISOString()
      }
    }

    return withRetry(async () => {
      const userId = form.userId || 1 // TODO: 从当前用户上下文获取实际userId

      const response =
        form.action?.toLowerCase() === 'approve'
          ? await approvalApi.approve(Number(fillId), {
              userId,
              comment: form.comment || ''
            })
          : await approvalApi.reject(Number(fillId), {
              userId,
              comment: form.comment || '',
              reason: form.comment || ''
            })

      return {
        ...response,
        data: response.data ? convertApprovalDetailToPlanFill(response.data) : null
      } as ApiResponse<PlanFill>
    })
  }
}

export default planApi
