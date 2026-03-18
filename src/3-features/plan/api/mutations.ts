/**
 * Plan Feature - Mutation API
 *
 * Write operations for plan data.
 */

import api from '@/5-shared/api'
import type { ApiResponse, Plan } from '@/5-shared/types'

/**
 * Create new plan
 *
 * API: POST /api/plans
 *
 * @param data - Plan creation data
 * @returns Created plan
 */
export async function createPlan(data: Partial<Plan>): Promise<ApiResponse<Plan>> {
  return api.post('/plans', data)
}

/**
 * Update plan
 *
 * API: PUT /api/plans/{id}
 *
 * @param planId - Plan ID
 * @param data - Update data
 * @returns Updated plan
 */
export async function updatePlan(
  planId: number | string,
  data: Partial<Plan>
): Promise<ApiResponse<Plan>> {
  return api.put(`/plans/${planId}`, data)
}

/**
 * Delete plan
 *
 * API: DELETE /api/plans/{id}
 *
 * @param planId - Plan ID
 */
export async function deletePlan(planId: number | string): Promise<ApiResponse<void>> {
  return api.delete(`/plans/${planId}`)
}

/**
 * Submit plan for approval
 *
 * API: POST /api/plans/{id}/submit-approval
 *
 * @param planId - Plan ID
 * @param comment - Submission comment
 */
export async function submitPlanForApproval(
  planId: number | string,
  comment?: string
): Promise<ApiResponse<void>> {
  void comment
  return api.post(`/plans/${planId}/publish`)
}

/**
 * Approve plan
 *
 * API: POST /api/approval/instances/{instanceId}/approve?userId=...&comment=...
 *
 * @param instanceId - Approval instance ID
 * @param userId - Approver user ID
 * @param comment - Approval comment
 */
export async function approvePlan(
  instanceId: number | string,
  userId: number | string,
  comment?: string
): Promise<ApiResponse<void>> {
  const encodedComment = comment ? `&comment=${encodeURIComponent(comment)}` : ''
  return api.post(`/approval/instances/${instanceId}/approve?userId=${userId}${encodedComment}`, {
    comment
  })
}

/**
 * Reject plan
 *
 * API: POST /api/approval/instances/{instanceId}/reject?userId=...&comment=...
 *
 * @param instanceId - Approval instance ID
 * @param userId - Approver user ID
 * @param comment - Rejection reason (required)
 */
export async function rejectPlan(
  instanceId: number | string,
  userId: number | string,
  comment: string
): Promise<ApiResponse<void>> {
  return api.post(
    `/approval/instances/${instanceId}/reject?userId=${userId}&comment=${encodeURIComponent(comment)}`,
    { comment }
  )
}

/**
 * Archive plan
 *
 * API: POST /api/plans/{id}/archive
 *
 * @param planId - Plan ID
 */
export async function archivePlan(planId: number | string): Promise<ApiResponse<void>> {
  return api.post(`/plans/${planId}/archive`)
}
