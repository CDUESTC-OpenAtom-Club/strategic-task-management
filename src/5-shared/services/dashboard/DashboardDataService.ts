/**
 * Dashboard Data Service
 *
 * 负责仪表板数据的获取和转换
 * 分离数据层逻辑，使组件更专注于 UI 展示
 */

import type { DashboardData, Indicator } from '@/5-shared/types'
import { useStrategicStore } from '@/3-features/task/model/strategic'
import { useAuthStore } from '@/3-features/auth/model/store'
import { useTimeContextStore } from '@/5-shared/lib/timeContext'
import { useOrgStore } from '@/3-features/organization/model/store'
import { logger } from '@/5-shared/lib/utils/logger'

export class DashboardDataService {
  private strategicStore: ReturnType<typeof useStrategicStore>
  private authStore: ReturnType<typeof useAuthStore>
  private timeContext: ReturnType<typeof useTimeContextStore>
  private orgStore: ReturnType<typeof useOrgStore>

  constructor() {
    this.strategicStore = useStrategicStore()
    this.authStore = useAuthStore()
    this.timeContext = useTimeContextStore()
    this.orgStore = useOrgStore()
  }

  /**
   * 获取仪表板数据
   * 根据当前用户角色和时间上下文获取相应的数据
   */
  async fetchDashboardData(): Promise<DashboardData> {
    try {
      logger.debug('[DashboardDataService] Fetching dashboard data...')

      // 确保数据已加载
      if (this.strategicStore.indicators.length === 0) {
        await this.strategicStore.fetchIndicators()
      }

      return this.transformDashboardData()
    } catch (error) {
      logger.error('[DashboardDataService] Failed to fetch dashboard data:', error)
      throw error
    }
  }

  /**
   * 转换仪表板数据
   * 将原始数据转换为 UI 所需的格式
   */
  private transformDashboardData(): DashboardData {
    const { indicators } = this.strategicStore
    const currentYear = this.timeContext.currentYear

    // 根据角色和时间上下文过滤指标
    const filteredIndicators = this.filterIndicatorsByRoleAndTime(indicators, currentYear)

    return {
      indicators: filteredIndicators,
      summary: this.calculateSummary(filteredIndicators),
      statistics: this.calculateStatistics(filteredIndicators)
    }
  }

  /**
   * 根据角色和时间上下文过滤指标
   */
  private filterIndicatorsByRoleAndTime(indicators: Indicator[], currentYear: number): Indicator[] {
    const { currentUser } = this.authStore
    const orgLevel = this.orgStore.currentOrgLevel

    return indicators.filter(indicator => {
      // 年份过滤
      const indicatorYear = indicator.year || currentYear
      if (indicatorYear !== currentYear) {
        return false
      }

      // 角色权限过滤
      if (orgLevel === 'secondary_college') {
        // 二级学院只看自己的指标
        return indicator.responsible_dept === currentUser?.department
      }

      if (orgLevel === 'functional') {
        // 职能部门看自己下发的指标
        return indicator.owner_dept === currentUser?.department
      }

      // 战略发展部可以看所有指标
      return true
    })
  }

  /**
   * 计算摘要信息
   */
  private calculateSummary(indicators: Indicator[]) {
    const total = indicators.length
    const completed = indicators.filter(i => i.progress >= 100).length
    const inProgress = indicators.filter(i => i.progress > 0 && i.progress < 100).length
    const notStarted = indicators.filter(i => i.progress === 0).length

    return {
      total,
      completed,
      inProgress,
      notStarted,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
    }
  }

  /**
   * 计算统计数据
   */
  private calculateStatistics(indicators: Indicator[]) {
    const basicIndicators = indicators.filter(i => i.type2 === '基础性')
    const developmentIndicators = indicators.filter(i => i.type2 === '发展性')

    const basicAvg =
      basicIndicators.length > 0
        ? Math.round(
            basicIndicators.reduce((sum, i) => sum + i.progress, 0) / basicIndicators.length
          )
        : 0

    const developmentAvg =
      developmentIndicators.length > 0
        ? Math.round(
            developmentIndicators.reduce((sum, i) => sum + i.progress, 0) /
              developmentIndicators.length
          )
        : 0

    return {
      basicAvg,
      developmentAvg,
      totalAvg: Math.round((basicAvg + developmentAvg * 0.2) * 100) / 100
    }
  }

  /**
   * 刷新数据
   */
  async refresh(): Promise<void> {
    try {
      await this.strategicStore.fetchIndicators()
      logger.debug('[DashboardDataService] Data refreshed successfully')
    } catch (error) {
      logger.error('[DashboardDataService] Failed to refresh data:', error)
      throw error
    }
  }
}

// 导出单例实例函数
export function useDashboardDataService(): DashboardDataService {
  return new DashboardDataService()
}
