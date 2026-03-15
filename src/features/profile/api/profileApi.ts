/**
 * Profile Feature API
 *
 * Provides API endpoints for user profile functionality
 * @module features/profile/api
 */

import { apiClient } from '@/shared/api/client'

export const profileApi = {
  /**
   * Get user profile
   * 使用正确的后端API路径：/api/v1/auth/userinfo
   */
  async getProfile() {
    return await apiClient.get('/auth/userinfo')
  }
}
