/**
 * Strategic Indicator API Integration Tests
 * 
 * Tests the integration between the strategic indicator API layer and the backend.
 * Validates API calls, error handling, and data transformation.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useIndicatorStore } from '@/features/strategic-indicator/model/store'
import { getIndicatorById } from '@/features/strategic-indicator/api/query'
import type { Indicator } from '@/entities/indicator/model/types'

// Mock the API client
vi.mock('@/shared/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

describe('Strategic Indicator API Integration', () => {
  let indicatorStore: ReturnType<typeof useIndicatorStore>

  const mockIndicator: Indicator = {
    id: 1,
    name: 'Test Strategic Indicator',
    description: 'Integration test indicator',
    type: 'QUANTITATIVE',
    unit: 'units',
    targetValue: 100,
    actualValue: 75,
    completionRate: 75,
    weight: 0.6,
    level: 'STRATEGIC',
    status: 'DISTRIBUTED',
    year: 2026,
    taskId: 1,
    ownerOrgId: 1,
    targetOrgId: 2,
    createdAt: '2026-03-12T10:00:00Z',
    updatedAt: '2026-03-12T10:00:00Z'
  }

  const mockApiResponse = {
    data: {
      content: [mockIndicator],
      totalElements: 1,
      totalPages: 1,
      size: 20,
      number: 0
    }
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    indicatorStore = useIndicatorStore()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Query Operations', () => {
    it('should fetch indicators through API and update store', async () => {
      const { apiClient } = await import('@/shared/lib/api/client')
      
      // Mock successful API response
      vi.mocked(apiClient.get).mockResolvedValue(mockApiResponse)

      // Call store method which uses the API
      await indicatorStore.fetchIndicators()

      // Verify API was called correctly
      expect(apiClient.get).toHaveBeenCalledWith('/indicators', {
        page: 0,
        size: 20
      })

      // Verify store was updated
      expect(indicatorStore.indicators).toEqual([mockIndicator])
      expect(indicatorStore.total).toBe(1)
      expect(indicatorStore.loading).toBe(false)
      expect(indicatorStore.error).toBe(null)
    })

    it('should handle API errors gracefully', async () => {
      const { apiClient } = await import('@/shared/lib/api/client')
      const apiError = new Error('Network error')
      
      vi.mocked(apiClient.get).mockRejectedValue(apiError)

      // Expect the store method to throw
      await expect(indicatorStore.fetchIndicators()).rejects.toThrow('Network error')

      // Verify error state
      expect(indicatorStore.error).toBe('Network error')
      expect(indicatorStore.loading).toBe(false)
      expect(indicatorStore.indicators).toEqual([])
    })

    it('should fetch indicator by ID with correct API call', async () => {
      const { apiClient } = await import('@/shared/lib/api/client')
      
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockIndicator })

      const result = await getIndicatorById(1)

      expect(apiClient.get).toHaveBeenCalledWith('/indicators/1')
      expect(result).toEqual(mockIndicator)
    })

    it('should apply filters correctly in API calls', async () => {
      const { apiClient } = await import('@/shared/lib/api/client')
      
      vi.mocked(apiClient.get).mockResolvedValue(mockApiResponse)

      const filters = {
        page: 1,
        size: 10,
        status: 'ACTIVE',
        level: 'STRATEGIC'
      }

      await indicatorStore.fetchIndicators(filters)

      expect(apiClient.get).toHaveBeenCalledWith('/indicators', filters)
      expect(indicatorStore.filters).toEqual(filters)
    })
  })

  describe('Mutation Operations', () => {
    it('should create indicator through API and update store', async () => {
      const { apiClient } = await import('@/shared/lib/api/client')
      const newIndicatorData = {
        name: 'New Indicator',
        description: 'Test creation',
        type: 'QUANTITATIVE' as const,
        unit: 'units',
        targetValue: 200
      }
      const createdIndicator = { ...mockIndicator, id: 2, ...newIndicatorData }
      
      vi.mocked(apiClient.post).mockResolvedValue({ data: createdIndicator })

      // Ensure store starts with empty state
      expect(indicatorStore.indicators).toHaveLength(0)
      expect(indicatorStore.total).toBe(0)

      const result = await indicatorStore.createIndicator(newIndicatorData)

      expect(apiClient.post).toHaveBeenCalledWith('/indicators', newIndicatorData)
      expect(result).toEqual(createdIndicator)
      expect(indicatorStore.indicators).toHaveLength(1)
      expect(indicatorStore.indicators[0]).toEqual(createdIndicator)
      expect(indicatorStore.total).toBe(1)
    })

    it('should update indicator through API and sync store', async () => {
      const { apiClient } = await import('@/shared/lib/api/client')
      
      // Set initial state
      indicatorStore.indicators = [mockIndicator]
      indicatorStore.currentIndicator = mockIndicator

      const updateData = { name: 'Updated Name', targetValue: 150 }
      const updatedIndicator = { ...mockIndicator, ...updateData }
      
      vi.mocked(apiClient.put).mockResolvedValue({ data: updatedIndicator })

      const result = await indicatorStore.updateIndicator(1, updateData)

      expect(apiClient.put).toHaveBeenCalledWith('/indicators/1', updateData)
      expect(result).toEqual(updatedIndicator)
      expect(indicatorStore.indicators[0]).toEqual(updatedIndicator)
      expect(indicatorStore.currentIndicator).toEqual(updatedIndicator)
    })

    it('should delete indicator through API and remove from store', async () => {
      const { apiClient } = await import('@/shared/lib/api/client')
      
      // Set initial state
      indicatorStore.indicators = [mockIndicator]
      indicatorStore.currentIndicator = mockIndicator
      indicatorStore.total = 1
      
      vi.mocked(apiClient.delete).mockResolvedValue({ data: null })

      await indicatorStore.deleteIndicator(1)

      expect(apiClient.delete).toHaveBeenCalledWith('/indicators/1')
      expect(indicatorStore.indicators).toEqual([])
      expect(indicatorStore.currentIndicator).toBe(null)
      expect(indicatorStore.total).toBe(0)
    })

    it('should handle mutation errors and preserve store state', async () => {
      const { apiClient } = await import('@/shared/lib/api/client')
      const originalIndicators = [mockIndicator]
      
      // Set initial state
      indicatorStore.indicators = [...originalIndicators]
      
      const apiError = new Error('Validation failed')
      vi.mocked(apiClient.post).mockRejectedValue(apiError)

      await expect(indicatorStore.createIndicator({})).rejects.toThrow('Validation failed')

      // Verify store state is preserved
      expect(indicatorStore.indicators).toEqual(originalIndicators)
      expect(indicatorStore.error).toBe('Validation failed')
    })
  })

  describe('API Response Transformation', () => {
    it('should handle paginated responses correctly', async () => {
      const { apiClient } = await import('@/shared/lib/api/client')
      const paginatedResponse = {
        data: {
          content: [mockIndicator, { ...mockIndicator, id: 2 }],
          totalElements: 25,
          totalPages: 3,
          size: 10,
          number: 1
        }
      }
      
      vi.mocked(apiClient.get).mockResolvedValue(paginatedResponse)

      await indicatorStore.fetchIndicators({ page: 1, size: 10 })

      expect(indicatorStore.indicators).toHaveLength(2)
      expect(indicatorStore.total).toBe(25)
    })

    it('should handle empty responses', async () => {
      const { apiClient } = await import('@/shared/lib/api/client')
      const emptyResponse = {
        data: {
          content: [],
          totalElements: 0,
          totalPages: 0,
          size: 20,
          number: 0
        }
      }
      
      vi.mocked(apiClient.get).mockResolvedValue(emptyResponse)

      await indicatorStore.fetchIndicators()

      expect(indicatorStore.indicators).toEqual([])
      expect(indicatorStore.total).toBe(0)
      expect(indicatorStore.error).toBe(null)
    })
  })

  describe('Concurrent API Calls', () => {
    it('should handle multiple simultaneous API calls', async () => {
      const { apiClient } = await import('@/shared/lib/api/client')
      
      vi.mocked(apiClient.get).mockResolvedValue(mockApiResponse)

      // Make multiple concurrent calls
      const promises = [
        indicatorStore.fetchIndicators(),
        indicatorStore.fetchIndicators({ status: 'ACTIVE' }),
        indicatorStore.fetchIndicators({ level: 'STRATEGIC' })
      ]

      await Promise.all(promises)

      // Verify all calls were made
      expect(apiClient.get).toHaveBeenCalledTimes(3)
      expect(indicatorStore.loading).toBe(false)
    })

    it('should handle mixed success and failure scenarios', async () => {
      const { apiClient } = await import('@/shared/lib/api/client')
      
      // Mock different responses for different calls
      vi.mocked(apiClient.get)
        .mockResolvedValueOnce(mockApiResponse)
        .mockRejectedValueOnce(new Error('Network error'))

      // First call should succeed
      await indicatorStore.fetchIndicators()
      expect(indicatorStore.indicators).toEqual([mockIndicator])

      // Second call should fail
      await expect(indicatorStore.fetchIndicators()).rejects.toThrow('Network error')
      expect(indicatorStore.error).toBe('Network error')
    })
  })
})