import { beforeEach, describe, expect, it, vi } from 'vitest'
import { alertApi } from '@/shared/api/monitoringApi'

const apiClientMock = vi.hoisted(() => ({
  getAxiosInstance: vi.fn()
}))

vi.mock('@/shared/api/client', () => ({
  apiClient: apiClientMock
}))

describe('monitoring api compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiClientMock.getAxiosInstance.mockReturnValue({
      get: vi.fn()
    })
  })

  it('returns empty alerts by default when remote alerts api is disabled', async () => {
    const axiosGet = vi.fn()
    apiClientMock.getAxiosInstance.mockReturnValue({ get: axiosGet })

    const result = await alertApi.getUnclosedAlerts()

    expect(result).toEqual([])
    expect(axiosGet).not.toHaveBeenCalled()
  })

  it('returns empty stats by default when remote alerts api is disabled', async () => {
    const axiosGet = vi.fn()
    apiClientMock.getAxiosInstance.mockReturnValue({ get: axiosGet })

    const stats = await alertApi.getStats()

    expect(stats).toEqual({
      totalOpen: 0,
      countBySeverity: {
        CRITICAL: 0,
        MAJOR: 0,
        MINOR: 0
      }
    })
    expect(axiosGet).not.toHaveBeenCalled()
  })
})
