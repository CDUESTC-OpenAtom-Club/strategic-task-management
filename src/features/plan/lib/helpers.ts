/**
 * Plan Feature - Helper Functions
 *
 * Internal helper functions for plan feature.
 */

import type { Plan, PlanStatus } from '@/types'

/**
 * Check if plan can be edited
 */
export function canEditPlan(plan: Plan | null): boolean {
  if (!plan) return false
  return ['DRAFT', 'REJECTED'].includes(plan.status)
}

/**
 * Check if plan can be submitted
 */
export function canSubmitPlan(plan: Plan | null): boolean {
  if (!plan) return false
  return plan.status === 'DRAFT'
}

/**
 * Check if plan can be approved
 */
export function canApprovePlan(plan: Plan | null): boolean {
  if (!plan) return false
  return plan.status === 'PENDING_APPROVAL'
}

/**
 * Get plan status text
 */
export function getPlanStatusText(status: PlanStatus): string {
  const statusMap: Record<PlanStatus, string> = {
    DRAFT: '草稿',
    PENDING_APPROVAL: '待审批',
    APPROVED: '已通过',
    REJECTED: '已拒绝',
    ARCHIVED: '已归档'
  }
  return statusMap[status] || status
}

/**
 * Get plan status color
 */
export function getPlanStatusColor(status: PlanStatus): string {
  const colorMap: Record<PlanStatus, string> = {
    DRAFT: 'info',
    PENDING_APPROVAL: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
    ARCHIVED: 'info'
  }
  return colorMap[status] || 'info'
}

/**
 * Filter plans by status
 */
export function filterPlansByStatus(plans: Plan[], status: PlanStatus | 'all'): Plan[] {
  if (status === 'all') return plans
  return plans.filter(p => p.status === status)
}

/**
 * Filter plans by organization
 */
export function filterPlansByOrg(plans: Plan[], orgId: number | string | null): Plan[] {
  if (!orgId) return plans
  return plans.filter(p => p.org_id === orgId)
}

/**
 * Sort plans by date
 */
export function sortPlansByDate(plans: Plan[], order: 'asc' | 'desc' = 'desc'): Plan[] {
  return [...plans].sort((a, b) => {
    const dateA = new Date(a.created_at || 0).getTime()
    const dateB = new Date(b.created_at || 0).getTime()
    return order === 'asc' ? dateA - dateB : dateB - dateA
  })
}
