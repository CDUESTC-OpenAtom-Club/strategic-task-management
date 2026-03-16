/**
 * Strategic Indicator Feature - Mutation API
 *
 * Write operations for indicators (create, update, delete, distribute).
 * Based on API documentation: POST/PUT/DELETE /api/indicators/*
 */

import { apiClient } from '@/shared/lib/api/client'
import type {
  Indicator,
  IndicatorCreateRequest,
  IndicatorUpdateRequest,
  DistributeRequest
} from '@/entities/indicator/model/types'
import type {
  IndicatorDetailResponse,
  DistributionResponse,
  ApprovalSubmissionResponse,
  DistributionResult,
  ApprovalSubmissionResult
} from './types'

/**
 * Create indicator
 *
 * API: POST /api/indicators
 *
 * @param data - Indicator creation data
 * @returns Created indicator
 */
export async function createIndicator(data: IndicatorCreateRequest): Promise<Indicator> {
  const response = await apiClient.post<IndicatorDetailResponse>('/indicators', data)
  return response.data
}

/**
 * Update indicator
 *
 * API: PUT /api/indicators/{id}
 *
 * @param id - Indicator ID
 * @param data - Update data
 * @returns Updated indicator
 */
export async function updateIndicator(
  id: number,
  data: IndicatorUpdateRequest
): Promise<Indicator> {
  const response = await apiClient.put<IndicatorDetailResponse>(`/indicators/${id}`, data)
  return response.data
}

/**
 * Delete indicator
 *
 * API: DELETE /api/indicators/{id}
 *
 * @param id - Indicator ID
 */
export async function deleteIndicator(id: number): Promise<void> {
  await apiClient.delete(`/indicators/${id}`)
}

/**
 * Distribute indicator to target organizations
 *
 * API: POST /api/indicators/{id}/distribute
 *
 * @param id - Indicator ID
 * @param request - Distribution request
 * @returns Distribution result
 */
export async function distributeIndicator(
  id: number,
  request: DistributeRequest
): Promise<DistributionResult> {
  const response = await apiClient.post<DistributionResponse>(
    `/indicators/${id}/distribute`,
    request
  )
  return response.data
}

/**
 * Batch distribute indicators
 *
 * API: POST /api/indicators/distribute/batch
 *
 * @param indicatorIds - Indicator IDs
 * @param targetOrgIds - Target organization IDs
 * @param deadline - Deadline
 * @returns Distribution result
 */
export async function batchDistributeIndicators(
  indicatorIds: number[],
  targetOrgIds: number[],
  deadline?: string
): Promise<DistributionResult> {
  const response = await apiClient.post<DistributionResponse>('/indicators/distribute/batch', {
    indicatorIds,
    targetOrgIds,
    deadline
  })
  return response.data
}

/**
 * Withdraw indicator
 *
 * API: POST /api/indicators/{id}/withdraw
 *
 * @param id - Indicator ID
 * @param reason - Withdrawal reason
 */
export async function withdrawIndicator(id: number, reason?: string): Promise<void> {
  await apiClient.post(`/indicators/${id}/withdraw`, { reason })
}

/**
 * Submit indicator for approval
 *
 * API: POST /api/indicators/{id}/submit-approval
 *
 * @param id - Indicator ID
 * @param comment - Submission comment
 * @returns Approval submission result
 */
export async function submitIndicatorForApproval(
  id: number,
  comment?: string
): Promise<ApprovalSubmissionResult> {
  const response = await apiClient.post<ApprovalSubmissionResponse>(
    `/indicators/${id}/submit-approval`,
    {
      comment,
      flowCode: 'INDICATOR_APPROVAL'
    }
  )
  return response.data
}

/**
 * Submit indicator progress
 *
 * API: POST /api/indicators/{id}/submit-progress (from workflow endpoints)
 *
 * @param id - Indicator ID
 * @param value - Progress value
 * @param evidence - Evidence description
 * @param attachments - Attachment IDs
 * @returns Report ID
 */
export async function submitIndicatorProgress(
  id: number,
  value: number,
  evidence?: string,
  attachments?: number[]
): Promise<{ reportId: number; status: string }> {
  const response = await apiClient.post<any>(`/workflow/indicator/${id}/submit-progress`, {
    value,
    evidence,
    attachments
  })
  return response.data
}

/**
 * Confirm indicator receipt
 *
 * API: POST /workflow/indicator/{id}/confirm-receive
 *
 * @param id - Indicator ID
 * @param comment - Confirmation comment
 */
export async function confirmIndicatorReceipt(id: number, comment?: string): Promise<void> {
  await apiClient.post(`/workflow/indicator/${id}/confirm-receive`, {
    comment
  })
}

/**
 * Decompose indicator into sub-indicators
 *
 * API: POST /workflow/indicator/{id}/decompose
 *
 * @param id - Parent indicator ID
 * @param decompositions - Sub-indicator data
 * @returns Created sub-indicators
 */
export async function decomposeIndicator(
  id: number,
  decompositions: Array<{
    name: string
    targetOrgId: number
    value: number
    weight: number
  }>
): Promise<{ parentId: number; createdCount: number; childIndicators: Indicator[] }> {
  const response = await apiClient.post<any>(`/workflow/indicator/${id}/decompose`, {
    decompositions
  })
  return response.data
}
