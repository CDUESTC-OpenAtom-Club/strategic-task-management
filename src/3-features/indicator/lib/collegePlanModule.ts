import type { Plan } from '@/shared/types'

type PlanLike = Plan & {
  targetOrgId?: number | string
  targetOrgName?: string
  orgId?: number | string
  orgName?: string
  planLevel?: string
  createdByOrgName?: string
  indicators?: Array<Record<string, unknown>>
}

interface CollegePlanMatchContext {
  currentYear: number
  viewingOrgId: number | null
  viewingDept: string
  resolvePlanYear: (plan: PlanLike) => number | null
}

function normalizeText(value: unknown): string {
  return String(value || '').trim()
}

function toPositiveNumber(value: unknown): number | null {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null
  }
  return numericValue
}

function getPlanIndicatorText(indicator: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = indicator[key]
    const normalized = normalizeText(value)
    if (normalized) {
      return normalized
    }
  }

  return ''
}

export function isCollegePlanCandidate(plan: PlanLike, context: CollegePlanMatchContext): boolean {
  const cycleYear = context.resolvePlanYear(plan)
  if (cycleYear !== context.currentYear) {
    return false
  }

  const planLevel = normalizeText(plan.planLevel).toUpperCase()
  if (planLevel && planLevel !== 'FUNC_TO_COLLEGE') {
    return false
  }

  const normalizedStatus = normalizeText(plan.status).toUpperCase()
  if (normalizedStatus === 'DRAFT') {
    return false
  }

  const targetOrgId = toPositiveNumber(plan.targetOrgId ?? plan.orgId ?? plan.org_id)
  if (context.viewingOrgId && targetOrgId) {
    return targetOrgId === context.viewingOrgId
  }

  const targetOrgName = normalizeText(plan.targetOrgName ?? plan.orgName)
  return Boolean(context.viewingDept) && targetOrgName === context.viewingDept
}

export function resolveCollegePlanSourceDept(plan: PlanLike | null | undefined): string {
  if (!plan) {
    return ''
  }

  if (Array.isArray(plan.indicators)) {
    for (const indicator of plan.indicators) {
      const sourceDept = getPlanIndicatorText(indicator, 'ownerOrgName', 'ownerDept')
      if (sourceDept) {
        return sourceDept
      }
    }
  }

  return normalizeText(plan.createdByOrgName ?? plan.createdByName)
}

export function listCollegePlanSourceDepts(plans: PlanLike[]): string[] {
  return Array.from(
    new Set(
      plans
        .map(plan => resolveCollegePlanSourceDept(plan))
        .filter(Boolean)
    )
  ).sort()
}
