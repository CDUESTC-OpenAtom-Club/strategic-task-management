/**
 * 审计日志 API
 * 对应后端接口：GET /api/audit/logs
 */

import { apiClient } from '@/shared/api/client'

/**
 * 审计日志查询参数
 */
export interface AuditLogQueryParams {
  page?: number
  size?: number
  userId?: number
  action?: string
  startTime?: string
  endTime?: string
  keyword?: string
}

/**
 * 审计日志数据结构
 */
export interface AuditLogItem {
  id: number
  userId: number
  userName: string
  action: string
  resource: string
  resourceId?: number
  description: string
  ip: string
  userAgent: string
  status: 'SUCCESS' | 'FAILURE'
  timestamp: string
}

/**
 * 审计日志响应
 */
export interface AuditLogResponse {
  items: AuditLogItem[]
  total: number
  page: number
  size: number
}

/**
 * 审计日志 API
 */
export const auditLogApi = {
  /**
   * 查询审计日志列表
   */
  list: async (params: AuditLogQueryParams = {}) => {
    const response = await apiClient.get<{
      code: number
      message: string
      data: AuditLogResponse
    }>('/audit/logs', { params })
    return response.data.data
  },

  /**
   * 导出审计日志
   */
  export: async (params: AuditLogQueryParams = {}) => {
    const response = await apiClient.get('/audit/logs/export', {
      params,
      responseType: 'blob'
    })
    return response.data
  }
}

export default auditLogApi
