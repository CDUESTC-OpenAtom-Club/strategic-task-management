/**
 * Task Feature - Mutation API
 *
 * Write operations for task data.
 */

import api from '@/5-shared/api'
import type { ApiResponse, StrategicTask } from '@/5-shared/types'
import type {
  TaskCreateRequest,
  TaskUpdateRequest
} from '@/5-shared/types'

/**
 * Create new task
 *
 * API: POST /api/v1/tasks
 *
 * @param request - Task creation request
 * @returns Created task
 */
export async function createTask(request: TaskCreateRequest): Promise<ApiResponse<StrategicTask>> {
  return api.post('/tasks', request)
}

/**
 * Update task
 *
 * API: PUT /api/v1/tasks/{id}
 *
 * @param taskId - Task ID
 * @param request - Update request
 * @returns Updated task
 */
export async function updateTask(
  taskId: number,
  request: TaskUpdateRequest
): Promise<ApiResponse<StrategicTask>> {
  return api.put(`/tasks/${taskId}`, request)
}

/**
 * Delete task
 *
 * API: DELETE /api/v1/tasks/{id}
 *
 * @param taskId - Task ID
 */
export async function deleteTask(taskId: number): Promise<ApiResponse<void>> {
  return api.delete(`/tasks/${taskId}`)
}

/**
 * Submit task for approval
 *
 * API: POST /api/v1/approval/instances
 *
 * @param taskId - Task ID
 * @param requesterId - Requester user ID
 * @param requesterOrgId - Requester org ID
 * @param comment - Submission comment (optional)
 */
export async function submitTaskForApproval(
  taskId: number,
  requesterId: number,
  requesterOrgId: number,
  comment?: string
): Promise<ApiResponse<void>> {
  return api.post(
    `/approval/instances?requesterId=${requesterId}&requesterOrgId=${requesterOrgId}`,
    {
      entityType: 'TASK',
      entityId: taskId,
      workflowCode: 'TASK_APPROVAL',
      comment
    }
  )
}

/**
 * Approve task (approval instance)
 *
 * API: POST /api/v1/approval/instances/{instanceId}/approve?userId=...&comment=...
 *
 * @param instanceId - Approval instance ID
 * @param userId - Approver user ID
 * @param comment - Approval comment
 */
export async function approveTask(
  instanceId: number,
  userId: number,
  comment?: string
): Promise<ApiResponse<void>> {
  const encodedComment = comment ? `&comment=${encodeURIComponent(comment)}` : ''
  return api.post(`/approval/instances/${instanceId}/approve?userId=${userId}${encodedComment}`, {
    comment
  })
}

/**
 * Reject task (approval instance)
 *
 * API: POST /api/v1/approval/instances/{instanceId}/reject?userId=...&comment=...
 *
 * @param instanceId - Approval instance ID
 * @param userId - Approver user ID
 * @param reason - Rejection reason (required)
 */
export async function rejectTask(
  instanceId: number,
  userId: number,
  reason: string
): Promise<ApiResponse<void>> {
  return api.post(
    `/approval/instances/${instanceId}/reject?userId=${userId}&comment=${encodeURIComponent(
      reason
    )}`,
    { comment: reason }
  )
}

/**
 * Activate task
 *
 * API: POST /api/v1/tasks/{id}/activate
 *
 * @param taskId - Task ID
 */
export async function activateTask(taskId: number): Promise<ApiResponse<void>> {
  return api.post(`/tasks/${taskId}/activate`)
}

/**
 * Deactivate task
 *
 * API: POST /api/v1/tasks/{id}/cancel
 *
 * @param taskId - Task ID
 */
export async function deactivateTask(taskId: number): Promise<ApiResponse<void>> {
  return api.post(`/tasks/${taskId}/cancel`)
}
