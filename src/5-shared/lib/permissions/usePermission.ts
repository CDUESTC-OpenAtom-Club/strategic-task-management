/**
 * Canonical permissions entry for permission-aware composables.
 *
 * This module is the single source of truth for `usePermission`.
 * Legacy imports from `authorization` and `hooks/usePermission` should
 * re-export from here during the migration window.
 */

import { computed, type ComputedRef } from 'vue'
import { useAuthStore } from '@/features/auth/model/store'
import type {
  PermissionCode,
  UserRoleWithPermission as _UserRoleWithPermission,
  Plan,
  PlanFill,
  Indicator,
  IndicatorFill
} from '@/shared/types'

export interface PermissionCheckResult {
  hasPermission: boolean
  permissionCode: string
  reason?: string
}

export interface UsePermissionReturn {
  userRole: ComputedRef<string | undefined>
  userOrgId: ComputedRef<number | string | undefined>
  isStrategicDept: ComputedRef<boolean>
  isFunctionalDept: ComputedRef<boolean>
  isSecondaryCollege: ComputedRef<boolean>
  hasPermission: (permission: PermissionCode | PermissionCode[]) => boolean
  canAccessOrg: (orgId: number | string) => boolean
  canOperate: (resourceOrgId: number | string, permission: PermissionCode) => boolean
  canViewPlan: (plan: Plan) => boolean
  canEditPlan: (plan: Plan) => boolean
  canDeletePlan: (plan: Plan) => boolean
  canSubmitPlan: (plan: Plan) => boolean
  getAccessiblePlans: (plans: Plan[]) => Plan[]
  canAuditPlanFill: (planFill: PlanFill) => boolean
  canViewPlanFill: (planFill: PlanFill) => boolean
  getAuditablePlanFills: (planFills: PlanFill[]) => PlanFill[]
  canFillIndicator: (indicator: Indicator) => boolean
  canViewIndicator: (indicator: Indicator) => boolean
  canEditIndicatorFill: (fill: IndicatorFill) => boolean
  canDeleteIndicatorFill: (fill: IndicatorFill) => boolean
}

const PERMISSION_ROLE_MAP: Record<PermissionCode, string[]> = {
  [PermissionCode.PLAN_CREATE]: ['strategic_dept', 'functional_dept'],
  [PermissionCode.PLAN_VIEW]: ['strategic_dept', 'functional_dept', 'secondary_college'],
  [PermissionCode.PLAN_EDIT]: ['strategic_dept', 'functional_dept'],
  [PermissionCode.PLAN_DELETE]: ['strategic_dept'],
  [PermissionCode.PLAN_SUBMIT]: ['strategic_dept', 'functional_dept', 'secondary_college'],
  [PermissionCode.INDICATOR_VIEW]: ['strategic_dept', 'functional_dept', 'secondary_college'],
  [PermissionCode.INDICATOR_FILL]: ['strategic_dept', 'functional_dept', 'secondary_college'],
  [PermissionCode.INDICATOR_EDIT]: ['strategic_dept', 'functional_dept'],
  [PermissionCode.TASK_CREATE]: ['strategic_dept', 'functional_dept'],
  [PermissionCode.TASK_EDIT]: ['strategic_dept', 'functional_dept'],
  [PermissionCode.TASK_DELETE]: ['strategic_dept']
}

export function usePermission(): UsePermissionReturn {
  const authStore = useAuthStore()

  const userRole = computed(() => authStore.user?.role)
  const userOrgId = computed(() => authStore.user?.orgId || authStore.user?.department)
  const isStrategicDept = computed(() => userRole.value === 'strategic_dept')
  const isFunctionalDept = computed(() => userRole.value === 'functional_dept')
  const isSecondaryCollege = computed(() => userRole.value === 'secondary_college')

  const hasPermission = (permission: PermissionCode | PermissionCode[]): boolean => {
    if (!userRole.value) {
      return false
    }

    const permissions = Array.isArray(permission) ? permission : [permission]

    if (isStrategicDept.value) {
      return true
    }

    return permissions.some(code => {
      const allowedRoles = PERMISSION_ROLE_MAP[code] || []
      return userRole.value ? allowedRoles.includes(userRole.value) : false
    })
  }

  const canAccessOrg = (orgId: number | string): boolean => {
    if (isStrategicDept.value) {
      return true
    }

    return userOrgId.value === orgId
  }

  const canOperate = (resourceOrgId: number | string, permission: PermissionCode): boolean => {
    return hasPermission(permission) && canAccessOrg(resourceOrgId)
  }

  const canViewPlan = (plan: Plan): boolean => {
    if (isStrategicDept.value) {
      return true
    }

    if (isFunctionalDept.value && plan.org_id === userOrgId.value) {
      return true
    }

    return false
  }

  const canEditPlan = (plan: Plan): boolean => {
    if (plan.status !== 'draft') {
      return false
    }

    if (isStrategicDept.value) {
      return true
    }

    if (isFunctionalDept.value && plan.org_id === userOrgId.value) {
      return true
    }

    return false
  }

  const canDeletePlan = (plan: Plan): boolean => {
    if (!isStrategicDept.value) {
      return false
    }

    return plan.status === 'draft'
  }

  const canSubmitPlan = (plan: Plan): boolean => {
    if (plan.status !== 'draft' && plan.status !== 'pending') {
      return false
    }

    if (!hasPermission(PermissionCode.PLAN_SUBMIT)) {
      return false
    }

    if (isStrategicDept.value) {
      return true
    }

    return plan.org_id === userOrgId.value
  }

  const getAccessiblePlans = (plans: Plan[]): Plan[] => {
    return plans.filter(canViewPlan)
  }

  const canAuditPlanFill = (planFill: PlanFill): boolean => {
    void planFill
    // 审批按钮现已由工作流待办 + 后端权限码统一控制，不再从前端角色兜底推导。
    return false
  }

  const canViewPlanFill = (planFill: PlanFill): boolean => {
    if (isStrategicDept.value) {
      return true
    }

    return canAccessOrg(planFill.org_id)
  }

  const getAuditablePlanFills = (planFills: PlanFill[]): PlanFill[] => {
    return planFills.filter(canAuditPlanFill)
  }

  const canFillIndicator = (indicator: Indicator): boolean => {
    if (!hasPermission(PermissionCode.INDICATOR_FILL)) {
      return false
    }

    return canAccessOrg(indicator.target_org_id)
  }

  const canViewIndicator = (indicator: Indicator): boolean => {
    if (isStrategicDept.value) {
      return true
    }

    return canAccessOrg(indicator.target_org_id) || canAccessOrg(indicator.org_id)
  }

  const canEditIndicatorFill = (fill: IndicatorFill): boolean => {
    if (!hasPermission(PermissionCode.INDICATOR_FILL)) {
      return false
    }

    return canAccessOrg(fill.org_id)
  }

  const canDeleteIndicatorFill = (fill: IndicatorFill): boolean => {
    return canEditIndicatorFill(fill)
  }

  return {
    userRole,
    userOrgId,
    isStrategicDept,
    isFunctionalDept,
    isSecondaryCollege,
    hasPermission,
    canAccessOrg,
    canOperate,
    canViewPlan,
    canEditPlan,
    canDeletePlan,
    canSubmitPlan,
    getAccessiblePlans,
    canAuditPlanFill,
    canViewPlanFill,
    getAuditablePlanFills,
    canFillIndicator,
    canViewIndicator,
    canEditIndicatorFill,
    canDeleteIndicatorFill
  }
}

export default usePermission
