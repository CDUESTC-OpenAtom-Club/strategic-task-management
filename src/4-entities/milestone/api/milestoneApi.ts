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
} from '@/shared/types'
import { buildQueryKey, fetchWithCache, invalidateQueries } from '@/shared/lib/utils/cache'
import {
  CACHE_TTL,
  createMemoryDetailPolicy,
  createShortMemoryPolicy
} from '@/shared/lib/utils/cache-config'
import { getCachedUserContext } from '@/shared/lib/utils/cacheContext'
import { logger } from '@/shared/lib/utils/logger'

type MilestoneMutationRequest = {
  indicatorId: number
  milestoneName: string
  description?: string
  targetProgress: number
  dueDate: string | null
  status: string
  sortOrder: number
  isPaired?: boolean
  inheritedFrom?: number | null
}

type BatchMilestoneMutationItem = {
  id?: number
  milestoneName: string
  description?: string
  targetProgress: number
  dueDate: string | null
  status: string
  sortOrder: number
  isPaired?: boolean
  inheritedFrom?: number | null
}

function normalizeDueDate(dueDate: string | null): string | null {
  if (!dueDate) {
    return null
  }

  const normalized = dueDate.trim()
  if (!normalized) {
    return null
  }

  // Backend DTO expects LocalDateTime, while UI commonly edits milestones as YYYY-MM-DD.
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return `${normalized}T00:00:00`
  }

  return normalized
}

function normalizeMilestoneMutationRequest(request: MilestoneMutationRequest): MilestoneMutationRequest {
  return {
    ...request,
    milestoneName: request.milestoneName.trim(),
    dueDate: normalizeDueDate(request.dueDate)
  }
}

function withMilestoneCacheContext(params?: Record<string, unknown>): Record<string, unknown> {
  return {
    ...getCachedUserContext(),
    ...(params ?? {}),
    version: 'v1'
  }
}

function invalidateMilestoneCaches(indicatorId?: string | number, milestoneId?: string | number): void {
  const targets: Array<string | ReturnType<typeof buildQueryKey>> = [
    'milestone.list',
    'indicator.detail',
    'indicator.list',
    'task.detail',
    'task.list',
    'plan.detail',
    'dashboard.overview'
  ]

  if (indicatorId !== undefined) {
    targets.push(`milestone.indicator.${indicatorId}`)
    targets.push(buildQueryKey('milestone', 'list', withMilestoneCacheContext({ indicatorId: String(indicatorId) })))
  }

  if (milestoneId !== undefined) {
    targets.push(`milestone.detail.${milestoneId}`)
    targets.push(
      buildQueryKey('milestone', 'detail', withMilestoneCacheContext({ milestoneId: String(milestoneId) }))
    )
  }

  invalidateQueries(targets)
}

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
  async createMilestone(request: MilestoneMutationRequest): Promise<ApiResponse<Milestone>> {
    const payload = normalizeMilestoneMutationRequest(request)
    const response = await apiClient.post<ApiResponse<Milestone>>('/milestones', payload)
    invalidateMilestoneCaches(request.indicatorId, response.data?.id)
    return response
  },

  /**
   * 更新里程碑
   */
  async updateMilestone(
    milestoneId: string,
    request: MilestoneMutationRequest
  ): Promise<ApiResponse<Milestone>> {
    const payload = normalizeMilestoneMutationRequest(request)
    const response = await apiClient.put<ApiResponse<Milestone>>(`/milestones/${milestoneId}`, payload)
    invalidateMilestoneCaches(request.indicatorId, milestoneId)
    return response
  },

  /**
   * 删除里程碑
   */
  async deleteMilestone(milestoneId: string): Promise<ApiResponse<void>> {
    const response = await apiClient.delete<ApiResponse<void>>(`/milestones/${milestoneId}`)
    invalidateMilestoneCaches(undefined, milestoneId)
    return response
  },

  /**
   * 按指标整包保存里程碑，在单次请求中完成新增、修改、删除。
   */
  async saveMilestonesForIndicator(
    indicatorId: string,
    milestones: BatchMilestoneMutationItem[]
  ): Promise<ApiResponse<Milestone[]>> {
    const payload = {
      milestones: milestones.map(item => ({
        ...item,
        dueDate: normalizeDueDate(item.dueDate)
      }))
    }
    const response = await apiClient.put<ApiResponse<Milestone[]>>(
      `/milestones/indicator/${indicatorId}/batch`,
      payload
    )
    invalidateMilestoneCaches(indicatorId)
    return response
  },

  /**
   * 获取指标的所有里程碑
   */
  async getMilestonesByIndicator(indicatorId: string): Promise<ApiResponse<Milestone[]>> {
    return fetchWithCache({
      key: buildQueryKey('milestone', 'list', withMilestoneCacheContext({ indicatorId })),
      policy: {
        ...createMemoryDetailPolicy({
          staleWhileRevalidate: true,
          tags: ['milestone.list', `milestone.indicator.${indicatorId}`]
        })
      },
      fetcher: () => apiClient.get<ApiResponse<Milestone[]>>(`/milestones/indicator/${indicatorId}`)
    })
  },

  /**
   * 批量获取多个指标的里程碑，按指标ID分组返回
   * 将 N 个请求合并为 1 个请求，消除 N+1 问题
   */
  async getMilestonesByIndicatorIds(
    indicatorIds: number[]
  ): Promise<ApiResponse<Record<number, Milestone[]>>> {
    if (indicatorIds.length === 0) {
      return { success: true, data: {}, message: '', timestamp: new Date().toISOString(), code: 200 }
    }
    const ids = indicatorIds.join(',')
    return fetchWithCache({
      key: buildQueryKey('milestone', 'batchList', withMilestoneCacheContext({ ids })),
      policy: {
        ...createMemoryDetailPolicy({
          staleWhileRevalidate: true,
          tags: ['milestone.list']
        })
      },
      fetcher: () => apiClient.get<ApiResponse<Record<number, Milestone[]>>>(`/milestones/by-indicators?ids=${ids}`)
    })
  },

  /**
   * 获取指标的下一个待填报里程碑（补录规则）
   * 返回最早的未配对里程碑
   */
  async getNextMilestoneToReport(indicatorId: string): Promise<ApiResponse<Milestone | null>> {
    return fetchWithCache({
      key: buildQueryKey('milestone', 'nextToReport', withMilestoneCacheContext({ indicatorId })),
      policy: {
        ...createShortMemoryPolicy(CACHE_TTL.MILESTONE_SHORT, {
          tags: ['milestone.list', `milestone.indicator.${indicatorId}`]
        })
      },
      fetcher: () =>
        apiClient.get<ApiResponse<Milestone | null>>(`/milestones/indicator/${indicatorId}/next-to-report`)
    })
  },

  /**
   * 获取指标的所有未配对里程碑
   */
  async getUnpairedMilestones(indicatorId: string): Promise<ApiResponse<Milestone[]>> {
    return fetchWithCache({
      key: buildQueryKey('milestone', 'unpaired', withMilestoneCacheContext({ indicatorId })),
      policy: {
        ...createShortMemoryPolicy(CACHE_TTL.MILESTONE_SHORT, {
          tags: ['milestone.list', `milestone.indicator.${indicatorId}`]
        })
      },
      fetcher: () => apiClient.get<ApiResponse<Milestone[]>>(`/milestones/indicator/${indicatorId}/unpaired`)
    })
  },

  /**
   * 检查里程碑是否已配对
   */
  async isMilestonePaired(
    milestoneId: string
  ): Promise<
    ApiResponse<{
      milestoneId: string
      isPaired: boolean
      pairedIndicatorId?: number
      pairedAt?: string
    }>
  > {
    return fetchWithCache({
      key: buildQueryKey('milestone', 'pairingStatusByMilestone', withMilestoneCacheContext({ milestoneId })),
      policy: {
        ...createShortMemoryPolicy(CACHE_TTL.MILESTONE_SHORT, {
          tags: ['milestone.list', `milestone.detail.${milestoneId}`]
        })
      },
      fetcher: () => apiClient.get(`/milestones/${milestoneId}/pairing-status`)
    })
  },

  /**
   * 获取指标的配对状态摘要
   */
  async getPairingStatus(indicatorId: string): Promise<ApiResponse<MilestonePairingStatus>> {
    return fetchWithCache({
      key: buildQueryKey('milestone', 'pairingStatus', withMilestoneCacheContext({ indicatorId })),
      policy: {
        ...createShortMemoryPolicy(CACHE_TTL.MILESTONE_SHORT, {
          tags: ['milestone.list', `milestone.indicator.${indicatorId}`]
        })
      },
      fetcher: () =>
        apiClient.get<ApiResponse<MilestonePairingStatus>>(`/milestones/indicator/${indicatorId}/pairing-status`)
    })
  },

  /**
   * 检查是否可以填报指定里程碑（补录规则验证）
   */
  async canReportOnMilestone(
    indicatorId: string,
    milestoneId: string
  ): Promise<ApiResponse<MilestoneReportValidation>> {
    return fetchWithCache({
      key: buildQueryKey(
        'milestone',
        'reportValidation',
        withMilestoneCacheContext({ indicatorId, milestoneId })
      ),
      policy: {
        ...createShortMemoryPolicy(CACHE_TTL.MILESTONE_HOT, {
          tags: ['milestone.list', `milestone.indicator.${indicatorId}`, `milestone.detail.${milestoneId}`]
        })
      },
      fetcher: () =>
        apiClient.get<ApiResponse<MilestoneReportValidation>>(
          `/milestones/indicator/${indicatorId}/can-report/${milestoneId}`
        )
    })
  },

  /**
   * 获取里程碑详情
   */
  async getMilestoneById(milestoneId: string): Promise<ApiResponse<Milestone>> {
    return fetchWithCache({
      key: buildQueryKey('milestone', 'detail', withMilestoneCacheContext({ milestoneId })),
      policy: {
        ...createMemoryDetailPolicy({
          tags: ['milestone.list', `milestone.detail.${milestoneId}`]
        })
      },
      fetcher: () => apiClient.get<ApiResponse<Milestone>>(`/milestones/${milestoneId}`)
    })
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
