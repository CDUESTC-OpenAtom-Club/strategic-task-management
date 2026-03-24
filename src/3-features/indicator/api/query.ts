/**
 * Strategic Indicator Feature - Query API
 *
 * Read-only API operations for indicators.
 * Based on API documentation: GET /api/indicators/*
 */

import { apiClient } from '@/shared/api/client'
import { buildQueryKey, fetchWithCache } from '@/shared/lib/utils/cache'
import {
  CACHE_TTL,
  createMemoryDetailPolicy,
  createSessionListPolicy,
  createShortMemoryPolicy
} from '@/shared/lib/utils/cache-config'
import { getCachedUserContext } from '@/shared/lib/utils/cacheContext'
import type { Indicator, IndicatorFilters } from '@/entities/indicator/model/types'
import type { IndicatorListResponse, IndicatorDetailResponse, PaginatedResponse } from './types'

const INDICATOR_LIST_POLICY = createSessionListPolicy({
  tags: ['indicator.list']
})

const INDICATOR_DETAIL_POLICY = createMemoryDetailPolicy({
  tags: ['indicator.detail']
})

function withIndicatorCacheContext(params?: Record<string, unknown>): Record<string, unknown> {
  return {
    ...getCachedUserContext(),
    ...(params ?? {}),
    version: 'v1'
  }
}

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
  const params = filters as Record<string, unknown> | undefined
  const cacheParams = withIndicatorCacheContext(params)
  const response = await fetchWithCache({
    key: buildQueryKey('indicator', 'list', cacheParams),
    policy: INDICATOR_LIST_POLICY,
    fetcher: () =>
      apiClient.get<IndicatorListResponse | PaginatedResponse<Indicator> | Indicator[]>(
        '/indicators',
        params
      )
  })
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
  const response = await fetchWithCache({
    key: buildQueryKey('indicator', 'detail', withIndicatorCacheContext({ id })),
    policy: {
      ...INDICATOR_DETAIL_POLICY,
      tags: ['indicator.detail', `indicator.detail.${id}`]
    },
    fetcher: () => apiClient.get<IndicatorDetailResponse | Indicator>(`/indicators/${id}`)
  })
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
  const response = await fetchWithCache({
    key: buildQueryKey('indicator', 'list', withIndicatorCacheContext({ taskId })),
    policy: {
      ...INDICATOR_LIST_POLICY,
      tags: ['indicator.list', `indicator.task.${taskId}`]
    },
    fetcher: () =>
      apiClient.get<IndicatorListResponse | PaginatedResponse<Indicator> | Indicator[]>(
        `/indicators/task/${taskId}`
      )
  })
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
  const response = await fetchWithCache({
    key: buildQueryKey('indicator', 'list', withIndicatorCacheContext({ ownerOrgId: orgId })),
    policy: {
      ...INDICATOR_LIST_POLICY,
      tags: ['indicator.list', `indicator.ownerOrg.${orgId}`]
    },
    fetcher: () =>
      apiClient.get<IndicatorListResponse | PaginatedResponse<Indicator> | Indicator[]>('/indicators')
  })
  return normalizeIndicatorArray(unwrapData(response)).filter(
    indicator => Number((indicator as unknown as Record<string, unknown>).ownerOrgId) === orgId
  )
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
  const response = await fetchWithCache({
    key: buildQueryKey('indicator', 'list', withIndicatorCacheContext({ targetOrgId: orgId })),
    policy: {
      ...INDICATOR_LIST_POLICY,
      tags: ['indicator.list', `indicator.targetOrg.${orgId}`]
    },
    fetcher: () =>
      apiClient.get<IndicatorListResponse | PaginatedResponse<Indicator> | Indicator[]>('/indicators')
  })
  return normalizeIndicatorArray(unwrapData(response)).filter(
    indicator => Number((indicator as unknown as Record<string, unknown>).targetOrgId) === orgId
  )
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
  const response = await fetchWithCache({
    key: buildQueryKey('indicator', 'list', withIndicatorCacheContext({ level })),
    policy: {
      ...INDICATOR_LIST_POLICY,
      tags: ['indicator.list', `indicator.level.${level}`]
    },
    fetcher: () =>
      apiClient.get<IndicatorListResponse | PaginatedResponse<Indicator> | Indicator[]>('/indicators')
  })
  return normalizeIndicatorArray(unwrapData(response)).filter(
    indicator => Number((indicator as unknown as Record<string, unknown>).level) === level
  )
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
  const response = await fetchWithCache({
    key: buildQueryKey('indicator', 'search', withIndicatorCacheContext({ keyword })),
    policy: {
      ...INDICATOR_LIST_POLICY,
      tags: ['indicator.list', 'indicator.search']
    },
    fetcher: () =>
      apiClient.get<IndicatorListResponse | PaginatedResponse<Indicator> | Indicator[]>(
        '/indicators/search',
        { keyword }
      )
  })
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
  const response = await fetchWithCache({
    key: buildQueryKey('indicator', 'list', withIndicatorCacheContext({ statusGroup: 'pending' })),
    policy: {
      ...createShortMemoryPolicy(CACHE_TTL.WORKFLOW_DETAIL, {
        tags: ['indicator.list', 'indicator.pending']
      })
    },
    fetcher: () =>
      apiClient.get<IndicatorListResponse | PaginatedResponse<Indicator> | Indicator[]>('/indicators')
  })
  return normalizeIndicatorArray(unwrapData(response)).filter(indicator =>
    ['PENDING', 'SUBMITTED'].includes(String((indicator as unknown as Record<string, unknown>).status))
  )
}

/**
 * Query distribution records
 *
 * API: GET /api/indicators/{id}/distribution-records
 *
 * @param id - Indicator ID
 * @returns Distribution records
 */
export async function queryDistributionRecords(_id: number): Promise<any[]> {
  return []
}
