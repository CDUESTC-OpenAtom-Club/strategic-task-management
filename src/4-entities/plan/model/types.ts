/**
 * Strategic Plan Entity Types
 * 
 * Domain model types for strategic plans based on backend entity structure.
 * Plans represent performance planning cycles and indicator collections.
 */

import type { Indicator } from '../../indicator'

/**
 * Plan Level
 * Hierarchical levels for plan distribution
 */
export type PlanLevel = 
  | 'STRAT_TO_FUNC'    // Strategic to Functional level
  | 'FUNC_TO_COLLEGE'  // Functional to College level

export const PlanLevel = {
  STRAT_TO_FUNC: 'STRAT_TO_FUNC' as const,
  FUNC_TO_COLLEGE: 'FUNC_TO_COLLEGE' as const
} as const

/**
 * Plan Status
 * 战略计划的三种状态：草稿、待审批、已下发
 */
export type PlanStatus =
  | 'DRAFT'             // Draft plan (草稿 - 可编辑)
  | 'PENDING'           // Pending approval (待审批)
  | 'DISTRIBUTED'       // Distributed to departments (已下发)

export const PlanStatus = {
  DRAFT: 'DRAFT' as const,
  PENDING: 'PENDING' as const,
  DISTRIBUTED: 'DISTRIBUTED' as const
} as const

/**
 * Assessment Cycle
 * Time period for performance assessment
 */
export interface AssessmentCycle {
  id: number
  name: string
  year: number
  startDate: string
  endDate: string
  status: string
  description?: string
}

/**
 * Plan Indicator
 * Indicator associated with a plan
 */
export interface PlanIndicator {
  indicatorId: number
  indicator?: Indicator
  weight?: number
  targetValue?: number
  actualValue?: number
  status?: string
  remark?: string
}

/**
 * Strategic Plan Entity
 * Core domain model for strategic performance plans
 */
export interface StrategicPlan {
  // Core identification
  id: number
  name?: string
  code?: string
  description?: string

  // Cycle and organization
  cycleId: number
  cycle?: AssessmentCycle
  cycleName?: string
  targetOrgId: number
  targetOrgName?: string
  createdByOrgId: number
  createdByOrgName?: string

  // Plan level and type
  planLevel: PlanLevel
  level?: string // Alias for planLevel

  // Status tracking
  status: PlanStatus

  // Indicators
  indicators?: Indicator[]
  indicatorIds?: number[]
  indicatorCount?: number
  totalWeight?: number

  // Dates and timeline
  createdAt: string
  updatedAt: string
  submittedAt?: string
  approvedAt?: string
  rejectedAt?: string
  completedAt?: string

  // Approval workflow
  approvalInstanceId?: number
  currentStep?: string
  approvalComment?: string
  rejectionReason?: string

  // Metadata
  isDeleted?: boolean
  version?: number
  remark?: string

  // Statistics
  completionRate?: number
  progressSummary?: {
    total: number
    completed: number
    inProgress: number
    notStarted: number
  }
}

/**
 * Plan Create Request
 * Data required to create a new strategic plan
 */
export interface PlanCreateRequest {
  name?: string
  cycleId: number
  targetOrgId: number
  planLevel?: PlanLevel
  indicatorIds?: number[]
  description?: string
  remark?: string
}

/**
 * Plan Update Request
 * Data for updating an existing plan
 */
export interface PlanUpdateRequest {
  name?: string
  targetOrgId?: number
  indicatorIds?: number[]
  description?: string
  remark?: string
}

/**
 * Plan Filters
 * Query filters for plan list
 */
export interface PlanFilters {
  page?: number
  size?: number
  sort?: string
  order?: 'asc' | 'desc'
  name?: string
  cycleId?: number
  targetOrgId?: number
  createdByOrgId?: number
  planLevel?: PlanLevel
  status?: PlanStatus
  year?: number
}

/**
 * Plan Fill Request
 * Data for filling plan indicator values
 */
export interface PlanFillRequest {
  indicatorData: Array<{
    indicatorId: number
    value: number
    evidence?: string
    remark?: string
  }>
}

/**
 * Plan Submit Request
 * Data for submitting plan for approval
 */
export interface PlanSubmitRequest {
  comment?: string
  flowCode?: string
}

/**
 * Plan Approval Request
 * Data for approving a plan
 */
export interface PlanApprovalRequest {
  comment?: string
  action: 'APPROVE' | 'REJECT'
}

/**
 * Plan Rejection Request
 * Data for rejecting a plan
 */
export interface PlanRejectionRequest {
  reason: string
  rejectTo?: 'APPLICATION' | 'PREVIOUS_STEP' | 'SPECIFIC_STEP'
  requireResubmit?: boolean
  specificStepCode?: string
}
