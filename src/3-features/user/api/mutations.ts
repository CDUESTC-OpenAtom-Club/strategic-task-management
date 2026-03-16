/**
 * User Feature - Mutation API
 *
 * Write operations for user management.
 */

import api from '@/5-shared/api'
import type { User } from '@/5-shared/types'

/**
 * Create user input
 */
export interface CreateUserInput {
  username: string
  password: string
  realName: string
  email?: string
  phone?: string
  role: User['role']
  orgId?: number
  department?: string
  status?: 'active' | 'inactive'
}

/**
 * Update user input
 */
export interface UpdateUserInput {
  realName?: string
  email?: string
  phone?: string
  role?: User['role']
  orgId?: number
  department?: string
  status?: 'active' | 'inactive'
}

/**
 * Create a new user
 *
 * API: POST /api/users
 *
 * @param userData - User creation data
 * @returns Created user
 */
export async function createUser(userData: CreateUserInput): Promise<User> {
  const response = await api.post('/users', userData)
  return response.data
}

/**
 * Update user information
 *
 * API: PUT /api/users/{id}
 *
 * @param userId - User ID
 * @param userData - User update data
 * @returns Updated user
 */
export async function updateUser(
  userId: string | number,
  userData: UpdateUserInput
): Promise<User> {
  const response = await api.put(`/users/${userId}`, userData)
  return response.data
}

/**
 * Delete user
 *
 * API: DELETE /api/users/{id}
 *
 * @param userId - User ID
 */
export async function deleteUser(userId: string | number): Promise<void> {
  await api.delete(`/users/${userId}`)
}

/**
 * Change user password
 *
 * API: PUT /api/users/{id}/password
 *
 * @param userId - User ID
 * @param oldPassword - Old password
 * @param newPassword - New password
 */
export async function changeUserPassword(
  userId: string | number,
  oldPassword: string,
  newPassword: string
): Promise<void> {
  await api.put(`/users/${userId}/password`, {
    oldPassword,
    newPassword
  })
}

/**
 * Reset user password (admin only)
 *
 * API: PUT /api/users/{id}/password/reset
 *
 * @param userId - User ID
 * @param newPassword - New password
 */
export async function resetUserPassword(
  userId: string | number,
  newPassword: string
): Promise<void> {
  await api.put(`/users/${userId}/password/reset`, { newPassword })
}

/**
 * Assign role to user
 *
 * API: PUT /api/users/{id}/role
 *
 * @param userId - User ID
 * @param role - New role
 */
export async function assignUserRole(userId: string | number, role: User['role']): Promise<User> {
  const response = await api.put(`/users/${userId}/role`, { role })
  return response.data
}
