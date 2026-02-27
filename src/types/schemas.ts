/**
 * Zod Schema Definitions - 运行时类型验证
 *
 * 职责:
 * - 为核心数据类型提供 Zod 验证模式
 * - 支持运行时数据验证
 * - 与 TypeScript 类型保持同步
 *
 * @module types/schemas
 */

import { z } from 'zod'

// ============================================================================
// 枚举类型 Zod Schema
// ============================================================================

export const UserRoleSchema = z.enum(['strategic_dept', 'functional_dept', 'secondary_college'])
export type UserRole = z.infer<typeof UserRoleSchema>

export const ApprovalStatusSchema = z.enum(['pending', 'approved', 'rejected'])
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>

export const ProgressApprovalStatusSchema = z.enum(['none', 'draft', 'pending', 'approved', 'rejected'])
export type ProgressApprovalStatus = z.infer<typeof ProgressApprovalStatusSchema>

export const IndicatorTypeSchema = z.enum(['quantitative', 'qualitative'])
export type IndicatorType = z.infer<typeof IndicatorTypeSchema>

export const AlertLevelSchema = z.enum(['severe', 'moderate', 'normal'])
export type AlertLevel = z.infer<typeof AlertLevelSchema>

export const MessageTypeSchema = z.enum(['alert', 'approval', 'system', 'task'])
export type MessageType = z.infer<typeof MessageTypeSchema>

export const AuditActionSchema = z.enum(['create', 'update', 'delete', 'approve', 'reject', 'withdraw', 'submit'])
export type AuditAction = z.infer<typeof AuditActionSchema>

// ============================================================================
// 用户相关 Schema
// ============================================================================

export const UserSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1).max(50),
  name: z.string().min(1).max(50),
  role: UserRoleSchema,
  department: z.string().min(1).max(100),
  avatar: z.string().url().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
})

export type User = z.infer<typeof UserSchema>

export const LoginCredentialsSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(6, '密码至少6位字符')
})

export type LoginCredentials = z.infer<typeof LoginCredentialsSchema>

// ============================================================================
// 里程碑 Schema
// ============================================================================

export const MilestoneSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  targetProgress: z.number().min(0).max(100),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必须为 YYYY-MM-DD'),
  status: z.enum(['pending', 'completed', 'overdue']).default('pending'),
  isPaired: z.boolean().optional().default(false),
  weightPercent: z.number().min(0).max(100).optional(),
  sortOrder: z.number().int().optional(),
  indicatorId: z.string().optional()
})

export type Milestone = z.infer<typeof MilestoneSchema>

// ============================================================================
// 状态审计日志 Schema
// ============================================================================

export const StatusAuditEntrySchema = z.object({
  id: z.string().min(1),
  timestamp: z.coerce.date(),
  operator: z.string().min(1),
  operatorName: z.string().min(1),
  operatorDept: z.string().min(1),
  action: z.enum(['submit', 'approve', 'reject', 'revoke', 'update', 'distribute', 'withdraw']),
  comment: z.string().optional(),
  previousStatus: z.string().optional(),
  newStatus: z.string().optional(),
  previousProgress: z.number().min(0).max(100).optional(),
  newProgress: z.number().min(0).max(100).optional()
})

export type StatusAuditEntry = z.infer<typeof StatusAuditEntrySchema>

// ============================================================================
// 战略指标 Schema
// ============================================================================

// 指标下发状态（与后端 distribution_status 字段对齐）
export const DistributionStatusSchema = z.enum(['DRAFT', 'DISTRIBUTED', 'PENDING', 'APPROVED', 'REJECTED'])
export type DistributionStatus = z.infer<typeof DistributionStatusSchema>

export const StrategicIndicatorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  isQualitative: z.boolean(),
  type1: z.enum(['定性', '定量']),
  type2: z.enum(['发展性', '基础性']),
  progress: z.number().min(0).max(100),
  createTime: z.string(),
  weight: z.number().min(0).max(100),
  remark: z.string().max(500).optional().default(''),
  canWithdraw: z.boolean().default(true),
  milestones: z.array(MilestoneSchema).default([]),
  targetValue: z.number(),
  actualValue: z.number().optional(),
  unit: z.string().default(''),
  responsibleDept: z.string(),
  responsiblePerson: z.string(),
  status: z.enum(['draft', 'active', 'archived', 'distributed', 'pending', 'approved']),
  /**
   * 后端持久化的下发状态字段（distribution_status）。
   * 前端草稿时为 'DRAFT'，调用 publish 接口后变为 'DISTRIBUTED'。
   * 后端返回的 IndicatorVO 含此字段，前端以此为准，不再纯靠 statusAudit 派生状态。
   */
  distributionStatus: DistributionStatusSchema.optional(),
  isStrategic: z.boolean(),
  approvalStatus: ApprovalStatusSchema.optional(),
  alertLevel: AlertLevelSchema.optional(),
  taskContent: z.string().optional(),
  ownerDept: z.string().optional(),
  parentIndicatorId: z.string().optional(),
  year: z.number().int().min(2020).max(2100).optional(),
  statusAudit: z.array(StatusAuditEntrySchema).default([]),
  progressApprovalStatus: ProgressApprovalStatusSchema.optional(),
  pendingProgress: z.number().min(0).max(100).optional(),
  pendingRemark: z.string().optional(),
  pendingAttachments: z.array(z.string().url()).optional()
})

export type StrategicIndicator = z.infer<typeof StrategicIndicatorSchema>

// ============================================================================
// 战略任务 Schema
// ============================================================================

export const StrategicTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  desc: z.string().min(1).max(1000),
  createTime: z.string(),
  cycle: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  status: z.enum(['draft', 'active', 'completed', 'cancelled']),
  createdBy: z.string().min(1),
  indicators: z.array(StrategicIndicatorSchema).default([]),
  year: z.number().int().min(2020).max(2100),
  isRecurring: z.boolean().default(false),
  parentTaskId: z.string().optional()
})

export type StrategicTask = z.infer<typeof StrategicTaskSchema>

// ============================================================================
// 仪表盘数据 Schema
// ============================================================================

export const DashboardDataSchema = z.object({
  totalScore: z.number().min(0),
  basicScore: z.number().min(0),
  developmentScore: z.number().min(0),
  completionRate: z.number().min(0).max(100),
  warningCount: z.number().int().min(0),
  totalIndicators: z.number().int().min(0),
  completedIndicators: z.number().int().min(0),
  alertIndicators: z.object({
    severe: z.number().int().min(0),
    moderate: z.number().int().min(0),
    normal: z.number().int().min(0)
  }),
  departmentProgress: z.array(z.object({
    department: z.string(),
    progress: z.number().min(0).max(100),
    status: z.string()
  })),
  tasksByStatus: z.object({
    draft: z.number().int().min(0),
    active: z.number().int().min(0),
    completed: z.number().int().min(0),
    cancelled: z.number().int().min(0)
  }),
  monthlyProgress: z.array(z.object({
    month: z.number().int().min(1).max(12),
    year: z.number().int(),
    progress: z.number().min(0).max(100),
    target: z.number().min(0).max(100)
  }))
})

export type DashboardData = z.infer<typeof DashboardDataSchema>

// ============================================================================
// API 响应 Schema
// ============================================================================

export const ApiResponseSchema = <T>(dataSchema: z.ZodType<T>) => z.object({
  success: z.boolean(),
  data: dataSchema.optional(),
  message: z.string().optional(),
  code: z.number().optional(),
  timestamp: z.string().optional()
})

export type ApiResponse<T> = z.infer<ReturnType<typeof ApiResponseSchema<T>>>

// ============================================================================
// 验证辅助函数
// ============================================================================

/**
 * 验证用户数据
 */
export function validateUser(data: unknown): { success: boolean; data?: User; errors?: string[] } {
  const result = UserSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
  return { success: false, errors }
}

/**
 * 验证指标数据
 */
export function validateIndicator(data: unknown): { success: boolean; data?: StrategicIndicator; errors?: string[] } {
  const result = StrategicIndicatorSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
  return { success: false, errors }
}

/**
 * 验证里程碑数据
 */
export function validateMilestone(data: unknown): { success: boolean; data?: Milestone; errors?: string[] } {
  const result = MilestoneSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
  return { success: false, errors }
}

/**
 * 验证登录凭据
 */
export function validateLoginCredentials(data: unknown): { success: boolean; data?: LoginCredentials; errors?: string[] } {
  const result = LoginCredentialsSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  const errors = result.error.errors.map(e => e.message)
  return { success: false, errors }
}
