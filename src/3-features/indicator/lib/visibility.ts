import type { StrategicIndicator } from '@/shared/types'

export const RECEIVED_PLAN_VISIBLE_STATUSES = ['DISTRIBUTED', 'PENDING', 'RETURNED'] as const

export function canViewReceivedPlanContent(
  planStatus: string | null | undefined,
  isStrategicDept: boolean
): boolean {
  if (isStrategicDept) {
    return true
  }

  const normalizedPlanStatus = String(planStatus || '').trim().toUpperCase()
  return RECEIVED_PLAN_VISIBLE_STATUSES.includes(
    normalizedPlanStatus as (typeof RECEIVED_PLAN_VISIBLE_STATUSES)[number]
  )
}

interface ReceivedStrategicIndicatorVisibilityOptions {
  indicator: StrategicIndicator
  currentYear: number
  realCurrentYear: number
  viewingDept: string | null | undefined
  viewingOrgId?: number | null
  isStrategicDept: boolean
  canViewReceivedContent: boolean
}

export function isVisibleReceivedStrategicIndicator({
  indicator,
  currentYear,
  realCurrentYear,
  viewingDept,
  viewingOrgId,
  isStrategicDept,
  canViewReceivedContent
}: ReceivedStrategicIndicatorVisibilityOptions): boolean {
  if (!indicator.isStrategic) {
    return false
  }

  const indicatorYear = indicator.year || realCurrentYear
  if (indicatorYear !== currentYear) {
    return false
  }

  if (isStrategicDept) {
    return true
  }

  if (!canViewReceivedContent) {
    return false
  }

  const indicatorTargetOrgId = Number(
    (indicator as StrategicIndicator & { targetOrgId?: number | string }).targetOrgId ?? NaN
  )
  return (
    viewingOrgId != null &&
    Number.isFinite(viewingOrgId) &&
    Number.isFinite(indicatorTargetOrgId) &&
    indicatorTargetOrgId > 0 &&
    indicatorTargetOrgId === viewingOrgId
  )
}
