/**
 * Strategic Indicator Feature - Query API
 *
 * Read-only API operations for indicators.
 * Based on API documentation: GET /api/indicators/*
 */

import { apiClient } from '@/5-shared/lib/api/client'
import type { Indicator, IndicatorFilters } from '@/4-entities/indicator/model/types'
import type { IndicatorListResponse, IndicatorDetailResponse, PaginatedResponse } from './types'

function unwrapData<T>(response: T | { data?: T }): T {
  if (
    response &&
    typeof response === 'object' &&
    'data' in (response as Record<string, unknown>) &&
    (response as { data?: T }).data !== undefined
  ) {
    return (response as { data: T }).data
  }

  return response as T
}

function normalizeIndicatorList(payload: unknown): PaginatedResponse<Indicator> {
  if (Array.isArray(payload)) {
    return {
      content: payload,
      totalElements: payload.length,
      totalPages: payload.length > 0 ? 1 : 0,
      number: 0,
      size: payload.length
    }
  }

  if (!payload || typeof payload !== 'object') {
    return {
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: 0
    }
  }

  const pageLike = payload as Record<string, unknown>
  const content = Array.isArray(pageLike.content) ? (pageLike.content as Indicator[]) : []
  const totalElements = Number(pageLike.totalElements ?? content.length)
  const size = Number(pageLike.size ?? pageLike.pageSize ?? content.length)
  const number = Number(pageLike.number ?? pageLike.pageNumber ?? 0)
  const totalPages = Number(pageLike.totalPages ?? (size > 0 ? Math.ceil(totalElements / size) : 0))

  return {
    content,
    totalElements,
    totalPages,
    number,
    size
  }
}

function normalizeIndicatorArray(payload: unknown): Indicator[] {
  if (Array.isArray(payload)) {
    return payload as Indicator[]
  }

  if (!payload || typeof payload !== 'object') {
    return []
  }

  const result = payload as Record<string, unknown>
  if (Array.isArray(result.content)) {
    return result.content as Indicator[]
  }

  return []
}

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
  const response = await apiClient.get<IndicatorListResponse | PaginatedResponse<Indicator> | Indicator[]>(
    '/indicators',
    filters
  )
  return normalizeIndicatorList(unwrapData(response))
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
  const response = await apiClient.get<IndicatorDetailResponse | Indicator>(`/indicators/${id}`)
  return unwrapData(response)
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
  const response = await apiClient.get<IndicatorListResponse | PaginatedResponse<Indicator> | Indicator[]>(
    `/indicators/task/${taskId}`
  )
  return normalizeIndicatorArray(unwrapData(response))
}

/**
 * Query indicators by owner organization
 *
 * API: GET /api/indicators/owner/{orgId}
 *
 * @param orgId - Organization ID
 * @returns Indicator list
 */
export async function queryIndicatorsByOwnerOrg(orgId: number): Promise<Indicator[]> {
  const response = await apiClient.get<IndicatorListResponse | PaginatedResponse<Indicator> | Indicator[]>(
    `/indicators/owner/${orgId}`
  )
  return normalizeIndicatorArray(unwrapData(response))
}

/**
 * Query indicators by target organization
 *
 * API: GET /api/indicators/target/{orgId}
 *
 * @param orgId - Organization ID
 * @returns Indicator list
 */
export async function queryIndicatorsByTargetOrg(orgId: number): Promise<Indicator[]> {
  const response = await apiClient.get<IndicatorListResponse | PaginatedResponse<Indicator> | Indicator[]>(
    `/indicators/target/${orgId}`
  )
  return normalizeIndicatorArray(unwrapData(response))
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
  const response = await apiClient.get<IndicatorListResponse | PaginatedResponse<Indicator> | Indicator[]>(
    `/indicators/level/${level}`
  )
  return normalizeIndicatorArray(unwrapData(response))
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
  const response = await apiClient.get<IndicatorListResponse | PaginatedResponse<Indicator> | Indicator[]>(
    '/indicators/search',
    { keyword }
  )
  return normalizeIndicatorArray(unwrapData(response))
}

/**
 * Query pending indicators (for current user)
 *
 * API: GET /api/indicators/pending
 *
 * @returns Indicator list
 */
export async function queryPendingIndicators(): Promise<Indicator[]> {
  const response = await apiClient.get<IndicatorListResponse | PaginatedResponse<Indicator> | Indicator[]>(
    '/indicators/pending'
  )
  return normalizeIndicatorArray(unwrapData(response))
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
  return unwrapData(response)
}
