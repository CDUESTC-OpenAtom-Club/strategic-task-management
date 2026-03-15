/**
 * Task Feature - Mutation API
 *
 * Write operations for task data.
 */

import api from '@/shared/api'
import type { ApiResponse, StrategicTask } from '@/types'
import type { TaskCreateRequest, TaskUpdateRequest } from '../model/types'

/**
 * Create new task
 *
 * API: POST /api/strategic
 *
 * @param request - Task creation request
 * @returns Created task
 */
export async function createTask(request: TaskCreateRequest): Promise<ApiResponse<StrategicTask>> {
  return api.post('/strategic', request)
}

/**
 * Update task
 *
 * API: PUT /api/strategic/{id}
 *
 * @param taskId - Task ID
 * @param request - Update request
 * @returns Updated task
 */
export async function updateTask(
  taskId: number,
  request: TaskUpdateRequest
): Promise<ApiResponse<StrategicTask>> {
  return api.put(`/strategic/${taskId}`, request)
}

/**
 * Delete task
 *
 * API: DELETE /api/strategic/{id}
 *
 * @param taskId - Task ID
 */
export async function deleteTask(taskId: number): Promise<ApiResponse<void>> {
  return api.delete(`/strategic/${taskId}`)
}

/**
 * Submit task for approval
 *
 * API: POST /api/strategic/{id}/submit
 *
 * @param taskId - Task ID
 * @param comment - Submission comment
 */
export async function submitTaskForApproval(
  taskId: number,
  comment?: string
): Promise<ApiResponse<void>> {
  return api.post(`/strategic/${taskId}/submit`, { comment })
}

/**
 * Approve task
 *
 * API: POST /api/strategic/{id}/approve
 *
 * @param taskId - Task ID
 * @param comment - Approval comment
 */
export async function approveTask(
  taskId: number,
  comment?: string
): Promise<ApiResponse<void>> {
  return api.post(`/strategic/${taskId}/approve`, { comment })
}

/**
 * Reject task
 *
 * API: POST /api/strategic/{id}/reject
 *
 * @param taskId - Task ID
 * @param reason - Rejection reason
 */
export async function rejectTask(
  taskId: number,
  reason: string
): Promise<ApiResponse<void>> {
  return api.post(`/strategic/${taskId}/reject`, { reason })
}

/**
 * Activate task
 *
 * API: POST /api/strategic/{id}/activate
 *
 * @param taskId - Task ID
 */
export async function activateTask(taskId: number): Promise<ApiResponse<void>> {
  return api.post(`/strategic/${taskId}/activate`)
}

/**
 * Deactivate task
 *
 * API: POST /api/strategic/{id}/deactivate
 *
 * @param taskId - Task ID
 */
export async function deactivateTask(taskId: number): Promise<ApiResponse<void>> {
  return api.post(`/strategic/${taskId}/deactivate`)
}

/**
 * Add indicator to task
 *
 * API: POST /api/strategic/{id}/indicators
 *
 * @param taskId - Task ID
 * @param indicator - Indicator data
 */
export async function addIndicator(
  taskId: number,
  indicator: any
): Promise<ApiResponse<void>> {
  return api.post(`/strategic/${taskId}/indicators`, indicator)
}

/**
 * Remove indicator from task
 *
 * API: DELETE /api/strategic/{taskId}/indicators/{indicatorId}
 *
 * @param taskId - Task ID
 * @param indicatorId - Indicator ID
 */
export async function removeIndicator(
  taskId: number,
  indicatorId: number
): Promise<ApiResponse<void>> {
  return api.delete(`/strategic/${taskId}/indicators/${indicatorId}`)
}

/**
 * Add milestone to task
 *
 * API: POST /api/strategic/{id}/milestones
 *
 * @param taskId - Task ID
 * @param milestone - Milestone data
 */
export async function addMilestone(
  taskId: number,
  milestone: any
): Promise<ApiResponse<void>> {
  return api.post(`/strategic/${taskId}/milestones`, milestone)
}

/**
 * Update milestone
 *
 * API: PUT /api/strategic/{taskId}/milestones/{milestoneId}
 *
 * @param taskId - Task ID
 * @param milestoneId - Milestone ID
 * @param milestone - Milestone data
 */
export async function updateMilestone(
  taskId: number,
  milestoneId: number,
  milestone: any
): Promise<ApiResponse<void>> {
  return api.put(`/strategic/${taskId}/milestones/${milestoneId}`, milestone)
}

/**
 * Delete milestone
 *
 * API: DELETE /api/strategic/{taskId}/milestones/{milestoneId}
 *
 * @param taskId - Task ID
 * @param milestoneId - Milestone ID
 */
export async function deleteMilestone(
  taskId: number,
  milestoneId: number
): Promise<ApiResponse<void>> {
  return api.delete(`/strategic/${taskId}/milestones/${milestoneId}`)
}
