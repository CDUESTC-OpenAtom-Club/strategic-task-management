import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { buildQueryKey, cacheManager } from '@/shared/lib/utils/cache'
import { messagesApi } from '@/features/messages/api/messagesApi'
import { useMessageStore } from '@/features/messages/model/message'

const apiClientMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn()
}))

vi.mock('@/shared/api/client', () => ({
  apiClient: apiClientMock
}))

describe('message center cache integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    cacheManager.clear()
    cacheManager.resetStats()
    sessionStorage.clear()
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cacheManager.clear()
    cacheManager.resetStats()
    sessionStorage.clear()
    localStorage.clear()
  })

  it('caches unified unread count via summary endpoint', async () => {
    apiClientMock.get.mockResolvedValue({
      data: {
        totalCount: 3,
        todoCount: 1,
        approvalCount: 2,
        reminderCount: 1,
        systemCount: 1,
        riskCount: 0,
        capabilities: {
          riskEnabled: false,
          approvalAggregationEnabled: true,
          detailDrawerEnabled: true
        }
      }
    })

    const first = await messagesApi.getUnreadCount()
    const second = await messagesApi.getUnreadCount()

    expect(first).toBe(3)
    expect(second).toBe(3)
    expect(apiClientMock.get).toHaveBeenCalledTimes(1)
    expect(cacheManager.get(buildQueryKey('messages', 'summary', { version: 'v2' }))?.scope).toBe(
      'memory'
    )
  })

  it('invalidates summary cache after marking a message as read', async () => {
    apiClientMock.get.mockResolvedValue({
      data: {
        totalCount: 1,
        todoCount: 0,
        approvalCount: 0,
        reminderCount: 0,
        systemCount: 1,
        riskCount: 0,
        capabilities: {
          riskEnabled: false,
          approvalAggregationEnabled: true,
          detailDrawerEnabled: true
        }
      }
    })
    apiClientMock.post.mockResolvedValue({ success: true })

    await messagesApi.getUnreadCount()
    expect(cacheManager.get(buildQueryKey('messages', 'summary', { version: 'v2' }))).toBeDefined()

    await messagesApi.markAsRead('notification:1')

    expect(
      cacheManager.get(buildQueryKey('messages', 'summary', { version: 'v2' }))
    ).toBeUndefined()
  })

  it('message store uses unified list data and does not fall back to mock messages', async () => {
    apiClientMock.get
      .mockResolvedValueOnce({
        data: {
          totalCount: 2,
          todoCount: 1,
          approvalCount: 1,
          reminderCount: 0,
          systemCount: 1,
          riskCount: 0,
          capabilities: {
            riskEnabled: false,
            approvalAggregationEnabled: true,
            detailDrawerEnabled: true
          }
        }
      })
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              messageId: 'workflow:12:501',
              sourceType: 'workflow',
              sourceId: '501',
              category: 'TODO',
              bizType: 'APPROVAL_TODO',
              title: '有新的计划待审批',
              summary: '计算机学院提交了“2026年度计划”，请及时处理。',
              content: '计算机学院提交了“2026年度计划”，请及时处理。',
              actionState: 'ACTION_REQUIRED',
              createdAt: '2026-04-17T08:00:00',
              actionUrl: '/strategic-tasks?tab=approval&approvalInstanceId=12',
              entityType: 'PLAN',
              entityId: 101,
              approvalInstanceId: 12,
              currentStepName: '部门负责人审批',
              canMarkAsRead: false,
              canViewDetail: true,
              canProcess: true
            },
            {
              messageId: 'notification:9',
              sourceType: 'notification',
              sourceId: '9',
              category: 'SYSTEM',
              bizType: 'SYSTEM_NOTICE',
              title: '系统维护提醒',
              summary: '本周日晚间系统维护。',
              content: '本周日晚间系统维护。',
              readState: 'UNREAD',
              createdAt: '2026-04-17T07:00:00',
              canMarkAsRead: true,
              canViewDetail: true,
              canProcess: false
            }
          ],
          total: 2,
          pageNum: 1,
          pageSize: 100,
          totalPages: 1,
          capabilities: {
            riskEnabled: false,
            approvalAggregationEnabled: true,
            detailDrawerEnabled: true
          }
        }
      })

    const store = useMessageStore()
    await store.refreshMessageCenter()

    expect(store.messages).toHaveLength(2)
    expect(store.todoMessages).toHaveLength(1)
    expect(store.approvalMessages).toHaveLength(1)
    expect(store.systemMessages).toHaveLength(1)
    expect(store.messages[0]?.id).toBe('workflow:12:501')
    expect(store.messages[0]?.canMarkAsRead).toBe(false)
    expect(store.summary.totalCount).toBe(2)
  })

  it('mark all as read only affects readable notifications and keeps todo counts intact', async () => {
    apiClientMock.get
      .mockResolvedValueOnce({
        data: {
          totalCount: 2,
          todoCount: 1,
          approvalCount: 1,
          reminderCount: 0,
          systemCount: 1,
          riskCount: 0,
          capabilities: {
            riskEnabled: false,
            approvalAggregationEnabled: true,
            detailDrawerEnabled: true
          }
        }
      })
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              messageId: 'workflow:12:501',
              sourceType: 'workflow',
              sourceId: '501',
              category: 'TODO',
              bizType: 'APPROVAL_TODO',
              title: '有新的计划待审批',
              summary: '待处理审批事项',
              content: '待处理审批事项',
              actionState: 'ACTION_REQUIRED',
              createdAt: '2026-04-17T08:00:00',
              canMarkAsRead: false,
              canViewDetail: true,
              canProcess: true
            },
            {
              messageId: 'notification:9',
              sourceType: 'notification',
              sourceId: '9',
              category: 'SYSTEM',
              bizType: 'SYSTEM_NOTICE',
              title: '系统维护提醒',
              summary: '本周日晚间系统维护。',
              content: '本周日晚间系统维护。',
              readState: 'UNREAD',
              createdAt: '2026-04-17T07:00:00',
              canMarkAsRead: true,
              canViewDetail: true,
              canProcess: false
            }
          ],
          total: 2,
          pageNum: 1,
          pageSize: 100,
          totalPages: 1,
          capabilities: {
            riskEnabled: false,
            approvalAggregationEnabled: true,
            detailDrawerEnabled: true
          }
        }
      })
    apiClientMock.post.mockResolvedValue({ success: true })

    const store = useMessageStore()
    await store.refreshMessageCenter()
    await store.markAllAsRead()

    expect(store.todoMessages[0]?.isRead).toBe(false)
    expect(store.systemMessages[0]?.isRead).toBe(true)
    expect(store.summary.todoCount).toBe(1)
    expect(store.summary.totalCount).toBe(1)
  })
})
