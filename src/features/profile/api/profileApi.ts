import { apiClient } from '@/shared/api/client'

export const profileApi = {
  async getProfile() {
    return await apiClient.get('/profile')
  }
}
