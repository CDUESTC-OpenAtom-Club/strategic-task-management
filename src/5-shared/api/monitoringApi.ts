/**
 * 预警告警 API
 * 用于 Dashboard 和消息中心的预警统计
 *
 * 当前 OpenAPI 只稳定暴露 alerts 相关接口。
 * warnings 和细粒度 process/acknowledge 能力在前端走兼容降级。
 */

import { apiClient } from '@/shared/api/client'
import { logger } from '@/shared/lib/utils/logger'

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

type ApiErrorLike = {
  code?: number | string
  status?: number
  message?: string
  details?: unknown
  response?: {
    status?: number
  }
}

const EMPTY_ALERT_STATS: AlertStats = {
  totalOpen: 0,
  countBySeverity: {
    CRITICAL: 0,
    MAJOR: 0,
    MINOR: 0
  }
}

let alertsApiUnavailable = false

function unwrapMockResponse<T>(response: T | ApiEnvelope<T>): T {
  if (response && typeof response === 'object' && 'data' in response) {
    return (response as ApiEnvelope<T>).data as T
  }

  return response as T
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const candidate = error as ApiErrorLike
  return candidate.status === 404 || candidate.code === 404 || candidate.response?.status === 404
}

async function requestUnclosedAlerts(path: string): Promise<AlertEvent[]> {
  const response = await apiClient.get<{
    code: number
    message: string
    data: AlertEvent[]
  }>(path)
  return unwrapMockResponse(response)
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
    if (alertsApiUnavailable) {
      return EMPTY_ALERT_STATS
    }

    try {
      const response = await apiClient.get<{
        code: number
        message: string
        data: AlertStats
      }>('/alerts/stats')
      return unwrapMockResponse(response)
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error
      }

      alertsApiUnavailable = true
      logger.warn('[alertApi] alerts stats endpoint unavailable, degrade to empty stats')
      return EMPTY_ALERT_STATS
    }
  },

  /**
   * 获取未关闭的告警事件
   * 兼容 `/alerts/events/unclosed` 与 `/alerts/unresolved`
   */
  getUnclosedAlerts: async () => {
    if (alertsApiUnavailable) {
      return []
    }

    try {
      return await requestUnclosedAlerts('/alerts/events/unclosed')
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error
      }

      logger.warn('[alertApi] /alerts/events/unclosed returned 404, fallback to /alerts/unresolved')
      try {
        return await requestUnclosedAlerts('/alerts/unresolved')
      } catch (fallbackError) {
        if (!isNotFoundError(fallbackError)) {
          throw fallbackError
        }

        alertsApiUnavailable = true
        logger.warn('[alertApi] alerts query endpoints unavailable, degrade to empty alerts list')
        return []
      }
    }
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
