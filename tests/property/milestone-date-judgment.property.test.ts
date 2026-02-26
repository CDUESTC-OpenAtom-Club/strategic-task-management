/**
 * 里程碑日期判断属性测试
 * 
 * **Feature: page-data-verification**
 * - **Property 9: Milestone Date Judgment**
 * 
 * **Validates: Requirements 6.2, 6.3**
 */
import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest'
import * as fc from 'fast-check'
import { setActivePinia, createPinia } from 'pinia'
import type { Milestone, StrategicIndicator } from '@/types'

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
// 日期判断函数（从 Store 提取的纯函数）
// ============================================================================

/**
 * 判断里程碑是否逾期
 * 条件：截止日期已过 且 状态不是 'completed'
 */
function isOverdue(milestone: Milestone, currentDate: Date = new Date()): boolean {
  if (!milestone.deadline) return false
  if (milestone.status === 'completed') return false
  
  const deadlineDate = new Date(milestone.deadline)
  if (isNaN(deadlineDate.getTime())) return false
  
  return deadlineDate < currentDate
}

/**
 * 判断里程碑是否即将到期
 * 条件：截止日期在30天内 且 状态是 'pending'
 */
function isUpcoming(milestone: Milestone, currentDate: Date = new Date(), daysThreshold: number = 30): boolean {
  if (!milestone.deadline) return false
  if (milestone.status !== 'pending') return false
  
  const deadlineDate = new Date(milestone.deadline)
  if (isNaN(deadlineDate.getTime())) return false
  
  const diffMs = deadlineDate.getTime() - currentDate.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  
  return diffDays > 0 && diffDays <= daysThreshold
}

/**
 * 获取逾期里程碑
 */
function getOverdueMilestones(
  indicators: StrategicIndicator[],
  currentDate: Date = new Date()
): Array<{ indicator: StrategicIndicator; milestone: Milestone }> {
  const result: Array<{ indicator: StrategicIndicator; milestone: Milestone }> = []
  
  indicators.forEach(indicator => {
    (indicator.milestones || []).forEach(milestone => {
      if (isOverdue(milestone, currentDate)) {
        result.push({ indicator, milestone })
      }
    })
  })
  
  return result
}

/**
 * 获取即将到期里程碑
 */
function getUpcomingMilestones(
  indicators: StrategicIndicator[],
  currentDate: Date = new Date(),
  daysThreshold: number = 30
): Array<{ indicator: StrategicIndicator; milestone: Milestone }> {
  const result: Array<{ indicator: StrategicIndicator; milestone: Milestone }> = []
  
  indicators.forEach(indicator => {
    (indicator.milestones || []).forEach(milestone => {
      if (isUpcoming(milestone, currentDate, daysThreshold)) {
        result.push({ indicator, milestone })
      }
    })
  })
  
  return result
}


// ============================================================================
// 数据生成器
// ============================================================================

/**
 * 生成日期字符串
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] || ''
}

/**
 * 创建里程碑
 */
function createMilestone(
  id: string,
  deadline: string,
  status: 'pending' | 'completed' | 'overdue'
): Milestone {
  return {
    id,
    name: `Milestone ${id}`,
    targetProgress: 50,
    deadline,
    status
  }
}

/**
 * 创建指标
 */
function createIndicator(id: string, milestones: Milestone[]): StrategicIndicator {
  return {
    id,
    name: `Indicator ${id}`,
    isQualitative: false,
    type1: '定量',
    type2: '基础性',
    progress: 50,
    createTime: '2025年01月01日',
    weight: 10,
    remark: '',
    canWithdraw: false,
    taskContent: 'Task',
    milestones,
    targetValue: 100,
    unit: '%',
    responsibleDept: '教务处',
    responsiblePerson: 'Test',
    status: 'active',
    isStrategic: true,
    ownerDept: '战略发展部',
    year: 2025,
    progressApprovalStatus: 'none'
  }
}


// ============================================================================
// Property 9: Milestone Date Judgment
// ============================================================================

describe('Property 9: Milestone Date Judgment', () => {
  /**
   * **Validates: Requirements 6.2, 6.3**
   * 
   * *For any* milestone with a deadline:
   * - If current date is past deadline AND status is not 'completed', 
   *   then getOverdueMilestones SHALL include this milestone
   * - If deadline is within 30 days AND status is 'pending',
   *   then getUpcomingMilestones SHALL include this milestone
   */

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('Overdue Milestone Detection (Requirement 6.2)', () => {
    it('should detect overdue milestones with past deadline and non-completed status', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }), // days past
          (daysPast) => {
            const currentDate = new Date('2025-06-15')
            const pastDate = new Date(currentDate)
            pastDate.setDate(pastDate.getDate() - daysPast)
            
            const milestone = createMilestone('m1', formatDate(pastDate), 'pending')
            const indicator = createIndicator('i1', [milestone])
            
            const overdue = getOverdueMilestones([indicator], currentDate)
            
            expect(overdue.length).toBe(1)
            expect(overdue[0]?.milestone.id).toBe('m1')
            
            return true
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should NOT include completed milestones even if past deadline', () => {
      const currentDate = new Date('2025-06-15')
      const pastDate = new Date('2025-05-01')
      
      const milestone = createMilestone('m1', formatDate(pastDate), 'completed')
      const indicator = createIndicator('i1', [milestone])
      
      const overdue = getOverdueMilestones([indicator], currentDate)
      
      expect(overdue.length).toBe(0)
    })

    it('should NOT include milestones with future deadline', () => {
      const currentDate = new Date('2025-06-15')
      const futureDate = new Date('2025-07-15')
      
      const milestone = createMilestone('m1', formatDate(futureDate), 'pending')
      const indicator = createIndicator('i1', [milestone])
      
      const overdue = getOverdueMilestones([indicator], currentDate)
      
      expect(overdue.length).toBe(0)
    })
  })


  describe('Upcoming Milestone Detection (Requirement 6.3)', () => {
    it('should detect upcoming milestones within 30 days with pending status', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 30 }), // days until deadline
          (daysUntil) => {
            const currentDate = new Date('2025-06-15')
            const futureDate = new Date(currentDate)
            futureDate.setDate(futureDate.getDate() + daysUntil)
            
            const milestone = createMilestone('m1', formatDate(futureDate), 'pending')
            const indicator = createIndicator('i1', [milestone])
            
            const upcoming = getUpcomingMilestones([indicator], currentDate, 30)
            
            expect(upcoming.length).toBe(1)
            expect(upcoming[0]?.milestone.id).toBe('m1')
            
            return true
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should NOT include milestones more than 30 days away', () => {
      const currentDate = new Date('2025-06-15')
      const farFutureDate = new Date('2025-08-15') // 61 days away
      
      const milestone = createMilestone('m1', formatDate(farFutureDate), 'pending')
      const indicator = createIndicator('i1', [milestone])
      
      const upcoming = getUpcomingMilestones([indicator], currentDate, 30)
      
      expect(upcoming.length).toBe(0)
    })

    it('should NOT include completed milestones even if within 30 days', () => {
      const currentDate = new Date('2025-06-15')
      const nearFutureDate = new Date('2025-06-25')
      
      const milestone = createMilestone('m1', formatDate(nearFutureDate), 'completed')
      const indicator = createIndicator('i1', [milestone])
      
      const upcoming = getUpcomingMilestones([indicator], currentDate, 30)
      
      expect(upcoming.length).toBe(0)
    })

    it('should NOT include past milestones', () => {
      const currentDate = new Date('2025-06-15')
      const pastDate = new Date('2025-06-01')
      
      const milestone = createMilestone('m1', formatDate(pastDate), 'pending')
      const indicator = createIndicator('i1', [milestone])
      
      const upcoming = getUpcomingMilestones([indicator], currentDate, 30)
      
      expect(upcoming.length).toBe(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle indicators without milestones', () => {
      const indicator = createIndicator('i1', [])
      const currentDate = new Date('2025-06-15')
      
      const overdue = getOverdueMilestones([indicator], currentDate)
      const upcoming = getUpcomingMilestones([indicator], currentDate)
      
      expect(overdue.length).toBe(0)
      expect(upcoming.length).toBe(0)
    })

    it('should handle milestones without deadline', () => {
      const milestone: Milestone = {
        id: 'm1',
        name: 'Test',
        targetProgress: 50,
        deadline: '',
        status: 'pending'
      }
      const indicator = createIndicator('i1', [milestone])
      const currentDate = new Date('2025-06-15')
      
      const overdue = getOverdueMilestones([indicator], currentDate)
      const upcoming = getUpcomingMilestones([indicator], currentDate)
      
      expect(overdue.length).toBe(0)
      expect(upcoming.length).toBe(0)
    })
  })
})
