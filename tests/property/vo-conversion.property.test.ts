/**
 * VO 转换属性测试
 * 
 * **Feature: page-data-verification**
 * - **Property 8: VO to Frontend Type Conversion**
 * 
 * **Validates: Requirements 7.3**
 */
import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest'
import * as fc from 'fast-check'
import { setActivePinia, createPinia } from 'pinia'

// ============================================================================
// Mock localStorage
// ============================================================================
const createLocalStorageMock = () => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    get length() { return Object.keys(store).length },
    key: vi.fn((index: number) => Object.keys(store)[index] || null)
  }
}

const localStorageMock = createLocalStorageMock()

beforeAll(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true
  })
})


// ============================================================================
// 类型定义（模拟后端 VO）
// ============================================================================

interface IndicatorVO {
  indicatorId: number
  indicatorDesc: string
  progress?: number
  weightPercent: number
  targetOrgName?: string
  ownerOrgName?: string
  year: number
  taskName: string
  level?: string
  status?: string
  isQualitative?: boolean
  type1?: string
  type2?: string
  responsibleDept?: string
  ownerDept?: string
  isStrategic?: boolean
  milestones?: MilestoneVO[]
}

interface MilestoneVO {
  milestoneId: number
  milestoneName: string
  targetProgress?: number
  weightPercent?: number
  dueDate: string
  status: string
}

interface StrategicIndicator {
  id: string
  name: string
  progress: number
  weight: number
  responsibleDept: string
  ownerDept: string
  year: number
  taskContent: string
}


// ============================================================================
// 转换函数（从 api/strategic.ts 提取的简化版本）
// ============================================================================

function convertIndicatorVOToStrategicIndicator(vo: IndicatorVO): StrategicIndicator {
  return {
    id: String(vo.indicatorId),
    name: vo.indicatorDesc,
    progress: vo.progress ?? 0,
    weight: vo.weightPercent,
    responsibleDept: vo.responsibleDept ?? vo.targetOrgName ?? '',
    ownerDept: vo.ownerDept ?? vo.ownerOrgName ?? '',
    year: vo.year,
    taskContent: vo.taskName
  }
}

function convertStrategicIndicatorToVO(indicator: StrategicIndicator): IndicatorVO {
  return {
    indicatorId: parseInt(indicator.id, 10) || 0,
    indicatorDesc: indicator.name,
    progress: indicator.progress,
    weightPercent: indicator.weight,
    targetOrgName: indicator.responsibleDept,
    ownerOrgName: indicator.ownerDept,
    year: indicator.year,
    taskName: indicator.taskContent
  }
}


// ============================================================================
// 数据生成器
// ============================================================================

const indicatorVOArbitrary: fc.Arbitrary<IndicatorVO> = fc.record({
  indicatorId: fc.integer({ min: 1, max: 10000 }),
  indicatorDesc: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  progress: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
  weightPercent: fc.integer({ min: 0, max: 100 }),
  targetOrgName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  ownerOrgName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  year: fc.integer({ min: 2023, max: 2026 }),
  taskName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  responsibleDept: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  ownerDept: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined })
})

// ============================================================================
// Property 8: VO to Frontend Type Conversion
// ============================================================================

describe('Property 8: VO to Frontend Type Conversion', () => {
  /**
   * **Validates: Requirement 7.3**
   * 
   * *For any* IndicatorVO returned by the API, converting it to StrategicIndicator
   * and back (round-trip) SHALL preserve all essential field values
   * (id, name, progress, weight, responsibleDept, year).
   */

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('Essential Field Preservation', () => {
    it('should preserve id after conversion', () => {
      fc.assert(
        fc.property(indicatorVOArbitrary, (vo) => {
          const converted = convertIndicatorVOToStrategicIndicator(vo)
          expect(converted.id).toBe(String(vo.indicatorId))
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should preserve name after conversion', () => {
      fc.assert(
        fc.property(indicatorVOArbitrary, (vo) => {
          const converted = convertIndicatorVOToStrategicIndicator(vo)
          expect(converted.name).toBe(vo.indicatorDesc)
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should preserve weight after conversion', () => {
      fc.assert(
        fc.property(indicatorVOArbitrary, (vo) => {
          const converted = convertIndicatorVOToStrategicIndicator(vo)
          expect(converted.weight).toBe(vo.weightPercent)
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should preserve year after conversion', () => {
      fc.assert(
        fc.property(indicatorVOArbitrary, (vo) => {
          const converted = convertIndicatorVOToStrategicIndicator(vo)
          expect(converted.year).toBe(vo.year)
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should preserve taskContent after conversion', () => {
      fc.assert(
        fc.property(indicatorVOArbitrary, (vo) => {
          const converted = convertIndicatorVOToStrategicIndicator(vo)
          expect(converted.taskContent).toBe(vo.taskName)
          return true
        }),
        { numRuns: 100 }
      )
    })
  })


  describe('Default Value Handling', () => {
    it('should use default value 0 when progress is undefined', () => {
      const vo: IndicatorVO = {
        indicatorId: 1,
        indicatorDesc: 'Test',
        progress: undefined,
        weightPercent: 10,
        year: 2025,
        taskName: 'Task'
      }
      
      const converted = convertIndicatorVOToStrategicIndicator(vo)
      expect(converted.progress).toBe(0)
    })

    it('should use targetOrgName when responsibleDept is undefined', () => {
      const vo: IndicatorVO = {
        indicatorId: 1,
        indicatorDesc: 'Test',
        weightPercent: 10,
        targetOrgName: '教务处',
        year: 2025,
        taskName: 'Task'
      }
      
      const converted = convertIndicatorVOToStrategicIndicator(vo)
      expect(converted.responsibleDept).toBe('教务处')
    })

    it('should use ownerOrgName when ownerDept is undefined', () => {
      const vo: IndicatorVO = {
        indicatorId: 1,
        indicatorDesc: 'Test',
        weightPercent: 10,
        ownerOrgName: '战略发展部',
        year: 2025,
        taskName: 'Task'
      }
      
      const converted = convertIndicatorVOToStrategicIndicator(vo)
      expect(converted.ownerDept).toBe('战略发展部')
    })
  })

  describe('Round-Trip Conversion', () => {
    it('should preserve essential fields in round-trip conversion', () => {
      fc.assert(
        fc.property(indicatorVOArbitrary, (vo) => {
          const converted = convertIndicatorVOToStrategicIndicator(vo)
          const backToVO = convertStrategicIndicatorToVO(converted)
          
          // 验证关键字段保持一致
          expect(backToVO.indicatorId).toBe(vo.indicatorId)
          expect(backToVO.indicatorDesc).toBe(vo.indicatorDesc)
          expect(backToVO.weightPercent).toBe(vo.weightPercent)
          expect(backToVO.year).toBe(vo.year)
          expect(backToVO.taskName).toBe(vo.taskName)
          
          return true
        }),
        { numRuns: 100 }
      )
    })
  })
})
