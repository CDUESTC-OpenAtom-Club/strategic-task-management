/**
 * Workflow Feature - Query API
 *
 * Read operations for workflow data using new API (/api/v1/workflows)
 */

import { apiClient } from '@/shared/api/client'
import type { ApiResponse } from '@/shared/types'
import type {
  WorkflowDefinitionResponse,
  WorkflowDefinitionPreviewResponse,
  WorkflowHistoryCardResponse,
  WorkflowInstanceResponse,
  WorkflowTaskResponse,
  WorkflowInstanceDetailResponse,
  PageResult
} from './types'

/**
 * Get workflow definitions with pagination
 *
 * API: GET /api/v1/workflows/definitions
 *
 * @param pageNum - Page number (default: 1)
 * @param pageSize - Page size (default: 10)
 * @returns Paginated workflow definitions
 */
export async function getWorkflowDefinitions(
  pageNum: number = 1,
  pageSize: number = 10
): Promise<ApiResponse<PageResult<WorkflowDefinitionResponse>>> {
  return apiClient.get('/workflows/definitions', { pageNum, pageSize })
}

/**
 * Get workflow definition by ID
 *
 * API: GET /api/v1/workflows/definitions/{definitionId}
 *
 * @param definitionId - Workflow definition ID
 * @returns Workflow definition details
 */
export async function getWorkflowDefinitionById(
  definitionId: string
): Promise<ApiResponse<WorkflowDefinitionResponse>> {
  return apiClient.get(`/workflows/definitions/${definitionId}`)
}

/**
 * Get workflow definition by code
 *
 * API: GET /api/v1/workflows/definitions/code/{flowCode}
 *
 * @param flowCode - Workflow flow code
 * @returns Workflow definition details
 */
export async function getWorkflowDefinitionByCode(
  flowCode: string
): Promise<ApiResponse<WorkflowDefinitionResponse>> {
  return apiClient.get(`/workflows/definitions/code/${flowCode}`)
}

/**
 * Preview workflow definition with candidate approvers
 *
 * API: GET /api/v1/workflows/definitions/code/{flowCode}/preview
 */
export async function getWorkflowDefinitionPreviewByCode(
  flowCode: string
): Promise<ApiResponse<WorkflowDefinitionPreviewResponse>> {
  return apiClient.get(`/workflows/definitions/code/${flowCode}/preview`)
}

/**
 * Get workflow definitions by entity type
 *
 * API: GET /api/v1/workflows/definitions/entity-type/{entityType}
 *
 * @param entityType - Entity type (e.g., 'TASK', 'INDICATOR')
 * @returns List of workflow definitions
 */
export async function getWorkflowDefinitionsByEntityType(
  entityType: string
): Promise<ApiResponse<WorkflowDefinitionResponse[]>> {
  return apiClient.get(`/workflows/definitions/entity-type/${entityType}`)
}

/**
 * Get workflow instances for a specific definition
 *
 * API: GET /api/v1/workflows/{definitionId}/instances
 *
 * @param definitionId - Workflow definition ID
 * @param pageNum - Page number (default: 1)
 * @param pageSize - Page size (default: 10)
 * @returns Paginated workflow instances
 */
export async function getWorkflowInstances(
  definitionId: string,
  pageNum: number = 1,
  pageSize: number = 10
): Promise<ApiResponse<PageResult<WorkflowInstanceResponse>>> {
  return apiClient.get(`/workflows/${definitionId}/instances`, { pageNum, pageSize })
}

/**
 * Get workflow instance detail
 *
 * API: GET /api/v1/workflows/instances/{instanceId}
 *
 * @param instanceId - Workflow instance ID
 * @returns Detailed workflow instance with tasks and history
 */
export async function getWorkflowInstanceDetail(
  instanceId: string
): Promise<ApiResponse<WorkflowInstanceDetailResponse>> {
  return apiClient.get(`/workflows/instances/${instanceId}`)
}

/**
 * Get latest workflow instance detail by business entity.
 *
 * API: GET /api/v1/workflows/instances/entity/{entityType}/{entityId}
 */
export async function getWorkflowInstanceDetailByBusiness(
  entityType: string,
  entityId: number | string
): Promise<ApiResponse<WorkflowInstanceDetailResponse>> {
  return apiClient.get(`/workflows/instances/entity/${entityType}/${entityId}`)
}

/**
 * Get all completed workflow history cards by business entity.
 *
 * API: GET /api/v1/workflows/instances/entity/{entityType}/{entityId}/list
 */
export async function getWorkflowInstanceHistoryByBusiness(
  entityType: string,
  entityId: number | string
): Promise<ApiResponse<WorkflowHistoryCardResponse[]>> {
  return apiClient.get(`/workflows/instances/entity/${entityType}/${entityId}/list`)
}

/**
 * Get my pending workflow tasks
 *
 * API: GET /api/v1/workflows/my-tasks
 *
 * @param pageNum - Page number (default: 1)
 * @returns Paginated pending tasks for current user
 */
export async function getMyPendingTasks(
  pageNum: number = 1
): Promise<ApiResponse<PageResult<WorkflowTaskResponse>>> {
  return apiClient.get('/workflows/my-tasks', { pageNum })
}

/**
 * Get my approved workflow instances
 *
 * API: GET /api/v1/workflows/my-approved
 *
 * @param pageNum - Page number (default: 1)
 * @param pageSize - Page size (default: 10)
 * @returns Paginated approved instances for current user
 */
export async function getMyApprovedInstances(
  pageNum: number = 1,
  pageSize: number = 10
): Promise<ApiResponse<PageResult<WorkflowInstanceResponse>>> {
  return apiClient.get('/workflows/my-approved', { pageNum, pageSize })
}

/**
 * Get my applied workflow instances
 *
 * API: GET /api/v1/workflows/my-applied
 *
 * @param pageNum - Page number (default: 1)
 * @param pageSize - Page size (default: 10)
 * @returns Paginated applied instances for current user
 */
export async function getMyAppliedInstances(
  pageNum: number = 1,
  pageSize: number = 10
): Promise<ApiResponse<PageResult<WorkflowInstanceResponse>>> {
  return apiClient.get('/workflows/my-applied', { pageNum, pageSize })
}

/**
 * Get workflow statistics
 *
 * API: GET /api/v1/workflows/statistics
 *
 * @returns Workflow statistics data
 */
export async function getWorkflowStatistics(): Promise<ApiResponse<Record<string, unknown>>> {
  return apiClient.get('/workflows/statistics')
}
