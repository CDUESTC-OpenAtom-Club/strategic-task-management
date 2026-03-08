/**
 * 权限控制组合式函数
 *
 * 基于 Org ID（组织ID）进行数据权限控制
 * 配合新数据结构: Plan -> Task -> Indicator -> IndicatorFill
 *
 * 权限层级：
 * 1. 战略部 (strategic_dept) - 全局权限
 * 2. 职能部门 (functional_dept) - 部门级权限
 * 3. 学院 (secondary_college) - 本学院权限
 */

import { computed, type ComputedRef } from 'vue'
import { useAuthStore } from '@/stores/auth'
import type { PermissionCode, UserRoleWithPermission as _UserRoleWithPermission, Plan, PlanFill, Indicator, IndicatorFill } from '@/types'

/**
 * 权限检查结果
 */
export interface PermissionCheckResult {
  /** 是否有权限 */
  hasPermission: boolean
  /** 权限代码 */
  permissionCode: string
  /** 原因说明 */
  reason?: string
}

/**
 * 权限控制返回值
 */
export interface UsePermissionReturn {
  /** 当前用户角色 */
  userRole: ComputedRef<string | undefined>
  /** 当前用户 Org ID */
  userOrgId: ComputedRef<number | string | undefined>
  /** 是否为战略部门 */
  isStrategicDept: ComputedRef<boolean>
  /** 是否为职能部门 */
  isFunctionalDept: ComputedRef<boolean>
  /** 是否为学院 */
  isSecondaryCollege: ComputedRef<boolean>

  // ============ 通用权限检查 ============

  /** 检查是否有指定权限 */
  hasPermission: (permission: PermissionCode | PermissionCode[]) => boolean
  /** 检查是否可以访问指定 Org 的数据 */
  canAccessOrg: (orgId: number | string) => boolean
  /** 检查是否可以操作指定资源 */
  canOperate: (resourceOrgId: number | string, permission: PermissionCode) => boolean

  // ============ Plan 权限 ============

  /** 检查是否可以查看 Plan */
  canViewPlan: (plan: Plan) => boolean
  /** 检查是否可以编辑 Plan */
  canEditPlan: (plan: Plan) => boolean
  /** 检查是否可以删除 Plan */
  canDeletePlan: (plan: Plan) => boolean
  /** 检查是否可以提交 Plan */
  canSubmitPlan: (plan: Plan) => boolean
  /** 获取可操作的 Plan 列表 */
  getAccessiblePlans: (plans: Plan[]) => Plan[]

  // ============ PlanFill 权限 ============

  /** 检查是否可以审核 PlanFill */
  canAuditPlanFill: (planFill: PlanFill) => boolean
  /** 检查是否可以查看 PlanFill */
  canViewPlanFill: (planFill: PlanFill) => boolean
  /** 获取可审核的 PlanFill 列表 */
  getAuditablePlanFills: (planFills: PlanFill[]) => PlanFill[]

  // ============ Indicator 权限 ============

  /** 检查是否可以填报 Indicator */
  canFillIndicator: (indicator: Indicator) => boolean
  /** 检查是否可以查看 Indicator */
  canViewIndicator: (indicator: Indicator) => boolean

  // ============ IndicatorFill 权限 ============

  /** 检查是否可以编辑 IndicatorFill */
  canEditIndicatorFill: (fill: IndicatorFill) => boolean
  /** 检查是否可以删除 IndicatorFill */
  canDeleteIndicatorFill: (fill: IndicatorFill) => boolean
}

// 权限代码到角色映射
const PERMISSION_ROLE_MAP: Record<PermissionCode, string[]> = {
  // Plan 相关
  [PermissionCode.PLAN_CREATE]: ['strategic_dept', 'functional_dept'],
  [PermissionCode.PLAN_VIEW]: ['strategic_dept', 'functional_dept', 'secondary_college'],
  [PermissionCode.PLAN_EDIT]: ['strategic_dept', 'functional_dept'],
  [PermissionCode.PLAN_DELETE]: ['strategic_dept'],
  [PermissionCode.PLAN_SUBMIT]: ['strategic_dept', 'functional_dept', 'secondary_college'],

  // Indicator 相关
  [PermissionCode.INDICATOR_VIEW]: ['strategic_dept', 'functional_dept', 'secondary_college'],
  [PermissionCode.INDICATOR_FILL]: ['strategic_dept', 'functional_dept', 'secondary_college'],
  [PermissionCode.INDICATOR_EDIT]: ['strategic_dept', 'functional_dept'],

  // 审核相关
  [PermissionCode.AUDIT_VIEW]: ['strategic_dept', 'functional_dept'],
  [PermissionCode.AUDIT_APPROVE]: ['strategic_dept', 'functional_dept'],
  [PermissionCode.AUDIT_REJECT]: ['strategic_dept', 'functional_dept'],

  // Task 相关
  [PermissionCode.TASK_CREATE]: ['strategic_dept', 'functional_dept'],
  [PermissionCode.TASK_EDIT]: ['strategic_dept', 'functional_dept'],
  [PermissionCode.TASK_DELETE]: ['strategic_dept'],
}

/**
 * 权限控制组合式函数
 *
 * @returns 权限检查方法和状态
 *
 * @example
 * ```typescript
 * const { canViewPlan, canEditPlan, getAccessiblePlans } = usePermission()
 *
 * // 检查是否可以查看 Plan
 * if (canViewPlan(plan)) {
 *   // 显示 Plan
 * }
 *
 * // 获取可访问的 Plan 列表
 * const accessiblePlans = getAccessiblePlans(allPlans)
 * ```
 */
export function usePermission(): UsePermissionReturn {
  const authStore = useAuthStore()

  // ============ 基础状态 ============

  /** 当前用户角色 */
  const userRole = computed(() => authStore.user?.role)

  /** 当前用户 Org ID */
  const userOrgId = computed(() => authStore.user?.orgId || authStore.user?.department)

  /** 是否为战略部门 */
  const isStrategicDept = computed(() => userRole.value === 'strategic_dept')

  /** 是否为职能部门 */
  const isFunctionalDept = computed(() => userRole.value === 'functional_dept')

  /** 是否为学院 */
  const isSecondaryCollege = computed(() => userRole.value === 'secondary_college')

  // ============ 通用权限检查 ============

  /**
   * 检查是否有指定权限
   * @param permission - 权限代码或权限代码数组
   * @returns 是否有权限
   */
  const hasPermission = (permission: PermissionCode | PermissionCode[]): boolean => {
    if (!userRole.value) {return false}

    const permissions = Array.isArray(permission) ? permission : [permission]

    // 战略部门拥有所有权限
    if (isStrategicDept.value) {return true}

    // 检查每个权限
    return permissions.some(p => {
      const allowedRoles = PERMISSION_ROLE_MAP[p] || []
      return allowedRoles.includes(userRole.value!)
    })
  }

  /**
   * 检查是否可以访问指定 Org 的数据
   * @param orgId - 组织 ID
   * @returns 是否可以访问
   */
  const canAccessOrg = (orgId: number | string): boolean => {
    // 战略部门可以访问所有数据
    if (isStrategicDept.value) {return true}

    // 检查是否是同一组织
    return userOrgId.value === orgId
  }

  /**
   * 检查是否可以操作指定资源
   * @param resourceOrgId - 资源所属组织 ID
   * @param permission - 所需权限
   * @returns 是否可以操作
   */
  const canOperate = (resourceOrgId: number | string, permission: PermissionCode): boolean => {
    return hasPermission(permission) && canAccessOrg(resourceOrgId)
  }

  // ============ Plan 权限 ============

  /**
   * 检查是否可以查看 Plan
   * @param plan - Plan 对象
   * @returns 是否可以查看
   */
  const canViewPlan = (plan: Plan): boolean => {
    // 战略部门可以查看所有 Plan
    if (isStrategicDept.value) {return true}

    // 职能部门可以查看自己发布的 Plan
    if (isFunctionalDept.value && plan.org_id === userOrgId.value) {return true}

    // 学院可以查看分配给自己的 Plan
    // 这里需要根据业务逻辑判断
    // 例如：Plan 的 tasks 中的 indicators 的 target_org_id 是否包含当前学院

    return false
  }

  /**
   * 检查是否可以编辑 Plan
   * @param plan - Plan 对象
   * @returns 是否可以编辑
   */
  const canEditPlan = (plan: Plan): boolean => {
    // 只有草稿状态的 Plan 可以编辑
    if (plan.status !== 'draft') {return false}

    // 战略部门可以编辑所有 Plan
    if (isStrategicDept.value) {return true}

    // 职能部门只能编辑自己创建的 Plan
    if (isFunctionalDept.value && plan.org_id === userOrgId.value) {return true}

    return false
  }

  /**
   * 检查是否可以删除 Plan
   * @param plan - Plan 对象
   * @returns 是否可以删除
   */
  const canDeletePlan = (plan: Plan): boolean => {
    // 只有战略部门可以删除 Plan
    if (!isStrategicDept.value) {return false}

    // 只有草稿状态的 Plan 可以删除
    return plan.status === 'draft'
  }

  /**
   * 检查是否可以提交 Plan
   * @param plan - Plan 对象
   * @returns 是否可以提交
   */
  const canSubmitPlan = (plan: Plan): boolean => {
    // 只有草稿或待审核状态的 Plan 可以提交
    if (plan.status !== 'draft' && plan.status !== 'pending') {return false}

    // 必须有权限
    if (!hasPermission(PermissionCode.PLAN_SUBMIT)) {return false}

    // 战略部门可以提交所有 Plan
    if (isStrategicDept.value) {return true}

    // 职能部门和学院只能提交自己的 Plan
    return plan.org_id === userOrgId.value
  }

  /**
   * 获取可操作的 Plan 列表
   * @param plans - 所有 Plan 列表
   * @returns 可访问的 Plan 列表
   */
  const getAccessiblePlans = (plans: Plan[]): Plan[] => {
    return plans.filter(plan => canViewPlan(plan))
  }

  // ============ PlanFill 权限 ============

  /**
   * 检查是否可以审核 PlanFill
   * @param planFill - PlanFill 对象
   * @returns 是否可以审核
   */
  const canAuditPlanFill = (planFill: PlanFill): boolean => {
    // 必须有审核权限
    if (!hasPermission([PermissionCode.AUDIT_APPROVE, PermissionCode.AUDIT_REJECT])) {
      return false
    }

    // 只能审核待审核状态的提交
    if (planFill.status !== 'submitted') {return false}

    // 战略部门可以审核所有提交
    if (isStrategicDept.value) {return true}

    // 职能部门可以审核下级学院的提交
    // 这里需要根据业务逻辑判断
    // 例如：检查 Plan 的 org_id 是否是当前部门的下级

    return true
  }

  /**
   * 检查是否可以查看 PlanFill
   * @param planFill - PlanFill 对象
   * @returns 是否可以查看
   */
  const canViewPlanFill = (planFill: PlanFill): boolean => {
    // 战略部门可以查看所有提交
    if (isStrategicDept.value) {return true}

    // 提交人可以查看自己的提交
    if (planFill.submitted_by === authStore.user?.id) {return true}

    // 审核人可以查看待审核的提交
    if (canAuditPlanFill(planFill)) {return true}

    return false
  }

  /**
   * 获取可审核的 PlanFill 列表
   * @param planFills - 所有 PlanFill 列表
   * @returns 可审核的 PlanFill 列表
   */
  const getAuditablePlanFills = (planFills: PlanFill[]): PlanFill[] => {
    return planFills.filter(fill => canAuditPlanFill(fill))
  }

  // ============ Indicator 权限 ============

  /**
   * 检查是否可以填报 Indicator
   * @param _indicator - Indicator 对象
   * @returns 是否可以填报
   */
  const canFillIndicator = (_indicator: Indicator): boolean => {
    // 必须有填报权限
    if (!hasPermission(PermissionCode.INDICATOR_FILL)) {return false}

    // 战略部门可以填报所有指标
    if (isStrategicDept.value) {return true}

    // TODO: 检查指标是否分配给当前用户/组织

    return true
  }

  /**
   * 检查是否可以查看 Indicator
   * @param _indicator - Indicator 对象
   * @returns 是否可以查看
   */
  const canViewIndicator = (_indicator: Indicator): boolean => {
    // 所有有权限的用户都可以查看指标
    return hasPermission(PermissionCode.INDICATOR_VIEW)
  }

  // ============ IndicatorFill 权限 ============

  /**
   * 检查是否可以编辑 IndicatorFill
   * @param fill - IndicatorFill 对象
   * @returns 是否可以编辑
   */
  const canEditIndicatorFill = (fill: IndicatorFill): boolean => {
    // 只能编辑自己创建的填报记录
    if (fill.filled_by !== authStore.user?.id) {return false}

    // 只有草稿或已驳回状态的记录可以编辑
    return !fill.status || fill.status === 'rejected'
  }

  /**
   * 检查是否可以删除 IndicatorFill
   * @param fill - IndicatorFill 对象
   * @returns 是否可以删除
   */
  const canDeleteIndicatorFill = (fill: IndicatorFill): boolean => {
    // 只能删除自己创建的填报记录
    if (fill.filled_by !== authStore.user?.id) {return false}

    // 只有草稿状态的记录可以删除
    return !fill.status
  }

  return {
    // 基础状态
    userRole,
    userOrgId,
    isStrategicDept,
    isFunctionalDept,
    isSecondaryCollege,

    // 通用权限检查
    hasPermission,
    canAccessOrg,
    canOperate,

    // Plan 权限
    canViewPlan,
    canEditPlan,
    canDeletePlan,
    canSubmitPlan,
    getAccessiblePlans,

    // PlanFill 权限
    canAuditPlanFill,
    canViewPlanFill,
    getAuditablePlanFills,

    // Indicator 权限
    canFillIndicator,
    canViewIndicator,

    // IndicatorFill 权限
    canEditIndicatorFill,
    canDeleteIndicatorFill
  }
}

export default usePermission
