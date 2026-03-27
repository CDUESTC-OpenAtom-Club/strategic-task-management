/**
 * Auth Feature - API Types
 * 
 * API request/response types specific to authentication endpoints.
 */

import type { User } from '@/entities/user/model/types'

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  code: number
  message?: string
  data: T
  success?: boolean
  timestamp?: string
}

/**
 * Login request
 */
export interface LoginRequest {
  username: string
  password: string
  captcha?: string
  captchaKey?: string
}

/**
 * Login response data
 */
export interface LoginResponseData {
  accessToken: string
  refreshToken?: string
  expiresIn: number
  user: User
}

/**
 * Refresh token request
 */
export interface RefreshTokenRequest {
  refreshToken: string
}

/**
 * Refresh token response
 */
export interface RefreshTokenResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: string
}

/**
 * Token verification response
 */
export interface TokenVerificationResponse {
  valid: boolean
  expiresAt?: string
  user?: User
}

/**
 * User info response
 */
export type UserInfoResponse = ApiResponse<User>

/**
 * Logout response
 */
export type LogoutResponse = ApiResponse<void>
