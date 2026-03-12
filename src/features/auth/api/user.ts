import api from '@/api'
import type { ApiResponse, User } from '@/types'

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
    return api.put('/user/password', data)
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
    return api.put(`/admin/users/${userId}/password`, { newPassword })
  },

  /**
   * 获取所有用户列表 (管理员)
   */
  async getAllUsers(): Promise<ApiResponse<User[]>> {
    return api.get('/admin/users')
  }
}

export default userApi
