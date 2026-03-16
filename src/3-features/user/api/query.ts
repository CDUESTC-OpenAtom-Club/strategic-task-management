/**
 * User Feature - Query API
 *
 * Read-only API operations for user management.
 */

import api from '@/5-shared/api'
import type { User, UserRole } from '@/5-shared/types'

/**
 * User list query parameters
 */
export interface UserListParams {
  page?: number
  pageSize?: number
  username?: string
  realName?: string
  role?: UserRole
  orgId?: number
  department?: string
  status?: 'active' | 'inactive'
}

/**
 * User list response
 */
export interface UserListResponse {
  list: User[]
  total: number
  page: number
  pageSize: number
}

/**
 * Get user list with pagination and filters
 *
 * API: GET /api/users
 *
 * @param params - Query parameters
 * @returns User list with pagination
 */
export async function getUserList(params: UserListParams = {}): Promise<UserListResponse> {
  const response = await api.get('/users', { params })
  return response.data
}

/**
 * Get user by ID
 *
 * API: GET /api/users/{id}
 *
 * @param userId - User ID
 * @returns User detail
 */
export async function getUserById(userId: string | number): Promise<User> {
  const response = await api.get(`/users/${userId}`)
  return response.data
}

/**
 * Get current user profile
 *
 * API: GET /api/users/me
 *
 * @returns Current user profile
 */
export async function getCurrentUserProfile(): Promise<User> {
  const response = await api.get('/users/me')
  return response.data
}

/**
 * Search users by name or username
 *
 * API: GET /api/users/search
 *
 * @param keyword - Search keyword
 * @returns Matching users
 */
export async function searchUsers(keyword: string): Promise<User[]> {
  const response = await api.get('/users/search', {
    params: { keyword }
  })
  return response.data
}
