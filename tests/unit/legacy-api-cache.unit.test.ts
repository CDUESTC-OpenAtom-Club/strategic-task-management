import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildQueryKey, cacheManager } from '@/shared/lib/utils/cache'
import { indicatorApi } from '@/features/indicator/api/indicator'
import strategicApi from '@/features/task/api/strategicApi'

const apiClientMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn()
}))

vi.mock('@/shared/api/client', () => ({
  apiClient: apiClientMock
}))

vi.mock('@/features/workflow/api', () => ({
  getMyPendingTasks: vi.fn(),
  getWorkflowInstanceDetail: vi.fn(),
  approveTask: vi.fn(),
  rejectTask: vi.fn()
}))

describe('legacy API cache integration', () => {
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

  it('caches legacy indicator detail queries in memory scope', async () => {
    apiClientMock.get.mockResolvedValue({
      success: true,
      code: 200,
      message: 'ok',
      data: {
        indicatorId: 12,
        indicatorName: '科研经费',
        taskId: 3
      }
    })

    await indicatorApi.getIndicatorById('12')
    await indicatorApi.getIndicatorById('12')

    expect(apiClientMock.get).toHaveBeenCalledTimes(1)
    expect(
      cacheManager.get(
        buildQueryKey('indicator', 'detail', { indicatorId: '12', version: 'v1' })
      )?.scope
    ).toBe('memory')
  })

  it('caches cycle lookup by year in session scope', async () => {
    apiClientMock.get.mockResolvedValue({
      success: true,
      code: 200,
      message: 'ok',
      data: {
        content: [
          {
            cycleId: 8,
            cycleName: '2026年度考核周期',
            year: 2026
          }
        ]
      }
    })

    await strategicApi.getCycleByYear(2026)
    await strategicApi.getCycleByYear(2026)

    expect(apiClientMock.get).toHaveBeenCalledTimes(1)
    expect(
      cacheManager.get(buildQueryKey('cycle', 'detail', { year: 2026, version: 'v1' }))?.scope
    ).toBe('session')
  })
})
