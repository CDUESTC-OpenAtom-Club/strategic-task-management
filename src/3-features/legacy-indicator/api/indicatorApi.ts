import { apiClient } from '@/5-shared/api/client'
import type {
  ApiResponse,
  IndicatorDistributionRequest,
  IndicatorDistributionEligibility,
  BatchDistributionRequest
} from '@/5-shared/types'
import { logger } from '@/5-shared/lib/utils/logger'
// 导入统一的 IndicatorVO 和 MilestoneVO 接口，避免重复定义
import type { IndicatorVO, IndicatorCreateRequest } from '@/5-shared/types/backend-aligned'

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

/**
 * 指标 API 服务
 * 包含指标下发相关的接口
 */

export const indicatorApi = {
  /**
   * 获取所有活跃指标
   * @param year 可选的年份过滤参数
   */
  async getAllIndicators(year?: number): Promise<ApiResponse<IndicatorVO[]>> {
    const params = year ? { year } : {}
    return apiClient.get<ApiResponse<IndicatorVO[]>>('/indicators', { params })
  },

  /**
   * 获取指标详情
   */
  async getIndicatorById(indicatorId: string): Promise<ApiResponse<IndicatorVO>> {
    return apiClient.get<ApiResponse<IndicatorVO>>(`/indicators/${indicatorId}`)
  },

  /**
   * 按任务获取指标
   */
  async getIndicatorsByTask(taskId: string): Promise<ApiResponse<IndicatorVO[]>> {
    return apiClient.get<ApiResponse<IndicatorVO[]>>(`/indicators/task/${taskId}`)
  },

  /**
   * 获取任务的根指标
   */
  async getRootIndicatorsByTask(taskId: string): Promise<ApiResponse<IndicatorVO[]>> {
    const response = await apiClient.get<ApiResponse<IndicatorVO[]>>(`/indicators/task/${taskId}`)
    const payload = Array.isArray(response?.data) ? response.data : []
    return {
      ...response,
      data: payload.filter(item => !('parentIndicatorId' in (item as Record<string, unknown>)))
    }
  },

  /**
   * 按发布方组织获取指标
   */
  async getIndicatorsByOwnerOrg(ownerOrgId: string): Promise<ApiResponse<IndicatorVO[]>> {
    const response = await apiClient.get<ApiResponse<IndicatorVO[]>>('/indicators')
    const payload = Array.isArray(response?.data) ? response.data : []
    return {
      ...response,
      data: payload.filter(
        item => String((item as Record<string, unknown>).ownerOrgId ?? '') === ownerOrgId
      )
    }
  },

  /**
   * 按责任方组织获取指标
   */
  async getIndicatorsByTargetOrg(targetOrgId: string): Promise<ApiResponse<IndicatorVO[]>> {
    const response = await apiClient.get<ApiResponse<IndicatorVO[]>>('/indicators')
    const payload = Array.isArray(response?.data) ? response.data : []
    return {
      ...response,
      data: payload.filter(
        item => String((item as Record<string, unknown>).targetOrgId ?? '') === targetOrgId
      )
    }
  },

  /**
   * 搜索指标
   */
  async searchIndicators(keyword: string): Promise<ApiResponse<IndicatorVO[]>> {
    return apiClient.get<ApiResponse<IndicatorVO[]>>('/indicators/search', { keyword })
  },

  // ==================== 指标下发相关接口 ====================

  /**
   * 检查指标是否可以下发
   */
  async checkDistributionEligibility(
    indicatorId: string
  ): Promise<ApiResponse<IndicatorDistributionEligibility>> {
    const response = await apiClient.get<ApiResponse<Record<string, unknown>>>(
      `/indicators/${indicatorId}/distribution-status`
    )
    const currentStatus = String(response?.data ?? '').toUpperCase()
    return {
      ...response,
      data: {
        eligible: currentStatus !== 'DISTRIBUTED',
        reason: currentStatus === 'DISTRIBUTED' ? '指标已下发' : undefined
      } as IndicatorDistributionEligibility
    }
  },

  /**
   * 下发指标到目标组织
   *
   * 这是一个关键操作，使用显式重试逻辑（最多3次，指数退避）
   * 因为指标下发涉及数据库写入和组织关系建立，网络不稳定可能导致失败
   *
   * **Validates: Requirements 2.4**
   *
   * @param request 下发请求参数
   */
  async distributeIndicator(
    request: IndicatorDistributionRequest
  ): Promise<ApiResponse<IndicatorVO>> {
    return withRetry(async () => {
      const params = new URLSearchParams()
      params.append('targetOrgId', request.targetOrgId)
      if (request.customDesc) {
        params.append('customDesc', request.customDesc)
      }
      if (request.actorUserId) {
        params.append('actorUserId', request.actorUserId)
      }

      return apiClient.post<ApiResponse<IndicatorVO>>(
        `/indicators/${request.parentIndicatorId}/distribute?${params.toString()}`
      )
    })
  },

  /**
   * 批量下发指标到多个目标组织
   *
   * 这是一个关键操作，使用显式重试逻辑（最多3次，指数退避）
   * 批量操作涉及多个数据库事务，失败后重试可以提高成功率
   *
   * **Validates: Requirements 2.4**
   *
   * @param request 批量下发请求参数
   */
  async batchDistributeIndicator(
    request: BatchDistributionRequest
  ): Promise<ApiResponse<IndicatorVO[]>> {
    return withRetry(async () => {
      const results = await Promise.all(
        request.targetOrgIds.map(targetOrgId => {
          const params = new URLSearchParams()
          params.append('targetOrgId', targetOrgId)
          if (request.actorUserId) {
            params.append('actorUserId', request.actorUserId)
          }

          return apiClient.post<ApiResponse<IndicatorVO>>(
            `/indicators/${request.parentIndicatorId}/distribute?${params.toString()}`
          )
        })
      )

      return {
        success: true,
        data: results.flatMap(result => (result?.data ? [result.data] : [])),
        message: '批量下发成功'
      } as ApiResponse<IndicatorVO[]>
    })
  },

  /**
   * 获取已下发的子指标列表
   */
  async getDistributedIndicators(parentIndicatorId: string): Promise<ApiResponse<IndicatorVO[]>> {
    const response = await apiClient.get<ApiResponse<IndicatorVO[]>>('/indicators')
    const payload = Array.isArray(response?.data) ? response.data : []
    return {
      ...response,
      data: payload.filter(
        item => String((item as Record<string, unknown>).parentIndicatorId ?? '') === parentIndicatorId
      )
    }
  },

  /**
   * 更新指标
   *
   * 这是一个关键操作，使用显式重试逻辑（最多3次，指数退避）
   * 指标更新可能涉及复杂的业务逻辑和数据验证，重试可以处理临时性错误
   *
   * **Validates: Requirements 2.4**
   *
   * @param indicatorId 指标ID
   * @param updates 更新的字段
   */
  async updateIndicator(
    indicatorId: string,
    updates: Partial<IndicatorVO>
  ): Promise<ApiResponse<IndicatorVO>> {
    return withRetry(async () => {
      return apiClient.post<ApiResponse<IndicatorVO>>(`/indicators/${indicatorId}/breakdown`, updates)
    })
  },

  /**
   * 创建新指标
   *
   * 这是一个关键操作，使用显式重试逻辑（最多3次，指数退避）
   * 指标创建是核心业务操作，需要确保成功率
   *
   * **Validates: Requirements 2.4**
   *
   * @param request 指标创建请求
   */
  async createIndicator(request: IndicatorCreateRequest): Promise<ApiResponse<IndicatorVO>> {
    return withRetry(async () => {
      return apiClient.post<ApiResponse<IndicatorVO>>('/indicators', request)
    })
  },

  /**
   * 删除指标
   *
   * 这是一个关键操作，使用显式重试逻辑（最多3次，指数退避）
   * 删除操作需要确保执行成功，避免数据不一致
   *
   * **Validates: Requirements 2.4**
   *
   * @param indicatorId 指标ID
   */
  async deleteIndicator(indicatorId: string): Promise<ApiResponse<void>> {
    return withRetry(async () => {
      return apiClient.post<ApiResponse<void>>(`/indicators/${indicatorId}/terminate`)
    })
  }
}

export default indicatorApi
