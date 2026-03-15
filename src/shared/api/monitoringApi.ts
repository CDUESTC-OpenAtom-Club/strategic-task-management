/**
 * 预警告警 API
 * 用于 Dashboard 和消息中心的预警统计
 *
 * 注意：根据后端API文档，预警和告警是分开的两个模块
 * - 预警：/api/v1/warnings/
 * - 告警：/api/v1/alerts/
 */

import { apiClient } from '@/shared/api/client'

/**
 * 预警事件
 */
export interface WarningEvent {
  id: number
  ruleId: number
  ruleName: string
  entityType: string
  entityId: number
  entityName?: string
  message: string
  status: 'ACTIVE' | 'ACKNOWLEDGED'
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  triggeredAt: string
}

/**
 * 告警事件
 */
export interface AlertEvent {
  id: number
  ruleId: number
  ruleName: string
  entityType: string
  entityId: number
  entityName?: string
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR'
  message: string
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED'
  triggeredAt: string
  assigneeId?: number
  assigneeName?: string
}

/**
 * 告警统计数据
 */
export interface AlertStats {
  totalOpen: number
  countBySeverity: {
    CRITICAL: number
    MAJOR: number
    MINOR: number
  }
}

/**
 * 预警告警 API
 */
export const alertApi = {
  /**
   * 获取告警统计
   * 使用正确的后端API路径：/api/v1/alerts/stats
   */
  getStats: async () => {
    const response = await apiClient.get<{
      code: number
      message: string
      data: AlertStats
    }>('/alerts/stats')
    return response.data.data
  },

  /**
   * 获取未关闭的告警事件
   * 使用正确的路径：/api/v1/alerts/events/unclosed
   */
  getUnclosedAlerts: async () => {
    const response = await apiClient.get<{
      code: number
      message: string
      data: AlertEvent[]
    }>('/alerts/events/unclosed')
    return response.data.data
  },

  /**
   * 获取活跃的预警事件
   * 使用正确的路径：/api/v1/warnings/events
   */
  getActiveWarnings: async (params?: {
    indicatorId?: number
    orgId?: number
    page?: number
    size?: number
  }) => {
    const response = await apiClient.get<{
      code: number
      message: string
      data: {
        content: WarningEvent[]
        total: number
      }
    }>('/warnings/events', { params })
    return response.data.data
  },

  /**
   * 确认预警
   * 使用正确的路径：/api/v1/warnings/events/{id}/acknowledge
   */
  acknowledgeWarning: async (id: number) => {
    const response = await apiClient.post<{
      code: number
      message: string
      data: WarningEvent
    }>(`/warnings/events/${id}/acknowledge`)
    return response.data.data
  },

  /**
   * 处理告警
   * 使用正确的路径：/api/v1/alerts/events/{id}/process
   */
  processAlert: async (id: number, data: {
    assigneeId?: number
    status: string
    actionLog: string
  }) => {
    const response = await apiClient.post<{
      code: number
      message: string
      data: AlertEvent
    }>(`/alerts/events/${id}/process`, data)
    return response.data.data
  }
}

export default alertApi
