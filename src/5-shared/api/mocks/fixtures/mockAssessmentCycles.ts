import type { AssessmentCycle } from '@/5-shared/types/entities'

export const mockAssessmentCycles: AssessmentCycle[] = [
  {
    cycleId: 1,
    cycleName: '2025-2026 学年第一学期',
    startDate: '2025-09-01',
    endDate: '2026-01-15',
    status: 'active',
    createdAt: '2025-08-20T09:00:00Z',
    updatedAt: '2025-08-20T09:00:00Z'
  },
  {
    cycleId: 2,
    cycleName: '2025-2026 学年第二学期',
    startDate: '2026-02-20',
    endDate: '2026-07-10',
    status: 'pending',
    createdAt: '2025-08-20T09:00:00Z',
    updatedAt: '2025-08-20T09:00:00Z'
  },
  {
    cycleId: 3,
    cycleName: '2025 年度考核',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    status: 'active',
    createdAt: '2024-12-15T00:00:00Z',
    updatedAt: '2024-12-15T00:00:00Z'
  }
]
