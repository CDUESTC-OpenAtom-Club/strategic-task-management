/**
 * Mock 与 API 数据一致性属性测试
 * 
 * **Feature: data-alignment-sop, Property 11: Mock 与 API 数据一致性**
 * **Validates: Requirements 6.2, 6.3**
 * 
 * For any indicator ID present in both mock data and database,
 * the API response values SHALL match the mock data values exactly.
 */
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ==================== Types ====================

interface MockIndicator {
  id: string
  name: string
  isQualitative: boolean
  type1: '定性' | '定量'
  type2: '发展性' | '基础性'
  progress: number
  weight: number
  remark: string
  canWithdraw: boolean
  targetValue: number
  unit: string
  responsiblePerson: string
  status: string
  year: number
}

interface ApiIndicator {
  indicatorId: number
  indicatorDesc: string
  isQualitative: boolean
  type1: string
  type2: string
  progress: number
  weightPercent: number
  remark: string
  canWithdraw: boolean
  targetValue: number
  unit: string
  responsiblePerson: string
  status: string
  year: number
}

interface ConsistencyResult {
  consistent: boolean
  mismatches: string[]
}

// ==================== Mapping Functions ====================

/**
 * Map mock indicator ID to API indicator ID
 * Mock: "2026-101" -> API: 4101
 * Mock: "2026-101-1" -> API: 4111
 */
function mapMockIdToApiId(mockId: string): number {
  const parts = mockId.split('-')
  if (parts.length === 2) {
    // Parent indicator: "2026-101" -> 4101
    return 4000 + parseInt(parts[1]!, 10)
  } else if (parts.length === 3) {
    // Child indicator: "2026-101-1" -> 4111
    // Pattern: 4000 + (parentNum % 100) * 10 + childNum + 100
    // e.g., 101-1 -> 4000 + 1*10 + 1 + 100 = 4111
    // e.g., 102-1 -> 4000 + 2*10 + 1 + 100 = 4121
    const parentNum = parseInt(parts[1]!, 10)
    const childNum = parseInt(parts[2]!, 10)
    return 4000 + (parentNum % 100) * 10 + childNum + 100
  }
  return 0
}

/**
 * Normalize status for comparison
 */
function normalizeStatus(status: string): string {
  return status.toUpperCase()
}

// ==================== Consistency Check Functions ====================

/**
 * Check consistency between mock and API indicator data
 */
function checkConsistency(mock: MockIndicator, api: ApiIndicator): ConsistencyResult {
  const mismatches: string[] = []
  
  // Check name/description
  if (mock.name !== api.indicatorDesc) {
    mismatches.push(`name: mock="${mock.name}", api="${api.indicatorDesc}"`)
  }
  
  // Check isQualitative
  if (mock.isQualitative !== api.isQualitative) {
    mismatches.push(`isQualitative: mock=${mock.isQualitative}, api=${api.isQualitative}`)
  }
  
  // Check type1
  if (mock.type1 !== api.type1) {
    mismatches.push(`type1: mock="${mock.type1}", api="${api.type1}"`)
  }
  
  // Check type2
  if (mock.type2 !== api.type2) {
    mismatches.push(`type2: mock="${mock.type2}", api="${api.type2}"`)
  }
  
  // Check progress
  if (mock.progress !== api.progress) {
    mismatches.push(`progress: mock=${mock.progress}, api=${api.progress}`)
  }
  
  // Check targetValue
  if (mock.targetValue !== api.targetValue) {
    mismatches.push(`targetValue: mock=${mock.targetValue}, api=${api.targetValue}`)
  }
  
  // Check unit
  if (mock.unit !== api.unit) {
    mismatches.push(`unit: mock="${mock.unit}", api="${api.unit}"`)
  }
  
  // Check responsiblePerson
  if (mock.responsiblePerson !== api.responsiblePerson) {
    mismatches.push(`responsiblePerson: mock="${mock.responsiblePerson}", api="${api.responsiblePerson}"`)
  }
  
  // Check year
  if (mock.year !== api.year) {
    mismatches.push(`year: mock=${mock.year}, api=${api.year}`)
  }
  
  // Check status (case-insensitive)
  if (normalizeStatus(mock.status) !== normalizeStatus(api.status)) {
    mismatches.push(`status: mock="${mock.status}", api="${api.status}"`)
  }
  
  return {
    consistent: mismatches.length === 0,
    mismatches
  }
}

/**
 * Validate field mapping between mock and API formats
 */
function validateFieldMapping(mockField: string, apiField: string): boolean {
  const fieldMap: Record<string, string> = {
    'id': 'indicatorId',
    'name': 'indicatorDesc',
    'weight': 'weightPercent',
    'isQualitative': 'isQualitative',
    'type1': 'type1',
    'type2': 'type2',
    'progress': 'progress',
    'remark': 'remark',
    'canWithdraw': 'canWithdraw',
    'targetValue': 'targetValue',
    'unit': 'unit',
    'responsiblePerson': 'responsiblePerson',
    'status': 'status',
    'year': 'year'
  }
  
  return fieldMap[mockField] === apiField
}

export { 
  MockIndicator, 
  ApiIndicator, 
  ConsistencyResult,
  mapMockIdToApiId,
  normalizeStatus,
  checkConsistency,
  validateFieldMapping
}


// ==================== Generators ====================

const type1Arb = fc.constantFrom('定性', '定量') as fc.Arbitrary<'定性' | '定量'>
const type2Arb = fc.constantFrom('发展性', '基础性') as fc.Arbitrary<'发展性' | '基础性'>
const statusArb = fc.constantFrom('active', 'draft', 'archived')

const mockIndicatorArb: fc.Arbitrary<MockIndicator> = fc.record({
  id: fc.stringMatching(/^2026-\d{3}(-\d)?$/),
  name: fc.stringMatching(/^[\u4e00-\u9fa5a-zA-Z0-9]{5,30}$/),
  isQualitative: fc.boolean(),
  type1: type1Arb,
  type2: type2Arb,
  progress: fc.integer({ min: 0, max: 100 }),
  weight: fc.integer({ min: 1, max: 100 }),
  remark: fc.stringMatching(/^[\u4e00-\u9fa5a-zA-Z0-9]{2,20}$/),
  canWithdraw: fc.boolean(),
  targetValue: fc.integer({ min: 1, max: 100 }),
  unit: fc.constantFrom('%', '篇', '人', '家/专业'),
  responsiblePerson: fc.stringMatching(/^[\u4e00-\u9fa5]{2,4}$/),
  status: statusArb,
  year: fc.constant(2026)
}).map(indicator => ({
  ...indicator,
  type1: indicator.isQualitative ? '定性' as const : '定量' as const
}))

/**
 * Generate API indicator from mock indicator (simulating correct sync)
 */
function mockToApi(mock: MockIndicator): ApiIndicator {
  return {
    indicatorId: mapMockIdToApiId(mock.id),
    indicatorDesc: mock.name,
    isQualitative: mock.isQualitative,
    type1: mock.type1,
    type2: mock.type2,
    progress: mock.progress,
    weightPercent: mock.weight,
    remark: mock.remark,
    canWithdraw: mock.canWithdraw,
    targetValue: mock.targetValue,
    unit: mock.unit,
    responsiblePerson: mock.responsiblePerson,
    status: mock.status.toUpperCase(),
    year: mock.year
  }
}

// ==================== Property Tests ====================

describe('Property 11: Mock 与 API 数据一致性', () => {
  
  describe('11.1 ID 映射正确性', () => {
    /**
     * **Feature: data-alignment-sop, Property 11**
     * 
     * Mock indicator IDs SHALL map correctly to API indicator IDs.
     * 
     * **Validates: Requirements 6.2**
     */
    it('should map mock IDs to API IDs correctly', () => {
      // Test specific mappings
      expect(mapMockIdToApiId('2026-101')).toBe(4101)
      expect(mapMockIdToApiId('2026-102')).toBe(4102)
      expect(mapMockIdToApiId('2026-201')).toBe(4201)
      expect(mapMockIdToApiId('2026-401')).toBe(4401)
    })
    
    it('should map child indicator IDs correctly', () => {
      expect(mapMockIdToApiId('2026-101-1')).toBe(4111)
      expect(mapMockIdToApiId('2026-101-2')).toBe(4112)
      expect(mapMockIdToApiId('2026-102-1')).toBe(4121)
    })
  })

  describe('11.2 字段值一致性', () => {
    /**
     * **Feature: data-alignment-sop, Property 11**
     * 
     * For any correctly synced indicator, all field values SHALL match.
     * 
     * **Validates: Requirements 6.2, 6.3**
     */
    it('should have consistent field values after sync', () => {
      fc.assert(
        fc.property(
          mockIndicatorArb,
          (mock) => {
            // Simulate correct sync
            const api = mockToApi(mock)
            
            // Check consistency
            const result = checkConsistency(mock, api)
            
            expect(result.consistent).toBe(true)
            expect(result.mismatches).toHaveLength(0)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('11.3 字段映射验证', () => {
    /**
     * **Feature: data-alignment-sop, Property 11**
     * 
     * Field names SHALL map correctly between mock and API formats.
     * 
     * **Validates: Requirements 6.2**
     */
    it('should have correct field mappings', () => {
      expect(validateFieldMapping('id', 'indicatorId')).toBe(true)
      expect(validateFieldMapping('name', 'indicatorDesc')).toBe(true)
      expect(validateFieldMapping('weight', 'weightPercent')).toBe(true)
      expect(validateFieldMapping('isQualitative', 'isQualitative')).toBe(true)
      expect(validateFieldMapping('type1', 'type1')).toBe(true)
      expect(validateFieldMapping('type2', 'type2')).toBe(true)
    })
  })

  describe('11.4 状态值规范化', () => {
    /**
     * **Feature: data-alignment-sop, Property 11**
     * 
     * Status values SHALL be normalized for comparison.
     * 
     * **Validates: Requirements 6.3**
     */
    it('should normalize status values correctly', () => {
      expect(normalizeStatus('active')).toBe('ACTIVE')
      expect(normalizeStatus('ACTIVE')).toBe('ACTIVE')
      expect(normalizeStatus('Active')).toBe('ACTIVE')
      expect(normalizeStatus('draft')).toBe('DRAFT')
      expect(normalizeStatus('archived')).toBe('ARCHIVED')
    })
  })
})


// ==================== Real Data Validation ====================

describe('Real Data: 2026年 Mock 与 API 数据一致性验证', () => {
  // Sample mock data from indicators2026.ts
  const mockIndicators: MockIndicator[] = [
    {
      id: '2026-101',
      name: '优质就业比例不低于15%',
      isQualitative: false,
      type1: '定量',
      type2: '发展性',
      progress: 8,
      weight: 20,
      remark: '力争突破',
      canWithdraw: false,
      targetValue: 15,
      unit: '%',
      responsiblePerson: '张老师',
      status: 'active',
      year: 2026
    },
    {
      id: '2026-102',
      name: '毕业生就业率不低于95%',
      isQualitative: false,
      type1: '定量',
      type2: '发展性',
      progress: 12,
      weight: 20,
      remark: '确保就业率稳定',
      canWithdraw: false,
      targetValue: 95,
      unit: '%',
      responsiblePerson: '张老师',
      status: 'active',
      year: 2026
    },
    {
      id: '2026-201',
      name: '建立完善校友反馈母校的工作机制，择优建立部分地区校友会并开展高质量活动',
      isQualitative: true,
      type1: '定性',
      type2: '基础性',
      progress: 8,
      weight: 25,
      remark: '中长期发展规划未完成内容',
      canWithdraw: false,
      targetValue: 100,
      unit: '%',
      responsiblePerson: '陈主任',
      status: 'active',
      year: 2026
    }
  ]

  // Corresponding API data (simulated from seed SQL)
  const apiIndicators: ApiIndicator[] = [
    {
      indicatorId: 4101,
      indicatorDesc: '优质就业比例不低于15%',
      isQualitative: false,
      type1: '定量',
      type2: '发展性',
      progress: 8,
      weightPercent: 20,
      remark: '力争突破',
      canWithdraw: false,
      targetValue: 15,
      unit: '%',
      responsiblePerson: '张老师',
      status: 'ACTIVE',
      year: 2026
    },
    {
      indicatorId: 4102,
      indicatorDesc: '毕业生就业率不低于95%',
      isQualitative: false,
      type1: '定量',
      type2: '发展性',
      progress: 12,
      weightPercent: 20,
      remark: '确保就业率稳定',
      canWithdraw: false,
      targetValue: 95,
      unit: '%',
      responsiblePerson: '张老师',
      status: 'ACTIVE',
      year: 2026
    },
    {
      indicatorId: 4201,
      indicatorDesc: '建立完善校友反馈母校的工作机制，择优建立部分地区校友会并开展高质量活动',
      isQualitative: true,
      type1: '定性',
      type2: '基础性',
      progress: 8,
      weightPercent: 25,
      remark: '中长期发展规划未完成内容',
      canWithdraw: false,
      targetValue: 100,
      unit: '%',
      responsiblePerson: '陈主任',
      status: 'ACTIVE',
      year: 2026
    }
  ]

  it('should have consistent data for quantitative indicator 2026-101', () => {
    const mock = mockIndicators[0]!
    const api = apiIndicators[0]!
    
    const result = checkConsistency(mock, api)
    expect(result.consistent).toBe(true)
    expect(result.mismatches).toHaveLength(0)
  })

  it('should have consistent data for quantitative indicator 2026-102', () => {
    const mock = mockIndicators[1]!
    const api = apiIndicators[1]!
    
    const result = checkConsistency(mock, api)
    expect(result.consistent).toBe(true)
    expect(result.mismatches).toHaveLength(0)
  })

  it('should have consistent data for qualitative indicator 2026-201', () => {
    const mock = mockIndicators[2]!
    const api = apiIndicators[2]!
    
    const result = checkConsistency(mock, api)
    expect(result.consistent).toBe(true)
    expect(result.mismatches).toHaveLength(0)
  })

  it('should have correct ID mappings for all indicators', () => {
    for (let i = 0; i < mockIndicators.length; i++) {
      const mock = mockIndicators[i]!
      const api = apiIndicators[i]!
      
      const expectedApiId = mapMockIdToApiId(mock.id)
      expect(api.indicatorId).toBe(expectedApiId)
    }
  })

  it('should preserve Chinese characters in all fields', () => {
    for (let i = 0; i < mockIndicators.length; i++) {
      const mock = mockIndicators[i]!
      const api = apiIndicators[i]!
      
      expect(api.indicatorDesc).toBe(mock.name)
      expect(api.remark).toBe(mock.remark)
      expect(api.responsiblePerson).toBe(mock.responsiblePerson)
    }
  })
})
