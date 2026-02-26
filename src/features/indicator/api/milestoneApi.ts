/**
 * 里程碑 API 服务
 * 包含配对机制相关的接口
 * 使用简化的 apiClient，在业务层实现必要的重试逻辑
 *
 * **Validates: Requirements 2.4, 2.6**
 */
import { apiClient } from '@/shared/api/client'
import type { ApiResponse, Milestone, MilestonePairingStatus, MilestoneReportValidation } from '@/types'
import { logger } from '@/utils/logger'

/**
 * 重试辅助函数 - 使用指数退避策略
 *
 * 对关键操作提供显式重试逻辑，最多重试3次
 * 使用指数退避策略：第1次重试等待1秒，第2次等待2秒，第3次等待3秒
 *
 * **Validates: Requirements 2.4**
 *
 * @param fn 需要重试的异步函数
 * @param maxRetries 最大重试次数（默认3次）
 * @returns 函数执行结果
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T> {
  let lastError: Error

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      logger.warn(`[Retry] Attempt ${attempt}/${maxRetries} failed:`, error)

      if (attempt < maxRetries) {
        // 指数退避: 1s, 2s, 3s
        const delayMs = attempt * 1000
        logger.debug(`[Retry] Waiting ${delayMs}ms before next attempt`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }

  logger.error(`[Retry] All ${maxRetries} attempts failed`, lastError!)
  throw lastError!
}

export const milestoneApi = {
  /**
   * 获取指标的所有里程碑
   */
  async getMilestonesByIndicator(indicatorId: string): Promise<ApiResponse<Milestone[]>> {
    return apiClient.get<ApiResponse<Milestone[]>>(`/milestones/indicator/${indicatorId}`)
  },

  /**
   * 获取指标的下一个待填报里程碑（补录规则）
   * 返回最早的未配对里程碑
   */
  async getNextMilestoneToReport(indicatorId: string): Promise<ApiResponse<Milestone | null>> {
    return apiClient.get<ApiResponse<Milestone | null>>(`/milestones/indicator/${indicatorId}/next-to-report`)
  },

  /**
   * 获取指标的所有未配对里程碑
   */
  async getUnpairedMilestones(indicatorId: string): Promise<ApiResponse<Milestone[]>> {
    return apiClient.get<ApiResponse<Milestone[]>>(`/milestones/indicator/${indicatorId}/unpaired`)
  },

  /**
   * 检查里程碑是否已配对
   */
  async isMilestonePaired(milestoneId: string): Promise<ApiResponse<{ milestoneId: string; isPaired: boolean; message: string }>> {
    return apiClient.get(`/milestones/${milestoneId}/is-paired`)
  },

  /**
   * 获取指标的配对状态摘要
   */
  async getPairingStatus(indicatorId: string): Promise<ApiResponse<MilestonePairingStatus>> {
    return apiClient.get<ApiResponse<MilestonePairingStatus>>(`/milestones/indicator/${indicatorId}/pairing-status`)
  },

  /**
   * 检查是否可以填报指定里程碑（补录规则验证）
   */
  async canReportOnMilestone(indicatorId: string, milestoneId: string): Promise<ApiResponse<MilestoneReportValidation>> {
    return apiClient.get<ApiResponse<MilestoneReportValidation>>(`/milestones/indicator/${indicatorId}/can-report/${milestoneId}`)
  },

  /**
   * 获取里程碑详情
   */
  async getMilestoneById(milestoneId: string): Promise<ApiResponse<Milestone>> {
    return apiClient.get<ApiResponse<Milestone>>(`/milestones/${milestoneId}`)
  },

  /**
   * 获取权重验证结果
   */
  async validateWeights(indicatorId: string): Promise<ApiResponse<{ isValid: boolean; actualSum: number; expectedSum: number; message: string }>> {
    return apiClient.get(`/milestones/indicator/${indicatorId}/weight-validation`)
  },
}

export default milestoneApi
