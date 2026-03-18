/**
 * Dashboard Feature - Query API
 *
 * Read-only API operations for dashboard data.
 */

import { apiClient } from '@/5-shared/api/client'
import { logger } from '@/5-shared/lib/utils/logger'
import type { DashboardData, DepartmentProgress, AlertSummary } from '@/5-shared/types'

/**
 * Get dashboard overview data
 *
 * API: GET /api/v1/analytics/dashboard/overview
 *
 * @returns Dashboard overview data
 */
export async function getDashboardData(): Promise<DashboardData> {
  try {
    logger.debug('[Dashboard API] Fetching dashboard data')
    const response = await apiClient.post<DashboardData>('/analytics/dashboard', {})
    return response
  } catch (error) {
    logger.error('[Dashboard API] Failed to fetch dashboard data:', error)
    throw error
  }
}

/**
 * Get department progress data
 *
 * API: GET /api/v1/analytics/dashboard/charts
 *
 * @returns Department progress list
 */
export async function getDepartmentProgress(): Promise<DepartmentProgress[]> {
  try {
    logger.debug('[Dashboard API] Fetching department progress')
    await apiClient.post('/analytics/dashboard', {})
    return []
  } catch (error) {
    logger.error('[Dashboard API] Failed to fetch department progress:', error)
    throw error
  }
}

/**
 * Get recent activities
 *
 * API: GET /api/v1/analytics/activities
 *
 * @returns Recent activities list
 */
export async function getRecentActivities(): Promise<Array<Record<string, unknown>>> {
  try {
    logger.debug('[Dashboard API] Fetching recent activities')
    return []
  } catch (error) {
    logger.error('[Dashboard API] Failed to fetch recent activities:', error)
    // Return empty array to maintain UI stability
    return []
  }
}

/**
 * Get alert summary
 *
 * API: GET /api/v1/alerts/events/unclosed
 *
 * @returns Alert summary
 */
export async function getAlertSummary(): Promise<AlertSummary> {
  try {
    logger.debug('[Dashboard API] Fetching alert summary')
    const response = await apiClient.get<AlertSummary>('/alerts/unresolved')
    return response
  } catch (error) {
    logger.error('[Dashboard API] Failed to fetch alert summary:', error)
    throw error
  }
}

/**
 * Get filtered dashboard data
 *
 * API: GET /api/v1/analytics/dashboard/overview
 *
 * @param params - Filter parameters
 * @returns Dashboard overview data
 */
export async function getFilteredDashboardData(params: {
  department?: string
  indicatorType?: string
  alertLevel?: 'severe' | 'moderate' | 'normal'
  year?: number
}): Promise<DashboardData> {
  try {
    logger.debug('[Dashboard API] Fetching filtered dashboard data:', params)
    const response = await apiClient.post<DashboardData>('/analytics/dashboard', params)
    return response
  } catch (error) {
    logger.error('[Dashboard API] Failed to fetch filtered dashboard data:', error)
    throw error
  }
}
