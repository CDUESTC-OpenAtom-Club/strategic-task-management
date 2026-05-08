/**
 * Unit tests for milestone-intelligence helpers (calculateMilestoneStatus,
 * getMilestonesTooltip, getIndicatorMilestoneProgressText)
 */
import { describe, it, expect } from 'vitest'
import {
  calculateMilestoneStatus,
  getIndicatorMilestoneProgressText,
  getMilestonesTooltip
} from '@/shared/lib/milestone-intelligence'
import type { StrategicIndicator } from '@/shared/types'

function makeIndicatorWithMilestones(milestones: any[], progress: number = 0): StrategicIndicator {
  return {
    id: 1,
    name: 'Indicator',
    milestones: milestones,
    progress
  } as unknown as StrategicIndicator
}

describe('Milestone Intelligence', () => {
  it('should highlight overdue milestones as exception', () => {
    const past = new Date(2000, 0, 1)
    const deadline = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`
    const indicator = makeIndicatorWithMilestones(
      [{ id: 'm1', name: 'Past', deadline, targetProgress: 0, status: 'pending' }],
      0
    )
    const status = calculateMilestoneStatus(indicator, {})
    expect(status).toBe('exception')
  })

  it('should show upcoming milestone as warning when close', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 2)
    const deadline = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
    const indicator: StrategicIndicator = makeIndicatorWithMilestones(
      [{ id: 'm2', name: 'Upcoming', deadline, targetProgress: 10, status: 'pending' }],
      0
    )
    const status = calculateMilestoneStatus(indicator, { upcomingDaysThreshold: 5 })
    expect(status).toBe('warning')
  })

  it('getMilestonesTooltip should map basic milestone fields', () => {
    const deadline = '2026-12-31'
    const indicator: StrategicIndicator = makeIndicatorWithMilestones(
      [{ id: 'm3', name: 'M3', deadline, targetProgress: 70, status: 'pending' }],
      70
    )
    const tooltips = getMilestonesTooltip(indicator)
    expect(Array.isArray(tooltips)).toBeTruthy()
    // Expect at least one tooltip with expectedDate formatted
    expect(tooltips[0].name).toBe('M3')
    expect(tooltips[0].expectedDate).toBe('2026-12-31')
  })

  it('getIndicatorMilestoneProgressText should reflect pending milestones', () => {
    const deadline = '2026-12-31'
    const indicator = makeIndicatorWithMilestones(
      [{ id: 'm4', name: 'M4', deadline, targetProgress: 50, status: 'pending' }],
      0
    )
    const text = getIndicatorMilestoneProgressText(indicator)
    expect(typeof text).toBe('string')
    expect(text).toMatch(/待完成|里程碑/)
  })
})
