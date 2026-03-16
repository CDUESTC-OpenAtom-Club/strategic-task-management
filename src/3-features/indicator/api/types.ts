/**
 * Strategic Indicator Feature - API Types
 *
 * API request/response types specific to indicator endpoints.
 */

import type { Indicator, IndicatorFilters } from '@/4-entities/indicator/model/types'

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
  first?: boolean
  last?: boolean
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  code: number
  message?: string
  data: T
  timestamp?: string
}

/**
 * Indicator list response
 */
export type IndicatorListResponse = ApiResponse<PaginatedResponse<Indicator>>

/**
 * Indicator detail response
 */
export type IndicatorDetailResponse = ApiResponse<Indicator>

/**
 * Distribution result
 */
export interface DistributionResult {
  distributedCount: number
  failedOrgs: Array<{
    orgId: number
    orgName: string
    reason: string
  }>
}

/**
 * Distribution response
 */
export type DistributionResponse = ApiResponse<DistributionResult>

/**
 * Approval submission result
 */
export interface ApprovalSubmissionResult {
  approvalInstanceId: number
  currentStep: string
  status: string
}

/**
 * Approval submission response
 */
export type ApprovalSubmissionResponse = ApiResponse<ApprovalSubmissionResult>

/**
 * Query parameters for indicator list
 */
export interface IndicatorQueryParams extends IndicatorFilters {
  // Additional query params can be added here
}
