/**
 * Plan Feature - Mutation API
 *
 * Write operations for plan data.
 */

import { apiClient as api } from '@/shared/api/client'
import { approveTask, rejectTask } from '@/features/workflow/api'
import type { ApiResponse, Plan } from '@/shared/types'

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
 * API: POST /api/v1/workflows/tasks/{taskId}/approve
 *
 * @param instanceId - Approval instance ID
 * @param userId - Approver user ID (unused, taken from JWT)
 * @param comment - Approval comment
 */
export async function approvePlan(
  instanceId: number | string,
  _userId: number | string,
  comment?: string
): Promise<ApiResponse<void>> {
  await approveTask(String(instanceId), { comment })
  return { success: true, data: undefined }
}

/**
 * Reject plan
 *
 * API: POST /api/v1/workflows/tasks/{taskId}/reject
 *
 * @param instanceId - Approval instance ID
 * @param userId - Approver user ID (unused, taken from JWT)
 * @param comment - Rejection reason (required)
 */
export async function rejectPlan(
  instanceId: number | string,
  _userId: number | string,
  comment: string
): Promise<ApiResponse<void>> {
  await rejectTask(String(instanceId), { reason: comment })
  return { success: true, data: undefined }
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
