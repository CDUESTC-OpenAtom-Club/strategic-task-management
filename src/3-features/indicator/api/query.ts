/**
 * Strategic Indicator Feature - Query API
 *
 * Read-only API operations for indicators.
 * Based on API documentation: GET /api/indicators/*
 */

import { apiClient } from '@/5-shared/lib/api/client'
import type { Indicator, IndicatorFilters } from '@/4-entities/indicator/model/types'
import type { IndicatorListResponse, IndicatorDetailResponse, PaginatedResponse } from './types'

/**
 * Query indicators with filters
 *
 * API: GET /api/indicators
 *
 * @param filters - Query filters
 * @returns Paginated indicator list
 */
export async function queryIndicators(
  filters?: IndicatorFilters
): Promise<PaginatedResponse<Indicator>> {
  const response = await apiClient.get<IndicatorListResponse>('/indicators', filters)
  return response.data
}

/**
 * Get indicator by ID
 *
 * API: GET /api/indicators/{id}
 *
 * @param id - Indicator ID
 * @returns Indicator detail
 */
export async function getIndicatorById(id: number): Promise<Indicator> {
  const response = await apiClient.get<IndicatorDetailResponse>(`/indicators/${id}`)
  return response.data
}

/**
 * Query indicators by task
 *
 * API: GET /api/indicators/task/{taskId}
 *
 * @param taskId - Task ID
 * @returns Indicator list
 */
export async function queryIndicatorsByTask(taskId: number): Promise<Indicator[]> {
  const response = await apiClient.get<IndicatorListResponse>(`/indicators/task/${taskId}`)
  return response.data.content
}

/**
 * Query indicators by owner organization
 *
 * API: GET /api/indicators/owner-org/{orgId}
 *
 * @param orgId - Organization ID
 * @returns Indicator list
 */
export async function queryIndicatorsByOwnerOrg(orgId: number): Promise<Indicator[]> {
  const response = await apiClient.get<IndicatorListResponse>(`/indicators/owner-org/${orgId}`)
  return response.data.content
}

/**
 * Query indicators by target organization
 *
 * API: GET /api/indicators/target-org/{orgId}
 *
 * @param orgId - Organization ID
 * @returns Indicator list
 */
export async function queryIndicatorsByTargetOrg(orgId: number): Promise<Indicator[]> {
  const response = await apiClient.get<IndicatorListResponse>(`/indicators/target-org/${orgId}`)
  return response.data.content
}

/**
 * Query indicators by level
 *
 * API: GET /api/indicators/level/{level}
 *
 * @param level - Indicator level (1 or 2)
 * @returns Indicator list
 */
export async function queryIndicatorsByLevel(level: number): Promise<Indicator[]> {
  const response = await apiClient.get<IndicatorListResponse>(`/indicators/level/${level}`)
  return response.data.content
}

/**
 * Search indicators
 *
 * API: GET /api/indicators/search
 *
 * @param keyword - Search keyword
 * @returns Indicator list
 */
export async function searchIndicators(keyword: string): Promise<Indicator[]> {
  const response = await apiClient.get<IndicatorListResponse>('/indicators/search', { keyword })
  return response.data.content
}

/**
 * Query pending indicators (for current user)
 *
 * API: GET /api/indicators/pending
 *
 * @returns Indicator list
 */
export async function queryPendingIndicators(): Promise<Indicator[]> {
  const response = await apiClient.get<IndicatorListResponse>('/indicators/pending')
  return response.data.content
}

/**
 * Query distribution records
 *
 * API: GET /api/indicators/{id}/distribution-records
 *
 * @param id - Indicator ID
 * @returns Distribution records
 */
export async function queryDistributionRecords(id: number): Promise<any[]> {
  const response = await apiClient.get<any>(`/indicators/${id}/distribution-records`)
  return response.data
}
