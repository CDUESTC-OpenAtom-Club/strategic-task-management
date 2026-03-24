import type { StrategicIndicator } from '@/shared/types'

export type IndicatorViewerRole = 'strategic_dept' | 'functional_dept' | 'secondary_college'

export function getIndicatorTargetOrgId(indicator: StrategicIndicator): number | null {
  const targetOrgId = Number(
    (indicator as StrategicIndicator & { targetOrgId?: number | string }).targetOrgId ?? NaN
  )
  return Number.isFinite(targetOrgId) && targetOrgId > 0 ? targetOrgId : null
}

export function getIndicatorOwnerOrgId(indicator: StrategicIndicator): number | null {
  const ownerOrgId = Number(
    (indicator as StrategicIndicator & { ownerOrgId?: number | string }).ownerOrgId ?? NaN
  )
  return Number.isFinite(ownerOrgId) && ownerOrgId > 0 ? ownerOrgId : null
}

export function isIndicatorOwnedByOrg(
  indicator: StrategicIndicator,
  ownerOrgId: number | null
): boolean {
  return ownerOrgId !== null && getIndicatorOwnerOrgId(indicator) === ownerOrgId
}

export function isIndicatorTargetedToOrg(
  indicator: StrategicIndicator,
  targetOrgId: number | null
): boolean {
  return targetOrgId !== null && getIndicatorTargetOrgId(indicator) === targetOrgId
}

export function isRootIndicator(indicator: StrategicIndicator): boolean {
  return String(indicator.parentIndicatorId || '').trim().length === 0
}

export function filterIndicatorsForViewerRole(
  list: StrategicIndicator[],
  role: IndicatorViewerRole,
  viewingOrgId: number | null,
  canViewReceivedContent: boolean
): StrategicIndicator[] {
  if (role === 'strategic_dept') {
    return list
  }

  if (viewingOrgId === null || !canViewReceivedContent) {
    return []
  }

  if (role === 'secondary_college') {
    return list.filter(indicator => getIndicatorTargetOrgId(indicator) === viewingOrgId)
  }

  return list.filter(
    indicator => getIndicatorTargetOrgId(indicator) === viewingOrgId && isRootIndicator(indicator)
  )
}

export function canUseAsFunctionalParentIndicator(
  indicator: StrategicIndicator,
  viewingOrgId: number | null,
  canViewReceivedContent: boolean
): boolean {
  if (!indicator.isStrategic) {
    return false
  }

  if (viewingOrgId === null || !canViewReceivedContent) {
    return false
  }

  return getIndicatorTargetOrgId(indicator) === viewingOrgId && isRootIndicator(indicator)
}
