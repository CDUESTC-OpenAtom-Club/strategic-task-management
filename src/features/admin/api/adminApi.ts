/**
 * Admin Feature API
 *
 * Provides API endpoints for administrative functions including:
 * - System statistics
 * - User management
 * - Audit logs
 * - System configuration
 *
 * @module features/admin/api
 *
 * 注意：后端API路径已修正，不使用/admin前缀
 */

import { apiClient } from '@/shared/api/client'
import { logger } from '@/utils/logger'

/**
 * System statistics
 */
export interface SystemStats {
  totalUsers: number
  activeUsers: number
  totalIndicators: number
  totalPlans: number
  completionRate: number
}

/**
 * User information for admin management
 */
export interface AdminUser {
  id: string
  username: string
  email: string
  department: string
  role: string
  status: 'active' | 'inactive' | 'suspended'
  lastLogin: string
}

/**
 * User list response
 */
export interface UserListResponse {
  users: AdminUser[]
  total: number
  page: number
  pageSize: number
}

/**
 * Audit log entry
 */
export interface AuditLog {
  id: string
  userId: string
  username: string
  action: string
  resource: string
  timestamp: string
  details: Record<string, unknown>
}

/**
 * API endpoints for admin functionality
 */
export const adminApi = {
  /**
   * Get system statistics
   * 使用正确的后端API路径：/api/v1/analytics/dashboard/overview
   */
  async getSystemStats(): Promise<SystemStats> {
    try {
      logger.debug('[adminApi] Fetching system statistics')
      return await apiClient.get<SystemStats>('/analytics/dashboard/overview')
    } catch (error) {
      logger.error('[adminApi] Failed to fetch system statistics:', error)
      throw error
    }
  },

  /**
   * Get user list with pagination
   * 使用正确的后端API路径：/api/v1/users
   */
  async getUserList(params: {
    page?: number
    pageSize?: number
    search?: string
    department?: string
    status?: string
  }): Promise<UserListResponse> {
    try {
      logger.debug('[adminApi] Fetching user list:', params)
      return await apiClient.get<UserListResponse>('/users', params)
    } catch (error) {
      logger.error('[adminApi] Failed to fetch user list:', error)
      throw error
    }
  },

  /**
   * Get user details
   * 使用正确的后端API路径：/api/v1/users/{id}
   */
  async getUserDetails(userId: string): Promise<AdminUser> {
    try {
      logger.debug('[adminApi] Fetching user details:', userId)
      return await apiClient.get<AdminUser>(`/users/${userId}`)
    } catch (error) {
      logger.error('[adminApi] Failed to fetch user details:', error)
      throw error
    }
  },

  /**
   * Update user status
   * 使用正确的后端API路径：/api/v1/users/{id}/status
   * 使用PUT方法
   */
  async updateUserStatus(
    userId: string,
    status: 'active' | 'inactive' | 'suspended'
  ): Promise<void> {
    try {
      logger.debug('[adminApi] Updating user status:', userId, status)
      await apiClient.put<void>(`/users/${userId}/status`, { status })
    } catch (error) {
      logger.error('[adminApi] Failed to update user status:', error)
      throw error
    }
  },

  /**
   * Get audit logs
   * 使用正确的后端API路径：/api/v1/audit/logs
   */
  async getAuditLogs(params: {
    page?: number
    pageSize?: number
    userId?: string
    action?: string
    startDate?: string
    endDate?: string
  }): Promise<{ logs: AuditLog[]; total: number }> {
    try {
      logger.debug('[adminApi] Fetching audit logs:', params)
      return await apiClient.get<{ logs: AuditLog[]; total: number }>(
        '/audit/logs',
        params
      )
    } catch (error) {
      logger.error('[adminApi] Failed to fetch audit logs:', error)
      throw error
    }
  },

  /**
   * Export audit logs
   * 使用正确的后端API路径：/api/v1/analytics/export/audit-logs
   */
  async exportAuditLogs(params: {
    startDate?: string
    endDate?: string
    format?: 'csv' | 'json'
  }): Promise<void> {
    try {
      logger.debug('[adminApi] Exporting audit logs:', params)
      const queryParams = new URLSearchParams()
      if (params.startDate) queryParams.append('startDate', params.startDate)
      if (params.endDate) queryParams.append('endDate', params.endDate)
      if (params.format) queryParams.append('format', params.format)

      await apiClient.download(
        `/analytics/export/audit-logs?${queryParams.toString()}`,
        `audit-logs-${Date.now()}.${params.format || 'csv'}`
      )
    } catch (error) {
      logger.error('[adminApi] Failed to export audit logs:', error)
      throw error
    }
  }
}
