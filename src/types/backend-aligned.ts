/**
 * Backend-Aligned Type Definitions
 *
 * This file contains TypeScript interfaces that align with the backend database schema.
 *
 * TERMINOLOGY MAPPING:
 * - Backend "strategic_task" → Frontend "Plan"
 * - Backend "indicator" → Frontend "Task" (at plan level) or "Indicator" (at execution level)
 *
 * Requirements: 1.1, 1.2, 1.5
 */

// ============================================
// Enums (matching backend)
// ============================================

export enum OrgType {
  SCHOOL = 'SCHOOL',
  FUNCTIONAL_DEPT = 'FUNCTIONAL_DEPT',
  FUNCTION_DEPT = 'FUNCTION_DEPT',
  COLLEGE = 'COLLEGE',
  STRATEGY_DEPT = 'STRATEGY_DEPT',
  DIVISION = 'DIVISION',
  OTHER = 'OTHER'
}

export enum TaskType {
  BASIC = 'BASIC',
  REGULAR = 'REGULAR',
  KEY = 'KEY',
  SPECIAL = 'SPECIAL',
  QUANTITATIVE = 'QUANTITATIVE',
  DEVELOPMENT = 'DEVELOPMENT'
}

export enum IndicatorLevel {
  STRAT_TO_FUNC = 'STRAT_TO_FUNC',
  FUNC_TO_COLLEGE = 'FUNC_TO_COLLEGE'
}

export enum IndicatorStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED'
}

export enum MilestoneStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  DELAYED = 'DELAYED',
  CANCELED = 'CANCELED'
}

export enum ReportStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  RETURNED = 'RETURNED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export enum ApprovalAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  RETURN = 'RETURN'
}

export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL'
}

export enum AlertStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED'
}

export enum AdhocScopeType {
  ALL_ORGS = 'ALL_ORGS',
  BY_DEPT_ISSUED_INDICATORS = 'BY_DEPT_ISSUED_INDICATORS',
  CUSTOM = 'CUSTOM'
}

export enum AdhocTaskStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  ARCHIVED = 'ARCHIVED'
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  APPROVE = 'APPROVE',
  ARCHIVE = 'ARCHIVE',
  RESTORE = 'RESTORE'
}

export enum AuditEntityType {
  ORG = 'ORG',
  USER = 'USER',
  CYCLE = 'CYCLE',
  TASK = 'TASK',
  INDICATOR = 'INDICATOR',
  MILESTONE = 'MILESTONE',
  REPORT = 'REPORT',
  ADHOC_TASK = 'ADHOC_TASK',
  ALERT = 'ALERT'
}

export enum ProgressApprovalStatus {
  NONE = 'NONE',
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

// ============================================
// Core Entity Interfaces (Backend Schema)
// ============================================

/**
 * Organization entity (org table)
 */
export interface Organization {
  orgId: number
  orgName: string
  orgType: OrgType
  parentOrgId: number | null
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

/**
 * User entity (app_user table)
 */
export interface User {
  userId: number
  username: string
  realName: string
  orgId: number
  passwordHash?: string // Not exposed to frontend in normal operations
  ssoId: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Assessment Cycle entity (assessment_cycle table)
 */
export interface AssessmentCycle {
  cycleId: number
  cycleName: string
  year: number
  startDate: string
  endDate: string
  description: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Plan entity (strategic_task table in backend)
 *
 * TERMINOLOGY: Backend calls this "strategic_task", frontend calls it "Plan"
 */
export interface Plan {
  taskId: number // Backend field name
  cycleId: number
  taskName: string
  taskDesc: string | null
  taskType: TaskType
  orgId: number
  createdByOrgId: number
  sortOrder: number
  remark: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Task entity (indicator table in backend)
 *
 * TERMINOLOGY: Backend calls this "indicator", frontend calls it "Task"
 * This represents work items under a Plan
 */
export interface Task {
  indicatorId: number // Backend field name
  taskId: number // References Plan (strategic_task)
  parentIndicatorId: number | null
  level: IndicatorLevel
  ownerOrgId: number
  targetOrgId: number
  indicatorDesc: string
  weightPercent: number
  sortOrder: number
  year: number
  status: IndicatorStatus
  remark: string | null

  // Extended fields for frontend alignment
  isQualitative: boolean
  type1: '定性' | '定量'
  type2: '基础性' | '发展性'
  targetValue: number | null
  actualValue: number | null
  unit: string | null
  responsiblePerson: string | null
  canWithdraw: boolean
  progress: number
  statusAudit: StatusAuditEntry[]
  progressApprovalStatus: ProgressApprovalStatus
  pendingProgress: number | null
  pendingRemark: string | null
  pendingAttachments: string[]

  createdAt: string
  updatedAt: string
}

/**
 * Status audit entry (stored in indicator.status_audit JSONB)
 */
export interface StatusAuditEntry {
  id: string
  timestamp: string
  operator: string
  operatorName: string
  operatorDept: string
  action: 'submit' | 'approve' | 'reject' | 'revoke' | 'update' | 'distribute' | 'withdraw'
  comment?: string
  previousStatus?: string
  newStatus?: string
  previousProgress?: number
  newProgress?: number
}

/**
 * Milestone entity (milestone table)
 */
export interface Milestone {
  milestoneId: number
  indicatorId: number
  milestoneName: string
  milestoneDesc: string | null
  dueDate: string
  weightPercent: number
  status: MilestoneStatus
  sortOrder: number
  inheritedFrom: number | null
  targetProgress: number
  isPaired: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Progress Report entity (progress_report table)
 */
export interface ProgressReport {
  reportId: number
  indicatorId: number
  milestoneId: number | null
  adhocTaskId: number | null
  percentComplete: number
  achievedMilestone: boolean
  narrative: string | null
  reporterId: number
  status: ReportStatus
  isFinal: boolean
  versionNo: number
  submittedAt: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Approval Record entity (approval_record table)
 */
export interface ApprovalRecord {
  approvalId: number
  reportId: number
  approverId: number
  action: ApprovalAction
  comments: string | null
  approvedAt: string
  createdAt: string
  updatedAt: string
}

/**
 * Alert Event entity (alert_event table)
 */
export interface AlertEvent {
  alertId: number
  indicatorId: number | null
  milestoneId: number | null
  severity: AlertSeverity
  alertMessage: string
  status: AlertStatus
  resolvedBy: number | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Audit Log entity (audit_log table)
 */
export interface AuditLog {
  logId: number
  entityType: AuditEntityType
  entityId: number
  action: AuditAction
  operatorId: number
  changesBefore: Record<string, any> | null
  changesAfter: Record<string, any> | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

/**
 * Refresh Token entity (refresh_token table)
 */
export interface RefreshToken {
  tokenId: number
  userId: number
  token: string
  expiresAt: string
  createdAt: string
}

/**
 * Idempotency Record entity (idempotency_record table)
 */
export interface IdempotencyRecord {
  recordId: number
  idempotencyKey: string
  requestPath: string
  requestMethod: string
  responseStatus: number
  responseBody: string | null
  createdAt: string
  expiresAt: string
}

// ============================================
// API Request/Response Types
// ============================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
  timestamp: string
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> {
  success: boolean
  message: string
  data: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  timestamp: string
}

/**
 * Error response
 */
export interface ApiError {
  success: false
  message: string
  error: {
    code: string
    details?: Record<string, any>
  }
  timestamp: string
}

// ============================================
// Frontend-Specific Types
// ============================================

/**
 * User role (derived from org_type)
 */
export type UserRole = 'strategic_dept' | 'functional_dept' | 'secondary_college'

/**
 * Permission definition
 */
export interface Permission {
  resource: string
  action: 'create' | 'read' | 'update' | 'delete' | 'approve'
  scope?: 'own' | 'department' | 'all'
}

/**
 * Attachment metadata
 */
export interface Attachment {
  id: string
  fileName: string
  fileSize: number
  fileType: string
  url: string
  uploadedBy: number
  uploadedAt: string
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number
  pageSize: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

/**
 * Filter state for UI
 */
export interface FilterState {
  department?: string
  indicatorType?: '定性' | '定量'
  alertLevel?: AlertSeverity
  dateRange?: [string, string]
  sourceOwner?: string
  collegeFilter?: string
}

// ============================================
// Type Guards
// ============================================

export function isApiError(response: any): response is ApiError {
  return response && response.success === false && 'error' in response
}

export function isApiResponse<T>(response: any): response is ApiResponse<T> {
  return response && response.success === true && 'data' in response
}

export function isPaginatedResponse<T>(response: any): response is PaginatedResponse<T> {
  return (
    response &&
    response.success === true &&
    'data' in response &&
    Array.isArray(response.data) &&
    'pagination' in response
  )
}

// ============================================
// Utility Types
// ============================================

/**
 * Make all properties optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

/**
 * Make specific properties required
 */
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>

/**
 * Omit multiple properties
 */
export type OmitMultiple<T, K extends keyof T> = Omit<T, K>

/**
 * Extract non-nullable properties
 */
export type NonNullableFields<T> = {
  [P in keyof T]: NonNullable<T[P]>
}
