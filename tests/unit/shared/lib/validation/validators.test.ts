/**
 * Unit Tests for Validation Utilities
 * 
 * Tests for shared/lib/validation/validators.ts functions
 */

import { describe, it, expect } from 'vitest'
import {
  isValidEmail,
  isValidPhone,
  isRequired,
  isValidLength,
  isInRange,
  isValidUrl
} from '@/shared/lib/validation/validators'

describe('Validation Utilities', () => {
  describe('isValidEmail', () => {
    it('should validate correct email formats', () => {
      expect(isValidEmail('user@example.com')).toBe(true)
      expect(isValidEmail('test.email@domain.co.uk')).toBe(true)
      expect(isValidEmail('user+tag@example.org')).toBe(true)
      expect(isValidEmail('123@456.com')).toBe(true)
    })

    it('should reject invalid email formats', () => {
      expect(isValidEmail('invalid-email')).toBe(false)
      expect(isValidEmail('user@')).toBe(false)
      expect(isValidEmail('@domain.com')).toBe(false)
      expect(isValidEmail('user@domain')).toBe(false)
      expect(isValidEmail('user.domain.com')).toBe(false)
      expect(isValidEmail('')).toBe(false)
      expect(isValidEmail('user @domain.com')).toBe(false)
    })
  })

  describe('isValidPhone', () => {
    it('should validate correct Chinese phone numbers', () => {
      expect(isValidPhone('13812345678')).toBe(true)
      expect(isValidPhone('15987654321')).toBe(true)
      expect(isValidPhone('18612345678')).toBe(true)
      expect(isValidPhone('19912345678')).toBe(true)
    })

    it('should reject invalid phone numbers', () => {
      expect(isValidPhone('12812345678')).toBe(false) // starts with 12
      expect(isValidPhone('1381234567')).toBe(false)  // too short
      expect(isValidPhone('138123456789')).toBe(false) // too long
      expect(isValidPhone('phone-number')).toBe(false)
      expect(isValidPhone('')).toBe(false)
      expect(isValidPhone('138-1234-5678')).toBe(false) // with dashes
    })
  })

  describe('isRequired', () => {
    it('should return true for valid values', () => {
      expect(isRequired('text')).toBe(true)
      expect(isRequired('  text  ')).toBe(true) // trimmed
      expect(isRequired(123)).toBe(true)
      expect(isRequired(0)).toBe(true)
      expect(isRequired(false)).toBe(true)
      expect(isRequired([1, 2, 3])).toBe(true)
      expect(isRequired({ key: 'value' })).toBe(true)
    })

    it('should return false for empty/null values', () => {
      expect(isRequired(null)).toBe(false)
      expect(isRequired(undefined)).toBe(false)
      expect(isRequired('')).toBe(false)
      expect(isRequired('   ')).toBe(false) // only whitespace
      expect(isRequired([])).toBe(false)
    })
  })

  describe('isValidLength', () => {
    it('should validate string length within range', () => {
      expect(isValidLength('hello', 3, 10)).toBe(true)
      expect(isValidLength('hi', 2, 5)).toBe(true)
      expect(isValidLength('exactly5', 5, 8)).toBe(true)
    })

    it('should reject string length outside range', () => {
      expect(isValidLength('hi', 3, 10)).toBe(false) // too short
      expect(isValidLength('this is too long', 3, 10)).toBe(false) // too long
    })

    it('should handle edge cases', () => {
      expect(isValidLength('', 0, 5)).toBe(true) // empty string, min 0
      expect(isValidLength('test', 4, 4)).toBe(true) // exact length
      expect(isValidLength('  test  ', 4, 6)).toBe(true) // trimmed length
    })
  })

  describe('isInRange', () => {
    it('should validate numbers within range', () => {
      expect(isInRange(5, 0, 10)).toBe(true)
      expect(isInRange(0, 0, 10)).toBe(true) // min boundary
      expect(isInRange(10, 0, 10)).toBe(true) // max boundary
      expect(isInRange(-5, -10, 0)).toBe(true)
    })

    it('should reject numbers outside range', () => {
      expect(isInRange(-1, 0, 10)).toBe(false) // below min
      expect(isInRange(11, 0, 10)).toBe(false) // above max
    })

    it('should handle decimal numbers', () => {
      expect(isInRange(5.5, 5, 6)).toBe(true)
      expect(isInRange(4.9, 5, 6)).toBe(false)
      expect(isInRange(6.1, 5, 6)).toBe(false)
    })
  })

  describe('isValidUrl', () => {
    it('should validate correct URL formats', () => {
      expect(isValidUrl('https://example.com')).toBe(true)
      expect(isValidUrl('http://example.com')).toBe(true)
      expect(isValidUrl('https://www.example.com/path')).toBe(true)
      expect(isValidUrl('https://example.com:8080')).toBe(true)
      expect(isValidUrl('https://example.com/path?query=value')).toBe(true)
      expect(isValidUrl('https://example.com/path#fragment')).toBe(true)
    })

    it('should reject invalid URL formats', () => {
      expect(isValidUrl('not-a-url')).toBe(false)
      expect(isValidUrl('example.com')).toBe(false) // missing protocol
      expect(isValidUrl('ftp://example.com')).toBe(true) // FTP is valid URL
      expect(isValidUrl('')).toBe(false)
      expect(isValidUrl('http://')).toBe(false) // incomplete
    })

    it('should handle edge cases', () => {
      expect(isValidUrl('file:///path/to/file')).toBe(true)
      expect(isValidUrl('mailto:user@example.com')).toBe(true)
      expect(isValidUrl('tel:+1234567890')).toBe(true)
    })
  })
})