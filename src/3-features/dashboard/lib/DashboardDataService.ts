/**
 * Dashboard Data Service
 *
 * 负责仪表板数据的获取和转换。
 * 该服务依赖 dashboard feature 需要的 store，因此应归属于 feature 层。
 */

import type { DashboardData, Indicator } from '@/shared/types'
import { useStrategicStore } from '@/features/task/model/strategic'
import { useAuthStore } from '@/features/auth/model/store'
import { useTimeContextStore } from '@/shared/lib/timeContext'
import { useOrgStore } from '@/features/organization/model/store'
import { logger } from '@/shared/lib/utils/logger'

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
   * 将原始数据转换为 UI 所需格式
   */
  private transformDashboardData(): DashboardData {
    const indicators = this.getFilteredIndicators()
    const alertIndicators = indicators.filter(i => i.progress < 60)

    return {
      totalScore: this.calculateTotalScore(indicators),
      basicScore: this.calculateBasicScore(indicators),
      developmentScore: this.calculateDevelopmentScore(indicators),
      completionRate: this.calculateCompletionRate(indicators),
      warningCount: alertIndicators.length,
      totalIndicators: indicators.length,
      completedIndicators: indicators.filter(i => i.progress >= 100).length,
      alertIndicators: {
        severe: alertIndicators.filter(i => i.progress < 30).length,
        moderate: alertIndicators.filter(i => i.progress >= 30 && i.progress < 60).length,
        normal: indicators.filter(i => i.progress >= 60 && i.progress < 100).length
      }
    }
  }

  /**
   * 根据登录用户和时间上下文筛选指标
   */
  private getFilteredIndicators(): Indicator[] {
    const { user } = this.authStore
    const currentYear = this.timeContext.selectedYear
    const indicators = this.strategicStore.indicators

    if (!user) {
      return indicators
    }

    return indicators.filter(indicator => {
      const yearMatched = !currentYear || indicator.year === currentYear
      const departmentMatched =
        !user.department || indicator.responsibleDept === user.department

      return yearMatched && departmentMatched
    })
  }

  private calculateTotalScore(indicators: Indicator[]): number {
    if (indicators.length === 0) {
      return 0
    }

    return Math.round(
      indicators.reduce((sum, indicator) => sum + indicator.progress * (indicator.weight || 1), 0) /
        indicators.reduce((sum, indicator) => sum + (indicator.weight || 1), 0)
    )
  }

  private calculateBasicScore(indicators: Indicator[]): number {
    const basicIndicators = indicators.filter(indicator => indicator.type2 === '基础性')
    return this.calculateTotalScore(basicIndicators)
  }

  private calculateDevelopmentScore(indicators: Indicator[]): number {
    const developmentIndicators = indicators.filter(indicator => indicator.type2 === '发展性')
    return this.calculateTotalScore(developmentIndicators)
  }

  private calculateCompletionRate(indicators: Indicator[]): number {
    if (indicators.length === 0) {
      return 0
    }

    const completedCount = indicators.filter(indicator => indicator.progress >= 100).length
    return Math.round((completedCount / indicators.length) * 100)
  }

  /**
   * 计算部门统计
   */
  private calculateDepartmentStats(indicators: Indicator[]) {
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

export function useDashboardDataService(): DashboardDataService {
  return new DashboardDataService()
}
