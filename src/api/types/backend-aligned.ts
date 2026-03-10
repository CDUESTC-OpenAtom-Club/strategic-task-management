/**
 * Backend-Aligned Type Definitions
 * 
 * This file contains TypeScript types that exactly match the backend VO (Value Object) definitions.
 * All fields are aligned with the Java backend to ensure type safety and prevent runtime errors.
 * 
 * Generated: 2026-03-10
 * Based on: Backend VO files in sism-backend/src/main/java/com/sism/vo/
 */

// ============================================================================
// Enums (aligned with backend)
// ============================================================================

export type DistributionStatus = 'DRAFT' | 'DISTRIBUTED' | 'PENDING' | 'APPROVED' | 'REJECTED'

export type IndicatorStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED' | 'DISTRIBUTED' | 'PENDING' | 'APPROVED'

export type MilestoneStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED' | 'CANCELED'

export type ProgressApprovalStatus = 'NONE' | 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED'

export type TaskType = 'BASIC' | 'DEVELOPMENT' | 'KEY' | 'SPECIAL' | 'QUANTITATIVE' | 'REGULAR'

export type PlanStatus = 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'ARCHIVED'

// ============================================================================
// Core VO Types (exactly matching backend)
// ============================================================================

/**
 * IndicatorVO - Complete alignment with backend
 * Source: sism-backend/src/main/java/com/sism/vo/IndicatorVO.java
 */
export interface IndicatorVO {
  // Core fields
  indicatorId: number
  taskId: number
  taskName: string
  parentIndicatorId?: number
  parentIndicatorDesc?: string
  level: string
  
  // Organization fields
  ownerOrgId?: number
  ownerOrgName?: string
  targetOrgId?: number
  targetOrgName?: string
  ownerDept?: string
  responsibleDept?: string
  
  // Indicator details
  indicatorDesc: string
  weightPercent: number
  sortOrder: number
  year: number
  status: IndicatorStatus
  remark?: string
  
  // Timestamps
  createdAt: string  // LocalDateTime serialized as ISO string
  updatedAt: string  // LocalDateTime serialized as ISO string
  
  // Nested collections
  childIndicators?: IndicatorVO[]
  milestones?: MilestoneVO[]
  
  // Distribution fields
  distributionStatus?: DistributionStatus
  
  // NEW FIELDS - Previously missing in frontend
  canWithdraw?: boolean           // 是否可撤回 - CRITICAL for withdraw functionality
  displayStatus?: string          // 显示状态 (computed)
  pendingProgress?: number        // 待审批进度
  isQualitative?: boolean         // 是否定性指标
  type1?: string                  // 指标分类1
  type2?: string                  // 指标分类2
  targetValue?: number            // 目标值
  actualValue?: number            // 实际值
  unit?: string                   // 单位
  responsiblePerson?: string      // 责任人
  progress?: number               // 进度
  statusAudit?: string            // 状态审计日志 (JSON string)
  progressApprovalStatus?: ProgressApprovalStatus  // 进度审批状态
  pendingRemark?: string          // 待审批备注
  pendingAttachments?: string     // 待审批附件 (JSON string)
  isStrategic?: boolean           // 是否战略指标
}

/**
 * TaskVO - Complete alignment with backend
 * Source: sism-backend/src/main/java/com/sism/vo/TaskVO.java
 */
export interface TaskVO {
  taskId: number
  planId?: number                 // NEW - Previously missing
  cycleId: number
  cycleName: string
  year: number
  taskName: string
  taskDesc: string
  taskType: TaskType
  orgId: number
  orgName: string
  createdByOrgId: number
  createdByOrgName: string
  sortOrder: number
  remark?: string
  createdAt: string
  updatedAt: string
  
  // NEW FIELDS - Previously missing
  approvalStatus?: string         // 审批状态 - CRITICAL
  indicators?: IndicatorVO[]      // 关联指标列表
}

/**
 * MilestoneVO - Complete alignment with backend
 * Source: sism-backend/src/main/java/com/sism/vo/MilestoneVO.java
 */
export interface MilestoneVO {
  milestoneId: number
  indicatorId: number
  indicatorDesc: string
  milestoneName: string
  milestoneDesc?: string
  dueDate: string                 // LocalDate serialized as ISO string
  targetProgress: number          // 目标进度 (0-100) - PRIMARY field
  weightPercent?: number          // DEPRECATED - kept for backward compatibility
  status: MilestoneStatus
  sortOrder: number
  inheritedFromId?: number
  createdAt: string
  updatedAt: string
  isPaired: boolean
}

/**
 * PlanVO - Complete alignment with backend
 * Source: sism-backend/src/main/java/com/sism/vo/PlanVO.java
 */
export interface PlanVO {
  planId: number
  planName: string
  cycle: string
  orgId: number
  orgName: string
  status: PlanStatus
  createdAt: string
  updatedAt: string
  createdBy: string
  description?: string
  
  // NEW FIELDS - Previously missing
  tasks?: TaskVO[]                // 关联任务列表
}

/**
 * UserVO - Complete definition (was completely missing)
 * Source: sism-backend/src/main/java/com/sism/vo/UserVO.java
 * 
 * CRITICAL: Backend returns 'username' NOT 'userName'
 */
export interface UserVO {
  userId: number
  username: string        // Backend field name (NOT userName)
  realName: string
  isActive?: boolean
  orgId: number          // Backend organization ID
  orgName: string        // Backend organization name
  orgType: string        // Backend organization type (STRATEGIC_DEPT, FUNCTIONAL_DEPT, etc.)
  
  // Extended fields (may not be in backend VO but used in frontend)
  email?: string
  phone?: string
  department?: string    // Mapped from orgName
  role?: string          // Mapped from orgType
  avatar?: string
  createdAt?: string
  updatedAt?: string
}

/**
 * OrgVO - Complete definition (was completely missing)
 * Source: sism-backend/src/main/java/com/sism/vo/OrgVO.java
 */
export interface OrgVO {
  orgId: number
  orgName: string
  orgCode: string
  orgType: string
  parentId?: number
  parentName?: string
  level?: number
  sortOrder?: number
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean
  data: T | null
  message: string
  timestamp: Date | string
  code?: number
}

export interface PageResponse<T> {
  content: T[]
  pageNumber: number
  pageSize: number
  totalElements: number
  totalPages: number
  hasNext: boolean
  hasPrevious: boolean
}

// ============================================================================
// Request Types
// ============================================================================

export interface IndicatorCreateRequest {
  taskId: number
  parentIndicatorId?: number
  indicatorDesc: string
  weightPercent?: number
  sortOrder?: number
  remark?: string
  type?: string
  progress?: number
  ownerOrgId?: number
  targetOrgId?: number
  level?: 'STRAT_TO_FUNC' | 'FUNC_TO_COLLEGE'
  year?: number
  canWithdraw?: boolean
  distributionStatus?: DistributionStatus
}

export interface IndicatorUpdateRequest {
  indicatorDesc?: string
  weightPercent?: number
  sortOrder?: number
  remark?: string
  progress?: number
  actualValue?: number
  targetValue?: number
  unit?: string
  responsiblePerson?: string
}

export interface IndicatorDistributionRequest {
  parentIndicatorId: string
  targetOrgId: string
  customDesc?: string
  actorUserId?: string
}

export interface BatchDistributionRequest {
  parentIndicatorId: string
  targetOrgIds: string[]
  actorUserId?: string
}

export interface IndicatorDistributionEligibility {
  eligible: boolean
  reason?: string
  canWithdraw?: boolean
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Attachment type for file uploads
 */
export interface Attachment {
  name: string
  url: string
  size?: number
  type?: string
  uploadedAt?: string
}

/**
 * Status audit entry (parsed from JSON string)
 */
export interface StatusAuditEntry {
  timestamp: string
  operator: string
  operatorName?: string
  action: string
  comment?: string
  previousStatus?: string
  newStatus?: string
}

/**
 * AssessmentCycleVO - Assessment cycle definition
 * Source: Backend API response for cycles
 */
export interface AssessmentCycleVO {
  cycleId: number
  cycleName: string
  year: number
  startDate: string
  endDate: string
  description?: string
}

/**
 * AssessmentCycleVO - Assessment cycle definition
 * Source: Backend API response for cycles
 */
export interface AssessmentCycleVO {
  cycleId: number
  cycleName: string
  year: number
  startDate: string
  endDate: string
  description?: string
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
}
