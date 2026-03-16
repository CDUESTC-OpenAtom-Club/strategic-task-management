/**
 * Auth Feature - Query API
 *
 * Read-only API operations for authentication.
 */

import api from '@/5-shared/api'
import type { ApiResponse } from './types'

/**
 * Get current user info
 *
 * API: GET /api/auth/userinfo
 *
 * @returns Current user information
 */
export async function getCurrentUser(): Promise<ApiResponse<any>> {
  return api.get('/auth/userinfo')
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
  return api.get('/auth/permissions')
}
