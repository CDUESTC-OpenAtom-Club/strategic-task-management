import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildQueryKey, cacheManager } from '@/shared/lib/utils/cache'
import { getMyPendingTasks, getWorkflowInstanceDetail } from '@/features/workflow/api/queries'
import { approveTask } from '@/features/workflow/api/mutations'

const apiClientMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn()
}))

vi.mock('@/shared/api/client', () => ({
  apiClient: apiClientMock
}))

describe('workflow cache integration', () => {
  beforeEach(() => {
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

  it('caches workflow todo queries in memory scope', async () => {
    apiClientMock.get.mockResolvedValue({
      success: true,
      code: 200,
      message: 'ok',
      data: {
        items: [
          {
            taskId: 'task-1',
            status: 'PENDING',
            taskName: '审批任务',
            taskKey: 'approve_plan'
          }
        ],
        total: 1,
        pageNum: 1,
        pageSize: 10
      },
      timestamp: Date.now()
    })

    await getMyPendingTasks(1)
    await getMyPendingTasks(1)

    expect(apiClientMock.get).toHaveBeenCalledTimes(1)
    expect(cacheManager.get(buildQueryKey('workflow', 'todo', { pageNum: 1, version: 'v1' }))?.scope).toBe(
      'memory'
    )
  })

  it('invalidates workflow detail and todo cache after approval', async () => {
    apiClientMock.get
      .mockResolvedValueOnce({
        success: true,
        code: 200,
        message: 'ok',
        data: {
          items: [
            {
              taskId: 'task-1',
              status: 'PENDING',
              taskName: '审批任务',
              taskKey: 'approve_plan'
            }
          ],
          total: 1,
          pageNum: 1,
          pageSize: 10
        },
        timestamp: Date.now()
      })
      .mockResolvedValueOnce({
        success: true,
        code: 200,
        message: 'ok',
        data: {
          instanceId: 'instance-9',
          status: 'PENDING',
          tasks: [],
          history: []
        },
        timestamp: Date.now()
      })

    apiClientMock.post.mockResolvedValue({
      success: true,
      code: 200,
      message: 'approved',
      data: {
        instanceId: 'instance-9',
        status: 'APPROVED'
      },
      timestamp: Date.now()
    })

    await getMyPendingTasks(1)
    await getWorkflowInstanceDetail('instance-9')

    expect(cacheManager.get(buildQueryKey('workflow', 'todo', { pageNum: 1, version: 'v1' }))).toBeDefined()
    expect(
      cacheManager.get(buildQueryKey('workflow', 'detail', { instanceId: 'instance-9', version: 'v1' }))
    ).toBeDefined()

    await approveTask('task-1', { comment: '通过' })

    expect(cacheManager.get(buildQueryKey('workflow', 'todo', { pageNum: 1, version: 'v1' }))).toBeUndefined()
    expect(
      cacheManager.get(buildQueryKey('workflow', 'detail', { instanceId: 'instance-9', version: 'v1' }))
    ).toBeUndefined()
  })
})
