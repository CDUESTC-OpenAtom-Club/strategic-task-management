/**
 * LocalStorage Tests
 * 
 * Unit tests for localStorage utilities
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { getItem, setItem, removeItem, clear } from '../localStorage'

describe('LocalStorage Utilities', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
  })

  describe('setItem', () => {
    it('should store string value', () => {
      setItem('key', 'value')
      expect(localStorage.getItem('key')).toBe('"value"')
    })

    it('should store number value', () => {
      setItem('key', 123)
      expect(localStorage.getItem('key')).toBe('123')
    })

    it('should store boolean value', () => {
      setItem('key', true)
      expect(localStorage.getItem('key')).toBe('true')
    })

    it('should store object value', () => {
      const obj = { name: 'test', value: 123 }
      setItem('key', obj)
      expect(localStorage.getItem('key')).toBe(JSON.stringify(obj))
    })

    it('should store array value', () => {
      const arr = [1, 2, 3]
      setItem('key', arr)
      expect(localStorage.getItem('key')).toBe(JSON.stringify(arr))
    })

    it('should store null value', () => {
      setItem('key', null)
      expect(localStorage.getItem('key')).toBe('null')
    })
  })

  describe('getItem', () => {
    it('should retrieve string value', () => {
      localStorage.setItem('key', '"value"')
      expect(getItem<string>('key')).toBe('value')
    })

    it('should retrieve number value', () => {
      localStorage.setItem('key', '123')
      expect(getItem<number>('key')).toBe(123)
    })

    it('should retrieve boolean value', () => {
      localStorage.setItem('key', 'true')
      expect(getItem<boolean>('key')).toBe(true)
    })

    it('should retrieve object value', () => {
      const obj = { name: 'test', value: 123 }
      localStorage.setItem('key', JSON.stringify(obj))
      expect(getItem<typeof obj>('key')).toEqual(obj)
    })

    it('should retrieve array value', () => {
      const arr = [1, 2, 3]
      localStorage.setItem('key', JSON.stringify(arr))
      expect(getItem<number[]>('key')).toEqual(arr)
    })

    it('should return null for non-existent key', () => {
      expect(getItem('nonexistent')).toBe(null)
    })

    it('should return null for invalid JSON', () => {
      localStorage.setItem('key', 'invalid-json{')
      expect(getItem('key')).toBe(null)
    })
  })

  describe('removeItem', () => {
    it('should remove existing item', () => {
      localStorage.setItem('key', 'value')
      removeItem('key')
      expect(localStorage.getItem('key')).toBe(null)
    })

    it('should handle removing non-existent item', () => {
      expect(() => removeItem('nonexistent')).not.toThrow()
    })
  })

  describe('clear', () => {
    it('should clear all items', () => {
      localStorage.setItem('key1', 'value1')
      localStorage.setItem('key2', 'value2')
      localStorage.setItem('key3', 'value3')
      
      clear()
      
      expect(localStorage.length).toBe(0)
      expect(localStorage.getItem('key1')).toBe(null)
      expect(localStorage.getItem('key2')).toBe(null)
      expect(localStorage.getItem('key3')).toBe(null)
    })

    it('should handle clearing empty storage', () => {
      expect(() => clear()).not.toThrow()
    })
  })

  describe('Integration', () => {
    it('should handle complete workflow', () => {
      // Set multiple items
      setItem('user', { id: 1, name: 'John' })
      setItem('token', 'abc123')
      setItem('settings', { theme: 'dark', lang: 'zh' })
      
      // Retrieve items
      expect(getItem<{ id: number; name: string }>('user')).toEqual({ id: 1, name: 'John' })
      expect(getItem<string>('token')).toBe('abc123')
      expect(getItem<{ theme: string; lang: string }>('settings')).toEqual({ theme: 'dark', lang: 'zh' })
      
      // Remove one item
      removeItem('token')
      expect(getItem('token')).toBe(null)
      expect(getItem('user')).not.toBe(null)
      
      // Clear all
      clear()
      expect(getItem('user')).toBe(null)
      expect(getItem('settings')).toBe(null)
    })

    it('should handle complex nested objects', () => {
      const complexObj = {
        user: {
          id: 1,
          profile: {
            name: 'John',
            age: 30,
            tags: ['admin', 'user']
          }
        },
        settings: {
          notifications: {
            email: true,
            sms: false
          }
        }
      }
      
      setItem('data', complexObj)
      expect(getItem('data')).toEqual(complexObj)
    })
  })
})
