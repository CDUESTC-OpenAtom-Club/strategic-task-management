import { describe, it, expect, vi, beforeEach } from 'vitest'
import { indicatorApi } from '../indicator'
import { apiClient } from '@/shared/api/client'

// Mock the apiClient
vi.mock('@/shared/api/client', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  }
}))

describe('Indicator Review Workflow API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('submitIndicatorForReview', () => {
    it('should call POST /indicators/{id}/submit-review endpoint', async () => {
      const mockResponse = {
        code: 200,
        message: 'Success',
        data: {
          indicatorId: 1,
          status: 'PENDING_REVIEW',
          taskId: 1,
          taskName: 'Test Task',
          level: 'STRAT_TO_FUNC' as const,
          indicatorDesc: 'Test Indicator',
          weightPercent: 100,
          sortOrder: 1,
          year: 2024,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01'
        }
      }

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse)

      const result = await indicatorApi.submitIndicatorForReview('1')

      expect(apiClient.post).toHaveBeenCalledWith('/indicators/1/submit-review')
      expect(result).toEqual(mockResponse)
    })

    it('should retry on failure', async () => {
      const mockError = new Error('Network error')
      const mockSuccess = {
        code: 200,
        message: 'Success',
        data: { indicatorId: 1 }
      }

      vi.mocked(apiClient.post)
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce(mockSuccess)

      const result = await indicatorApi.submitIndicatorForReview('1')

      expect(apiClient.post).toHaveBeenCalledTimes(2)
      expect(result).toEqual(mockSuccess)
    })
  })

  describe('approveIndicatorReview', () => {
    it('should call POST /indicators/{id}/approve-review endpoint', async () => {
      const mockResponse = {
        code: 200,
        message: 'Success',
        data: {
          indicatorId: 1,
          status: 'DISTRIBUTED',
          taskId: 1,
          taskName: 'Test Task',
          level: 'STRAT_TO_FUNC' as const,
          indicatorDesc: 'Test Indicator',
          weightPercent: 100,
          sortOrder: 1,
          year: 2024,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01'
        }
      }

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse)

      const result = await indicatorApi.approveIndicatorReview('1')

      expect(apiClient.post).toHaveBeenCalledWith('/indicators/1/approve-review')
      expect(result).toEqual(mockResponse)
    })
  })

  describe('rejectIndicatorReview', () => {
    it('should call POST /indicators/{id}/reject-review endpoint with reason', async () => {
      const mockResponse = {
        code: 200,
        message: 'Success',
        data: {
          indicatorId: 1,
          status: 'DRAFT',
          taskId: 1,
          taskName: 'Test Task',
          level: 'STRAT_TO_FUNC' as const,
          indicatorDesc: 'Test Indicator',
          weightPercent: 100,
          sortOrder: 1,
          year: 2024,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01'
        }
      }

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse)

      const reason = '指标描述不够清晰'
      const result = await indicatorApi.rejectIndicatorReview('1', reason)

      expect(apiClient.post).toHaveBeenCalledWith(
        '/indicators/1/reject-review',
        { reason }
      )
      expect(result).toEqual(mockResponse)
    })

    it('should include reason in request body', async () => {
      const mockResponse = { code: 200, message: 'Success', data: {} }
      vi.mocked(apiClient.post).mockResolvedValue(mockResponse)

      const reason = '权重分配不合理'
      await indicatorApi.rejectIndicatorReview('123', reason)

      const callArgs = vi.mocked(apiClient.post).mock.calls[0]
      expect(callArgs[0]).toBe('/indicators/123/reject-review')
      expect(callArgs[1]).toEqual({ reason })
    })
  })

  describe('API function signatures', () => {
    it('should have correct function signatures', () => {
      expect(typeof indicatorApi.submitIndicatorForReview).toBe('function')
      expect(typeof indicatorApi.approveIndicatorReview).toBe('function')
      expect(typeof indicatorApi.rejectIndicatorReview).toBe('function')
    })

    it('submitIndicatorForReview should accept indicatorId parameter', () => {
      expect(indicatorApi.submitIndicatorForReview.length).toBe(1)
    })

    it('approveIndicatorReview should accept indicatorId parameter', () => {
      expect(indicatorApi.approveIndicatorReview.length).toBe(1)
    })

    it('rejectIndicatorReview should accept indicatorId and reason parameters', () => {
      expect(indicatorApi.rejectIndicatorReview.length).toBe(2)
    })
  })
})
