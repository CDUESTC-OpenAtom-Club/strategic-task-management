/**
 * Plan Feature - Query API
 *
 * Read-only API operations for plan data.
 */

import { apiClient as api } from '@/shared/api/client'
import type { ApiResponse, Plan } from '@/shared/types'

/**
 * Get all plans
 *
 * API: GET /api/plans
 *
 * @returns All plans
 */
export async function getAllPlans(): Promise<ApiResponse<Plan[]>> {
  return api.get('/plans')
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
  return api.get(`/plans/${planId}`)
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
  return api.get('/plans', { orgId })
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
  return api.get('/plans', { status })
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
  return api.get('/plans', { keyword })
}
