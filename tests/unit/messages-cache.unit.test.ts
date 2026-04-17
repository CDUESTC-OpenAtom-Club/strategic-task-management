import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { buildQueryKey, cacheManager } from '@/shared/lib/utils/cache'
import { messagesApi } from '@/features/messages/api/messagesApi'
import { useMessageStore } from '@/features/messages/model/message'

const apiClientMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn()
}))

const alertApiMock = vi.hoisted(() => ({
  getActiveWarnings: vi.fn(),
  getUnclosedAlerts: vi.fn(),
  acknowledgeWarning: vi.fn(),
  processAlert: vi.fn()
}))

vi.mock('@/shared/api/client', () => ({
  apiClient: apiClientMock
}))

vi.mock('@/shared/api/monitoringApi', () => ({
  alertApi: alertApiMock
}))

describe('messages cache integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    cacheManager.clear()
    cacheManager.resetStats()
    sessionStorage.clear()
    localStorage.clear()
    vi.clearAllMocks()

    alertApiMock.getActiveWarnings.mockResolvedValue({ content: [], total: 0 })
    alertApiMock.getUnclosedAlerts.mockResolvedValue([])
  })

  afterEach(() => {
    cacheManager.clear()
    cacheManager.resetStats()
    sessionStorage.clear()
    localStorage.clear()
  })

  it('caches unread count in memory scope', async () => {
    apiClientMock.get.mockResolvedValue({
      data: {
        data: [
          {
            id: 'n-1',
            type: 'NOTIFICATION',
            title: '消息1',
            content: '内容1',
            isRead: false,
            createdAt: '2026-03-24T08:00:00Z'
          }
        ]
      }
    })

    const first = await messagesApi.getUnreadCount()
    const second = await messagesApi.getUnreadCount()

    expect(first).toBe(1)
    expect(second).toBe(1)
    expect(apiClientMock.get).toHaveBeenCalledTimes(1)
    expect(
      cacheManager.get(buildQueryKey('messages', 'unreadCount', { version: 'v1' }))?.scope
    ).toBe('memory')
  })

  it('invalidates unread cache after marking a message as read', async () => {
    apiClientMock.get.mockResolvedValue({
      data: {
        data: [
          {
            id: 'n-1',
            type: 'NOTIFICATION',
            title: '消息1',
            content: '内容1',
            isRead: false,
            createdAt: '2026-03-24T08:00:00Z'
          }
        ]
      }
    })
    apiClientMock.post.mockResolvedValue({ success: true })

    await messagesApi.getUnreadCount()
    expect(
      cacheManager.get(buildQueryKey('messages', 'unreadCount', { version: 'v1' }))
    ).toBeDefined()

    await messagesApi.markAsRead('n-1')

    expect(
      cacheManager.get(buildQueryKey('messages', 'unreadCount', { version: 'v1' }))
    ).toBeUndefined()
  })

  it('message store fetches remote messages before falling back to mock data', async () => {
    apiClientMock.get.mockResolvedValue({
      data: {
        data: [
          {
            id: 'n-2',
            type: 'NOTIFICATION',
            title: '远程消息',
            content: '需要处理',
            isRead: false,
            createdAt: '2026-03-24T09:00:00Z'
          }
        ]
      }
    })

    const store = useMessageStore()
    await store.fetchMessages()

    expect(store.messages).toHaveLength(1)
    expect(store.messages[0]?.title).toBe('远程消息')
  })

  it('maps reminder notifications into reminder message type', async () => {
    apiClientMock.get.mockResolvedValue({
      data: {
        data: [
          {
            id: 'n-3',
            type: 'REMINDER',
            title: '催办提醒',
            content: '请尽快处理',
            isRead: false,
            createdAt: '2026-03-24T09:30:00Z'
          }
        ]
      }
    })

    const store = useMessageStore()
    await store.fetchMessages()

    expect(store.messages[0]?.type).toBe('reminder')
    expect(store.unreadCount.reminders).toBe(1)
  })

  it('reads paged notification payloads returned directly under data.content', async () => {
    apiClientMock.get.mockResolvedValue({
      data: {
        content: [
          {
            id: 4,
            type: 'REMINDER',
            title: '滞后任务催办提醒',
            content: '任务“测试”当前进度滞后，请尽快处理并更新进展。',
            isRead: false,
            createdAt: '2026-04-05T02:03:05.203605',
            relatedEntityId: 2049
          }
        ],
        totalElements: 1
      }
    })

    const store = useMessageStore()
    await store.fetchMessages()

    expect(store.messages).toHaveLength(1)
    expect(store.messages[0]?.type).toBe('reminder')
    expect(store.reminderMessages).toHaveLength(1)
    expect(store.messages[0]?.title).toBe('滞后任务催办提醒')
  })

  it('retains approval routing metadata on remote approval messages', async () => {
    apiClientMock.get.mockResolvedValue({
      data: {
        data: [
          {
            id: 'n-4',
            type: 'NOTIFICATION',
            title: '有新的计划待审批',
            content: '请及时处理。',
            isRead: false,
            createdAt: '2026-03-24T10:00:00Z',
            entityId: 88,
            entityType: 'PLAN',
            approvalInstanceId: 91,
            link: '/strategic-tasks?tab=approval&approvalInstanceId=91',
            status: 'APPROVAL_PENDING'
          }
        ]
      }
    })

    const store = useMessageStore()
    await store.fetchMessages()

    expect(store.messages[0]?.type).toBe('approval')
    expect(store.messages[0]?.entityType).toBe('PLAN')
    expect(store.messages[0]?.entityId).toBe('88')
    expect(store.messages[0]?.approvalInstanceId).toBe(91)
    expect(store.messages[0]?.actionUrl).toBe('/strategic-tasks?tab=approval&approvalInstanceId=91')
  })

  it('syncs pending approvals into synthetic approval messages', async () => {
    apiClientMock.get.mockResolvedValue({ data: { data: [] } })

    const store = useMessageStore()
    await store.fetchMessages()
    store.syncPendingApprovals([
      {
        instanceId: 12,
        entityType: 'PLAN',
        entityId: 101,
        status: 'PENDING',
        currentStepName: '计划审批',
        applicant: { name: '教务处' },
        initiatedAt: '2026-03-24T11:00:00Z'
      }
    ])

    expect(store.approvalMessages).toHaveLength(2)
    const syntheticMessage = store.approvalMessages.find(
      message => message.syntheticSource === 'pending_approval'
    )
    expect(syntheticMessage?.title).toBe('有新的计划待审批')
    expect(syntheticMessage?.actionUrl).toBe('/strategic-tasks')
    expect(syntheticMessage?.entityId).toBe('101')
    expect(store.unreadCount.approvals).toBeGreaterThanOrEqual(1)
  })

  it('keeps synthetic pending approvals unread and visible when local read actions run', async () => {
    apiClientMock.get.mockResolvedValue({ data: { data: [] } })

    const store = useMessageStore()
    await store.fetchMessages()
    store.syncPendingApprovals([
      {
        instanceId: 18,
        entityType: 'PLAN',
        entityId: 108,
        status: 'PENDING',
        currentStepName: '计划审批',
        applicant: { name: '科研处' },
        initiatedAt: '2026-03-24T11:20:00Z'
      }
    ])

    const syntheticMessage = store.approvalMessages.find(
      message => message.syntheticSource === 'pending_approval'
    )

    expect(syntheticMessage?.isRead).toBe(false)

    await store.markAsRead(String(syntheticMessage?.id))
    expect(
      store.approvalMessages.find(message => message.id === syntheticMessage?.id)?.isRead
    ).toBe(false)

    await store.markAllAsRead()
    expect(
      store.approvalMessages.find(message => message.id === syntheticMessage?.id)?.isRead
    ).toBe(false)

    store.clearReadMessages()
    expect(store.approvalMessages.some(message => message.id === syntheticMessage?.id)).toBe(true)
    expect(store.unreadCount.approvals).toBeGreaterThanOrEqual(1)
  })

  it('keeps matched remote approval notifications actionable while the approval is still pending', async () => {
    apiClientMock.get.mockResolvedValue({
      data: {
        data: [
          {
            id: 'n-5a',
            type: 'NOTIFICATION',
            title: '有新的计划待审批',
            content: '请及时处理。',
            isRead: true,
            createdAt: '2026-03-24T10:30:00Z',
            entityId: 101,
            entityType: 'PLAN',
            link: '/strategic-tasks?tab=approval&approvalInstanceId=12',
            status: 'APPROVAL_PENDING'
          }
        ]
      }
    })

    const store = useMessageStore()
    await store.fetchMessages()
    expect(store.approvalMessages[0]?.isRead).toBe(true)

    store.syncPendingApprovals([
      {
        instanceId: 12,
        entityType: 'PLAN',
        entityId: 101,
        status: 'PENDING',
        currentStepName: '计划审批',
        applicant: { name: '教务处' },
        initiatedAt: '2026-03-24T11:00:00Z'
      }
    ])

    expect(store.approvalMessages).toHaveLength(1)
    expect(store.approvalMessages[0]?.syntheticSource).toBe('notification')
    expect(store.approvalMessages[0]?.isRead).toBe(false)

    await store.markAllAsRead()
    expect(store.approvalMessages[0]?.isRead).toBe(false)

    store.clearReadMessages()
    expect(store.approvalMessages).toHaveLength(1)
  })

  it('dedupes pending approvals against matching remote approval notifications', async () => {
    apiClientMock.get.mockResolvedValue({
      data: {
        data: [
          {
            id: 'n-5',
            type: 'NOTIFICATION',
            title: '有新的计划待审批',
            content: '请及时处理。',
            isRead: false,
            createdAt: '2026-03-24T10:30:00Z',
            entityId: 101,
            entityType: 'PLAN',
            link: '/strategic-tasks?tab=approval&approvalInstanceId=12',
            status: 'APPROVAL_PENDING'
          }
        ]
      }
    })

    const store = useMessageStore()
    await store.fetchMessages()
    store.syncPendingApprovals([
      {
        instanceId: 12,
        entityType: 'PLAN',
        entityId: 101,
        status: 'PENDING',
        currentStepName: '计划审批',
        applicant: { name: '教务处' },
        initiatedAt: '2026-03-24T11:00:00Z'
      }
    ])

    expect(store.approvalMessages).toHaveLength(1)
    expect(store.approvalMessages[0]?.syntheticSource).toBe('notification')
    expect(store.approvalMessages[0]?.approvalInstanceId).toBe(12)
    expect(store.approvalMessages[0]?.entityId).toBe('101')
    expect(store.approvalMessages[0]?.actionUrl).toBe(
      '/strategic-tasks?tab=approval&approvalInstanceId=12'
    )
  })
})
