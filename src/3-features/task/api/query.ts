/**
 * Task Feature - Query API
 *
 * Read-only API operations for task data.
 */

import { apiClient as api } from '@/shared/api/client'
import type { ApiResponse, StrategicTask } from '@/shared/types'
import { milestoneApi } from '@/entities/milestone/api/milestoneApi'

/**
 * Get tasks by year
 *
 * API: GET /api/v1/tasks (client-side filter by year)
 *
 * @param year - Year
 * @returns Tasks for the year
 */
export async function getTasksByYear(year: number): Promise<ApiResponse<StrategicTask[]>> {
  const response = await api.get('/tasks')
  if (response.success && response.data) {
    return { ...response, data: response.data.filter(task => task.year === year) }
  }
  return response
}

/**
 * Get task by ID
 *
 * API: GET /api/v1/tasks/{id}
 *
 * @param taskId - Task ID
 * @returns Task details
 */
export async function getTaskById(taskId: number): Promise<ApiResponse<StrategicTask>> {
  return api.get(`/tasks/${taskId}`)
}

/**
 * Get tasks by organization
 *
 * API: GET /api/v1/tasks/by-org/{orgId}
 *
 * @param orgId - Organization ID
 * @returns Tasks for organization
 */
export async function getTasksByOrg(orgId: number): Promise<ApiResponse<StrategicTask[]>> {
  return api.get(`/tasks/by-org/${orgId}`)
}

/**
 * Get tasks by status
 *
 * 后端不支持 /tasks/by-status/{status} 端点
 * Task 的 status 字段是 @Transient（不存储在数据库中），从关联的 Plan 获取
 * 暂时返回空结果，需要按 status 过滤时请通过 Plan 关联查询
 *
 * @param status - Task status (not used, kept for API compatibility)
 * @returns Empty result (status filtering not supported)
 */
export async function getTasksByStatus(_status: string): Promise<ApiResponse<StrategicTask[]>> {
  // 后端不支持按 status 查询，返回空结果
  return {
    success: true,
    code: 200,
    message: 'Status filtering not supported, returning empty result',
    data: [],
    timestamp: new Date().toISOString()
  }
}

/**
 * Search tasks
 *
 * API: GET /api/v1/tasks/search
 *
 * @param keyword - Search keyword
 * @returns Matching tasks
 */
export async function searchTasks(keyword: string): Promise<ApiResponse<StrategicTask[]>> {
  return api.get('/tasks/search', { taskName: keyword })
}

/**
 * Get task indicators
 *
 * API: GET /api/v1/indicators/task/{id}
 *
 * @param taskId - Task ID
 * @returns Task indicators
 */
export async function getTaskIndicators(taskId: number): Promise<ApiResponse<any[]>> {
  return api.get(`/indicators/task/${taskId}`)
}

/**
 * Get task milestones
 *
 * API: GET /api/v1/indicators/task/{taskId} + GET /api/v1/milestones/by-indicators?ids=...
 * 使用批量接口替代 N+1 请求
 *
 * @param taskId - Task ID
 * @returns Task milestones
 */
export async function getTaskMilestones(taskId: number): Promise<ApiResponse<any[]>> {
  const indicatorsResponse = await api.get(`/indicators/task/${taskId}`)

  if (!indicatorsResponse?.success || !Array.isArray(indicatorsResponse.data)) {
    return {
      ...indicatorsResponse,
      data: []
    }
  }

  const indicatorIds = indicatorsResponse.data
    .map((indicator: { indicatorId?: number; id?: number }) => indicator.indicatorId ?? indicator.id)
    .filter((id: number | undefined): id is number => typeof id === 'number')

  if (indicatorIds.length === 0) {
    return { ...indicatorsResponse, data: [] }
  }

  // 批量查询：1 个请求替代 N 个请求
  try {
    const batchResponse = await milestoneApi.getMilestonesByIndicatorIds(indicatorIds)
    const allMilestones: any[] = []
    if (batchResponse?.success && batchResponse.data) {
      for (const milestones of Object.values(batchResponse.data)) {
        if (Array.isArray(milestones)) {
          allMilestones.push(...milestones)
        }
      }
    }
    return { ...indicatorsResponse, data: allMilestones }
  } catch {
    return { ...indicatorsResponse, data: [] }
  }
}
