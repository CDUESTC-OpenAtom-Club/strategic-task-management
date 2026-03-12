/**
 * Dashboard Feature Store
 * 
 * Migrated from stores/dashboard.ts
 * Dashboard data and visualization state management
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  DashboardData,
  DepartmentProgress,
  DrillDownLevel,
  BreadcrumbItem,
  FilterState,
  AlertSummary,
  StrategicIndicator,
  ComparisonItem,
  SankeyData,
  SourcePieData,
  OrgLevel
} from '@/types'
import { useStrategicStore } from '@/features/task/model/strategic'
import { useAuthStore } from '@/features/auth/model/store'
import { useTimeContextStore } from '@/shared/lib/timeContext'
import { getProgressStatus, isSecondaryCollege } from '@/utils/colors'
import { useOrgStore } from '@/features/organization/model/store'
import api from '@/api'
import { logger } from '@/utils/logger'

export const useDashboardStore = defineStore('dashboard', () => {
  // ============ State ============
  const dashboardData = ref<DashboardData | null>(null)
  const departmentProgress = ref<DepartmentProgress[]>([])
  const recentActivities = ref<Array<Record<string, unknown>>>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 下钻和筛选状�?
  const currentLevel = ref<DrillDownLevel>('organization')
  const breadcrumbs = ref<BreadcrumbItem[]>([
    { level: 'organization', label: '组织总览' }
  ])
  const filters = ref<FilterState>({})
  const selectedDepartment = ref<string | undefined>()
  const selectedIndicator = ref<string | undefined>()

  // 三级联动状�?
  const currentOrgLevel = ref<OrgLevel>('strategy')
  const selectedFunctionalDept = ref<string | undefined>()
  const selectedCollege = ref<string | undefined>()

  // ============ Getters ============
  const completionRate = computed(() => dashboardData.value?.completionRate || 0)
  const totalScore = computed(() => dashboardData.value?.totalScore || 0)
  const warningCount = computed(() => dashboardData.value?.warningCount || 0)
  const alertStats = computed(() => dashboardData.value?.alertIndicators || { severe: 0, moderate: 0, normal: 0 })
  
  // 筛选后的指标列�?
  const filteredIndicators = computed<StrategicIndicator[]>(() => {
    const strategicStore = useStrategicStore()
    const timeContext = useTimeContextStore()
    let result = [...strategicStore.indicators]
    
    const currentYear = timeContext.currentYear
    const realYear = timeContext.realCurrentYear
    result = result.filter(i => {
      const indicatorYear = i.year || realYear
      return indicatorYear === currentYear
    })
    
    if (filters.value.department) {
      result = result.filter(i => i.responsibleDept === filters.value.department)
    }
    
    if (filters.value.indicatorType) {
      result = result.filter(i => i.type1 === filters.value.indicatorType)
    }
    
    if (filters.value.alertLevel) {
      result = result.filter(i => {
        const level = getAlertLevel(i.progress)
        return level === filters.value.alertLevel
      })
    }
    
    if (currentLevel.value === 'department' && selectedDepartment.value) {
      result = result.filter(i => i.responsibleDept === selectedDepartment.value)
    }
    
    return result
  })
  
  // 辅助函数：获取预警级�?
  const getAlertLevel = (progress: number): 'severe' | 'moderate' | 'normal' => {
    if (progress < 30) {return 'severe'}
    if (progress < 60) {return 'moderate'}
    return 'normal'
  }

  // 预警分布
  const alertDistribution = computed<AlertSummary>(() => {
    const strategicStore = useStrategicStore()
    const indicators = filteredIndicators.value.length > 0 
      ? filteredIndicators.value 
      : strategicStore.indicators
    
    const severe = indicators.filter(i => i.progress < 30).length
    const moderate = indicators.filter(i => i.progress >= 30 && i.progress < 60).length
    const normal = indicators.filter(i => i.progress >= 60).length
    
    return { severe, moderate, normal, total: indicators.length }
  })

  // ============ Actions ============
  const fetchDashboardData = async () => {
    loading.value = true
    error.value = null

    try {
      logger.info('[Dashboard Store] Fetching dashboard data from API...')
      const response = await api.get<DashboardData>('/dashboard')

      if (response.success && response.data) {
        dashboardData.value = response.data
        logger.info('[Dashboard Store] Dashboard data loaded successfully')
      } else {
        throw new Error(response.message || 'Failed to fetch dashboard data')
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error occurred'
      logger.error('[Dashboard Store] Failed to fetch dashboard data:', err)
    } finally {
      loading.value = false
    }
  }

  const fetchDepartmentProgress = async () => {
    try {
      logger.info('[Dashboard Store] Fetching department progress from API...')
      const response = await api.get<DepartmentProgress[]>('/dashboard/department-progress')

      if (response.success && response.data) {
        departmentProgress.value = response.data
        logger.info('[Dashboard Store] Department progress loaded successfully')
      }
    } catch (err) {
      logger.error('[Dashboard Store] Failed to fetch department progress:', err)
    }
  }

  const fetchRecentActivities = async () => {
    try {
      logger.info('[Dashboard Store] Fetching recent activities from API...')
      const response = await api.get<Array<Record<string, unknown>>>('/dashboard/recent-activities')

      if (response.success && response.data) {
        recentActivities.value = response.data
        logger.info('[Dashboard Store] Recent activities loaded successfully')
      }
    } catch (err) {
      logger.error('[Dashboard Store] Failed to fetch recent activities:', err)
    }
  }

  const refreshDashboard = async () => {
    await Promise.all([
      fetchDashboardData(),
      fetchDepartmentProgress(),
      fetchRecentActivities(),
    ])
  }

  // 下钻操作
  const drillDown = (level: DrillDownLevel, value: string, label: string) => {
    currentLevel.value = level
    
    if (level === 'department') {
      selectedDepartment.value = value
      selectedIndicator.value = undefined
      breadcrumbs.value = [
        { level: 'organization', label: '组织总览' },
        { level: 'department', label, value }
      ]
    } else if (level === 'indicator') {
      selectedIndicator.value = value
      breadcrumbs.value = [
        { level: 'organization', label: '组织总览' },
        ...(selectedDepartment.value ? [{ 
          level: 'department' as DrillDownLevel, 
          label: selectedDepartment.value, 
          value: selectedDepartment.value 
        }] : []),
        { level: 'indicator', label, value }
      ]
    }
  }
  
  // 面包屑导�?
  const navigateToBreadcrumb = (index: number) => {
    const target = breadcrumbs.value[index]
    if (!target) {return}
    
    currentLevel.value = target.level
    breadcrumbs.value = breadcrumbs.value.slice(0, index + 1)
    
    if (target.level === 'organization') {
      selectedDepartment.value = undefined
      selectedIndicator.value = undefined
    } else if (target.level === 'department') {
      selectedDepartment.value = target.value
      selectedIndicator.value = undefined
    }
  }
  
  // 应用筛�?
  const applyFilter = (filter: Partial<FilterState>) => {
    filters.value = { ...filters.value, ...filter }
  }
  
  // 重置筛选和下钻状�?
  const resetFilters = () => {
    filters.value = {}
    currentLevel.value = 'organization'
    selectedDepartment.value = undefined
    selectedIndicator.value = undefined
    breadcrumbs.value = [{ level: 'organization', label: '组织总览' }]
    currentOrgLevel.value = 'strategy'
    selectedFunctionalDept.value = undefined
    selectedCollege.value = undefined
  }

  return {
    // State
    dashboardData,
    departmentProgress,
    recentActivities,
    loading,
    error,
    currentLevel,
    breadcrumbs,
    filters,
    selectedDepartment,
    selectedIndicator,
    currentOrgLevel,
    selectedFunctionalDept,
    selectedCollege,

    // Getters
    completionRate,
    totalScore,
    warningCount,
    alertStats,
    filteredIndicators,
    alertDistribution,

    // Actions
    fetchDashboardData,
    fetchDepartmentProgress,
    fetchRecentActivities,
    refreshDashboard,
    drillDown,
    navigateToBreadcrumb,
    applyFilter,
    resetFilters
  }
})
