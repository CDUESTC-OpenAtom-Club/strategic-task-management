/**
 * 里程碑 API 服务
 * 包含配对机制相关的接口
 * 使用简化的 apiClient，在业务层实现必要的重试逻辑
 *
 * **Validates: Requirements 2.4, 2.6**
 */
import { apiClient } from '@/shared/api/client'
import type {
  ApiResponse,
  Milestone,
  MilestonePairingStatus,
  MilestoneReportValidation
} from '@/types'
import { logger } from '@/shared/lib/utils/logger'

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
async function _withRetry<T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T> {
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

  logger.error(`[Retry] All ${maxRetries} attempts failed`, lastError ?? new Error('Unknown error'))
  throw lastError ?? new Error('Unknown error')
}

export const milestoneApi = {
  /**
   * 创建新里程碑
   */
  async createMilestone(request: {
    indicatorId: number
    milestoneName: string
    targetProgress: number
    dueDate: string
    status: string
    sortOrder: number
  }): Promise<ApiResponse<Milestone>> {
    return apiClient.post<ApiResponse<Milestone>>('/milestones', request)
  },

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
    return apiClient.get<ApiResponse<Milestone | null>>(
      `/milestones/indicator/${indicatorId}/next-to-report`
    )
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
  async isMilestonePaired(
    milestoneId: string
  ): Promise<ApiResponse<{ milestoneId: string; isPaired: boolean; message: string }>> {
    return apiClient.get(`/milestones/${milestoneId}/is-paired`)
  },

  /**
   * 获取指标的配对状态摘要
   */
  async getPairingStatus(indicatorId: string): Promise<ApiResponse<MilestonePairingStatus>> {
    return apiClient.get<ApiResponse<MilestonePairingStatus>>(
      `/milestones/indicator/${indicatorId}/pairing-status`
    )
  },

  /**
   * 检查是否可以填报指定里程碑（补录规则验证）
   */
  async canReportOnMilestone(
    indicatorId: string,
    milestoneId: string
  ): Promise<ApiResponse<MilestoneReportValidation>> {
    return apiClient.get<ApiResponse<MilestoneReportValidation>>(
      `/milestones/indicator/${indicatorId}/can-report/${milestoneId}`
    )
  },

  /**
   * 获取里程碑详情
   */
  async getMilestoneById(milestoneId: string): Promise<ApiResponse<Milestone>> {
    return apiClient.get<ApiResponse<Milestone>>(`/milestones/${milestoneId}`)
  },

  /**
   * @deprecated 权重系统已废弃，改用 targetProgress (0-100)
   * 此方法保留用于向后兼容，但后端不再验证权重总和
   */
  async validateWeights(
    _indicatorId: string
  ): Promise<
    ApiResponse<{ isValid: boolean; actualSum: number; expectedSum: number; message: string }>
  > {
    // 返回模拟的成功响应，不再调用后端
    return Promise.resolve({
      success: true,
      data: {
        isValid: true,
        actualSum: 0,
        expectedSum: 0,
        message: '权重系统已废弃，改用目标进度 (targetProgress)'
      },
      message: '权重系统已废弃'
    })
  }
}

export default milestoneApi
