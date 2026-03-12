/**
 * Unit Tests for Number Formatting Utilities
 * 
 * Tests for shared/lib/format/number.ts functions
 */

import { describe, it, expect } from 'vitest'
import {
  formatNumber,
  formatCurrency,
  formatPercentage,
  formatFileSize,
  parseNumber,
  clamp,
  roundTo
} from '@/shared/lib/format/number'

describe('Number Formatting Utilities', () => {
  describe('formatNumber', () => {
    it('should format number with default decimals', () => {
      expect(formatNumber(1234.567)).toBe('1,234.57')
    })

    it('should format number with custom decimals', () => {
      expect(formatNumber(1234.567, 1)).toBe('1,234.6')
      expect(formatNumber(1234.567, 0)).toBe('1,235')
      expect(formatNumber(1234.567, 3)).toBe('1,234.567')
    })

    it('should handle zero', () => {
      expect(formatNumber(0)).toBe('0.00')
    })

    it('should handle negative numbers', () => {
      expect(formatNumber(-1234.567)).toBe('-1,234.57')
    })

    it('should handle large numbers', () => {
      expect(formatNumber(1234567.89)).toBe('1,234,567.89')
    })
  })

  describe('formatCurrency', () => {
    it('should format currency with default CNY', () => {
      const result = formatCurrency(1234.56)
      expect(result).toContain('1,234.56')
      expect(result).toContain('¥') // CNY symbol
    })

    it('should format currency with custom currency', () => {
      const result = formatCurrency(1234.56, 'USD')
      expect(result).toContain('1,234.56')
      // USD formatting may vary by locale
    })

    it('should handle zero amount', () => {
      const result = formatCurrency(0)
      expect(result).toContain('0.00')
    })

    it('should handle negative amounts', () => {
      const result = formatCurrency(-1234.56)
      expect(result).toContain('1,234.56')
    })
  })

  describe('formatPercentage', () => {
    it('should format percentage with default decimals', () => {
      expect(formatPercentage(85.67)).toBe('85.7%')
    })

    it('should format percentage with custom decimals', () => {
      expect(formatPercentage(85.67, 0)).toBe('86%')
      expect(formatPercentage(85.67, 2)).toBe('85.67%')
    })

    it('should handle zero percentage', () => {
      expect(formatPercentage(0)).toBe('0.0%')
    })

    it('should handle 100 percentage', () => {
      expect(formatPercentage(100)).toBe('100.0%')
    })
  })

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(0)).toBe('0 B')
      expect(formatFileSize(512)).toBe('512 B')
    })

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB')
      expect(formatFileSize(1536)).toBe('1.5 KB')
    })

    it('should format megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1 MB')
      expect(formatFileSize(1024 * 1024 * 1.5)).toBe('1.5 MB')
    })

    it('should format gigabytes', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB')
      expect(formatFileSize(1024 * 1024 * 1024 * 2.5)).toBe('2.5 GB')
    })

    it('should format terabytes', () => {
      expect(formatFileSize(1024 * 1024 * 1024 * 1024)).toBe('1 TB')
    })
  })

  describe('parseNumber', () => {
    it('should parse clean number string', () => {
      expect(parseNumber('123.45')).toBe(123.45)
    })

    it('should parse number with commas', () => {
      expect(parseNumber('1,234.56')).toBe(1234.56)
    })

    it('should parse number with currency symbols', () => {
      expect(parseNumber('¥1,234.56')).toBe(1234.56)
      expect(parseNumber('$1,234.56')).toBe(1234.56)
    })

    it('should parse negative numbers', () => {
      expect(parseNumber('-123.45')).toBe(-123.45)
    })

    it('should return null for invalid input', () => {
      expect(parseNumber('abc')).toBe(null)
      expect(parseNumber('')).toBe(null)
      expect(parseNumber('not a number')).toBe(null)
    })

    it('should handle mixed text and numbers', () => {
      expect(parseNumber('Price: $123.45')).toBe(123.45)
    })
  })

  describe('clamp', () => {
    it('should clamp value within range', () => {
      expect(clamp(5, 0, 10)).toBe(5)
    })

    it('should clamp value to minimum', () => {
      expect(clamp(-5, 0, 10)).toBe(0)
    })

    it('should clamp value to maximum', () => {
      expect(clamp(15, 0, 10)).toBe(10)
    })

    it('should handle equal min and max', () => {
      expect(clamp(5, 3, 3)).toBe(3)
    })

    it('should handle negative ranges', () => {
      expect(clamp(-5, -10, -1)).toBe(-5)
      expect(clamp(-15, -10, -1)).toBe(-10)
      expect(clamp(0, -10, -1)).toBe(-1)
    })
  })

  describe('roundTo', () => {
    it('should round to specified decimal places', () => {
      expect(roundTo(123.456, 2)).toBe(123.46)
      expect(roundTo(123.456, 1)).toBe(123.5)
      expect(roundTo(123.456, 0)).toBe(123)
    })

    it('should handle negative numbers', () => {
      expect(roundTo(-123.456, 2)).toBe(-123.46)
    })

    it('should handle zero decimals', () => {
      expect(roundTo(123.456, 0)).toBe(123)
      expect(roundTo(123.6, 0)).toBe(124)
    })

    it('should handle large decimal places', () => {
      expect(roundTo(123.123456789, 5)).toBe(123.12346)
    })

    it('should handle zero', () => {
      expect(roundTo(0, 2)).toBe(0)
    })
  })
})