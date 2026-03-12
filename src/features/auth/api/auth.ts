/**
 * Auth Feature - Authentication API
 * 
 * API calls for authentication operations.
 * Based on backend API documentation: sism-backend/docs/API接口文档.md
 */

import api from '@/api'
import type { LoginCredentials, LoginResponse } from '@/entities/user/model/types'
import type { ApiResponse } from './types'

/**
 * Authentication API endpoints
 */
export const authApi = {
  /**
   * User login
   * POST /api/auth/login
   * 
   * @param credentials - Username and password
   * @returns Login response with token and user info
   */
  async login(credentials: LoginCredentials): Promise<ApiResponse<LoginResponse>> {
    return api.post('/auth/login', credentials)
  },

  /**
   * User logout
   * POST /api/auth/logout
   * 
   * Invalidates the current access token
   */
  async logout(): Promise<ApiResponse<void>> {
    return api.post('/auth/logout')
  },

  /**
   * Refresh access token
   * POST /api/auth/refresh
   * 
   * @param refreshToken - Refresh token
   * @returns New access token
   */
  async refreshToken(refreshToken: string): Promise<ApiResponse<{ accessToken: string; expiresIn: number }>> {
    return api.post('/auth/refresh', { refreshToken })
  },

  /**
   * Get current user info
   * GET /api/auth/me
   * 
   * @returns Current user information
   */
  async getCurrentUser(): Promise<ApiResponse<any>> {
    return api.get('/auth/me')
  },

  /**
   * Verify token validity
   * GET /api/auth/verify
   * 
   * @returns Token validity status
   */
  async verifyToken(): Promise<ApiResponse<{ valid: boolean }>> {
    return api.get('/auth/verify')
  }
}

export default authApi
