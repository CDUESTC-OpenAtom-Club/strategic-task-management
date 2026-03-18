/**
 * Dashboard Feature API
 *
 * Provides API endpoints for dashboard functionality including:
 * - Dashboard overview data
 * - Department progress
 * - Recent activities
 * - Alert summaries
 *
 * @module features/dashboard/api
 */

import { apiClient } from '@/5-shared/api/client'
import { buildQueryKey, fetchWithCache } from '@/5-shared/lib/utils/cache'
import { logger } from '@/5-shared/lib/utils/logger'
import type { DashboardData, DepartmentProgress, AlertSummary } from '@/5-shared/types'

/**
 * API endpoints for dashboard functionality
 * 注意：后端API位于 /api/v1/analytics/ 路径下
 */
export const dashboardApi = {
  /**
   * Get dashboard overview data
   * 使用正确的后端API路径：/api/v1/analytics/dashboard/overview
   */
  async getDashboardData(): Promise<DashboardData> {
    try {
      logger.debug('[dashboardApi] Fetching dashboard data')
      return await fetchWithCache({
        key: buildQueryKey('dashboard', 'overview'),
        policy: {
          ttlMs: 45 * 1000,
          scope: 'memory',
          staleWhileRevalidate: true,
          dedupeWindowMs: 1000,
          tags: ['dashboard.overview']
        },
        fetcher: () => apiClient.post<DashboardData>('/analytics/dashboard', {})
      })
    } catch (error) {
      logger.error('[dashboardApi] Failed to fetch dashboard data:', error)
      throw error
    }
  },

  /**
   * Get department progress data
   * 使用正确的后端API路径：/api/v1/analytics/dashboard/charts
   */
  async getDepartmentProgress(): Promise<DepartmentProgress[]> {
    try {
      logger.debug('[dashboardApi] Fetching department progress')
      await apiClient.post('/analytics/dashboard', {})
      return []
    } catch (error) {
      logger.error('[dashboardApi] Failed to fetch department progress:', error)
      throw error
    }
  },

  /**
   * Get recent activities

   * 注意：后端文档中未明确定义此接口
   * 使用/analytics/activities作为临时路径，需要后端确认
   */
  async getRecentActivities(): Promise<Array<Record<string, unknown>>> {
    try {
      logger.debug('[dashboardApi] Fetching recent activities')
      return []
    } catch (error) {
      logger.error('[dashboardApi] Failed to fetch recent activities:', error)
      // 返回空数组而不是抛出错误，保持UI稳定性
      return []
    }
  },

  /**
   * Get alert summary
   * 使用正确的后端API路径：/api/v1/alerts/events/unclosed
   */
  async getAlertSummary(): Promise<AlertSummary> {
    try {
      logger.debug('[dashboardApi] Fetching alert summary')
      return await apiClient.get<AlertSummary>('/alerts/unresolved')
    } catch (error) {
      logger.error('[dashboardApi] Failed to fetch alert summary:', error)
      throw error
    }
  },

  /**
   * Get filtered dashboard data
   * 注意：后端文档中未明确定义此接口
   * 临时复用overview接口，需要后端确认
   */
  async getFilteredDashboardData(params: {
    department?: string
    indicatorType?: string
    alertLevel?: 'severe' | 'moderate' | 'normal'
    year?: number
  }): Promise<DashboardData> {
    try {
      logger.debug('[dashboardApi] Fetching filtered dashboard data:', params)
      return await fetchWithCache({
        key: buildQueryKey('dashboard', 'overview', params),
        policy: {
          ttlMs: 45 * 1000,
          scope: 'memory',
          staleWhileRevalidate: true,
          dedupeWindowMs: 1000,
          tags: ['dashboard.overview']
        },
        fetcher: () => apiClient.post<DashboardData>('/analytics/dashboard', params)
      })
    } catch (error) {
      logger.error('[dashboardApi] Failed to fetch filtered dashboard data:', error)
      throw error
    }
  }
}
