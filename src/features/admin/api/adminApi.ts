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
   */
  async getSystemStats(): Promise<SystemStats> {
    try {
      logger.debug('[adminApi] Fetching system statistics')
      return await apiClient.get<SystemStats>('/admin/stats')
    } catch (error) {
      logger.error('[adminApi] Failed to fetch system statistics:', error)
      throw error
    }
  },

  /**
   * Get user list with pagination
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
      return await apiClient.get<UserListResponse>('/admin/users', params)
    } catch (error) {
      logger.error('[adminApi] Failed to fetch user list:', error)
      throw error
    }
  },

  /**
   * Get user details
   */
  async getUserDetails(userId: string): Promise<AdminUser> {
    try {
      logger.debug('[adminApi] Fetching user details:', userId)
      return await apiClient.get<AdminUser>(`/admin/users/${userId}`)
    } catch (error) {
      logger.error('[adminApi] Failed to fetch user details:', error)
      throw error
    }
  },

  /**
   * Update user status
   */
  async updateUserStatus(
    userId: string,
    status: 'active' | 'inactive' | 'suspended'
  ): Promise<void> {
    try {
      logger.debug('[adminApi] Updating user status:', userId, status)
      await apiClient.patch<void>(`/admin/users/${userId}/status`, { status })
    } catch (error) {
      logger.error('[adminApi] Failed to update user status:', error)
      throw error
    }
  },

  /**
   * Get audit logs
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
        '/admin/audit-logs',
        params
      )
    } catch (error) {
      logger.error('[adminApi] Failed to fetch audit logs:', error)
      throw error
    }
  },

  /**
   * Export audit logs
   */
  async exportAuditLogs(params: {
    startDate?: string
    endDate?: string
    format?: 'csv' | 'json'
  }): Promise<void> {
    try {
      logger.debug('[adminApi] Exporting audit logs:', params)
      const queryParams = new URLSearchParams()
      if (params.startDate) {queryParams.append('startDate', params.startDate)}
      if (params.endDate) {queryParams.append('endDate', params.endDate)}
      if (params.format) {queryParams.append('format', params.format)}

      await apiClient.download(
        `/admin/audit-logs/export?${queryParams.toString()}`,
        `audit-logs-${Date.now()}.${params.format || 'csv'}`
      )
    } catch (error) {
      logger.error('[adminApi] Failed to export audit logs:', error)
      throw error
    }
  }
}
