/**
 * Plan Feature - Query API
 *
 * Read-only API operations for plan data.
 */

import { apiClient as api } from '@/shared/api/client'
import { buildQueryKey, fetchWithCache } from '@/shared/lib/utils/cache'
import {
  createMemoryDetailPolicy,
  createSessionListPolicy
} from '@/shared/lib/utils/cache-config'
import { getCachedUserContext } from '@/shared/lib/utils/cacheContext'
import type { ApiResponse, Plan } from '@/shared/types'

const PLAN_LIST_POLICY = createSessionListPolicy({
  tags: ['plan.list']
})

const PLAN_DETAIL_POLICY = createMemoryDetailPolicy({
  tags: ['plan.detail']
})

function withPlanCacheContext(params?: Record<string, unknown>): Record<string, unknown> {
  return {
    ...getCachedUserContext(),
    ...(params ?? {}),
    version: 'v1'
  }
}

/**
 * Get all plans
 *
 * API: GET /api/plans
 *
 * @returns All plans
 */
export async function getAllPlans(): Promise<ApiResponse<Plan[]>> {
  return fetchWithCache({
    key: buildQueryKey('plan', 'list', withPlanCacheContext()),
    policy: PLAN_LIST_POLICY,
    fetcher: () => api.get('/plans')
  })
}

/**
 * Get plan by ID
 *
 * API: GET /api/plans/{id}
 *
 * @param planId - Plan ID
 * @returns Plan details
 */
export async function getPlanById(planId: number | string): Promise<ApiResponse<Plan>> {
  return fetchWithCache({
    key: buildQueryKey('plan', 'detail', withPlanCacheContext({ planId: String(planId) })),
    policy: {
      ...PLAN_DETAIL_POLICY,
      tags: ['plan.detail', `plan.detail.${planId}`]
    },
    fetcher: () => api.get(`/plans/${planId}`)
  })
}

/**
 * Get plans by organization
 *
 * API: GET /api/plans?orgId={orgId}
 *
 * @param orgId - Organization ID
 * @returns Plans for organization
 */
export async function getPlansByOrg(orgId: number | string): Promise<ApiResponse<Plan[]>> {
  return fetchWithCache({
    key: buildQueryKey('plan', 'list', withPlanCacheContext({ orgId: String(orgId) })),
    policy: {
      ...PLAN_LIST_POLICY,
      tags: ['plan.list', `plan.org.${orgId}`]
    },
    fetcher: () => api.get('/plans', { orgId })
  })
}

/**
 * Get plans by status
 *
 * API: GET /api/plans?status={status}
 *
 * @param status - Plan status
 * @returns Plans with status
 */
export async function getPlansByStatus(status: string): Promise<ApiResponse<Plan[]>> {
  return fetchWithCache({
    key: buildQueryKey('plan', 'list', withPlanCacheContext({ status })),
    policy: {
      ...PLAN_LIST_POLICY,
      tags: ['plan.list', `plan.status.${status}`]
    },
    fetcher: () => api.get('/plans', { status })
  })
}

/**
 * Search plans
 *
 * API: GET /api/plans?keyword={keyword}
 *
 * @param keyword - Search keyword
 * @returns Matching plans
 */
export async function searchPlans(keyword: string): Promise<ApiResponse<Plan[]>> {
  return fetchWithCache({
    key: buildQueryKey('plan', 'search', withPlanCacheContext({ keyword })),
    policy: {
      ...PLAN_LIST_POLICY,
      tags: ['plan.list', 'plan.search']
    },
    fetcher: () => api.get('/plans', { keyword })
  })
}
