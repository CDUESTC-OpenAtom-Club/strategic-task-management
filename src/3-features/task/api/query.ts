/**
 * Task Feature - Query API
 *
 * Read-only API operations for task data.
 */

import api from '@/5-shared/api'
import type { ApiResponse, StrategicTask } from '@/5-shared/types'

/**
 * Get tasks by year
 *
 * API: GET /api/strategic/year/{year}
 *
 * @param year - Year
 * @returns Tasks for the year
 */
export async function getTasksByYear(year: number): Promise<ApiResponse<StrategicTask[]>> {
  return api.get(`/strategic/year/${year}`)
}

/**
 * Get task by ID
 *
 * API: GET /api/strategic/{id}
 *
 * @param taskId - Task ID
 * @returns Task details
 */
export async function getTaskById(taskId: number): Promise<ApiResponse<StrategicTask>> {
  return api.get(`/strategic/${taskId}`)
}

/**
 * Get tasks by organization
 *
 * API: GET /api/strategic/org/{orgId}
 *
 * @param orgId - Organization ID
 * @returns Tasks for organization
 */
export async function getTasksByOrg(orgId: number): Promise<ApiResponse<StrategicTask[]>> {
  return api.get(`/strategic/org/${orgId}`)
}

/**
 * Get tasks by status
 *
 * API: GET /api/strategic/status/{status}
 *
 * @param status - Task status
 * @returns Tasks with status
 */
export async function getTasksByStatus(status: string): Promise<ApiResponse<StrategicTask[]>> {
  return api.get(`/strategic/status/${status}`)
}

/**
 * Search tasks
 *
 * API: GET /api/strategic/search
 *
 * @param keyword - Search keyword
 * @returns Matching tasks
 */
export async function searchTasks(keyword: string): Promise<ApiResponse<StrategicTask[]>> {
  return api.get('/strategic/search', { keyword })
}

/**
 * Get task indicators
 *
 * API: GET /api/strategic/{id}/indicators
 *
 * @param taskId - Task ID
 * @returns Task indicators
 */
export async function getTaskIndicators(taskId: number): Promise<ApiResponse<any[]>> {
  return api.get(`/strategic/${taskId}/indicators`)
}

/**
 * Get task milestones
 *
 * API: GET /api/strategic/{id}/milestones
 *
 * @param taskId - Task ID
 * @returns Task milestones
 */
export async function getTaskMilestones(taskId: number): Promise<ApiResponse<any[]>> {
  return api.get(`/strategic/${taskId}/milestones`)
}
