import { describe, expect, it } from 'vitest'
import { toStrategicIndicator } from './strategic'

describe('toStrategicIndicator', () => {
  it('treats indicators with parentIndicatorId as child indicators even when backend level is FIRST', () => {
    const indicator = toStrategicIndicator({
      id: 2042,
      taskId: 41001,
      parentIndicatorId: 2001,
      indicatorName: '完成党委办公室年度重点工作分解与落实',
      ownerOrgId: 36,
      targetOrgId: 55,
      ownerOrgName: '党委办公室 | 党委统战部',
      targetOrgName: '马克思主义学院',
      level: 'FIRST',
      status: 'DRAFT',
      createdAt: '2026-03-23T08:57:35.878283'
    })

    expect(indicator.isStrategic).toBe(false)
    expect(indicator.parentIndicatorId).toBe('2001')
    expect((indicator as { ownerOrgId?: number }).ownerOrgId).toBe(36)
    expect((indicator as { targetOrgId?: number }).targetOrgId).toBe(55)
  })
})
