import { apiClient as api } from '@/shared/api/client'
import type { ApiResponse, User } from '@/shared/types'

/**
 * 用户密码相关API
 */
export const userApi = {
  /**
   * 修改个人密码
   * @param data 旧密码和新密码
   */
  async changePassword(data: {
    oldPassword: string
    newPassword: string
  }): Promise<ApiResponse<void>> {
    return api.post('/profile/password', data)
  },

  /**
   * 管理员重置用户密码
   * @param userId 用户ID
   * @param newPassword 新密码
   */
  async resetUserPassword(
    userId: string | number,
    newPassword: string
  ): Promise<ApiResponse<void>> {
    void userId
    void newPassword
    return Promise.reject(
      new Error('当前 OpenAPI 未提供管理员重置密码接口，请通过用户自行修改密码处理')
    )
  },

  /**
   * 获取所有用户列表 (管理员)
   */
  async getAllUsers(): Promise<ApiResponse<User[]>> {
    return api.get('/auth/users')
  }
}

export default userApi
