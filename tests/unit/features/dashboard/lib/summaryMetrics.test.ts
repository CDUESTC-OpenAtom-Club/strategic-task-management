import { describe, expect, it } from 'vitest'

import {
  buildDashboardSummary,
  getIndicatorStatusAtMonth
} from '@/features/dashboard/lib/summaryMetrics'
import type { Indicator } from '@/shared/types'

const createIndicator = (overrides: Partial<Indicator> = {}): Indicator =>
  ({
    id: 1,
    name: '测试指标',
    taskId: 1,
    level: 'FIRST',
    ownerOrgId: 1,
    targetOrgId: 1,
    type: '定量',
    status: 'DISTRIBUTED',
    workflowStatus: 'DISTRIBUTED',
    ownerDept: '战略发展部',
    responsibleDept: '科技处',
    progress: 0,
    year: 2026,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    milestones: [],
    ...overrides
  }) as Indicator

describe('summaryMetrics', () => {
  it('treats missed in-month milestones as delayed at month end', () => {
    const indicator = createIndicator({
      progress: 20,
      milestones: [
        {
          dueDate: '2026-04-10',
          targetProgress: 50
        }
      ]
    })

    expect(getIndicatorStatusAtMonth(indicator, 4, 2026)).toBe('delayed')
    expect(getIndicatorStatusAtMonth(indicator, 5, 2026)).toBe('delayed')
  })

  it('marks reached month targets as ahead', () => {
    const indicator = createIndicator({
      progress: 80,
      milestones: [
        {
          dueDate: '2026-04-30',
          targetProgress: 60
        }
      ]
    })

    expect(getIndicatorStatusAtMonth(indicator, 4, 2026)).toBe('ahead')
  })

  it('builds monthly summary from milestone status instead of raw progress thresholds', () => {
    const indicators = [
      createIndicator({
        id: 1,
        type2: '基础性',
        progress: 20,
        milestones: [
          {
            dueDate: '2026-04-10',
            targetProgress: 50
          }
        ]
      }),
      createIndicator({
        id: 2,
        type2: '基础性',
        progress: 70,
        milestones: [
          {
            dueDate: '2026-04-25',
            targetProgress: 60
          }
        ]
      }),
      createIndicator({
        id: 3,
        type2: '发展性',
        progress: 10,
        milestones: []
      })
    ]

    const summary = buildDashboardSummary(indicators, 4, 2026)

    expect(summary.totalIndicators).toBe(3)
    expect(summary.completedIndicators).toBe(2)
    expect(summary.completionRate).toBe(67)
    expect(summary.warningCount).toBe(1)
    expect(summary.alertIndicators).toEqual({
      severe: 1,
      moderate: 0,
      normal: 2
    })
    expect(summary.totalScore).toBe(47)
  })
})
