/**
 * Messages Feature API
 * 集成预警告警消息
 */

import { apiClient } from '@/shared/api/client'
import { alertApi, type WarningEvent, type AlertEvent } from '@/shared/api/monitoringApi'

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
        apiClient.get<{ code: number; message: string; data: MessageItem[] }>('/messages'),
        alertApi.getActiveWarnings({ page: 1, size: 20 }),
        alertApi.getUnclosedAlerts()
      ])

      const messages: MessageItem[] = []

      // 添加通知消息
      if (notifications.status === 'fulfilled' && notifications.value.data?.data) {
        messages.push(
          ...notifications.value.data.data.map((msg: MessageItem) => ({
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
      return messages.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    } catch (error) {
      console.error('获取消息失败:', error)
      // 失败时至少返回通知消息
      try {
        const response = await apiClient.get<{
          code: number
          message: string
          data: MessageItem[]
        }>('/messages')
        return response.data.data.map((msg: MessageItem) => ({
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
   */
  async getMessages() {
    return await apiClient.get('/messages')
  },

  /**
   * 标记为已读
   */
  async markAsRead(id: string) {
    return await apiClient.patch(`/messages/${id}/read`)
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
  async processAlert(id: number, data: {
    assigneeId?: number
    status: string
    actionLog: string
  }) {
    return await alertApi.processAlert(id, data)
  },

  /**
   * 批量标记为已读
   */
  async markMultipleAsRead(ids: (string | number)[]) {
    return await apiClient.patch('/messages/batch-read', { ids })
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
