/**
 * Validators Tests
 *
 * Unit tests for validation utilities
 */

import { describe, it, expect } from 'vitest'
import {
  isValidEmail,
  isValidPhone,
  isRequired,
  isValidLength,
  isInRange,
  isValidUrl
} from '../validators'

describe('Validators', () => {
  describe('isValidEmail', () => {
    it('should validate correct email', () => {
      expect(isValidEmail('test@example.com')).toBe(true)
      expect(isValidEmail('user.name@example.com')).toBe(true)
      expect(isValidEmail('user+tag@example.co.uk')).toBe(true)
    })

    it('should reject invalid email', () => {
      expect(isValidEmail('invalid')).toBe(false)
      expect(isValidEmail('invalid@')).toBe(false)
      expect(isValidEmail('@example.com')).toBe(false)
      expect(isValidEmail('user@')).toBe(false)
      expect(isValidEmail('user@domain')).toBe(false)
      expect(isValidEmail('')).toBe(false)
    })

    it('should reject email with spaces', () => {
      expect(isValidEmail('user @example.com')).toBe(false)
      expect(isValidEmail('user@ example.com')).toBe(false)
    })
  })

  describe('isValidPhone', () => {
    it('should validate correct Chinese phone number', () => {
      expect(isValidPhone('13800138000')).toBe(true)
      expect(isValidPhone('15912345678')).toBe(true)
      expect(isValidPhone('18612345678')).toBe(true)
      expect(isValidPhone('19912345678')).toBe(true)
    })

    it('should reject invalid phone number', () => {
      expect(isValidPhone('12345678901')).toBe(false) // starts with 2
      expect(isValidPhone('1380013800')).toBe(false) // too short
      expect(isValidPhone('138001380000')).toBe(false) // too long
      expect(isValidPhone('abc12345678')).toBe(false) // contains letters
      expect(isValidPhone('')).toBe(false)
    })

    it('should reject phone with spaces or dashes', () => {
      expect(isValidPhone('138 0013 8000')).toBe(false)
      expect(isValidPhone('138-0013-8000')).toBe(false)
    })
  })

  describe('isRequired', () => {
    it('should validate non-empty values', () => {
      expect(isRequired('text')).toBe(true)
      expect(isRequired(123)).toBe(true)
      expect(isRequired(true)).toBe(true)
      expect(isRequired(false)).toBe(true)
      expect(isRequired([1, 2, 3])).toBe(true)
      expect(isRequired({ key: 'value' })).toBe(true)
    })

    it('should reject empty values', () => {
      expect(isRequired(null)).toBe(false)
      expect(isRequired(undefined)).toBe(false)
      expect(isRequired('')).toBe(false)
      expect(isRequired('   ')).toBe(false)
      expect(isRequired([])).toBe(false)
    })

    it('should handle zero as valid', () => {
      expect(isRequired(0)).toBe(true)
    })
  })

  describe('isValidLength', () => {
    it('should validate string within length range', () => {
      expect(isValidLength('hello', 1, 10)).toBe(true)
      expect(isValidLength('test', 4, 4)).toBe(true)
      expect(isValidLength('a', 1, 5)).toBe(true)
    })

    it('should reject string outside length range', () => {
      expect(isValidLength('', 1, 10)).toBe(false)
      expect(isValidLength('hello', 6, 10)).toBe(false)
      expect(isValidLength('hello world', 1, 5)).toBe(false)
    })

    it('should trim whitespace before checking', () => {
      expect(isValidLength('  hello  ', 5, 5)).toBe(true)
      expect(isValidLength('  hello  ', 6, 10)).toBe(false)
    })

    it('should handle Chinese characters', () => {
      expect(isValidLength('你好', 2, 5)).toBe(true)
      expect(isValidLength('你好世界', 4, 4)).toBe(true)
    })
  })

  describe('isInRange', () => {
    it('should validate number within range', () => {
      expect(isInRange(5, 0, 10)).toBe(true)
      expect(isInRange(0, 0, 10)).toBe(true)
      expect(isInRange(10, 0, 10)).toBe(true)
    })

    it('should reject number outside range', () => {
      expect(isInRange(-1, 0, 10)).toBe(false)
      expect(isInRange(11, 0, 10)).toBe(false)
    })

    it('should handle negative ranges', () => {
      expect(isInRange(-5, -10, 0)).toBe(true)
      expect(isInRange(-11, -10, 0)).toBe(false)
    })

    it('should handle decimal numbers', () => {
      expect(isInRange(5.5, 0, 10)).toBe(true)
      expect(isInRange(10.1, 0, 10)).toBe(false)
    })
  })

  describe('isValidUrl', () => {
    it('should validate correct URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true)
      expect(isValidUrl('http://example.com')).toBe(true)
      expect(isValidUrl('https://example.com/path')).toBe(true)
      expect(isValidUrl('https://example.com/path?query=value')).toBe(true)
      expect(isValidUrl('https://example.com:8080')).toBe(true)
    })

    it('should reject invalid URLs', () => {
      expect(isValidUrl('invalid')).toBe(false)
      expect(isValidUrl('example.com')).toBe(false)
      expect(isValidUrl('//example.com')).toBe(false)
      expect(isValidUrl('')).toBe(false)
    })

    it('should validate URLs with different protocols', () => {
      expect(isValidUrl('ftp://example.com')).toBe(true)
      expect(isValidUrl('ws://example.com')).toBe(true)
      expect(isValidUrl('wss://example.com')).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle special characters in email', () => {
      expect(isValidEmail('user+tag@example.com')).toBe(true)
      expect(isValidEmail('user.name@example.com')).toBe(true)
      expect(isValidEmail('user_name@example.com')).toBe(true)
    })

    it('should handle boundary values in range', () => {
      expect(isInRange(0, 0, 0)).toBe(true)
      expect(isInRange(100, 100, 100)).toBe(true)
    })

    it('should handle empty strings in length validation', () => {
      expect(isValidLength('', 0, 10)).toBe(true)
      expect(isValidLength('   ', 0, 10)).toBe(true)
    })
  })
})
