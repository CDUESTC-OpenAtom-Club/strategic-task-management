import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildQueryKey, cacheManager } from '@/shared/lib/utils/cache'
import { milestoneApi } from '@/entities/milestone/api/milestoneApi'

const apiClientMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn()
}))

vi.mock('@/shared/api/client', () => ({
  apiClient: apiClientMock
}))

describe('milestone cache integration', () => {
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

  it('caches milestone list by indicator in memory scope', async () => {
    apiClientMock.get.mockResolvedValue({
      success: true,
      code: 200,
      message: 'ok',
      data: [
        {
          id: 'm-1',
          name: '阶段检查',
          indicatorId: '9'
        }
      ]
    })

    await milestoneApi.getMilestonesByIndicator('9')
    await milestoneApi.getMilestonesByIndicator('9')

    expect(apiClientMock.get).toHaveBeenCalledTimes(1)
    expect(
      cacheManager.get(buildQueryKey('milestone', 'list', { indicatorId: '9', version: 'v1' }))?.scope
    ).toBe('memory')
  })

  it('invalidates milestone caches after milestone update', async () => {
    apiClientMock.get.mockResolvedValue({
      success: true,
      code: 200,
      message: 'ok',
      data: [
        {
          id: 'm-1',
          name: '阶段检查',
          indicatorId: '9'
        }
      ]
    })
    apiClientMock.put.mockResolvedValue({
      success: true,
      code: 200,
      message: 'updated',
      data: {
        id: 'm-1'
      }
    })

    await milestoneApi.getMilestonesByIndicator('9')
    expect(
      cacheManager.get(buildQueryKey('milestone', 'list', { indicatorId: '9', version: 'v1' }))
    ).toBeDefined()

    await milestoneApi.updateMilestone('m-1', {
      indicatorId: 9,
      milestoneName: '阶段检查',
      targetProgress: 50,
      dueDate: '2026-03-24',
      status: 'pending',
      sortOrder: 1
    })

    expect(
      cacheManager.get(buildQueryKey('milestone', 'list', { indicatorId: '9', version: 'v1' }))
    ).toBeUndefined()
  })
})
