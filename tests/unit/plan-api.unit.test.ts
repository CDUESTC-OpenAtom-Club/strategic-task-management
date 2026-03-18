import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiGetMock = vi.fn()

vi.mock('@/5-shared/lib/api', () => ({
  apiClient: {
    get: apiGetMock
  }
}))

vi.mock('@/3-features/approval/api/approval', () => ({
  approvalApi: {}
}))

describe('planApi.getAllPlans', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
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

    const { planApi } = await import('@/3-features/plan/api/planApi')
    const result = await planApi.getAllPlans()

    expect(apiGetMock).toHaveBeenCalledWith('/plans')
    expect(result.data).toEqual([plan])
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

    const { planApi } = await import('@/3-features/plan/api/planApi')
    const result = await planApi.getAllPlans()

    expect(result.data).toEqual([plan])
  })
})
