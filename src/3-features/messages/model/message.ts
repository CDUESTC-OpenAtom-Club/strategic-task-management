/**
 * Message Store
 *
 * Manages system messages and notifications for the message center and header badge.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Message } from '@/shared/types'
import { messagesApi, type MessageItem } from '@/features/messages/api/messagesApi'

type PendingApprovalLike = {
  instanceId?: number | string
  entityType?: string | null
  entityId?: number | string | null
  status?: string | null
  currentStepName?: string | null
  applicant?: {
    name?: string | null
  }
  initiatedAt?: string | null
}

const SYNTHETIC_PENDING_PREFIX = 'pending-approval'

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
    actionUrl: '/strategic-tasks',
    entityType: 'PLAN',
    entityId: 'plan-fill-1',
    syntheticSource: 'notification'
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

  function isPendingApprovalMessage(message?: Pick<Message, 'type' | 'status'> | null): boolean {
    if (!message || message.type !== 'approval') {
      return false
    }

    return String(message.status || '')
      .toUpperCase()
      .includes('PENDING')
  }

  function normalizeEntityType(entityType?: string | null): string | undefined {
    const normalized = String(entityType || '')
      .trim()
      .toUpperCase()
    return normalized || undefined
  }

  function normalizeEntityId(entityId?: string | number | null): string | undefined {
    if (entityId == null) {
      return undefined
    }
    const normalized = String(entityId).trim()
    return normalized || undefined
  }

  function normalizeApprovalActionUrl(path?: string | null): string | undefined {
    const normalized = String(path || '').trim()
    if (!normalized || normalized === '/messages' || normalized === '/workflow-tasks') {
      return undefined
    }
    return normalized
  }

  function resolveApprovalActionUrl(entityType?: string, fallbackUrl?: string): string | undefined {
    const preferredRoute = normalizeApprovalActionUrl(fallbackUrl)
    if (preferredRoute) {
      return preferredRoute
    }

    switch (entityType) {
      case 'PLAN':
      case 'PLAN_REPORT':
      case 'TASK':
        return '/strategic-tasks'
      case 'INDICATOR':
        return '/indicators'
      case 'INDICATOR_DISTRIBUTION':
        return '/distribution'
      default:
        return fallbackUrl
    }
  }

  function buildApprovalIdentityKeys(
    approvalInstanceId?: string | number | null,
    entityType?: string | null,
    entityId?: string | number | null
  ): string[] {
    const identityKeys: string[] = []
    const normalizedApprovalInstanceId = Number(approvalInstanceId)
    const normalizedEntityType = normalizeEntityType(entityType)
    const normalizedEntityId = normalizeEntityId(entityId)

    if (Number.isFinite(normalizedApprovalInstanceId) && normalizedApprovalInstanceId > 0) {
      identityKeys.push(`instance:${normalizedApprovalInstanceId}`)
    }

    if (normalizedEntityType && normalizedEntityId) {
      identityKeys.push(`entity:${normalizedEntityType}:${normalizedEntityId}`)
    }

    return identityKeys
  }

  function buildPendingApprovalMessageId(pendingApproval: PendingApprovalLike): string {
    const instanceId = String(pendingApproval.instanceId ?? 'unknown').trim()
    const entityType = normalizeEntityType(pendingApproval.entityType) || 'UNKNOWN'
    const entityId = normalizeEntityId(pendingApproval.entityId) || 'unknown'
    return `${SYNTHETIC_PENDING_PREFIX}-${instanceId}-${entityType}-${entityId}`
  }

  function buildPendingApprovalTitle(entityType?: string): string {
    switch (entityType) {
      case 'PLAN':
        return '有新的计划待审批'
      case 'PLAN_REPORT':
        return '有新的计划上报待审批'
      case 'INDICATOR':
        return '有新的指标待审批'
      case 'INDICATOR_DISTRIBUTION':
        return '有新的指标下发待审批'
      default:
        return '有新的审批事项待处理'
    }
  }

  function buildPendingApprovalContent(pendingApproval: PendingApprovalLike): string {
    const applicantName = String(pendingApproval.applicant?.name || '').trim()
    const stepName = String(pendingApproval.currentStepName || '').trim()
    const applicantPrefix = applicantName ? `${applicantName} 提交了新的审批事项` : '有新的审批事项'

    if (stepName) {
      return `${applicantPrefix}，当前环节为“${stepName}”，请及时处理。`
    }

    return `${applicantPrefix}，请及时处理。`
  }

  function toPendingApprovalMessage(
    pendingApproval: PendingApprovalLike,
    previousMessage?: Message
  ): Message {
    const entityType = normalizeEntityType(pendingApproval.entityType)
    const entityId = normalizeEntityId(pendingApproval.entityId)
    const approvalInstanceId = Number(pendingApproval.instanceId)
    const createdAt = pendingApproval.initiatedAt
      ? new Date(pendingApproval.initiatedAt)
      : previousMessage?.createdAt || new Date()

    return {
      id: buildPendingApprovalMessageId(pendingApproval),
      type: 'approval',
      title: buildPendingApprovalTitle(entityType),
      content: buildPendingApprovalContent(pendingApproval),
      severity: previousMessage?.severity || 'moderate',
      isRead: false,
      createdAt,
      relatedId: entityId,
      actionUrl: resolveApprovalActionUrl(entityType),
      entityType,
      entityId,
      approvalInstanceId: Number.isFinite(approvalInstanceId) ? approvalInstanceId : undefined,
      status: pendingApproval.status || 'PENDING',
      syntheticSource: 'pending_approval'
    }
  }

  function shareApprovalIdentity(message: Message, pendingApproval: PendingApprovalLike): boolean {
    const messageIdentityKeys = new Set(
      buildApprovalIdentityKeys(message.approvalInstanceId, message.entityType, message.entityId)
    )
    const pendingIdentityKeys = buildApprovalIdentityKeys(
      pendingApproval.instanceId,
      pendingApproval.entityType,
      pendingApproval.entityId
    )

    return pendingIdentityKeys.some(identityKey => messageIdentityKeys.has(identityKey))
  }

  function mergePendingApprovalIntoMessage(
    message: Message,
    pendingApproval: PendingApprovalLike
  ): Message {
    const entityType = message.entityType || normalizeEntityType(pendingApproval.entityType)
    const entityId = message.entityId || normalizeEntityId(pendingApproval.entityId)
    const approvalInstanceId =
      message.approvalInstanceId != null
        ? Number(message.approvalInstanceId)
        : Number(pendingApproval.instanceId)
    const nextStatus = message.status || pendingApproval.status || 'PENDING'

    return {
      ...message,
      relatedId: message.relatedId || entityId,
      actionUrl: resolveApprovalActionUrl(entityType, message.actionUrl),
      entityType,
      entityId,
      approvalInstanceId: Number.isFinite(approvalInstanceId) ? approvalInstanceId : undefined,
      isRead: isPendingApprovalMessage({ type: 'approval', status: nextStatus })
        ? false
        : message.isRead,
      status: nextStatus
    }
  }

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

    const entityType = normalizeEntityType(message.entityType)
    const entityId = normalizeEntityId(message.entityId ?? message.relatedEntityId)
    const approvalInstanceId = Number(message.approvalInstanceId)

    return {
      id: String(message.id),
      type: normalizedType,
      title: message.title,
      content: message.content,
      severity: message.severity?.toLowerCase(),
      isRead: message.isRead,
      createdAt: new Date(message.createdAt),
      relatedId: entityId,
      actionUrl: resolveApprovalActionUrl(entityType, message.link),
      entityType,
      entityId,
      approvalInstanceId: Number.isFinite(approvalInstanceId) ? approvalInstanceId : undefined,
      status: message.status,
      syntheticSource: 'notification'
    }
  }

  function syncPendingApprovals(pendingApprovals: PendingApprovalLike[]) {
    const previousSyntheticMessages = new Map(
      messages.value
        .filter(message => message.syntheticSource === 'pending_approval')
        .map(message => [message.id, message])
    )

    const nextMessages = messages.value.filter(
      message => message.syntheticSource !== 'pending_approval'
    )
    const syntheticMessages: Message[] = []

    pendingApprovals.forEach(pendingApproval => {
      const existingMessageIndex = nextMessages.findIndex(
        message =>
          message.type === 'approval' &&
          message.syntheticSource !== 'pending_approval' &&
          shareApprovalIdentity(message, pendingApproval)
      )

      if (existingMessageIndex !== -1) {
        nextMessages[existingMessageIndex] = mergePendingApprovalIntoMessage(
          nextMessages[existingMessageIndex],
          pendingApproval
        )
        return
      }

      const messageId = buildPendingApprovalMessageId(pendingApproval)
      syntheticMessages.push(
        toPendingApprovalMessage(pendingApproval, previousSyntheticMessages.get(messageId))
      )
    })

    messages.value = [...nextMessages, ...syntheticMessages].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    )
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
    if (!message || isPendingApprovalMessage(message)) {
      return
    }

    message.isRead = true

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
      if (isPendingApprovalMessage(message)) {
        return
      }

      message.isRead = true
    })
    try {
      const remoteMessageIds = messages.value
        .filter(message => !isPendingApprovalMessage(message))
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
    messages.value = messages.value.filter(
      message => isPendingApprovalMessage(message) || !message.isRead
    )
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
    syncPendingApprovals,
    markAsRead,
    markAllAsRead,
    clearReadMessages,
    deleteMessage
  }
})
