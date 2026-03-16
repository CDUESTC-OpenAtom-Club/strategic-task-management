/**
 * Common Validators
 * 
 * Reusable validation functions
 */

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate phone number (Chinese format)
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^1[3-9]\d{9}$/
  return phoneRegex.test(phone)
}

/**
 * Validate required field
 */
export function isRequired(value: unknown): boolean {
  if (value === null || value === undefined) {return false}
  if (typeof value === 'string') {return value.trim().length > 0}
  if (Array.isArray(value)) {return value.length > 0}
  return true
}

/**
 * Validate string length
 */
export function isValidLength(value: string, min: number, max: number): boolean {
  const length = value.trim().length
  return length >= min && length <= max
}

/**
 * Validate number range
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}
