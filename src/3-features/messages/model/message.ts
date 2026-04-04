/**
 * Message Store
 *
 * Manages system messages and notifications for the message center and header badge.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Message } from '@/shared/types'
import { messagesApi, type MessageItem } from '@/features/messages/api/messagesApi'

const mockMessages: Message[] = [
  {
    id: 'msg-1',
    type: 'alert',
    title: '科研指标存在严重预警',
    content: '科研处“高水平论文产出”进度低于预期，请尽快核查并更新说明。',
    severity: 'severe',
    isRead: false,
    createdAt: new Date('2026-03-16T09:20:00')
  },
  {
    id: 'msg-2',
    type: 'approval',
    title: '有新的计划待审核',
    content: '计算机学院提交了 2026 年度计划，请前往审批中心处理。',
    severity: 'moderate',
    isRead: false,
    createdAt: new Date('2026-03-15T15:10:00'),
    relatedId: 'plan-fill-1',
    actionUrl: '/messages'
  },
  {
    id: 'msg-3',
    type: 'system',
    title: '系统维护提醒',
    content: '本周日 02:00-06:00 将进行系统维护，期间部分功能可能不可用。',
    isRead: true,
    createdAt: new Date('2026-03-14T08:00:00')
  }
]

export const useMessageStore = defineStore('message', () => {
  const messages = ref<Message[]>([])
  const loading = ref(false)

  const visibleMessages = computed(() => messages.value)
  const reminderMessages = computed(() =>
    messages.value.filter(message => message.type === 'reminder')
  )
  const alertMessages = computed(() => messages.value.filter(message => message.type === 'alert'))
  const approvalMessages = computed(() =>
    messages.value.filter(message => message.type === 'approval')
  )
  const systemMessages = computed(() => messages.value.filter(message => message.type === 'system'))

  const unreadCount = computed(() => ({
    all: messages.value.filter(message => !message.isRead).length,
    reminders: reminderMessages.value.filter(message => !message.isRead).length,
    alerts: alertMessages.value.filter(message => !message.isRead).length,
    approvals: approvalMessages.value.filter(message => !message.isRead).length,
    system: systemMessages.value.filter(message => !message.isRead).length
  }))

  function toStoreMessage(message: MessageItem): Message {
    const normalizedType =
      message.type === 'ALERT'
        ? 'alert'
        : message.type === 'WARNING'
          ? 'alert'
          : message.type === 'REMINDER'
            ? 'reminder'
            : message.type === 'SYSTEM'
              ? 'system'
              : message.type === 'NOTIFICATION' &&
                  String(message.status || '')
                    .toUpperCase()
                    .includes('APPRO')
                ? 'approval'
                : message.type === 'NOTIFICATION'
                  ? 'system'
                  : String(message.type || 'system').toLowerCase()

    return {
      id: String(message.id),
      type: normalizedType,
      title: message.title,
      content: message.content,
      severity: message.severity?.toLowerCase(),
      isRead: message.isRead,
      createdAt: new Date(message.createdAt),
      relatedId: message.entityId != null ? String(message.entityId) : undefined,
      actionUrl: message.link
    }
  }

  async function fetchMessages() {
    loading.value = true
    try {
      const remoteMessages = await messagesApi.getAllMessages()
      if (remoteMessages.length > 0) {
        messages.value = remoteMessages.map(toStoreMessage)
        return
      }

      messages.value = mockMessages.map(message => ({ ...message }))
    } finally {
      loading.value = false
    }
  }

  function initializeMessages() {
    if (messages.value.length === 0) {
      messages.value = mockMessages.map(message => ({ ...message }))
    }
  }

  function isRemoteNotificationId(messageId: string): boolean {
    return /^\d+$/.test(String(messageId).trim())
  }

  async function markAsRead(messageId: string) {
    const message = messages.value.find(item => item.id === messageId)
    if (message) {
      message.isRead = true
    }
    if (!isRemoteNotificationId(messageId)) {
      return
    }
    try {
      await messagesApi.markAsRead(messageId)
    } catch {
      // Keep optimistic local state when remote read sync is unavailable.
    }
  }

  async function markAllAsRead() {
    messages.value.forEach(message => {
      message.isRead = true
    })
    try {
      const remoteMessageIds = messages.value
        .map(message => String(message.id))
        .filter(isRemoteNotificationId)

      if (remoteMessageIds.length === 0) {
        return
      }

      await messagesApi.markMultipleAsRead(remoteMessageIds)
    } catch {
      // Keep optimistic local state when remote batch sync is unavailable.
    }
  }

  function clearReadMessages() {
    messages.value = messages.value.filter(message => !message.isRead)
  }

  function deleteMessage(messageId: string) {
    const index = messages.value.findIndex(message => message.id === messageId)
    if (index !== -1) {
      messages.value.splice(index, 1)
    }
  }

  return {
    messages,
    loading,
    visibleMessages,
    reminderMessages,
    alertMessages,
    approvalMessages,
    systemMessages,
    unreadCount,
    fetchMessages,
    initializeMessages,
    markAsRead,
    markAllAsRead,
    clearReadMessages,
    deleteMessage
  }
})
