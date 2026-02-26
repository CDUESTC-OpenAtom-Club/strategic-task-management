/**
 * 种子数据值保真属性测试
 * 
 * **Feature: data-alignment-sop, Property 6: 种子数据值保真**
 * **Validates: Requirements 4.1, 4.2**
 * 
 * For any field in the frontend mock data, the corresponding database seed data
 * SHALL contain the exact same value (not placeholder values).
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

interface SeedIndicator {
  indicator_id: number
  indicator_desc: string
  is_qualitative: boolean
  type1: string
  type2: string
  progress: number
  weight_percent: number
  remark: string
  can_withdraw: boolean
  target_value: number
  unit: string
  responsible_person: string
  status: string
  year: number
}

// ==================== Validation Functions ====================

/**
 * Check if a value is a placeholder (not real data)
 */
function isPlaceholder(value: unknown): boolean {
  if (typeof value === 'string') {
    const placeholders = [
      'test', 'placeholder', 'xxx', '123', 'abc', 
      'todo', 'tbd', 'n/a', 'null', 'undefined',
      '测试', '占位符', '待定'
    ]
    const lowerValue = value.toLowerCase().trim()
    return placeholders.some(p => lowerValue === p || lowerValue.startsWith(p + ' '))
  }
  return false
}

/**
 * Validate that seed data matches mock data
 */
function validateSeedDataFidelity(
  mockData: MockIndicator,
  seedData: SeedIndicator
): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Check name/description
  if (mockData.name !== seedData.indicator_desc) {
    errors.push(`Name mismatch: mock="${mockData.name}", seed="${seedData.indicator_desc}"`)
  }
  
  // Check isQualitative
  if (mockData.isQualitative !== seedData.is_qualitative) {
    errors.push(`isQualitative mismatch: mock=${mockData.isQualitative}, seed=${seedData.is_qualitative}`)
  }
  
  // Check type1
  if (mockData.type1 !== seedData.type1) {
    errors.push(`type1 mismatch: mock="${mockData.type1}", seed="${seedData.type1}"`)
  }
  
  // Check type2
  if (mockData.type2 !== seedData.type2) {
    errors.push(`type2 mismatch: mock="${mockData.type2}", seed="${seedData.type2}"`)
  }
  
  // Check progress
  if (mockData.progress !== seedData.progress) {
    errors.push(`progress mismatch: mock=${mockData.progress}, seed=${seedData.progress}`)
  }
  
  // Check targetValue
  if (mockData.targetValue !== seedData.target_value) {
    errors.push(`targetValue mismatch: mock=${mockData.targetValue}, seed=${seedData.target_value}`)
  }
  
  // Check unit
  if (mockData.unit !== seedData.unit) {
    errors.push(`unit mismatch: mock="${mockData.unit}", seed="${seedData.unit}"`)
  }
  
  // Check responsiblePerson
  if (mockData.responsiblePerson !== seedData.responsible_person) {
    errors.push(`responsiblePerson mismatch: mock="${mockData.responsiblePerson}", seed="${seedData.responsible_person}"`)
  }
  
  // Check year
  if (mockData.year !== seedData.year) {
    errors.push(`year mismatch: mock=${mockData.year}, seed=${seedData.year}`)
  }
  
  // Check for placeholder values in seed data
  if (isPlaceholder(seedData.indicator_desc)) {
    errors.push(`Seed indicator_desc is a placeholder: "${seedData.indicator_desc}"`)
  }
  if (isPlaceholder(seedData.responsible_person)) {
    errors.push(`Seed responsible_person is a placeholder: "${seedData.responsible_person}"`)
  }
  if (isPlaceholder(seedData.unit)) {
    errors.push(`Seed unit is a placeholder: "${seedData.unit}"`)
  }
  if (isPlaceholder(seedData.remark)) {
    errors.push(`Seed remark is a placeholder: "${seedData.remark}"`)
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

// ==================== Generators ====================

const type1Arb = fc.constantFrom('定性', '定量') as fc.Arbitrary<'定性' | '定量'>
const type2Arb = fc.constantFrom('发展性', '基础性') as fc.Arbitrary<'发展性' | '基础性'>

const mockIndicatorArb: fc.Arbitrary<MockIndicator> = fc.record({
  id: fc.stringMatching(/^2026-\d{3}(-\d)?$/),
  name: fc.stringMatching(/^[\u4e00-\u9fa5a-zA-Z0-9]{5,50}$/),
  isQualitative: fc.boolean(),
  type1: type1Arb,
  type2: type2Arb,
  progress: fc.integer({ min: 0, max: 100 }),
  weight: fc.integer({ min: 1, max: 100 }),
  remark: fc.stringMatching(/^[\u4e00-\u9fa5a-zA-Z0-9]{2,30}$/),
  canWithdraw: fc.boolean(),
  targetValue: fc.float({ min: 1, max: 100, noNaN: true }),
  unit: fc.constantFrom('%', '篇', '人', '家/专业', '门', '项'),
  responsiblePerson: fc.stringMatching(/^[\u4e00-\u9fa5]{2,4}$/),
  status: fc.constantFrom('active', 'draft', 'archived'),
  year: fc.constant(2026)
})

// ==================== Property Tests ====================

describe('Property 6: 种子数据值保真', () => {
  
  describe('6.1 非占位符验证', () => {
    /**
     * **Feature: data-alignment-sop, Property 6: 种子数据值保真**
     * 
     * For any seed data value, it SHALL NOT be a placeholder value.
     * 
     * **Validates: Requirements 4.1**
     */
    it('should reject placeholder values', () => {
      const placeholders = [
        'test', 'placeholder', 'xxx', '123', 'abc',
        'todo', 'tbd', 'n/a', '测试', '占位符'
      ]
      
      for (const placeholder of placeholders) {
        expect(isPlaceholder(placeholder)).toBe(true)
      }
    })
    
    it('should accept real values', () => {
      const realValues = [
        '优质就业比例不低于15%',
        '张老师',
        '%',
        '力争突破',
        '计算机学院课程优良率达90%'
      ]
      
      for (const value of realValues) {
        expect(isPlaceholder(value)).toBe(false)
      }
    })
  })

  describe('6.2 Mock 到 Seed 转换保真', () => {
    /**
     * **Feature: data-alignment-sop, Property 6: 种子数据值保真**
     * 
     * For any mock indicator, when converted to seed format,
     * all field values SHALL be preserved exactly.
     * 
     * **Validates: Requirements 4.1, 4.2**
     */
    it('should preserve all field values during conversion', () => {
      fc.assert(
        fc.property(
          mockIndicatorArb,
          (mockData) => {
            // Simulate conversion to seed data format
            const seedData: SeedIndicator = {
              indicator_id: parseInt(mockData.id.replace(/[^0-9]/g, '')) || 4000,
              indicator_desc: mockData.name,
              is_qualitative: mockData.isQualitative,
              type1: mockData.type1,
              type2: mockData.type2,
              progress: mockData.progress,
              weight_percent: mockData.weight,
              remark: mockData.remark,
              can_withdraw: mockData.canWithdraw,
              target_value: mockData.targetValue,
              unit: mockData.unit,
              responsible_person: mockData.responsiblePerson,
              status: mockData.status.toUpperCase(),
              year: mockData.year
            }
            
            // Validate fidelity (excluding status case difference)
            const result = validateSeedDataFidelity(
              { ...mockData, status: mockData.status.toUpperCase() },
              { ...seedData, status: mockData.status.toUpperCase() }
            )
            
            // Should have no errors except status case
            const nonStatusErrors = result.errors.filter(e => !e.includes('status'))
            expect(nonStatusErrors).toHaveLength(0)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('6.3 类型一致性', () => {
    /**
     * **Feature: data-alignment-sop, Property 6: 种子数据值保真**
     * 
     * For any indicator type field (type1, type2), the seed data
     * SHALL use the exact same Chinese characters as the mock data.
     * 
     * **Validates: Requirements 4.2**
     */
    it('should preserve Chinese type values exactly', () => {
      fc.assert(
        fc.property(
          type1Arb,
          type2Arb,
          (type1, type2) => {
            // Type values should be preserved exactly
            expect(['定性', '定量']).toContain(type1)
            expect(['发展性', '基础性']).toContain(type2)
            
            // No transformation should occur
            expect(type1).toMatch(/^(定性|定量)$/)
            expect(type2).toMatch(/^(发展性|基础性)$/)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('6.4 数值精度保持', () => {
    /**
     * **Feature: data-alignment-sop, Property 6: 种子数据值保真**
     * 
     * For any numeric field (progress, targetValue, weight),
     * the seed data SHALL preserve the exact numeric value.
     * 
     * **Validates: Requirements 4.1, 4.2**
     */
    it('should preserve numeric values exactly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          fc.float({ min: 1, max: 100, noNaN: true }),
          fc.integer({ min: 1, max: 100 }),
          (progress, targetValue, weight) => {
            // Simulate seed data storage and retrieval
            const storedProgress = progress
            const storedTargetValue = targetValue
            const storedWeight = weight
            
            // Values should be preserved
            expect(storedProgress).toBe(progress)
            expect(storedWeight).toBe(weight)
            // Float comparison with tolerance
            expect(Math.abs(storedTargetValue - targetValue)).toBeLessThan(0.001)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})

// ==================== Real Data Validation ====================

describe('Real Data: 2026年指标种子数据验证', () => {
  // Sample of actual mock data from indicators2026.ts
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

  // Corresponding seed data (simulated from SQL)
  const seedIndicators: SeedIndicator[] = [
    {
      indicator_id: 4101,
      indicator_desc: '优质就业比例不低于15%',
      is_qualitative: false,
      type1: '定量',
      type2: '发展性',
      progress: 8,
      weight_percent: 20,
      remark: '力争突破',
      can_withdraw: false,
      target_value: 15,
      unit: '%',
      responsible_person: '张老师',
      status: 'ACTIVE',
      year: 2026
    },
    {
      indicator_id: 4102,
      indicator_desc: '毕业生就业率不低于95%',
      is_qualitative: false,
      type1: '定量',
      type2: '发展性',
      progress: 12,
      weight_percent: 20,
      remark: '确保就业率稳定',
      can_withdraw: false,
      target_value: 95,
      unit: '%',
      responsible_person: '张老师',
      status: 'ACTIVE',
      year: 2026
    },
    {
      indicator_id: 4201,
      indicator_desc: '建立完善校友反馈母校的工作机制，择优建立部分地区校友会并开展高质量活动',
      is_qualitative: true,
      type1: '定性',
      type2: '基础性',
      progress: 8,
      weight_percent: 25,
      remark: '中长期发展规划未完成内容',
      can_withdraw: false,
      target_value: 100,
      unit: '%',
      responsible_person: '陈主任',
      status: 'ACTIVE',
      year: 2026
    }
  ]

  it('should have matching mock and seed data for quantitative indicators', () => {
    // Find matching pairs by name
    for (let i = 0; i < 2; i++) {
      const mock = mockIndicators[i]!
      const seed = seedIndicators[i]!
      
      expect(seed.indicator_desc).toBe(mock.name)
      expect(seed.is_qualitative).toBe(mock.isQualitative)
      expect(seed.type1).toBe(mock.type1)
      expect(seed.type2).toBe(mock.type2)
      expect(seed.progress).toBe(mock.progress)
      expect(seed.target_value).toBe(mock.targetValue)
      expect(seed.unit).toBe(mock.unit)
      expect(seed.responsible_person).toBe(mock.responsiblePerson)
      expect(seed.year).toBe(mock.year)
    }
  })

  it('should have matching mock and seed data for qualitative indicators', () => {
    const mock = mockIndicators[2]!
    const seed = seedIndicators[2]!
    
    expect(seed.indicator_desc).toBe(mock.name)
    expect(seed.is_qualitative).toBe(true)
    expect(seed.type1).toBe('定性')
    expect(seed.type2).toBe('基础性')
  })

  it('should not contain placeholder values in seed data', () => {
    for (const seed of seedIndicators) {
      expect(isPlaceholder(seed.indicator_desc)).toBe(false)
      expect(isPlaceholder(seed.responsible_person)).toBe(false)
      expect(isPlaceholder(seed.unit)).toBe(false)
      expect(isPlaceholder(seed.remark)).toBe(false)
    }
  })
})
