/**
 * Unit Tests for Strategic Indicator Store
 *
 * Tests for features/strategic-indicator/model/store.ts
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useIndicatorStore } from '@/features/strategic-indicator/model/store'
import type { Indicator } from '@/entities/indicator/model/types'

// Mock API modules
vi.mock('@/features/strategic-indicator/api/query', () => ({
  queryIndicators: vi.fn(),
  getIndicatorById: vi.fn()
}))

vi.mock('@/features/strategic-indicator/api/mutations', () => ({
  createIndicator: vi.fn(),
  updateIndicator: vi.fn(),
  deleteIndicator: vi.fn(),
  distributeIndicator: vi.fn(),
  withdrawIndicator: vi.fn(),
  submitIndicatorForApproval: vi.fn()
}))

describe('Strategic Indicator Store', () => {
  let indicatorStore: ReturnType<typeof useIndicatorStore>

  const mockIndicator: Indicator = {
    id: 1,
    name: 'Test Indicator',
    description: 'Test Description',
    type: 'QUANTITATIVE',
    unit: 'units',
    targetValue: 100,
    actualValue: 80,
    completionRate: 80,
    weight: 0.5,
    level: 'STRATEGIC',
    status: 'DISTRIBUTED',
    year: 2026,
    taskId: 1,
    ownerOrgId: 1,
    targetOrgId: 2,
    createdAt: '2026-03-12T00:00:00Z',
    updatedAt: '2026-03-12T00:00:00Z'
  }

  const mockIndicatorList = [
    mockIndicator,
    {
      ...mockIndicator,
      id: 2,
      name: 'Test Indicator 2',
      status: 'COMPLETED',
      completionRate: 100,
      weight: 0.3,
      level: 'OPERATIONAL'
    } as Indicator
  ]

  beforeEach(() => {
    setActivePinia(createPinia())
    indicatorStore = useIndicatorStore()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      expect(indicatorStore.indicators).toEqual([])
      expect(indicatorStore.total).toBe(0)
      expect(indicatorStore.loading).toBe(false)
      expect(indicatorStore.error).toBe(null)
      expect(indicatorStore.currentIndicator).toBe(null)
      expect(indicatorStore.filters).toEqual({
        page: 0,
        size: 20
      })
    })
  })

  describe('Computed Properties', () => {
    beforeEach(() => {
      indicatorStore.indicators = mockIndicatorList
      indicatorStore.total = 2
    })

    it('should compute listState correctly', () => {
      const listState = indicatorStore.listState

      expect(listState.items).toEqual(mockIndicatorList)
      expect(listState.total).toBe(2)
      expect(listState.loading).toBe(false)
      expect(listState.error).toBe(null)
    })

    it('should compute statistics correctly', () => {
      const stats = indicatorStore.statistics

      expect(stats.total).toBe(2)
      expect(stats.byStatus).toEqual({
        DISTRIBUTED: 1,
        COMPLETED: 1
      })
      expect(stats.byLevel).toEqual({
        STRATEGIC: 1,
        OPERATIONAL: 1
      })
      expect(stats.completionRate).toBe(80) // Weighted: (80 + 80) / (100 + 100) * 100
    })

    it('should handle empty indicators in statistics', () => {
      indicatorStore.indicators = []
      const stats = indicatorStore.statistics

      expect(stats.total).toBe(0)
      expect(stats.byStatus).toEqual({})
      expect(stats.byLevel).toEqual({})
      expect(stats.completionRate).toBe(0)
    })

    it('should handle indicators without target/actual values', () => {
      indicatorStore.indicators = [
        { ...mockIndicator, targetValue: undefined, actualValue: undefined }
      ]
      const stats = indicatorStore.statistics

      expect(stats.completionRate).toBe(0)
    })
  })

  describe('Fetch Indicators', () => {
    it('should fetch indicators successfully', async () => {
      const mockQuery = await import('@/features/strategic-indicator/api/query')

      mockQuery.queryIndicators.mockResolvedValue({
        content: mockIndicatorList,
        totalElements: 2
      })

      await indicatorStore.fetchIndicators()

      expect(mockQuery.queryIndicators).toHaveBeenCalledWith({
        page: 0,
        size: 20
      })
      expect(indicatorStore.indicators).toEqual(mockIndicatorList)
      expect(indicatorStore.total).toBe(2)
      expect(indicatorStore.loading).toBe(false)
      expect(indicatorStore.error).toBe(null)
    })

    it('should handle fetch indicators error', async () => {
      const mockQuery = await import('@/features/strategic-indicator/api/query')
      const error = new Error('Network error')

      mockQuery.queryIndicators.mockRejectedValue(error)

      await expect(indicatorStore.fetchIndicators()).rejects.toThrow('Network error')
      expect(indicatorStore.error).toBe('Network error')
      expect(indicatorStore.loading).toBe(false)
    })

    it('should update filters when provided', async () => {
      const mockQuery = await import('@/features/strategic-indicator/api/query')

      mockQuery.queryIndicators.mockResolvedValue({
        content: [],
        totalElements: 0
      })

      const newFilters = { page: 1, size: 10, status: 'ACTIVE' }
      await indicatorStore.fetchIndicators(newFilters)

      expect(indicatorStore.filters).toEqual({
        page: 1,
        size: 10,
        status: 'ACTIVE'
      })
    })
  })

  describe('Fetch Indicator By ID', () => {
    it('should fetch indicator by ID successfully', async () => {
      const mockQuery = await import('@/features/strategic-indicator/api/query')

      mockQuery.getIndicatorById.mockResolvedValue(mockIndicator)

      const result = await indicatorStore.fetchIndicatorById(1)

      expect(mockQuery.getIndicatorById).toHaveBeenCalledWith(1)
      expect(result).toEqual(mockIndicator)
      expect(indicatorStore.currentIndicator).toEqual(mockIndicator)
      expect(indicatorStore.loading).toBe(false)
    })

    it('should handle fetch indicator by ID error', async () => {
      const mockQuery = await import('@/features/strategic-indicator/api/query')
      const error = new Error('Not found')

      mockQuery.getIndicatorById.mockRejectedValue(error)

      await expect(indicatorStore.fetchIndicatorById(1)).rejects.toThrow('Not found')
      expect(indicatorStore.error).toBe('Not found')
    })
  })

  describe('Create Indicator', () => {
    it('should create indicator successfully', async () => {
      const mockMutations = await import('@/features/strategic-indicator/api/mutations')
      const newIndicatorData = { name: 'New Indicator', type: 'QUANTITATIVE' }
      const createdIndicator = { ...mockIndicator, id: 3, ...newIndicatorData }

      mockMutations.createIndicator.mockResolvedValue(createdIndicator)

      const result = await indicatorStore.createIndicator(newIndicatorData)

      expect(mockMutations.createIndicator).toHaveBeenCalledWith(
        expect.objectContaining(newIndicatorData)
      )
      expect(result).toEqual(createdIndicator)
      expect(indicatorStore.indicators[0]).toEqual(createdIndicator)
      expect(indicatorStore.total).toBe(1)
    })

    it('should handle create indicator error', async () => {
      const mockMutations = await import('@/features/strategic-indicator/api/mutations')
      const error = new Error('Validation error')

      mockMutations.createIndicator.mockRejectedValue(error)

      await expect(indicatorStore.createIndicator({})).rejects.toThrow('Validation error')
      expect(indicatorStore.error).toBe('Validation error')
    })
  })

  describe('Update Indicator', () => {
    beforeEach(() => {
      indicatorStore.indicators = [mockIndicator]
      indicatorStore.currentIndicator = mockIndicator
    })

    it('should update indicator successfully', async () => {
      const mockMutations = await import('@/features/strategic-indicator/api/mutations')
      const updateData = { name: 'Updated Name' }
      const updatedIndicator = { ...mockIndicator, ...updateData }

      mockMutations.updateIndicator.mockResolvedValue(updatedIndicator)

      const result = await indicatorStore.updateIndicator(1, updateData)

      expect(mockMutations.updateIndicator).toHaveBeenCalledWith(1, updateData)
      expect(result).toEqual(updatedIndicator)
      expect(indicatorStore.indicators[0]).toEqual(updatedIndicator)
      expect(indicatorStore.currentIndicator).toEqual(updatedIndicator)
    })

    it('should handle update indicator error', async () => {
      const mockMutations = await import('@/features/strategic-indicator/api/mutations')
      const error = new Error('Update failed')

      mockMutations.updateIndicator.mockRejectedValue(error)

      await expect(indicatorStore.updateIndicator(1, {})).rejects.toThrow('Update failed')
      expect(indicatorStore.error).toBe('Update failed')
    })
  })

  describe('Delete Indicator', () => {
    beforeEach(() => {
      indicatorStore.indicators = [mockIndicator]
      indicatorStore.currentIndicator = mockIndicator
      indicatorStore.total = 1
    })

    it('should delete indicator successfully', async () => {
      const mockMutations = await import('@/features/strategic-indicator/api/mutations')

      mockMutations.deleteIndicator.mockResolvedValue(undefined)

      await indicatorStore.deleteIndicator(1)

      expect(mockMutations.deleteIndicator).toHaveBeenCalledWith(1)
      expect(indicatorStore.indicators).toEqual([])
      expect(indicatorStore.currentIndicator).toBe(null)
      expect(indicatorStore.total).toBe(0)
    })

    it('should handle delete indicator error', async () => {
      const mockMutations = await import('@/features/strategic-indicator/api/mutations')
      const error = new Error('Delete failed')

      mockMutations.deleteIndicator.mockRejectedValue(error)

      await expect(indicatorStore.deleteIndicator(1)).rejects.toThrow('Delete failed')
      expect(indicatorStore.error).toBe('Delete failed')
    })
  })

  describe('Distribute Indicator', () => {
    it('should distribute indicator successfully', async () => {
      const mockMutations = await import('@/features/strategic-indicator/api/mutations')
      const mockQuery = await import('@/features/strategic-indicator/api/query')

      mockMutations.distributeIndicator.mockResolvedValue({ success: true })
      mockQuery.getIndicatorById.mockResolvedValue(mockIndicator)

      const result = await indicatorStore.distributeIndicator(
        1,
        [2, 3],
        'Test message',
        '2026-12-31'
      )

      expect(mockMutations.distributeIndicator).toHaveBeenCalledWith(1, {
        targetOrgIds: [2, 3],
        message: 'Test message',
        deadline: '2026-12-31'
      })
      expect(mockQuery.getIndicatorById).toHaveBeenCalledWith(1)
      expect(result).toEqual({ success: true })
    })
  })

  describe('Utility Actions', () => {
    it('should reset filters', () => {
      indicatorStore.filters = { page: 5, size: 50, status: 'ACTIVE' }

      indicatorStore.resetFilters()

      expect(indicatorStore.filters).toEqual({
        page: 0,
        size: 20
      })
    })

    it('should clear error', () => {
      indicatorStore.error = 'Some error'

      indicatorStore.clearError()

      expect(indicatorStore.error).toBe(null)
    })
  })
})
