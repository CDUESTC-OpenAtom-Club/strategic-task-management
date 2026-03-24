import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { buildQueryKey, cacheManager } from '@/shared/lib/utils/cache'
import { messagesApi } from '@/features/messages/api/messagesApi'
import { useMessageStore } from '@/features/messages/model/message'

const apiClientMock = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
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
    apiClientMock.patch.mockResolvedValue({ success: true })

    await messagesApi.getUnreadCount()
    expect(cacheManager.get(buildQueryKey('messages', 'unreadCount', { version: 'v1' }))).toBeDefined()

    await messagesApi.markAsRead('n-1')

    expect(cacheManager.get(buildQueryKey('messages', 'unreadCount', { version: 'v1' }))).toBeUndefined()
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
})
