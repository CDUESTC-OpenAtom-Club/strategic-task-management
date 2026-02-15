import { apiService } from './index'
import type { ApiResponse, Milestone, MilestonePairingStatus, MilestoneReportValidation } from '@/types'

/**
 * 里程碑 API 服务
 * 包含配对机制相关的接口
 */
export const milestoneApi = {
  /**
   * 获取指标的所有里程碑
   */
  async getMilestonesByIndicator(indicatorId: string): Promise<ApiResponse<Milestone[]>> {
    return apiService.get<Milestone[]>(`/milestones/indicator/${indicatorId}`)
  },

  /**
   * 获取指标的下一个待填报里程碑（补录规则）
   * 返回最早的未配对里程碑
   */
  async getNextMilestoneToReport(indicatorId: string): Promise<ApiResponse<Milestone | null>> {
    return apiService.get<Milestone | null>(`/milestones/indicator/${indicatorId}/next-to-report`)
  },

  /**
   * 获取指标的所有未配对里程碑
   */
  async getUnpairedMilestones(indicatorId: string): Promise<ApiResponse<Milestone[]>> {
    return apiService.get<Milestone[]>(`/milestones/indicator/${indicatorId}/unpaired`)
  },

  /**
   * 检查里程碑是否已配对
   */
  async isMilestonePaired(milestoneId: string): Promise<ApiResponse<{ milestoneId: string; isPaired: boolean; message: string }>> {
    return apiService.get(`/milestones/${milestoneId}/is-paired`)
  },

  /**
   * 获取指标的配对状态摘要
   */
  async getPairingStatus(indicatorId: string): Promise<ApiResponse<MilestonePairingStatus>> {
    return apiService.get<MilestonePairingStatus>(`/milestones/indicator/${indicatorId}/pairing-status`)
  },

  /**
   * 检查是否可以填报指定里程碑（补录规则验证）
   */
  async canReportOnMilestone(indicatorId: string, milestoneId: string): Promise<ApiResponse<MilestoneReportValidation>> {
    return apiService.get<MilestoneReportValidation>(`/milestones/indicator/${indicatorId}/can-report/${milestoneId}`)
  },

  /**
   * 获取里程碑详情
   */
  async getMilestoneById(milestoneId: string): Promise<ApiResponse<Milestone>> {
    return apiService.get<Milestone>(`/milestones/${milestoneId}`)
  },

  /**
   * 获取权重验证结果
   */
  async validateWeights(indicatorId: string): Promise<ApiResponse<{ isValid: boolean; actualSum: number; expectedSum: number; message: string }>> {
    return apiService.get(`/milestones/indicator/${indicatorId}/weight-validation`)
  },
}

export default milestoneApi
