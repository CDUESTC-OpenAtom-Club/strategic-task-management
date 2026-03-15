/**
 * Auth Feature - Mutation API
 *
 * Write operations for authentication.
 */

import api from '@/shared/api'
import type { LoginCredentials, LoginResponse } from '@/entities/user/model/types'
import type { ApiResponse } from './types'

/**
 * User login
 *
 * API: POST /api/auth/login
 *
 * @param credentials - Username and password
 * @returns Login response with token and user info
 */
export async function login(credentials: LoginCredentials & { captcha?: string; captchaKey?: string }): Promise<ApiResponse<LoginResponse>> {
  return api.post('/auth/login', credentials)
}

/**
 * User logout
 *
 * API: POST /api/auth/logout
 *
 * Invalidates the current access token
 */
export async function logout(): Promise<ApiResponse<void>> {
  return api.post('/auth/logout')
}

/**
 * Refresh access token
 *
 * API: POST /api/auth/refresh
 *
 * @param refreshToken - Refresh token
 * @returns New access token
 */
export async function refreshToken(refreshToken: string): Promise<ApiResponse<{ accessToken: string; expiresIn: number }>> {
  return api.post('/auth/refresh', { refreshToken })
}

/**
 * User registration
 *
 * API: POST /api/auth/register
 *
 * @param userData - User registration data
 * @returns Registration response
 */
export async function register(userData: {
  username: string
  password: string
  realName: string
  email: string
  phone?: string
  orgId: number
}): Promise<ApiResponse<{ userId: number; status: string }>> {
  return api.post('/auth/register', userData)
}

/**
 * Change password
 *
 * API: PUT /api/user/password
 *
 * @param data - Old password and new password
 */
export async function changePassword(data: {
  oldPassword: string
  newPassword: string
}): Promise<ApiResponse<void>> {
  return api.put('/user/password', data)
}

/**
 * Reset user password (admin)
 *
 * API: PUT /api/admin/users/{userId}/password
 *
 * @param userId - User ID
 * @param newPassword - New password
 */
export async function resetUserPassword(
  userId: string | number,
  newPassword: string
): Promise<ApiResponse<void>> {
  return api.put(`/admin/users/${userId}/password`, { newPassword })
}
