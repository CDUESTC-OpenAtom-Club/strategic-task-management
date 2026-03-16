/**
 * Local Storage Utilities
 *
 * Type-safe localStorage wrapper
 */
import { logger } from '../utils/logger'

/**
 * Get item from localStorage
 */
export function getItem<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : null
  } catch (error) {
    logger.error(`Error reading from localStorage: ${key}`, error)
    return null
  }
}

/**
 * Set item in localStorage
 */
export function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    logger.error(`Error writing to localStorage: ${key}`, error)
  }
}

/**
 * Remove item from localStorage
 */
export function removeItem(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch (error) {
    logger.error(`Error removing from localStorage: ${key}`, error)
  }
}

/**
 * Clear all items from localStorage
 */
export function clear(): void {
  try {
    localStorage.clear()
  } catch (error) {
    logger.error('Error clearing localStorage', error)
  }
}
