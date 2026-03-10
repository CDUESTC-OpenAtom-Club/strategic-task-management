/**
 * API Types Index
 * 
 * Central export point for all backend-aligned types.
 * Import from here to ensure consistency across the application.
 * 
 * Usage:
 * ```typescript
 * import type { IndicatorVO, TaskVO, UserVO } from '@/api/types'
 * ```
 */

export type {
  // Core VO Types
  IndicatorVO,
  TaskVO,
  MilestoneVO,
  PlanVO,
  UserVO,
  OrgVO,
  
  // Enums
  DistributionStatus,
  IndicatorStatus,
  MilestoneStatus,
  ProgressApprovalStatus,
  TaskType,
  PlanStatus,
  
  // Request Types
  IndicatorCreateRequest,
  IndicatorUpdateRequest,
  IndicatorDistributionRequest,
  BatchDistributionRequest,
  IndicatorDistributionEligibility,
  
  // Response Types
  ApiResponse,
  PageResponse,
  
  // Utility Types
  Attachment,
  StatusAuditEntry
} from './backend-aligned'

// Additional VO Types
export type { AssessmentCycleVO } from './backend-aligned'
