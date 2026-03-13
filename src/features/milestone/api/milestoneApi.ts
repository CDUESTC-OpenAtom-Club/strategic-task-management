import { apiClient } from '@/shared/api/client'

export const milestoneApi = {
  async getMilestones() {
    return await apiClient.get('/milestones')
  }
}
