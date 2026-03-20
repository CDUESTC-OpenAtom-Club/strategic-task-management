/**
 * User Feature - Model Types
 *
 * Type definitions for User state management.
 */

import type { UserRole } from '@/shared/types'

/**
 * User filter state
 */
export interface UserFilterState {
  username?: string
  realName?: string
  role?: UserRole
  department?: string
  status?: 'active' | 'inactive'
}

/**
 * User form data
 */
export interface UserFormData {
  username: string
  password?: string
  realName: string
  email?: string
  phone?: string
  role: UserRole
  orgId?: number
  department?: string
}
