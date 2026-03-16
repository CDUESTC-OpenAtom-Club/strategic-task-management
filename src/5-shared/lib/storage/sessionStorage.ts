/**
 * Session Storage Utilities
 *
 * Type-safe sessionStorage wrapper
 */
import { logger } from '../utils/logger'

/**
 * Get item from sessionStorage
 */
export function getItem<T>(key: string): T | null {
  try {
    const item = sessionStorage.getItem(key)
    return item ? JSON.parse(item) : null
  } catch (error) {
    logger.error(`Error reading from sessionStorage: ${key}`, error)
    return null
  }
}

/**
 * Set item in sessionStorage
 */
export function setItem<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    logger.error(`Error writing to sessionStorage: ${key}`, error)
  }
}

/**
 * Remove item from sessionStorage
 */
export function removeItem(key: string): void {
  try {
    sessionStorage.removeItem(key)
  } catch (error) {
    logger.error(`Error removing from sessionStorage: ${key}`, error)
  }
}

/**
 * Clear all items from sessionStorage
 */
export function clear(): void {
  try {
    sessionStorage.clear()
  } catch (error) {
    logger.error('Error clearing sessionStorage', error)
  }
}
