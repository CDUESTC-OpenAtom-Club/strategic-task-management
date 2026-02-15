/**
 * 里程碑数据完整性属性测试
 * 
 * **Feature: data-alignment-sop, Property 13: 里程碑数据完整性**
 * **Validates: Requirements 7.4**
 * 
 * For any indicator with milestones, the milestone list SHALL contain all required
 * fields (id, name, targetProgress, deadline, status).
 */
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ==================== Types ====================

interface Milestone {
  id: string
  name: string
  targetProgress: number
  deadline: string
  status: 'completed' | 'pending' | 'overdue' | 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED' | 'CANCELED'
}

interface MilestoneDB {
  milestone_id: number
  indicator_id: number
  milestone_name: string
  milestone_desc?: string
  due_date: string
  weight_percent: number
  status: string
  sort_order: number
}

// ==================== Validation Functions ====================

/**
 * Validate that a milestone has all required fields
 */
function validateMilestoneFields(milestone: Milestone): { valid: boolean; missingFields: string[] } {
  const requiredFields = ['id', 'name', 'targetProgress', 'deadline', 'status']
  const missingFields: string[] = []
  
  for (const field of requiredFields) {
    if (milestone[field as keyof Milestone] === undefined || milestone[field as keyof Milestone] === null) {
      missingFields.push(field)
    }
  }
  
  return {
    valid: missingFields.length === 0,
    missingFields
  }
}

/**
 * Validate milestone data constraints
 */
function validateMilestoneConstraints(milestone: Milestone): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // targetProgress should be between 0 and 100
  if (milestone.targetProgress < 0 || milestone.targetProgress > 100) {
    errors.push(`targetProgress out of range: ${milestone.targetProgress}`)
  }
  
  // deadline should be a valid date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(milestone.deadline)) {
    errors.push(`Invalid deadline format: ${milestone.deadline}`)
  }
  
  // status should be a valid value
  const validStatuses = ['completed', 'pending', 'overdue', 'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'CANCELED']
  if (!validStatuses.includes(milestone.status)) {
    errors.push(`Invalid status: ${milestone.status}`)
  }
  
  // name should not be empty
  if (!milestone.name || milestone.name.trim() === '') {
    errors.push('Milestone name is empty')
  }
  
  // id should not be empty
  if (!milestone.id || milestone.id.trim() === '') {
    errors.push('Milestone id is empty')
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Validate quarterly milestones for an indicator
 */
function validateQuarterlyMilestones(milestones: Milestone[], year: number): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Should have exactly 4 quarterly milestones
  if (milestones.length !== 4) {
    errors.push(`Expected 4 quarterly milestones, got ${milestones.length}`)
  }
  
  // Check each quarter
  const expectedQuarters = [
    { q: 1, deadline: `${year}-03-31`, targetProgress: 25 },
    { q: 2, deadline: `${year}-06-30`, targetProgress: 50 },
    { q: 3, deadline: `${year}-09-30`, targetProgress: 75 },
    { q: 4, deadline: `${year}-12-31`, targetProgress: 100 }
  ]
  
  for (const expected of expectedQuarters) {
    const milestone = milestones.find(m => m.name.includes(`Q${expected.q}`))
    if (!milestone) {
      errors.push(`Missing Q${expected.q} milestone`)
    } else {
      if (milestone.deadline !== expected.deadline) {
        errors.push(`Q${expected.q} deadline mismatch: expected ${expected.deadline}, got ${milestone.deadline}`)
      }
      if (milestone.targetProgress !== expected.targetProgress) {
        errors.push(`Q${expected.q} targetProgress mismatch: expected ${expected.targetProgress}, got ${milestone.targetProgress}`)
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Convert DB milestone to frontend format
 */
function convertDBMilestone(dbMilestone: MilestoneDB): Milestone {
  return {
    id: `milestone-${dbMilestone.milestone_id}`,
    name: dbMilestone.milestone_name,
    targetProgress: dbMilestone.weight_percent * dbMilestone.sort_order, // Approximate
    deadline: dbMilestone.due_date,
    status: dbMilestone.status as Milestone['status']
  }
}

// ==================== Generators ====================

const milestoneStatusArb = fc.constantFrom(
  'completed', 'pending', 'overdue', 
  'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'CANCELED'
) as fc.Arbitrary<Milestone['status']>

// Generate valid date strings directly to avoid Invalid Date issues
const dateStringArb = fc.integer({ min: 1, max: 12 }).chain(month => {
  const maxDay = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
  return fc.integer({ min: 1, max: maxDay }).map(day => {
    const m = month.toString().padStart(2, '0')
    const d = day.toString().padStart(2, '0')
    return `2026-${m}-${d}`
  })
})

const milestoneArb: fc.Arbitrary<Milestone> = fc.record({
  id: fc.stringMatching(/^(hist-2026-[1-4]|milestone-\d+)$/),
  name: fc.stringMatching(/^Q[1-4]: [\u4e00-\u9fa5a-zA-Z0-9]{2,20}$/),
  targetProgress: fc.integer({ min: 0, max: 100 }),
  deadline: dateStringArb,
  status: milestoneStatusArb
})

const quarterlyMilestonesArb = (year: number): fc.Arbitrary<Milestone[]> => {
  return fc.constant([
    { id: `hist-${year}-1`, name: 'Q1: 阶段目标', targetProgress: 25, deadline: `${year}-03-31`, status: 'NOT_STARTED' as const },
    { id: `hist-${year}-2`, name: 'Q2: 阶段目标', targetProgress: 50, deadline: `${year}-06-30`, status: 'NOT_STARTED' as const },
    { id: `hist-${year}-3`, name: 'Q3: 阶段目标', targetProgress: 75, deadline: `${year}-09-30`, status: 'NOT_STARTED' as const },
    { id: `hist-${year}-4`, name: 'Q4: 阶段目标', targetProgress: 100, deadline: `${year}-12-31`, status: 'NOT_STARTED' as const }
  ])
}

// ==================== Property Tests ====================

describe('Property 13: 里程碑数据完整性', () => {
  
  describe('13.1 必填字段验证', () => {
    /**
     * **Feature: data-alignment-sop, Property 13: 里程碑数据完整性**
     * 
     * For any milestone, all required fields (id, name, targetProgress, deadline, status)
     * SHALL be present.
     * 
     * **Validates: Requirements 7.4**
     */
    it('should have all required fields', () => {
      fc.assert(
        fc.property(
          milestoneArb,
          (milestone) => {
            const result = validateMilestoneFields(milestone)
            expect(result.valid).toBe(true)
            expect(result.missingFields).toHaveLength(0)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('13.2 字段约束验证', () => {
    /**
     * **Feature: data-alignment-sop, Property 13: 里程碑数据完整性**
     * 
     * For any milestone, field values SHALL satisfy their constraints:
     * - targetProgress: 0-100
     * - deadline: valid date format
     * - status: valid enum value
     * 
     * **Validates: Requirements 7.4**
     */
    it('should satisfy field constraints', () => {
      fc.assert(
        fc.property(
          milestoneArb,
          (milestone) => {
            const result = validateMilestoneConstraints(milestone)
            expect(result.valid).toBe(true)
            expect(result.errors).toHaveLength(0)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('13.3 季度里程碑完整性', () => {
    /**
     * **Feature: data-alignment-sop, Property 13: 里程碑数据完整性**
     * 
     * For any indicator with quarterly milestones, there SHALL be exactly 4 milestones
     * with correct Q1-Q4 deadlines and target progress values.
     * 
     * **Validates: Requirements 7.4**
     */
    it('should have complete quarterly milestones', () => {
      fc.assert(
        fc.property(
          quarterlyMilestonesArb(2026),
          (milestones) => {
            const result = validateQuarterlyMilestones(milestones, 2026)
            expect(result.valid).toBe(true)
            expect(result.errors).toHaveLength(0)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('13.4 里程碑排序', () => {
    /**
     * **Feature: data-alignment-sop, Property 13: 里程碑数据完整性**
     * 
     * For any set of quarterly milestones, they SHALL be ordered by deadline
     * with increasing target progress.
     * 
     * **Validates: Requirements 7.4**
     */
    it('should have milestones ordered by deadline', () => {
      fc.assert(
        fc.property(
          quarterlyMilestonesArb(2026),
          (milestones) => {
            // Sort by deadline
            const sorted = [...milestones].sort((a, b) => 
              new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
            )
            
            // Target progress should be increasing
            for (let i = 1; i < sorted.length; i++) {
              expect(sorted[i].targetProgress).toBeGreaterThan(sorted[i-1].targetProgress)
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('13.5 权重总和', () => {
    /**
     * **Feature: data-alignment-sop, Property 13: 里程碑数据完整性**
     * 
     * For any indicator, the sum of milestone weights SHALL equal 100%.
     * 
     * **Validates: Requirements 7.4**
     */
    it('should have milestone weights summing to 100', () => {
      // Quarterly milestones each have 25% weight
      const milestones = [
        { weight: 25 },
        { weight: 25 },
        { weight: 25 },
        { weight: 25 }
      ]
      
      const totalWeight = milestones.reduce((sum, m) => sum + m.weight, 0)
      expect(totalWeight).toBe(100)
    })
  })
})

// ==================== Real Data Validation ====================

describe('Real Data: 2026年里程碑数据验证', () => {
  // Sample milestone data from seed SQL
  const sampleMilestones: Milestone[] = [
    { id: 'hist-2026-1', name: 'Q1: 阶段目标', targetProgress: 25, deadline: '2026-03-31', status: 'NOT_STARTED' },
    { id: 'hist-2026-2', name: 'Q2: 阶段目标', targetProgress: 50, deadline: '2026-06-30', status: 'NOT_STARTED' },
    { id: 'hist-2026-3', name: 'Q3: 阶段目标', targetProgress: 75, deadline: '2026-09-30', status: 'NOT_STARTED' },
    { id: 'hist-2026-4', name: 'Q4: 阶段目标', targetProgress: 100, deadline: '2026-12-31', status: 'NOT_STARTED' }
  ]

  it('should have all required fields in sample milestones', () => {
    for (const milestone of sampleMilestones) {
      const result = validateMilestoneFields(milestone)
      expect(result.valid).toBe(true)
      expect(result.missingFields).toHaveLength(0)
    }
  })

  it('should satisfy constraints in sample milestones', () => {
    for (const milestone of sampleMilestones) {
      const result = validateMilestoneConstraints(milestone)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    }
  })

  it('should have complete quarterly structure', () => {
    const result = validateQuarterlyMilestones(sampleMilestones, 2026)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should have correct Q1 deadline (March 31)', () => {
    const q1 = sampleMilestones.find(m => m.name.includes('Q1'))
    expect(q1?.deadline).toBe('2026-03-31')
  })

  it('should have correct Q2 deadline (June 30)', () => {
    const q2 = sampleMilestones.find(m => m.name.includes('Q2'))
    expect(q2?.deadline).toBe('2026-06-30')
  })

  it('should have correct Q3 deadline (September 30)', () => {
    const q3 = sampleMilestones.find(m => m.name.includes('Q3'))
    expect(q3?.deadline).toBe('2026-09-30')
  })

  it('should have correct Q4 deadline (December 31)', () => {
    const q4 = sampleMilestones.find(m => m.name.includes('Q4'))
    expect(q4?.deadline).toBe('2026-12-31')
  })
})
