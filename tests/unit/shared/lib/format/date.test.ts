/**
 * Unit Tests for Date Formatting Utilities
 * 
 * Tests for shared/lib/format/date.ts functions
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  formatDate,
  formatDateShort,
  formatDateTime,
  formatTime,
  formatDateChinese,
  safeFormatDate,
  getRelativeTime,
  parseDate,
  isValidDate,
  getDateRange
} from '@/shared/lib/format/date'

describe('Date Formatting Utilities', () => {
  const testDate = new Date('2026-03-12T14:30:45')
  const testDateString = '2026-03-12'
  const testTimestamp = new Date('2026-03-12T14:30:45').getTime()

  describe('formatDate', () => {
    it('should format date with default format', () => {
      expect(formatDate(testDate)).toBe('2026-03-12')
    })

    it('should format date with custom format', () => {
      expect(formatDate(testDate, 'YYYY/MM/DD')).toBe('2026/03/12')
    })

    it('should handle string input', () => {
      expect(formatDate(testDateString)).toBe('2026-03-12')
    })

    it('should handle timestamp input', () => {
      expect(formatDate(testTimestamp)).toBe('2026-03-12')
    })
  })

  describe('formatDateShort', () => {
    it('should format date in short format', () => {
      expect(formatDateShort(testDate)).toBe('2026-03-12')
    })
  })

  describe('formatDateTime', () => {
    it('should format datetime with default format', () => {
      expect(formatDateTime(testDate)).toBe('2026-03-12 14:30:45')
    })

    it('should format datetime with custom format', () => {
      expect(formatDateTime(testDate, 'YYYY-MM-DD HH:mm')).toBe('2026-03-12 14:30')
    })
  })

  describe('formatTime', () => {
    it('should format time with default format', () => {
      expect(formatTime(testDate)).toBe('14:30:45')
    })

    it('should format time with custom format', () => {
      expect(formatTime(testDate, 'HH:mm')).toBe('14:30')
    })
  })

  describe('formatDateChinese', () => {
    it('should format date in Chinese format', () => {
      expect(formatDateChinese(testDate)).toBe('2026年03月12日')
    })

    it('should handle null input', () => {
      expect(formatDateChinese(null)).toBe('未设置')
    })

    it('should handle undefined input', () => {
      expect(formatDateChinese(undefined)).toBe('未设置')
    })

    it('should handle invalid date', () => {
      expect(formatDateChinese('invalid-date')).toBe('日期格式错误')
    })
  })

  describe('safeFormatDate', () => {
    it('should format valid date', () => {
      expect(safeFormatDate(testDate)).toBe('2026-03-12')
    })

    it('should return default value for null', () => {
      expect(safeFormatDate(null)).toBe('未设置')
    })

    it('should return custom default value', () => {
      expect(safeFormatDate(null, 'YYYY-MM-DD', 'N/A')).toBe('N/A')
    })

    it('should return default value for invalid date', () => {
      expect(safeFormatDate('invalid-date')).toBe('未设置')
    })

    it('should format with custom format', () => {
      expect(safeFormatDate(testDate, 'YYYY/MM/DD')).toBe('2026/03/12')
    })
  })

  describe('getRelativeTime', () => {
    it('should return relative time string', () => {
      const result = getRelativeTime(testDate)
      expect(typeof result).toBe('string')
      // Note: Exact value depends on current time, so we just check it's a string
    })
  })

  describe('parseDate', () => {
    it('should parse date string', () => {
      const result = parseDate('2026-03-12')
      expect(result).toBeInstanceOf(Date)
      expect(result.getFullYear()).toBe(2026)
      expect(result.getMonth()).toBe(2) // 0-indexed
      expect(result.getDate()).toBe(12)
    })

    it('should parse date with custom format', () => {
      const result = parseDate('12/03/2026', 'DD/MM/YYYY')
      expect(result.getFullYear()).toBe(2026)
      expect(result.getMonth()).toBe(2) // March is month 2 (0-indexed)
      expect(result.getDate()).toBe(12)
    })
  })

  describe('isValidDate', () => {
    it('should return true for valid date', () => {
      expect(isValidDate(testDate)).toBe(true)
      expect(isValidDate('2026-03-12')).toBe(true)
      expect(isValidDate(testTimestamp)).toBe(true)
    })

    it('should return false for invalid date', () => {
      expect(isValidDate('invalid-date')).toBe(false)
      expect(isValidDate(null)).toBe(false)
      expect(isValidDate('')).toBe(false)
      // Note: dayjs considers undefined as current date, so we skip that test
    })
  })

  describe('getDateRange', () => {
    it('should return array of dates between start and end', () => {
      const start = '2026-03-10'
      const end = '2026-03-12'
      const result = getDateRange(start, end)
      
      expect(result).toHaveLength(3)
      expect(result[0]).toBeInstanceOf(Date)
      expect(formatDate(result[0])).toBe('2026-03-10')
      expect(formatDate(result[1])).toBe('2026-03-11')
      expect(formatDate(result[2])).toBe('2026-03-12')
    })

    it('should handle same start and end date', () => {
      const date = '2026-03-12'
      const result = getDateRange(date, date)
      
      expect(result).toHaveLength(1)
      expect(formatDate(result[0])).toBe('2026-03-12')
    })

    it('should handle Date objects', () => {
      const start = new Date('2026-03-10')
      const end = new Date('2026-03-11')
      const result = getDateRange(start, end)
      
      expect(result).toHaveLength(2)
      expect(result[0]).toBeInstanceOf(Date)
      expect(result[1]).toBeInstanceOf(Date)
    })
  })
})