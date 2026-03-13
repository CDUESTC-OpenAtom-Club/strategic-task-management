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

import { apiClient } from '@/shared/api/client'
import { logger } from '@/utils/logger'
import type {
  DashboardData,
  DepartmentProgress,
  AlertSummary
} from '@/types'

/**
 * API endpoints for dashboard functionality
 */
export const dashboardApi = {
  /**
   * Get dashboard overview data
   * Returns completion rates, scores, and warning counts
   */
  async getDashboardData(): Promise<DashboardData> {
    try {
      logger.debug('[dashboardApi] Fetching dashboard data')
      return await apiClient.get<DashboardData>('/dashboard')
    } catch (error) {
      logger.error('[dashboardApi] Failed to fetch dashboard data:', error)
      throw error
    }
  },

  /**
   * Get department progress data
   * Returns progress metrics for all departments
   */
  async getDepartmentProgress(): Promise<DepartmentProgress[]> {
    try {
      logger.debug('[dashboardApi] Fetching department progress')
      return await apiClient.get<DepartmentProgress[]>('/dashboard/department-progress')
    } catch (error) {
      logger.error('[dashboardApi] Failed to fetch department progress:', error)
      throw error
    }
  },

  /**
   * Get recent activities
   * Returns recent system activities and updates
   */
  async getRecentActivities(): Promise<Array<Record<string, unknown>>> {
    try {
      logger.debug('[dashboardApi] Fetching recent activities')
      return await apiClient.get<Array<Record<string, unknown>>>('/dashboard/recent-activities')
    } catch (error) {
      logger.error('[dashboardApi] Failed to fetch recent activities:', error)
      throw error
    }
  },

  /**
   * Get alert summary
   * Returns distribution of alerts by severity
   */
  async getAlertSummary(): Promise<AlertSummary> {
    try {
      logger.debug('[dashboardApi] Fetching alert summary')
      return await apiClient.get<AlertSummary>('/dashboard/alerts')
    } catch (error) {
      logger.error('[dashboardApi] Failed to fetch alert summary:', error)
      throw error
    }
  },

  /**
   * Get filtered dashboard data
   * Returns dashboard data filtered by department, indicator type, or alert level
   */
  async getFilteredDashboardData(params: {
    department?: string
    indicatorType?: string
    alertLevel?: 'severe' | 'moderate' | 'normal'
    year?: number
  }): Promise<DashboardData> {
    try {
      logger.debug('[dashboardApi] Fetching filtered dashboard data:', params)
      return await apiClient.get<DashboardData>('/dashboard/filtered', params)
    } catch (error) {
      logger.error('[dashboardApi] Failed to fetch filtered dashboard data:', error)
      throw error
    }
  }
}
