/**
 * Auth Feature - Mutation API
 *
 * Write operations for authentication.
 */

import { apiClient as api } from '@/shared/api/client'
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
 * API: POST /api/v1/auth/refresh
 *
 * @param refreshToken - Refresh token
 * @returns New access token
 */
export async function refreshToken(
  refreshToken: string
): Promise<
  ApiResponse<{ accessToken: string; refreshToken: string; expiresIn: number; tokenType: string }>
> {
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
  return api.post('/profile/password', data)
}

/**
 * Reset user password (admin)
 *
 * 当前 OpenAPI 未提供管理员重置密码接口
 *
 * @param userId - User ID
 * @param newPassword - New password
 */
export async function resetUserPassword(
  userId: string | number,
  newPassword: string
): Promise<ApiResponse<void>> {
  void userId
  void newPassword
  return Promise.reject(
    new Error('当前 OpenAPI 未提供管理员重置密码接口，请通过用户自行修改密码处理')
  )
}
