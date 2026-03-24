import { beforeEach, describe, expect, it, vi } from 'vitest'
import { alertApi } from '@/shared/api/monitoringApi'

const apiClientMock = vi.hoisted(() => ({
  get: vi.fn()
}))

vi.mock('@/shared/api/client', () => ({
  apiClient: apiClientMock
}))

describe('monitoring api compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prefers /alerts/events/unclosed and falls back to /alerts/unresolved on 404', async () => {
    apiClientMock.get
      .mockRejectedValueOnce({ status: 404, code: 404, message: 'not found' })
      .mockResolvedValueOnce({
        data: [
          {
            id: 1,
            ruleId: 101,
            ruleName: '告警',
            entityType: 'indicator',
            entityId: 1001,
            severity: 'CRITICAL',
            message: 'fallback',
            status: 'OPEN',
            triggeredAt: '2026-03-24T13:00:00Z'
          }
        ]
      })

    const result = await alertApi.getUnclosedAlerts()

    expect(apiClientMock.get).toHaveBeenNthCalledWith(1, '/alerts/events/unclosed')
    expect(apiClientMock.get).toHaveBeenNthCalledWith(2, '/alerts/unresolved')
    expect(result).toHaveLength(1)
  })

  it('degrades to empty alerts and stops retrying after both endpoints return 404', async () => {
    apiClientMock.get
      .mockRejectedValueOnce({ status: 404, code: 404, message: 'not found' })
      .mockRejectedValueOnce({ status: 404, code: 404, message: 'not found' })

    const first = await alertApi.getUnclosedAlerts()
    const second = await alertApi.getUnclosedAlerts()
    const stats = await alertApi.getStats()

    expect(first).toEqual([])
    expect(second).toEqual([])
    expect(stats).toEqual({
      totalOpen: 0,
      countBySeverity: {
        CRITICAL: 0,
        MAJOR: 0,
        MINOR: 0
      }
    })
    expect(apiClientMock.get).toHaveBeenCalledTimes(2)
  })
})
