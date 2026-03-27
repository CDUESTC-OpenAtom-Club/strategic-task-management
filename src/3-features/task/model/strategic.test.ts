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

  it('filters placeholder task names returned by backend', () => {
    const indicator = toStrategicIndicator({
      id: 2043,
      taskId: 41002,
      taskName: 'null',
      indicatorName: '形成党委系统战线领域专项推进台账',
      ownerOrgName: '战略发展部',
      targetOrgName: '党委办公室',
      level: 'STRAT_TO_FUNC',
      status: 'DRAFT',
      createdAt: '2026-03-27T04:19:49'
    })

    expect(indicator.taskContent).not.toBe('null')
    expect(indicator.taskContent).toBe('形成党委系统战线领域专项推进台账')
  })
})
