/**
 * 统一的实体类型定义 - 与后端完全对齐
 *
 * 原则: 后端叫什么,前端就叫什么
 * 消除"翻译层",消除认知负荷
 *
 * 后端表名映射:
 * - strategic_task → StrategicTask
 * - indicator → Indicator
 * - milestone → Milestone
 * - app_user → User
 * - assessment_cycle → AssessmentCycle
 * - progress_report → ProgressReport
 */

// ============================================================================
// 枚举类型定义
// ============================================================================

/**
 * 任务类型枚举
 * @requirement 后端 TaskType 枚举
 */
export enum TaskType {
  QUALITATIVE = '定性',
  QUANTITATIVE = '定量'
}

/**
 * 里程碑状态枚举
 * @requirement 后端 MilestoneStatus 枚举
 */
export enum MilestoneStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  OVERDUE = 'overdue'
}

/**
 * 进度审批状态枚举
 * @requirement 后端 ProgressApprovalStatus 枚举
 */
export enum ProgressApprovalStatus {
  NONE = 'none',
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

/**
 * 审计操作类型枚举
 * @requirement 后端 AuditAction 枚举
 */
export enum AuditAction {
  SUBMIT = 'submit',
  APPROVE = 'approve',
  REJECT = 'reject',
  REVOKE = 'revoke',
  UPDATE = 'update',
  DISTRIBUTE = 'distribute',
  WITHDRAW = 'withdraw'
}

/**
 * 指标状态枚举
 * @requirement 后端 IndicatorStatus 枚举
 */
export enum IndicatorStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  DISTRIBUTED = 'distributed',
  PENDING = 'pending',
  APPROVED = 'approved'
}

/**
 * 用户角色枚举
 * @requirement 后端 UserRole 枚举
 */
export enum UserRole {
  STRATEGIC_DEPT = 'strategic_dept',
  FUNCTIONAL_DEPT = 'functional_dept',
  SECONDARY_COLLEGE = 'secondary_college'
}

// ============================================================================
// 核心实体类型定义
// ============================================================================

/**
 * 战略任务实体
 * 对应后端表: strategic_task
 * 对应后端类: StrategicTask.java
 *
 * @requirement 后端字段完全对齐
 */
export interface StrategicTask {
  /** 任务ID (后端: task_id) */
  taskId: number
  /** 评估周期ID (后端: cycle_id) */
  cycleId: number
  /** 任务名称 (后端: task_name) */
  taskName: string
  /** 任务描述 (后端: task_desc) */
  taskDesc: string | null
  /** 任务类型 (后端: task_type) */
  taskType: TaskType
  /** 责任部门 (后端: responsible_dept) */
  responsibleDept: string
  /** 权重 (后端: weight) */
  weight: number
  /** 目标值 (后端: target_value) */
  targetValue: number | null
  /** 创建时间 (后端: created_at) */
  createdAt: string
  /** 更新时间 (后端: updated_at) */
  updatedAt: string
  /** 关联的指标列表 (后端关联: indicator) */
  indicators?: Indicator[]
}

/**
 * 指标实体
 * 对应后端表: indicator
 * 对应后端类: Indicator.java
 *
 * @requirement 后端字段完全对齐
 */
export interface Indicator {
  /** 指标ID (后端: indicator_id) */
  indicatorId: number
  /** 任务ID (后端: task_id) */
  taskId: number | null
  /** 指标名称 (后端: indicator_name) */
  indicatorName: string
  /** 指标描述 (后端: indicator_desc) */
  indicatorDesc: string | null
  /** 指标类型1 (后端: indicator_type1) */
  indicatorType1: string | null
  /** 指标类型2 (后端: indicator_type2) */
  indicatorType2: string | null
  /** 是否为战略指标 (后端: is_strategic) */
  isStrategic: boolean
  /** 责任部门 (后端: responsible_dept) */
  responsibleDept: string
  /** 责任人 (后端: responsible_person) */
  responsiblePerson: string | null
  /** 权重 (后端: weight) */
  weight: number
  /** 进度百分比 (后端: progress) */
  progress: number
  /** 目标值 (后端: target_value) */
  targetValue: number | null
  /** 实际值 (后端: actual_value) */
  actualValue: number | null
  /** 单位 (后端: unit) */
  unit: string | null
  /** 年份 (后端: year) */
  year: number | null
  /** 发布方部门 (后端: owner_dept) */
  ownerDept: string | null
  /** 父指标ID (后端: parent_indicator_id) */
  parentIndicatorId: number | null
  /** 进度审批状态 (后端: progress_approval_status) */
  progressApprovalStatus: ProgressApprovalStatus
  /** 待审批进度值 (后端: pending_progress) */
  pendingProgress: number | null
  /** 待审批说明 (后端: pending_remark) */
  pendingRemark: string | null
  /** 状态审计日志 (后端: status_audit) */
  statusAudit: StatusAuditEntry[]
  /** 状态 (后端: status) */
  status: IndicatorStatus
  /** 显示状态 (根据审批状态计算) */
  displayStatus?: 'DRAFT' | 'PENDING_APPROVAL' | 'DISTRIBUTED'
  /** 备注 (后端: remark) */
  remark: string | null
  /** 创建时间 (后端: created_at) */
  createdAt: string
  /** 更新时间 (后端: updated_at) */
  updatedAt: string
  /** 关联的里程碑列表 (后端关联: milestone) */
  milestones?: Milestone[]
}

/**
 * 里程碑实体
 * 对应后端表: milestone
 * 对应后端类: Milestone.java
 *
 * @requirement 后端字段完全对齐
 */
export interface Milestone {
  /** 里程碑ID (后端: milestone_id) */
  milestoneId: number
  /** 指标ID (后端: indicator_id) */
  indicatorId: number | null
  /** 里程碑名称 (后端: milestone_name) */
  milestoneName: string
  /** 里程碑描述 (后端: milestone_desc) */
  milestoneDesc: string | null
  /** 目标进度 (后端: target_progress) */
  targetProgress: number
  /** 截止时间 (后端: due_date) */
  dueDate: string
  /** 权重百分比 (后端: weight_percent) */
  weightPercent: number
  /** 排序顺序 (后端: sort_order) */
  sortOrder: number
  /** 状态 (后端: status) */
  status: MilestoneStatus
  /** 是否已配对 (后端: is_paired) */
  isPaired: boolean
  /** 创建时间 (后端: created_at) */
  createdAt: string
  /** 更新时间 (后端: updated_at) */
  updatedAt: string
}

/**
 * 用户实体
 * 对应后端表: app_user
 * 对应后端类: AppUser.java
 *
 * @requirement 后端字段完全对齐
 */
export interface User {
  /** 用户ID (后端: user_id) */
  userId: number
  /** 用户名 (后端: username) */
  username: string
  /** 姓名 (后端: name) */
  name: string
  /** 密码哈希 (后端: password_hash) */
  passwordHash: string
  /** 角色 (后端: role) */
  role: UserRole
  /** 部门 (后端: department) */
  department: string
  /** 邮箱 (后端: email) */
  email: string | null
  /** 电话 (后端: phone) */
  phone: string | null
  /** 是否激活 (后端: is_active) */
  isActive: boolean
  /** 创建时间 (后端: created_at) */
  createdAt: string
  /** 更新时间 (后端: updated_at) */
  updatedAt: string
}

/**
 * 评估周期实体
 * 对应后端表: assessment_cycle
 * 对应后端类: AssessmentCycle.java
 *
 * @requirement 后端字段完全对齐
 */
export interface AssessmentCycle {
  /** 周期ID (后端: cycle_id) */
  cycleId: number
  /** 周期名称 (后端: cycle_name) */
  cycleName: string
  /** 开始时间 (后端: start_date) */
  startDate: string
  /** 结束时间 (后端: end_date) */
  endDate: string
  /** 状态 (后端: status) */
  status: string
  /** 创建时间 (后端: created_at) */
  createdAt: string
  /** 更新时间 (后端: updated_at) */
  updatedAt: string
}

/**
 * 进度报告实体
 * 对应后端表: progress_report
 * 对应后端类: ProgressReport.java
 *
 * @requirement 后端字段完全对齐
 */
export interface ProgressReport {
  /** 报告ID (后端: report_id) */
  reportId: number
  /** 指标ID (后端: indicator_id) */
  indicatorId: number
  /** 进度值 (后端: progress) */
  progress: number
  /** 说明 (后端: remark) */
  remark: string | null
  /** 报告时间 (后端: report_date) */
  reportDate: string
  /** 创建时间 (后端: created_at) */
  createdAt: string
  /** 更新时间 (后端: updated_at) */
  updatedAt: string
}

/**
 * 状态审计日志条目
 * 对应后端审批记录结构
 *
 * @requirement 后端字段完全对齐
 */
export interface StatusAuditEntry {
  /** 审计日志ID (后端: audit_id) */
  auditId: number
  /** 操作时间 (后端: timestamp) */
  timestamp: string
  /** 操作人用户名 (后端: operator) */
  operator: string
  /** 操作人姓名 (后端: operator_name) */
  operatorName: string | null
  /** 操作人部门 (后端: operator_dept) */
  operatorDept: string | null
  /** 操作类型 (后端: action) */
  action: AuditAction
  /** 操作备注 (后端: comment) */
  comment: string | null
  /** 变更前状态 (后端: previous_status) */
  previousStatus: string | null
  /** 变更后状态 (后端: new_status) */
  newStatus: string | null
  /** 变更前进度 (后端: previous_progress) */
  previousProgress: number | null
  /** 变更后进度 (后端: new_progress) */
  newProgress: number | null
}

// ============================================================================
// 响应类型定义
// ============================================================================

/**
 * 分页响应
 * 对应后端统一响应格式
 */
export interface PageResponse<T> {
  /** 数据列表 */
  content: T[]
  /** 当前页码 */
  pageNumber: number
  /** 每页大小 */
  pageSize: number
  /** 总元素数 */
  totalElements: number
  /** 总页数 */
  totalPages: number
  /** 是否有下一页 */
  hasNext: boolean
  /** 是否有上一页 */
  hasPrevious: boolean
}

/**
 * API统一响应格式
 * 对应后端 ApiResponse<T>
 */
export interface ApiResponse<T> {
  /** 响应码 */
  code: number
  /** 响应消息 */
  message: string
  /** 响应数据 */
  data: T | null
  /** 是否成功 */
  success: boolean
  /** 时间戳 */
  timestamp: number
}

// ============================================================================
// 实用类型
// ============================================================================

/**
 * 创建战略任务请求
 */
export interface CreateStrategicTaskRequest {
  cycleId: number
  taskName: string
  taskDesc: string | null
  taskType: TaskType
  responsibleDept: string
  weight: number
  targetValue: number | null
}

/**
 * 更新战略任务请求
 */
export interface UpdateStrategicTaskRequest {
  taskId: number
  taskName?: string
  taskDesc?: string | null
  taskType?: TaskType
  responsibleDept?: string
  weight?: number
  targetValue?: number | null
}

/**
 * 创建指标请求
 */
export interface CreateIndicatorRequest {
  taskId: number | null
  indicatorName: string
  indicatorDesc: string | null
  indicatorType1: string | null
  indicatorType2: string | null
  isStrategic: boolean
  responsibleDept: string
  responsiblePerson: string | null
  weight: number
  targetValue: number | null
  unit: string | null
  year: number | null
  ownerDept: string | null
  parentIndicatorId: number | null
}

/**
 * 更新指标请求
 */
export interface UpdateIndicatorRequest {
  indicatorId: number
  indicatorName?: string
  indicatorDesc?: string | null
  progress?: number
  actualValue?: number | null
  remark?: string | null
}

/**
 * 提交进度审批请求
 */
export interface SubmitProgressApprovalRequest {
  indicatorId: number
  progress: number
  remark: string | null
}

/**
 * 审批进度请求
 */
export interface ApproveProgressRequest {
  indicatorId: number
  action: 'approve' | 'reject'
  comment: string | null
}

/**
 * 创建里程碑请求
 */
export interface CreateMilestoneRequest {
  indicatorId: number
  milestoneName: string
  milestoneDesc: string | null
  targetProgress: number
  dueDate: string
  weightPercent: number
  sortOrder: number
}

/**
 * 更新里程碑请求
 */
export interface UpdateMilestoneRequest {
  milestoneId: number
  milestoneName?: string
  milestoneDesc?: string | null
  targetProgress?: number
  dueDate?: string
  weightPercent?: number
  sortOrder?: number
  status?: MilestoneStatus
}
