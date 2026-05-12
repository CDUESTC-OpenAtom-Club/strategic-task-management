/**
 * Profile Feature API
 *
 * Provides API endpoints for user profile functionality
 * @module features/profile/api
 */

import { apiClient } from '@/shared/api/client'

export interface AvatarUploadResponse {
  avatarUrl: string
}

interface WrappedAvatarUploadResponse {
  success?: boolean
  data?: AvatarUploadResponse | null
}

export interface ProfileResponse {
  id: number
  username: string
  orgName?: string | null
  orgType?: string | null
  email?: string | null
  phone?: string | null
  realName: string
  orgId: number
  isActive: boolean
  roles: string[]
  avatar?: string | null
  avatarUrl: string | null
  createdAt: string
  lastLoginTime?: string | null
}

export const profileApi = {
  /**
   * Get user profile
   * 使用后端个人资料接口，返回真实业务角色列表
   */
  async getProfile(): Promise<ProfileResponse> {
    return await apiClient.get('/profile')
  },

  /**
   * Upload user avatar
   * 上传用户头像
   * @param file - 头像文件 (JPG/PNG/GIF/WebP, 最大2MB)
   * @returns 包含头像URL的响应
   */
  async uploadAvatar(file: File): Promise<AvatarUploadResponse> {
    const response = await apiClient.upload<AvatarUploadResponse | WrappedAvatarUploadResponse>(
      '/profile/avatar',
      file
    )

    if (response && typeof response === 'object' && 'avatarUrl' in response) {
      return response as AvatarUploadResponse
    }

    if (
      response &&
      typeof response === 'object' &&
      'data' in response &&
      response.data &&
      typeof response.data === 'object' &&
      'avatarUrl' in response.data
    ) {
      return response.data
    }

    throw new Error('头像上传接口返回格式异常')
  },

  /**
   * Update user profile
   * 更新用户资料
   */
  async updateProfile(data: { realName?: string; email?: string; phone?: string }) {
    return await apiClient.put('/profile', data)
  },

  async updateContact(data: { email?: string | null; phone?: string | null }) {
    return await apiClient.put('/auth/users/me/contact', data)
  },

  /**
   * Change password
   * 修改密码
   */
  async changePassword(data: {
    oldPassword: string
    newPassword: string
    confirmPassword: string
  }) {
    return await apiClient.post('/profile/password', data)
  }
}
