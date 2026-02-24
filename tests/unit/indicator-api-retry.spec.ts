/**
 * Unit tests for Indicator API retry logic
 * 
 * Tests the explicit retry mechanism with exponential backoff
 * for critical indicator operations.
 * 
 * **Validates: Requirements 2.4**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { indicatorApi } from '@/api/indicator'
import { apiClient } from '@/shared/api/client'
import type { IndicatorCreateRequest } from '@/api/indicator'

// Mock the apiClient
vi.mock('@/shared/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

// Mock the logger
vi.mock('@/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn()
  }
}))

describe('Indicator API - Retry Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('createIndicator', () => {
    it('should succeed on first attempt', async () => {
      const mockResponse = {
        code: 200,
        message: 'Success',
        data: { indicatorId: 1, indicatorDesc: 'Test Indicator' }
      }

      vi.mocked(apiClient.post).mockResolvedValueOnce(mockResponse)

      const request: IndicatorCreateRequest = {
        taskId: 1,
        indicatorDesc: 'Test Indicator'
      }

      const result = await indicatorApi.createIndicator(request)

      expect(result).toEqual(mockResponse)
      expect(apiClient.post).toHaveBeenCalledTimes(1)
    })

    it('should retry up to 3 times on failure', async () => {
      const error = new Error('Network error')
      vi.mocked(apiClient.post)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)

      const request: IndicatorCreateRequest = {
        taskId: 1,
        indicatorDesc: 'Test Indicator'
      }

      const promise = indicatorApi.createIndicator(request)

      // Fast-forward through retry delays
      await vi.advanceTimersByTimeAsync(1000) // First retry after 1s
      await vi.advanceTimersByTimeAsync(2000) // Second retry after 2s
      await vi.advanceTimersByTimeAsync(3000) // Third retry after 3s

      await expect(promise).rejects.toThrow('Network error')
      expect(apiClient.post).toHaveBeenCalledTimes(3)
    })

    it('should succeed on second attempt', async () => {
      const error = new Error('Temporary error')
      const mockResponse = {
        code: 200,
        message: 'Success',
        data: { indicatorId: 1, indicatorDesc: 'Test Indicator' }
      }

      vi.mocked(apiClient.post)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(mockResponse)

      const request: IndicatorCreateRequest = {
        taskId: 1,
        indicatorDesc: 'Test Indicator'
      }

      const promise = indicatorApi.createIndicator(request)

      // Fast-forward through first retry delay
      await vi.advanceTimersByTimeAsync(1000)

      const result = await promise

      expect(result).toEqual(mockResponse)
      expect(apiClient.post).toHaveBeenCalledTimes(2)
    })
  })

  describe('updateIndicator', () => {
    it('should retry with exponential backoff', async () => {
      const error = new Error('Server error')
      const mockResponse = {
        code: 200,
        message: 'Success',
        data: { indicatorId: 1, indicatorDesc: 'Updated' }
      }

      vi.mocked(apiClient.put)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(mockResponse)

      const promise = indicatorApi.updateIndicator('1', { indicatorDesc: 'Updated' })

      // Verify exponential backoff: 1s, 2s
      await vi.advanceTimersByTimeAsync(1000) // First retry
      await vi.advanceTimersByTimeAsync(2000) // Second retry

      const result = await promise

      expect(result).toEqual(mockResponse)
      expect(apiClient.put).toHaveBeenCalledTimes(3)
    })
  })

  describe('deleteIndicator', () => {
    it('should retry delete operations', async () => {
      const error = new Error('Delete failed')
      const mockResponse = {
        code: 200,
        message: 'Deleted',
        data: undefined
      }

      vi.mocked(apiClient.delete)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(mockResponse)

      const promise = indicatorApi.deleteIndicator('1')

      await vi.advanceTimersByTimeAsync(1000)

      const result = await promise

      expect(result).toEqual(mockResponse)
      expect(apiClient.delete).toHaveBeenCalledTimes(2)
    })
  })

  describe('distributeIndicator', () => {
    it('should retry distribution operations', async () => {
      const error = new Error('Distribution failed')
      const mockResponse = {
        code: 200,
        message: 'Success',
        data: { indicatorId: 2, parentIndicatorId: 1 }
      }

      vi.mocked(apiClient.post)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(mockResponse)

      const request = {
        parentIndicatorId: '1',
        targetOrgId: '2'
      }

      const promise = indicatorApi.distributeIndicator(request)

      await vi.advanceTimersByTimeAsync(1000)

      const result = await promise

      expect(result).toEqual(mockResponse)
      expect(apiClient.post).toHaveBeenCalledTimes(2)
    })
  })

  describe('batchDistributeIndicator', () => {
    it('should retry batch distribution operations', async () => {
      const error = new Error('Batch distribution failed')
      const mockResponse = {
        code: 200,
        message: 'Success',
        data: [
          { indicatorId: 2, parentIndicatorId: 1 },
          { indicatorId: 3, parentIndicatorId: 1 }
        ]
      }

      vi.mocked(apiClient.post)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(mockResponse)

      const request = {
        parentIndicatorId: '1',
        targetOrgIds: ['2', '3']
      }

      const promise = indicatorApi.batchDistributeIndicator(request)

      await vi.advanceTimersByTimeAsync(1000)

      const result = await promise

      expect(result).toEqual(mockResponse)
      expect(apiClient.post).toHaveBeenCalledTimes(2)
    })
  })

  describe('Non-critical operations', () => {
    it('should NOT retry read operations like getAllIndicators', async () => {
      const error = new Error('Network error')
      vi.mocked(apiClient.get).mockRejectedValueOnce(error)

      await expect(indicatorApi.getAllIndicators()).rejects.toThrow('Network error')
      
      // Should only be called once (no retry)
      expect(apiClient.get).toHaveBeenCalledTimes(1)
    })

    it('should NOT retry getIndicatorById', async () => {
      const error = new Error('Not found')
      vi.mocked(apiClient.get).mockRejectedValueOnce(error)

      await expect(indicatorApi.getIndicatorById('1')).rejects.toThrow('Not found')
      
      // Should only be called once (no retry)
      expect(apiClient.get).toHaveBeenCalledTimes(1)
    })
  })
})
