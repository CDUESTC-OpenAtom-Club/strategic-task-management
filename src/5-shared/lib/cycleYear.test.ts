import { describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTimeContextStore } from '@/shared/lib/timeContext'

describe('timeContext.resolveCycleYear', () => {
  it('resolves year from loaded cycle list by cycleId', () => {
    setActivePinia(createPinia())
    const timeContext = useTimeContextStore()

    timeContext.cycles = [
      {
        cycleId: 4,
        cycleName: '2026年度考核周期',
        year: 2026,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        description: null,
        createdAt: '2026-01-01T00:00:00',
        updatedAt: '2026-01-01T00:00:00'
      },
      {
        cycleId: 7,
        cycleName: '2025年度考核周期',
        year: 2025,
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        description: null,
        createdAt: '2025-01-01T00:00:00',
        updatedAt: '2025-01-01T00:00:00'
      }
    ]

    expect(timeContext.resolveCycleYear(4)).toBe(2026)
    expect(timeContext.resolveCycleYear('7')).toBe(2025)
    expect(timeContext.resolveCycleYear(999)).toBeNull()
  })
})
