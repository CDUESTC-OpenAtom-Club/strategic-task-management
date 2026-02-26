import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDashboardStore } from '@/stores/dashboard'
import { useAuthStore } from '@/stores/auth'
import { useStrategicStore } from '@/stores/strategic'
import { isSecondaryCollege } from '@/utils/colors'

// Mock localStorage for node environment
beforeAll(() => {
  const localStorageMock = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(() => null),
  }
  ;(globalThis as any).localStorage = localStorageMock
})

// Helper to create test users
const createStrategyUser = () => ({
  id: '1',
  username: 'strategy_user',
  name: '战略部张三',
  role: 'strategic_dept' as const,
  department: '战略发展部',
  createdAt: new Date(),
  updatedAt: new Date()
})

const createFunctionalUser = () => ({
  id: '2',
  username: 'func_user',
  name: '就业处李四',
  role: 'functional_dept' as const,
  department: '就业创业指导中心',
  createdAt: new Date(),
  updatedAt: new Date()
})

const createCollegeUser = () => ({
  id: '3',
  username: 'college_user',
  name: '计算机学院王五',
  role: 'secondary_college' as const,
  department: '计算机学院',
  createdAt: new Date(),
  updatedAt: new Date()
})

describe('Dashboard Store - Three-tier Drilldown', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('Role-based data filtering', () => {
    it('strategic_dept should see all indicators', () => {
      const authStore = useAuthStore()
      const dashboardStore = useDashboardStore()
      const strategicStore = useStrategicStore()

      authStore.user = createStrategyUser()

      const visibleCount = dashboardStore.visibleIndicators.length
      const totalCount = strategicStore.indicators.length

      expect(visibleCount).toBe(totalCount)
      expect(visibleCount).toBeGreaterThan(0)
    })

    it('functional_dept should only see own department and colleges', () => {
      const authStore = useAuthStore()
      const dashboardStore = useDashboardStore()

      authStore.user = createFunctionalUser()

      const visible = dashboardStore.visibleIndicators

      expect(visible.some(i => i.responsibleDept === '就业创业指导中心')).toBe(true)
      expect(visible.some(i => i.ownerDept === '就业创业指导中心' && isSecondaryCollege(i.responsibleDept))).toBe(true)
      expect(visible.every(i =>
        i.responsibleDept === '就业创业指导中心' ||
        i.ownerDept === '就业创业指导中心'
      )).toBe(true)
    })

    it('secondary_college should only see own indicators', () => {
      const authStore = useAuthStore()
      const dashboardStore = useDashboardStore()

      authStore.user = createCollegeUser()

      const visible = dashboardStore.visibleIndicators

      expect(visible.every(i => i.responsibleDept === '计算机学院')).toBe(true)
      expect(visible.length).toBeGreaterThan(0)
    })
  })

  describe('Drill-down functionality', () => {
    it('should drill down to functional department', () => {
      const authStore = useAuthStore()
      const dashboardStore = useDashboardStore()

      authStore.user = createStrategyUser()

      dashboardStore.drillDownToDepartment('就业创业指导中心', 'functional')

      expect(dashboardStore.currentOrgLevel).toBe('functional')
      expect(dashboardStore.selectedFunctionalDept).toBe('就业创业指导中心')
      expect(dashboardStore.breadcrumbs.length).toBe(2)
      expect(dashboardStore.breadcrumbs[1]?.label).toBe('就业创业指导中心')
    })

    it('should drill down to college', () => {
      const authStore = useAuthStore()
      const dashboardStore = useDashboardStore()

      authStore.user = createStrategyUser()

      dashboardStore.drillDownToDepartment('就业创业指导中心', 'functional')
      dashboardStore.drillDownToDepartment('计算机学院', 'college')

      expect(dashboardStore.currentOrgLevel).toBe('college')
      expect(dashboardStore.selectedCollege).toBe('计算机学院')
      expect(dashboardStore.breadcrumbs.length).toBe(3)
      expect(dashboardStore.breadcrumbs[2]?.label).toBe('计算机学院')
    })

    it('should filter indicators after drill-down', () => {
      const authStore = useAuthStore()
      const dashboardStore = useDashboardStore()

      authStore.user = createStrategyUser()

      const beforeDrillDown = dashboardStore.visibleIndicators.length
      dashboardStore.drillDownToDepartment('计算机学院', 'college')
      const afterDrillDown = dashboardStore.visibleIndicators.length

      expect(afterDrillDown).toBeLessThan(beforeDrillDown)
      expect(dashboardStore.visibleIndicators.every(i =>
        i.responsibleDept === '计算机学院'
      )).toBe(true)
    })
  })

  describe('Department comparison calculation', () => {
    it('should compute department comparison correctly', () => {
      const authStore = useAuthStore()
      const dashboardStore = useDashboardStore()

      authStore.user = createStrategyUser()

      const comparison = dashboardStore.departmentComparison

      expect(comparison.length).toBeGreaterThan(0)

      comparison.forEach(item => {
        expect(item).toHaveProperty('dept')
        expect(item).toHaveProperty('progress')
        expect(item).toHaveProperty('score')
        expect(item).toHaveProperty('completionRate')
        expect(item).toHaveProperty('totalIndicators')
        expect(item).toHaveProperty('completedIndicators')
        expect(item).toHaveProperty('alertCount')
        expect(item).toHaveProperty('rank')
        expect(item).toHaveProperty('status')
      })
    })

    it('should rank departments correctly (highest progress first)', () => {
      const authStore = useAuthStore()
      const dashboardStore = useDashboardStore()

      authStore.user = createStrategyUser()

      const comparison = dashboardStore.departmentComparison

      if (comparison.length >= 2) {
        expect(comparison[0]?.rank).toBe(1)

        for (let i = 0; i < comparison.length - 1; i++) {
          const current = comparison[i]
          const next = comparison[i + 1]
          if (current && next) {
            expect(current.progress).toBeGreaterThanOrEqual(next.progress)
          }
        }

        comparison.forEach((item, index) => {
          expect(item.rank).toBe(index + 1)
        })
      }
    })
  })

  describe('Filter functionality', () => {
    it('should apply filters correctly', () => {
      const authStore = useAuthStore()
      const dashboardStore = useDashboardStore()

      authStore.user = createStrategyUser()

      const beforeFilter = dashboardStore.visibleIndicators.length
      dashboardStore.applyFilter({ indicatorType: '定量' })
      const afterFilter = dashboardStore.visibleIndicators.length

      expect(afterFilter).toBeLessThanOrEqual(beforeFilter)
      expect(dashboardStore.visibleIndicators.every(i => i.type1 === '定量')).toBe(true)
    })

    it('should reset filters correctly', () => {
      const authStore = useAuthStore()
      const dashboardStore = useDashboardStore()
      const strategicStore = useStrategicStore()

      authStore.user = createStrategyUser()

      dashboardStore.applyFilter({ indicatorType: '定量' })
      expect(dashboardStore.filters.indicatorType).toBe('定量')

      dashboardStore.resetFilters()

      expect(dashboardStore.filters).toEqual({})
      expect(dashboardStore.visibleIndicators.length).toBe(strategicStore.indicators.length)
    })
  })
})
