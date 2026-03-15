/**
 * Plan Feature - Mutation API
 *
 * Write operations for plan data.
 */

import api from '@/shared/api'
import type { ApiResponse, Plan } from '@/types'

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
 * API: POST /api/plans/{id}/submit
 *
 * @param planId - Plan ID
 * @param comment - Submission comment
 */
export async function submitPlanForApproval(
  planId: number | string,
  comment?: string
): Promise<ApiResponse<void>> {
  return api.post(`/plans/${planId}/submit`, { comment })
}

/**
 * Approve plan
 *
 * API: POST /api/plans/{id}/approve
 *
 * @param planId - Plan ID
 * @param comment - Approval comment
 */
export async function approvePlan(
  planId: number | string,
  comment?: string
): Promise<ApiResponse<void>> {
  return api.post(`/plans/${planId}/approve`, { comment })
}

/**
 * Reject plan
 *
 * API: POST /api/plans/{id}/reject
 *
 * @param planId - Plan ID
 * @param reason - Rejection reason
 */
export async function rejectPlan(
  planId: number | string,
  reason: string
): Promise<ApiResponse<void>> {
  return api.post(`/plans/${planId}/reject`, { reason })
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
