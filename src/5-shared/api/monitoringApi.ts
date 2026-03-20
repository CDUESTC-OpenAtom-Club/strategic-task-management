/**
 * 预警告警 API
 * 用于 Dashboard 和消息中心的预警统计
 *
 * 当前 OpenAPI 只稳定暴露 alerts 相关接口。
 * warnings 和细粒度 process/acknowledge 能力在前端走兼容降级。
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

type ApiEnvelope<T> = {
  code?: number
  message?: string
  data?: T
  success?: boolean
}

function unwrapMockResponse<T>(response: T | ApiEnvelope<T>): T {
  if (response && typeof response === 'object' && 'data' in response) {
    return (response as ApiEnvelope<T>).data as T
  }

  return response as T
}

/**
 * 预警告警 API
 */
export const alertApi = {
  /**
   * 获取告警统计
   * 使用 OpenAPI 告警统计接口
   */
  getStats: async () => {
    const response = await apiClient.get<{
      code: number
      message: string
      data: AlertStats
    }>('/alerts/stats')
    return unwrapMockResponse(response)
  },

  /**
   * 获取未关闭的告警事件
   * 使用 OpenAPI 未解决告警接口
   */
  getUnclosedAlerts: async () => {
    const response = await apiClient.get<{
      code: number
      message: string
      data: AlertEvent[]
    }>('/alerts/unresolved')
    return unwrapMockResponse(response)
  },

  /**
   * 获取活跃的预警事件
   * 当前 OpenAPI 无预警事件列表，降级为空结果
   */
  getActiveWarnings: async (params?: {
    indicatorId?: number
    orgId?: number
    page?: number
    size?: number
  }) => {
    void params
    return {
      content: [] as WarningEvent[],
      total: 0
    }
  },

  /**
   * 确认预警
   * 当前 OpenAPI 无预警确认接口
   */
  acknowledgeWarning: async (id: number) => {
    void id
    throw new Error('当前 OpenAPI 未提供预警确认接口')
  },

  /**
   * 处理告警
   * 复用通知 handle/status 能力近似表达告警处理
   */
  processAlert: async (id: number, data: {
    assigneeId?: number
    status: string
    actionLog: string
  }) => {
    const handledByUserId = data.assigneeId ?? 0
    const handleParams = new URLSearchParams({
      handledByUserId: String(handledByUserId)
    })
    if (data.actionLog) {
      handleParams.set('handledNote', data.actionLog)
    }
    await apiClient.post(`/notifications/${id}/handle?${handleParams.toString()}`)
    await apiClient.patch(
      `/notifications/${id}/status?newStatus=${encodeURIComponent(data.status)}`
    )

    return {
      id,
      ruleId: 0,
      ruleName: 'Alert',
      entityType: 'NOTIFICATION',
      entityId: id,
      severity: 'MINOR' as const,
      message: data.actionLog,
      status: (data.status || 'IN_PROGRESS') as AlertEvent['status'],
      triggeredAt: new Date().toISOString(),
      assigneeId: data.assigneeId
    }
  }
}

export default alertApi
