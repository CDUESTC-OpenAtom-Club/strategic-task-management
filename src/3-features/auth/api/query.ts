/**
 * Auth Feature - Query API
 *
 * Read-only API operations for authentication.
 */

import { apiClient as api } from '@/shared/api/client'
import type { ApiResponse } from './types'

/**
 * Get current user info
 *
 * API: GET /api/v1/auth/me
 *
 * @returns Current user information
 */
export async function getCurrentUser(): Promise<ApiResponse<any>> {
  return api.get('/auth/me')
}

/**
 * Validate current token
 *
 * API: GET /api/auth/validate
 *
 * @returns Token validation result
 */
export async function validateToken(): Promise<ApiResponse<{ valid: boolean }>> {
  return api.get('/auth/validate')
}

/**
 * Get user permissions
 *
 * API: GET /api/auth/permissions
 *
 * @returns User permissions list
 */
export async function getUserPermissions(): Promise<ApiResponse<string[]>> {
  return Promise.resolve({
    success: true,
    data: [],
    message: '当前 OpenAPI 未提供权限查询接口，返回空权限列表'
  } as unknown as ApiResponse<string[]>)
}
