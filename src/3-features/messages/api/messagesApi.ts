/**
 * Messages Feature API
 * 集成预警告警消息
 */

import { apiClient } from '@/5-shared/api/client'
import { alertApi, type WarningEvent, type AlertEvent } from '@/5-shared/api/monitoringApi'
import { useAuthStore } from '@/3-features/auth/model/store'
import { logger } from '@/5-shared/lib/utils/logger'

/**
 * 消息类型
 */
export type MessageType = 'NOTIFICATION' | 'WARNING' | 'ALERT' | 'SYSTEM'

/**
 * 消息项
 */
export interface MessageItem {
  id: string | number
  type: MessageType
  title: string
  content: string
  isRead: boolean
  createdAt: string
  link?: string
  // 预警/告警特有字段
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'MAJOR' | 'MINOR'
  entityId?: number
  entityType?: string
  status?: string
}

export const messagesApi = {
  /**
   * 获取所有消息（包括通知、预警、告警）
   */
  async getAllMessages(): Promise<MessageItem[]> {
    try {
      // 并行获取各类消息
      const [notifications, warnings, alerts] = await Promise.allSettled([
        this.getMessages(),
        alertApi.getActiveWarnings({ page: 1, size: 20 }),
        alertApi.getUnclosedAlerts()
      ])

      const messages: MessageItem[] = []

      // 添加通知消息
      if (notifications.status === 'fulfilled') {
        const payload = notifications.value?.data?.data
        const notificationList = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.content)
            ? payload.content
            : []

        messages.push(
          ...notificationList.map((msg: MessageItem) => ({
            ...msg,
            type: (msg.type || 'NOTIFICATION') as MessageType
          }))
        )
      }

      // 添加预警消息
      if (warnings.status === 'fulfilled' && warnings.value?.content) {
        messages.push(
          ...warnings.value.content.map((w: WarningEvent) => ({
            id: `warning-${w.id}`,
            type: 'WARNING' as MessageType,
            title: w.ruleName || '预警提醒',
            content: w.message,
            isRead: w.status === 'ACKNOWLEDGED',
            createdAt: w.triggeredAt,
            severity: w.severity,
            entityId: w.entityId,
            entityType: w.entityType,
            status: w.status,
            link: `/indicators/${w.entityId}`
          }))
        )
      }

      // 添加告警消息
      if (alerts.status === 'fulfilled' && alerts.value) {
        messages.push(
          ...alerts.value.map((a: AlertEvent) => ({
            id: `alert-${a.id}`,
            type: 'ALERT' as MessageType,
            title: a.ruleName || '告警通知',
            content: a.message,
            isRead: a.status !== 'OPEN',
            createdAt: a.triggeredAt,
            severity: a.severity,
            entityId: a.entityId,
            entityType: a.entityType,
            status: a.status,
            link: `/indicators/${a.entityId}`
          }))
        )
      }

      // 按时间倒序排序
      return messages.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    } catch (error) {
      logger.error('获取消息失败:', error)
      // 失败时至少返回通知消息
      try {
        const response = await this.getMessages()
        const payload = response.data?.data
        const notificationList = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.content)
            ? payload.content
            : []
        return notificationList.map((msg: MessageItem) => ({
          ...msg,
          type: (msg.type || 'NOTIFICATION') as MessageType
        }))
      } catch {
        return []
      }
    }
  },

  /**
   * 获取通知消息
   * 使用正确的后端API路径：/api/v1/notifications/my
   */
  async getMessages() {
    const authStore = useAuthStore()
    if (!authStore.user) {
      throw new Error('用户未登录')
    }
    return await apiClient.get('/notifications/my')
  },

  /**
   * 标记为已读
   * 使用正确的后端API路径：/api/v1/notifications/{notificationId}/read
   * 使用POST方法（后端文档定义）
   */
  async markAsRead(id: string | number) {
    return await apiClient.post(`/notifications/${id}/read`)
  },

  /**
   * 确认预警
   */
  async acknowledgeWarning(id: number) {
    return await alertApi.acknowledgeWarning(id)
  },

  /**
   * 处理告警
   */
  async processAlert(
    id: number,
    data: {
      assigneeId?: number
      status: string
      actionLog: string
    }
  ) {
    return await alertApi.processAlert(id, data)
  },

  /**
   * 批量标记为已读
   * V1 未提供批量已读接口，前端逐条标记
   */
  async markMultipleAsRead(ids: (string | number)[]) {
    const results = await Promise.allSettled(ids.map(id => this.markAsRead(id)))
    return results
  },

  /**
   * 标记所有通知为已读
   * 使用正确的后端API路径：/api/v1/notifications/read-all
   * 使用POST方法（后端文档定义）
   */
  async markAllAsRead() {
    const authStore = useAuthStore()
    if (!authStore.user) {
      throw new Error('用户未登录')
    }
    return await apiClient.post('/notifications/read-all')
  },

  /**
   * 获取未读消息数量
   */
  async getUnreadCount(): Promise<number> {
    try {
      const messages = await this.getAllMessages()
      return messages.filter(m => !m.isRead).length
    } catch {
      return 0
    }
  }
}
