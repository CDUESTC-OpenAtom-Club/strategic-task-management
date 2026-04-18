import type { StatusTagType } from '@/shared/lib/utils/formatters'

export type CanonicalPlanStatus = 'DRAFT' | 'PENDING' | 'DISTRIBUTED'

const PLAN_STATUS_NORMALIZATION_MAP: Record<string, CanonicalPlanStatus> = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  IN_REVIEW: 'PENDING',
  PENDING_REVIEW: 'PENDING',
  PENDING_APPROVAL: 'PENDING',
  SUBMITTED: 'PENDING',
  APPROVED: 'DISTRIBUTED',
  PUBLISHED: 'DISTRIBUTED',
  DISTRIBUTED: 'DISTRIBUTED',
  ACTIVE: 'DISTRIBUTED',
  REJECTED: 'DRAFT',
  RETURNED: 'DRAFT',
  WITHDRAWN: 'DRAFT',
  CANCELLED: 'DRAFT',
  COMPLETED: 'DRAFT',
  ARCHIVED: 'DRAFT'
}

const PLAN_STATUS_DISPLAY_MAP: Record<CanonicalPlanStatus, { label: string; type: StatusTagType }> =
  {
    DRAFT: { label: '草稿', type: 'info' },
    PENDING: { label: '审批中', type: 'warning' },
    DISTRIBUTED: { label: '已下发', type: 'success' }
  }

export function normalizePlanStatus(status: unknown): CanonicalPlanStatus | null {
  const raw = String(status ?? '').trim()
  if (!raw) {
    return null
  }

  return PLAN_STATUS_NORMALIZATION_MAP[raw.toUpperCase()] || null
}

export function getPlanStatusDisplay(status: unknown): { label: string; type: StatusTagType } {
  const normalizedStatus = normalizePlanStatus(status)
  if (!normalizedStatus) {
    const fallback = String(status ?? '').trim()
    return {
      label: fallback || '暂无指标',
      type: 'info'
    }
  }

  return PLAN_STATUS_DISPLAY_MAP[normalizedStatus]
}
