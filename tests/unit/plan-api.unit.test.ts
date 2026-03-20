import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cacheManager } from '@/shared/lib/utils/cache'

const apiGetMock = vi.fn()

vi.mock('@/shared/api/client', () => ({
  apiClient: {
    get: apiGetMock
  }
}))

vi.mock('@/shared/api', () => ({
  withRetry: <T>(fn: () => Promise<T>) => fn()
}))

vi.mock('@/features/approval/api/approval', () => ({
  approvalApi: {}
}))

vi.mock('@/features/auth/model/store', () => ({
  useAuthStore: () => ({
    user: { id: 1 },
    effectiveRole: 'strategic_dept',
    effectiveDepartment: '战略发展部',
    userDepartment: '战略发展部'
  })
}))

describe('planApi.getAllPlans', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    cacheManager.clear()
    cacheManager.resetStats()
  })

  it('unwraps paged items payloads returned by backend', async () => {
    const plan = { id: 101, name: 'Plan 101' }
    apiGetMock.mockResolvedValue({
      code: 200,
      message: 'ok',
      timestamp: '2026-03-18T08:00:00Z',
      data: {
        items: [plan]
      }
    })

    const { planApi } = await import('@/features/plan/api/planApi')
    const result = await planApi.getAllPlans()

    expect(apiGetMock).toHaveBeenCalledWith('/plans', { page: 0, size: 1000 })
    expect(result.data).toHaveLength(1)
    expect(result.data?.[0]).toMatchObject(plan)
  })

  it('unwraps content payloads returned by backend page objects', async () => {
    const plan = { id: 202, name: 'Plan 202' }
    apiGetMock.mockResolvedValue({
      code: 200,
      message: 'ok',
      timestamp: '2026-03-18T08:00:00Z',
      data: {
        content: [plan]
      }
    })

    const { planApi } = await import('@/features/plan/api/planApi')
    const result = await planApi.getAllPlans()

    expect(result.data).toHaveLength(1)
    expect(result.data?.[0]).toMatchObject(plan)
  })
})
