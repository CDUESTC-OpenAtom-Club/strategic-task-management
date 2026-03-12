/**
 * Unit Tests for Strategic Indicator Calculations
 * 
 * Tests for features/strategic-indicator/lib/calculations.ts
 */

import { describe, it, expect } from 'vitest'
import {
  calculateCompletionRate,
  calculateWeightedCompletionRate,
  validateWeightSum,
  calculateRemainingWeight,
  normalizeWeights,
  calculateProgress,
  formatWeightAsPercentage,
  calculateAggregateStatistics
} from '@/features/strategic-indicator/lib/calculations'
import type { Indicator } from '@/entities/indicator/model/types'

describe('Strategic Indicator Calculations', () => {
  const mockIndicator: Partial<Indicator> = {
    id: 1,
    name: 'Test Indicator',
    targetValue: 100,
    actualValue: 80,
    weight: 0.5,
    completionRate: 80
  }

  describe('calculateCompletionRate', () => {
    it('should calculate completion rate correctly', () => {
      expect(calculateCompletionRate(100, 80)).toBe(80)
      expect(calculateCompletionRate(50, 25)).toBe(50)
      expect(calculateCompletionRate(100, 120)).toBe(100) // capped at 100
    })

    it('should handle zero target value', () => {
      expect(calculateCompletionRate(0, 50)).toBe(0)
      expect(calculateCompletionRate(undefined, 50)).toBe(0)
    })

    it('should handle zero actual value', () => {
      expect(calculateCompletionRate(100, 0)).toBe(0)
      expect(calculateCompletionRate(100, undefined)).toBe(0)
    })
  })

  describe('calculateWeightedCompletionRate', () => {
    const indicators = [
      { ...mockIndicator, weight: 0.6, targetValue: 100, actualValue: 80 }, // 80% completion
      { ...mockIndicator, weight: 0.4, targetValue: 100, actualValue: 90 }  // 90% completion
    ] as Indicator[]

    it('should calculate weighted completion rate', () => {
      const result = calculateWeightedCompletionRate(indicators)
      expect(result).toBe(84) // (80 * 0.6) + (90 * 0.4) = 84
    })

    it('should handle zero total weight', () => {
      const zeroWeightIndicators = [
        { ...mockIndicator, weight: 0, targetValue: 100, actualValue: 80 }
      ] as Indicator[]
      
      expect(calculateWeightedCompletionRate(zeroWeightIndicators)).toBe(0)
    })
  })

  describe('validateWeightSum', () => {
    it('should validate correct weight sum', () => {
      const indicators = [
        { ...mockIndicator, weight: 0.6 },
        { ...mockIndicator, weight: 0.4 }
      ] as Indicator[]
      
      expect(validateWeightSum(indicators)).toBe(true)
    })

    it('should reject incorrect weight sum', () => {
      const indicators = [
        { ...mockIndicator, weight: 0.7 },
        { ...mockIndicator, weight: 0.4 }
      ] as Indicator[]
      
      expect(validateWeightSum(indicators)).toBe(false)
    })

    it('should handle tolerance', () => {
      const indicators = [
        { ...mockIndicator, weight: 0.51 },
        { ...mockIndicator, weight: 0.49 }
      ] as Indicator[]
      
      expect(validateWeightSum(indicators, 0.01)).toBe(true)
      // Note: Exact tolerance behavior may vary due to floating point precision
    })
  })

  describe('calculateRemainingWeight', () => {
    it('should calculate remaining weight correctly', () => {
      const indicators = [
        { ...mockIndicator, weight: 0.3 },
        { ...mockIndicator, weight: 0.4 }
      ] as Indicator[]
      
      expect(calculateRemainingWeight(indicators)).toBeCloseTo(0.3, 10)
    })

    it('should return zero when weights exceed 1.0', () => {
      const indicators = [
        { ...mockIndicator, weight: 0.7 },
        { ...mockIndicator, weight: 0.5 }
      ] as Indicator[]
      
      expect(calculateRemainingWeight(indicators)).toBe(0)
    })
  })

  describe('normalizeWeights', () => {
    it('should normalize weights proportionally', () => {
      const indicators = [
        { ...mockIndicator, weight: 0.6 },
        { ...mockIndicator, weight: 0.9 }
      ] as Indicator[]
      
      const normalized = normalizeWeights(indicators)
      expect(normalized[0].weight).toBeCloseTo(0.4, 10) // 0.6 / 1.5
      expect(normalized[1].weight).toBeCloseTo(0.6, 10) // 0.9 / 1.5
    })

    it('should distribute equally when all weights are zero', () => {
      const indicators = [
        { ...mockIndicator, weight: 0 },
        { ...mockIndicator, weight: 0 }
      ] as Indicator[]
      
      const normalized = normalizeWeights(indicators)
      expect(normalized[0].weight).toBe(0.5)
      expect(normalized[1].weight).toBe(0.5)
    })
  })

  describe('calculateProgress', () => {
    it('should calculate progress correctly', () => {
      expect(calculateProgress(80, 100)).toBe(80)
      expect(calculateProgress(120, 100)).toBe(100) // capped at 100
    })

    it('should handle zero values', () => {
      expect(calculateProgress(0, 100)).toBe(0)
      expect(calculateProgress(50, 0)).toBe(0)
      expect(calculateProgress(undefined, 100)).toBe(0)
    })
  })

  describe('formatWeightAsPercentage', () => {
    it('should format weight as percentage', () => {
      expect(formatWeightAsPercentage(0.75)).toBe('75.0%')
      expect(formatWeightAsPercentage(0.333, 2)).toBe('33.30%')
    })

    it('should handle undefined weight', () => {
      expect(formatWeightAsPercentage(undefined)).toBe('0%')
    })
  })

  describe('calculateAggregateStatistics', () => {
    const indicators = [
      { ...mockIndicator, completionRate: 100, weight: 0.4, targetValue: 100, actualValue: 100 },
      { ...mockIndicator, completionRate: 80, weight: 0.6, targetValue: 100, actualValue: 80 }
    ] as Indicator[]

    it('should calculate aggregate statistics', () => {
      const stats = calculateAggregateStatistics(indicators)
      
      expect(stats.totalCount).toBe(2)
      expect(stats.completedCount).toBe(1) // only one with 100% completion
      expect(stats.averageCompletion).toBe(90) // (100 + 80) / 2
      expect(stats.totalWeight).toBe(1.0)
      expect(stats.weightedCompletion).toBe(88) // (100 * 0.4) + (80 * 0.6)
    })

    it('should handle empty indicators', () => {
      const stats = calculateAggregateStatistics([])
      
      expect(stats.totalCount).toBe(0)
      expect(stats.completedCount).toBe(0)
      expect(stats.averageCompletion).toBe(0)
      expect(stats.totalWeight).toBe(0)
      expect(stats.weightedCompletion).toBe(0)
    })
  })
})