/**
 * User Feature - API Types
 *
 * Common type definitions for User API operations.
 */

import type { User, UserRole } from '@/types'

/**
 * API response wrapper
 */
export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

/**
 * User detail with extended information
 */
export interface UserDetail extends User {
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
  orgName?: string
}

/**
 * User statistics
 */
export interface UserStats {
  total: number
  active: number
  inactive: number
  byRole: Record<UserRole, number>
}
