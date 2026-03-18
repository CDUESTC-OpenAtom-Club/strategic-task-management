import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cacheManager } from '@/5-shared/lib/utils/cache'

const apiGetMock = vi.fn()

vi.mock('@/5-shared/api/client', () => ({
  apiClient: {
    get: apiGetMock
  }
}))

describe('orgApi.getAllDepartments fallback', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    cacheManager.clear()
    cacheManager.resetStats()
  })

  it('falls back to /orgs when /organizations returns 403', async () => {
    apiGetMock
      .mockRejectedValueOnce({ code: 403, message: 'Forbidden' })
      .mockResolvedValueOnce({
        success: true,
        data: [
          {
            orgId: 11,
            orgName: '战略发展部',
            orgType: 'admin',
            sortOrder: 1
          }
        ]
      })

    const { orgApi } = await import('@/3-features/organization/api/org')
    const result = await orgApi.getAllDepartments()

    expect(apiGetMock).toHaveBeenNthCalledWith(1, '/organizations')
    expect(apiGetMock).toHaveBeenNthCalledWith(2, '/orgs')
    expect(result).toEqual([
      {
        id: '11',
        name: '战略发展部',
        type: 'strategic_dept',
        sortOrder: 1
      }
    ])
  })
})
