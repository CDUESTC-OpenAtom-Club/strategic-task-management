<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  ElDrawer,
  ElDialog,
  ElTabs,
  ElTabPane,
  ElEmpty,
  ElTag,
  ElAlert,
  ElButton,
  ElMessage,
  ElMessageBox,
  ElLoading
} from 'element-plus'
import { Document, User, Timer, Right } from '@element-plus/icons-vue'
import type { StrategicIndicator, Plan } from '@/shared/types'
import type { WorkflowNode, ApprovalHistoryItem } from '@/shared/types'
import { approvalApi } from '@/features/task/api/strategicApi'
import { getUserById } from '@/features/user/api/query'
import { useAuthStore } from '@/features/auth/model/store'
import { usePlanStore } from '@/features/plan/model/store'
import { useTimeContextStore } from '@/shared/lib/timeContext'
import { logger } from '@/shared/lib/utils/logger'
import {
  getWorkflowInstanceDetail,
  getWorkflowInstanceDetailByBusiness,
  getWorkflowInstanceHistoryByBusiness
} from '@/features/workflow/api/queries'
import type {
  WorkflowHistoryCardResponse,
  WorkflowInstanceDetailResponse,
  WorkflowTaskResponse
} from '@/features/workflow/api/types'
import ApprovalHistory from './ApprovalHistory.vue'
import CustomApprovalFlow from './CustomApprovalFlow.vue'

/**
 * 审批进度抽屉组件
 *
 * 整合审批组件：
 * 1. CustomApprovalFlow - 审批流程视图（垂直时间轴）
 * 2. ApprovalHistory - 审批历史时间线
 *
 * 用于展示指标审批进度和历史记录
 */

interface Props {
  modelValue: boolean
  indicators?: StrategicIndicator[]
  plan?: Plan | null
  initialPlanWorkflowDetail?: WorkflowInstanceDetailResponse | null
  indicatorId?: string | number
  departmentName?: string
  planName?: string
  showApprovalSection?: boolean
  showPlanApprovals?: boolean
  readonly?: boolean
  // 审批类型：'distribution' = 下发审批, 'submission' = 上报审批
  approvalType?: 'distribution' | 'submission'
  historyViewMode?: 'auto' | 'card-only'
  workflowCode?: string | string[]
  workflowEntityType?: 'PLAN' | 'PLAN_REPORT'
  workflowEntityId?: number | string
  secondaryWorkflowEntityType?: 'PLAN' | 'PLAN_REPORT'
  secondaryWorkflowEntityId?: number | string
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'close'): void
  (e: 'refresh'): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  indicators: () => [],
  plan: null,
  initialPlanWorkflowDetail: null,
  indicatorId: undefined,
  departmentName: '',
  planName: '',
  showApprovalSection: true,
  showPlanApprovals: false,
  readonly: false,
  approvalType: 'submission',
  historyViewMode: 'auto',
  workflowCode: '',
  workflowEntityType: 'PLAN',
  workflowEntityId: undefined,
  secondaryWorkflowEntityType: undefined,
  secondaryWorkflowEntityId: undefined
})

const emit = defineEmits<Emits>()
const authStore = useAuthStore()
const planStore = usePlanStore()
const timeContext = useTimeContextStore()
const PLAN_DISPATCH_APPROVE_PERMISSION = 'BTN_STRATEGY_TASK_DISPATCH_APPROVE'
const PLAN_REPORT_APPROVE_PERMISSION = 'BTN_STRATEGY_TASK_REPORT_APPROVE'
const INDICATOR_DISPATCH_APPROVE_PERMISSION = 'BTN_INDICATOR_DISPATCH_APPROVE'
const INDICATOR_REPORT_APPROVE_PERMISSION = 'BTN_INDICATOR_REPORT_APPROVE'
const currentUserId = computed(() => Number(authStore.user?.userId ?? authStore.user?.id ?? 0))
const currentUserOrgId = computed(() => Number(authStore.user?.orgId ?? 0))
const currentUserPermissionCodes = computed(() => {
  const permissions = (authStore.user as { permissions?: unknown[] } | null)?.permissions
  if (!Array.isArray(permissions)) {
    return []
  }
  return permissions
    .map(permission => (typeof permission === 'string' ? permission.trim() : ''))
    .filter(Boolean)
})
const currentUserRoleCodes = computed(() => {
  const roles = (authStore.user as { roles?: unknown[] } | null)?.roles
  if (!Array.isArray(roles)) {
    return []
  }

  return roles.map(role => (typeof role === 'string' ? role.trim() : '')).filter(Boolean)
})
const submitterNameCache = ref<Record<string, string>>({})

function normalizeDisplayName(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeWorkflowCode(value: unknown): string {
  return String(value || '')
    .trim()
    .toUpperCase()
}

const expectedWorkflowCodes = computed(() => {
  const rawCodes = Array.isArray(props.workflowCode) ? props.workflowCode : [props.workflowCode]
  return rawCodes.map(normalizeWorkflowCode).filter(Boolean)
})

function matchesExpectedWorkflowCode(workflowCode: unknown): boolean {
  if (expectedWorkflowCodes.value.length === 0) {
    return true
  }

  return expectedWorkflowCodes.value.includes(normalizeWorkflowCode(workflowCode))
}

function parsePositiveUserId(value: unknown): number | null {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null
  }
  return numericValue
}

function getFallbackSubmitterValue(): string {
  const createdBy = normalizeDisplayName(props.plan?.createdBy)
  if (createdBy && !parsePositiveUserId(createdBy)) {
    return createdBy
  }

  return props.departmentName || '当前提交人'
}

function cacheSubmitterName(userIdValue: unknown, nameValue: unknown): boolean {
  const userId = parsePositiveUserId(userIdValue)
  const displayName = normalizeDisplayName(nameValue)
  if (!userId || !displayName) {
    return false
  }

  const cacheKey = String(userId)
  if (submitterNameCache.value[cacheKey] === displayName) {
    return true
  }

  submitterNameCache.value = {
    ...submitterNameCache.value,
    [cacheKey]: displayName
  }

  return true
}

async function ensureSubmitterNameLoaded(
  userIdValue: unknown,
  fallbackName?: string
): Promise<void> {
  const userId = parsePositiveUserId(userIdValue)
  if (!userId) {
    return
  }

  const cacheKey = String(userId)
  if (submitterNameCache.value[cacheKey]) {
    return
  }

  try {
    const user = await getUserById(userId)
    const realName = normalizeDisplayName(user.realName)
    const username = normalizeDisplayName(user.username)
    submitterNameCache.value = {
      ...submitterNameCache.value,
      [cacheKey]: realName || username || cacheKey
    }
  } catch (error) {
    const fallbackDisplayName = normalizeDisplayName(fallbackName) || getFallbackSubmitterValue()
    cacheSubmitterName(userId, fallbackDisplayName)
    logger.warn('[ApprovalProgressDrawer] 提交人名称解析失败:', { userId, error })
  }
}

const planSubmitterName = computed(() => {
  const explicitName =
    normalizeDisplayName(props.plan?.submittedByName) ||
    normalizeDisplayName(props.plan?.createdByName)
  if (explicitName) {
    return explicitName
  }

  const submittedById = parsePositiveUserId(props.plan?.submittedBy)
  if (submittedById) {
    return submitterNameCache.value[String(submittedById)] || String(submittedById)
  }

  const createdById = parsePositiveUserId(props.plan?.createdBy)
  if (createdById) {
    return submitterNameCache.value[String(createdById)] || String(createdById)
  }

  return getFallbackSubmitterValue()
})

// ============ 状态 ============
const activeTab = ref('workflow')
const planApprovalsLoading = ref(false)
const pendingPlanApprovals = ref<Record<string, any>[]>([])
const planDetailDialogVisible = ref(false)
const planWorkflowDetail = ref<WorkflowInstanceDetailResponse | null>(props.initialPlanWorkflowDetail)
const planWorkflowHistoryCards = ref<WorkflowHistoryCardResponse[]>([])
const selectedHistoryInstanceId = ref<string | null>(null)
const selectedHistoryInstanceDetail = ref<WorkflowInstanceDetailResponse | null>(null)
const selectedHistoryInstanceDetailLoading = ref(false)
const historyInstanceDetailCache = ref<Record<string, WorkflowInstanceDetailResponse>>({})

interface PlanApprovalDetailItem {
  instanceId: number
  instanceNo: string
  title: string
  routeTitle?: string
  flowName?: string
  flowCode?: string
  submitterName: string
  currentStepName: string
  createdAt?: string
  completedAt?: string
  statusLabel?: string
  statusType?: 'success' | 'warning' | 'danger' | 'info'
  entityId?: string | number
  planName?: string
}

interface WorkflowHistoryTarget {
  entityType: 'PLAN' | 'PLAN_REPORT'
  entityId: number
}

// 当前选中的指标
const currentIndicator = computed(() => {
  if (props.indicatorId) {
    return props.indicators.find(i => i.id === props.indicatorId)
  }
  // 如果没有指定ID，返回第一个有待审批状态的指标
  return (
    props.indicators.find(
      i =>
        i.progressApprovalStatus &&
        ['pending', 'approved', 'rejected'].includes(i.progressApprovalStatus)
    ) || props.indicators[0]
  )
})

// 是否有审批数据
const hasApprovalData = computed(() => {
  return (
    props.indicators.length > 0 &&
    props.indicators.some(i => i.progressApprovalStatus && i.progressApprovalStatus !== 'none')
  )
})

// 待审批数量
const pendingCount = computed(() => {
  return props.indicators.filter(i => i.progressApprovalStatus === 'pending').length
})

// 已通过数量
const approvedCount = computed(() => {
  return props.indicators.filter(i => i.progressApprovalStatus === 'approved').length
})

// 已驳回数量
const rejectedCount = computed(() => {
  return props.indicators.filter(i => i.progressApprovalStatus === 'rejected').length
})

const currentPlanEntityIds = computed(() => {
  if (props.plan?.id) {
    return new Set([Number(props.plan.id)])
  }

  if (props.plan?.workflowInstanceId) {
    return new Set([Number(props.plan.workflowInstanceId)])
  }

  return new Set<number>()
})

const scopedDepartmentPlan = computed(() => {
  if (props.plan || !props.departmentName) {
    return null
  }

  return planStore.getPlanByTargetOrgAndYear(props.departmentName, timeContext.currentYear) || null
})

const scopedPlanEntityIds = computed(() => {
  const entityIds = new Set<number>()

  currentPlanEntityIds.value.forEach(entityId => {
    entityIds.add(entityId)
  })

  const departmentPlanId = Number(scopedDepartmentPlan.value?.id ?? NaN)
  if (Number.isFinite(departmentPlanId) && departmentPlanId > 0) {
    entityIds.add(departmentPlanId)
  }

  return entityIds
})

const scopedPlanApprovals = computed(() => {
  if (scopedPlanEntityIds.value.size === 0) {
    if (props.departmentName || props.planName) {
      return []
    }
    return pendingPlanApprovals.value
  }

  const withEntityId = pendingPlanApprovals.value.filter(instance => {
    const entityId = Number(instance.entityId)
    return Number.isFinite(entityId) && entityId > 0
  })

  if (withEntityId.length === 0) {
    return []
  }

  return withEntityId.filter(instance => {
    if (!scopedPlanEntityIds.value.has(Number(instance.entityId))) {
      return false
    }

    const flowCode = (instance as { flowCode?: string }).flowCode
    return matchesExpectedWorkflowCode(flowCode)
  })
})

const scopedPendingPlanCount = computed(() => scopedPlanApprovals.value.length)

const historyTargets = computed<WorkflowHistoryTarget[]>(() => {
  const targets: WorkflowHistoryTarget[] = []
  const seen = new Set<string>()

  const appendTarget = (entityType: 'PLAN' | 'PLAN_REPORT' | undefined, entityId: unknown) => {
    const normalizedType =
      entityType === 'PLAN_REPORT' ? 'PLAN_REPORT' : entityType === 'PLAN' ? 'PLAN' : null
    const normalizedId = Number(entityId ?? NaN)
    if (!normalizedType || !Number.isFinite(normalizedId) || normalizedId <= 0) {
      return
    }

    const key = `${normalizedType}:${normalizedId}`
    if (seen.has(key)) {
      return
    }

    seen.add(key)
    targets.push({
      entityType: normalizedType,
      entityId: normalizedId
    })
  }

  appendTarget(props.workflowEntityType, props.workflowEntityId ?? props.plan?.id)
  appendTarget(props.secondaryWorkflowEntityType, props.secondaryWorkflowEntityId)

  return targets
})
const activePlanWorkflow = computed(() => {
  if (!props.plan) {
    return null
  }

  const detail = planWorkflowDetail.value
  const useDetail = detail && matchesExpectedWorkflowCode(detail.flowCode)
  return {
    ...props.plan,
    workflowInstanceId:
      Number((useDetail ? detail.instanceId : undefined) || props.plan.workflowInstanceId || 0) ||
      undefined,
    workflowStatus:
      (useDetail ? detail.status : undefined) || props.plan.workflowStatus || props.plan.status,
    currentTaskId: (useDetail ? detail.currentTaskId : undefined) || props.plan.currentTaskId,
    currentStepName: (useDetail ? detail.currentStepName : undefined) || props.plan.currentStepName,
    currentApproverId:
      (useDetail ? detail.currentApproverId : undefined) ?? props.plan.currentApproverId,
    currentApproverName:
      (useDetail ? detail.currentApproverName : undefined) || props.plan.currentApproverName,
    canWithdraw:
      useDetail && typeof detail?.canWithdraw === 'boolean'
        ? detail.canWithdraw
        : props.plan.canWithdraw,
    workflowHistory:
      useDetail && Array.isArray(detail?.history) ? detail.history : props.plan.workflowHistory
  }
})

const currentDetailWorkflow = computed(
  () => selectedHistoryInstanceDetail.value || planWorkflowDetail.value
)

const hasPlanWorkflowData = computed(() => {
  return Boolean(
    activePlanWorkflow.value &&
    (activePlanWorkflow.value.workflowInstanceId ||
      activePlanWorkflow.value.workflowStatus ||
      activePlanWorkflow.value.currentStepName ||
      (Array.isArray(activePlanWorkflow.value.workflowHistory) &&
        activePlanWorkflow.value.workflowHistory.length > 0))
  )
})

const normalizedPlanBusinessStatus = computed(() => {
  const rawStatus = String(props.plan?.status || '')
    .trim()
    .toUpperCase()

  if (rawStatus === 'PUBLISHED') {
    return 'APPROVED'
  }

  return rawStatus
})

const planWorkflowStatus = computed(() => {
  return String(
    activePlanWorkflow.value?.workflowStatus || activePlanWorkflow.value?.status || ''
  ).toUpperCase()
})

const isPlanPendingApproval = computed(() => {
  return ['PENDING', 'IN_REVIEW', 'SUBMITTED'].includes(planWorkflowStatus.value)
})

const isPlanCompletedApproval = computed(() => {
  return ['DISTRIBUTED', 'APPROVED'].includes(planWorkflowStatus.value)
})

const currentPlanOperationLabel = computed(() => {
  if (!hasPlanWorkflowData.value) {
    return null
  }

  if (normalizedPlanBusinessStatus.value === 'DRAFT') {
    if (planWorkflowStatusTag.value.label === '已撤回') {
      return '已撤回，可重新发起审批'
    }
    if (planWorkflowStatusTag.value.label === '已驳回') {
      return '已退回，可修改后重新发起审批'
    }
    return '草稿状态，可发起审批'
  }

  if (['DRAFT', 'WITHDRAWN', 'CANCELLED'].includes(planWorkflowStatus.value)) {
    return '已撤回，可重新发起审批'
  }

  if (['RETURNED', 'REJECTED'].includes(planWorkflowStatus.value)) {
    return '已退回，可修改后重新发起审批'
  }

  if (isPlanCompletedApproval.value) {
    return '审批已完成'
  }

  if (isPlanPendingApproval.value) {
    return activePlanWorkflow.value?.canWithdraw ? '提交方仍可撤回' : '审批流已锁定'
  }

  return null
})

const requiredPlanApprovalPermissionCodes = computed(() => {
  return props.approvalType === 'distribution'
    ? [PLAN_DISPATCH_APPROVE_PERMISSION, INDICATOR_DISPATCH_APPROVE_PERMISSION]
    : [PLAN_REPORT_APPROVE_PERMISSION, INDICATOR_REPORT_APPROVE_PERMISSION]
})

const requiredPlanApprovalPermissionCode = computed(() => {
  return requiredPlanApprovalPermissionCodes.value[0]
})

const hasPlanApprovalPermission = computed(() => {
  return requiredPlanApprovalPermissionCodes.value.some(code =>
    currentUserPermissionCodes.value.includes(code)
  )
})

function resolveExpectedApproverRoleCodes(): string[] {
  const stepName = String(activePlanWorkflow.value?.currentStepName || '').trim()
  if (!stepName) {
    return []
  }

  if (
    stepName.includes('职能部门审批') ||
    stepName.includes('职能部门终审') ||
    stepName.includes('二级学院审批')
  ) {
    return ['ROLE_APPROVER']
  }

  if (stepName.includes('战略发展部')) {
    return ['ROLE_STRATEGY_DEPT_HEAD']
  }

  if (stepName.includes('分管校领导') || stepName.includes('学院院长')) {
    return ['ROLE_VICE_PRESIDENT']
  }

  return []
}

function resolveExpectedApproverOrgId(): number | null {
  const stepName = String(activePlanWorkflow.value?.currentStepName || '').trim()
  const currentTaskId = String(currentPlanTaskId.value || '').trim()
  if (currentTaskId && Array.isArray(planWorkflowDetail.value?.tasks)) {
    const currentTask = planWorkflowDetail.value.tasks.find(
      task => String(task.taskId || '').trim() === currentTaskId
    )

    if (stepName.includes('职能部门终审')) {
      const sourceOrgId = Number(
        planWorkflowDetail.value?.sourceOrgId ?? activePlanWorkflow.value?.sourceOrgId ?? 0
      )
      if (Number.isFinite(sourceOrgId) && sourceOrgId > 0) {
        return sourceOrgId
      }
    }

    const approverOrgId = Number(currentTask?.approverOrgId ?? 0)
    if (Number.isFinite(approverOrgId) && approverOrgId > 0) {
      return approverOrgId
    }
  }

  return null
}

const currentPendingPlanTask = computed<WorkflowTaskResponse | null>(() => {
  const currentTaskId = String(currentPlanTaskId.value || '').trim()
  if (!currentTaskId) {
    return null
  }

  return (
    planWorkflowTasks.value.find(task => {
      const taskId = String(task.taskId || '').trim()
      const status = String(task.status || '')
        .trim()
        .toUpperCase()
      return taskId === currentTaskId && status === 'PENDING'
    }) || null
  )
})

const canCurrentUserHandlePlanApproval = computed(() => {
  if (
    !hasPlanWorkflowData.value ||
    !isPlanPendingApproval.value ||
    !hasPlanApprovalPermission.value
  ) {
    return false
  }

  if (!currentPendingPlanTask.value) {
    return false
  }

  const expectedApproverRoleCodes = resolveExpectedApproverRoleCodes()
  if (expectedApproverRoleCodes.length > 0) {
    const hasExpectedRole = expectedApproverRoleCodes.some(roleCode =>
      currentUserRoleCodes.value.includes(roleCode)
    )
    if (!hasExpectedRole) {
      return false
    }
  }

  const expectedApproverOrgId = resolveExpectedApproverOrgId()
  if (
    Number.isFinite(currentUserOrgId.value) &&
    currentUserOrgId.value > 0 &&
    Number.isFinite(expectedApproverOrgId) &&
    (expectedApproverOrgId as number) > 0
  ) {
    return currentUserOrgId.value === expectedApproverOrgId
  }

  return false
})

const currentPlanTaskId = computed(() => {
  if (isPlanWorkflowTerminated.value) {
    return 0
  }

  const pendingTask = planWorkflowTasks.value.find(task => {
    return (
      String(task.status || '')
        .trim()
        .toUpperCase() === 'PENDING'
    )
  })
  const pendingTaskId = Number(pendingTask?.taskId ?? 0)
  if (Number.isFinite(pendingTaskId) && pendingTaskId > 0) {
    return pendingTaskId
  }

  const rawTaskId = Number(activePlanWorkflow.value?.currentTaskId ?? 0)
  if (Number.isFinite(rawTaskId) && rawTaskId > 0) {
    return rawTaskId
  }

  return 0
})

const currentPlanInstanceStatus = computed(() => {
  return String(activePlanWorkflow.value?.workflowStatus || activePlanWorkflow.value?.status || '')
    .trim()
    .toUpperCase()
})

const latestPlanTask = computed(() => {
  if (planWorkflowTasks.value.length === 0) {
    return null
  }

  const sorted = [...planWorkflowTasks.value].sort((left, right) => {
    const leftId = Number(left.taskId ?? 0)
    const rightId = Number(right.taskId ?? 0)
    if (leftId !== rightId) {
      return leftId - rightId
    }
    const leftTime = new Date(left.createdTime || 0).getTime()
    const rightTime = new Date(right.createdTime || 0).getTime()
    return leftTime - rightTime
  })

  return sorted[sorted.length - 1] || null
})

const isPlanWorkflowTerminated = computed(() => {
  return ['WITHDRAWN', 'REJECTED', 'RETURNED', 'CANCELLED'].includes(
    currentPlanInstanceStatus.value
  )
})

const currentPlanInstanceId = computed(() => {
  const rawInstanceId = Number(activePlanWorkflow.value?.workflowInstanceId ?? 0)
  if (Number.isFinite(rawInstanceId) && rawInstanceId > 0) {
    return rawInstanceId
  }

  return 0
})

const planWorkflowStatusTag = computed(() => {
  const rawStatus = currentPlanInstanceStatus.value
  if (rawStatus === 'DISTRIBUTED' || rawStatus === 'APPROVED') {
    return { label: '已通过', type: 'success' as const }
  }
  if (rawStatus === 'RETURNED' || rawStatus === 'REJECTED') {
    return { label: '已驳回', type: 'danger' as const }
  }
  if (rawStatus === 'WITHDRAWN' || rawStatus === 'CANCELLED') {
    return { label: '已撤回', type: 'info' as const }
  }
  if (rawStatus === 'PENDING' || rawStatus === 'IN_REVIEW' || rawStatus === 'SUBMITTED') {
    return { label: '审批中', type: 'warning' as const }
  }

  const allTaskStatuses = new Set(
    planWorkflowTasks.value.map(task =>
      String(task.status || '')
        .trim()
        .toUpperCase()
    )
  )

  if (normalizedPlanBusinessStatus.value === 'DRAFT') {
    if (allTaskStatuses.has('WITHDRAWN')) {
      return { label: '已撤回', type: 'info' as const }
    }
    if (allTaskStatuses.has('REJECTED')) {
      return { label: '已驳回', type: 'danger' as const }
    }
    return { label: '草稿', type: 'info' as const }
  }

  const latestTaskStatus = String(latestPlanTask.value?.status || '')
    .trim()
    .toUpperCase()

  if (latestTaskStatus === 'WITHDRAWN') {
    return { label: '已撤回', type: 'info' as const }
  }
  if (latestTaskStatus === 'REJECTED') {
    return { label: '已驳回', type: 'danger' as const }
  }
  return { label: rawStatus || '未发起', type: 'info' as const }
})

const planWorkflowHistory = computed<ApprovalHistoryItem[]>(() => {
  if (!Array.isArray(activePlanWorkflow.value?.workflowHistory)) {
    return []
  }

  return activePlanWorkflow.value.workflowHistory
    .filter(shouldDisplayWorkflowHistoryItem)
    .map((item, index) => ({
      id: String(item.taskId ?? index),
      action: normalizeWorkflowAction(item.action),
      operator: String(item.operatorId ?? index),
      operatorName: String(item.operatorName || '系统'),
      operateTime: new Date(item.operateTime || Date.now()),
      stepName: typeof item.stepName === 'string' ? item.stepName : undefined,
      comment: item.comment
    }))
})

const planWorkflowTasks = computed<WorkflowTaskResponse[]>(() => {
  if (!Array.isArray(planWorkflowDetail.value?.tasks)) {
    return []
  }

  return [...planWorkflowDetail.value.tasks].sort((left, right) => {
    const leftStepNo = Number(left.stepNo ?? Number.MAX_SAFE_INTEGER)
    const rightStepNo = Number(right.stepNo ?? Number.MAX_SAFE_INTEGER)
    if (leftStepNo !== rightStepNo) {
      return leftStepNo - rightStepNo
    }
    return String(left.taskId || '').localeCompare(String(right.taskId || ''))
  })
})

function mapWorkflowTaskStatusToNodeStatus(task: WorkflowTaskResponse): WorkflowNode['status'] {
  const normalizedStatus = String(task.status || '')
    .trim()
    .toUpperCase()
  if (normalizedStatus === 'COMPLETED') {
    return 'completed'
  }
  if (normalizedStatus === 'REJECTED') {
    return 'rejected'
  }
  if (normalizedStatus === 'WITHDRAWN') {
    return 'withdrawn'
  }
  if (normalizedStatus === 'WAITING') {
    return 'waiting'
  }
  if (normalizedStatus === 'PENDING' && isPlanWorkflowTerminated.value) {
    return 'waiting'
  }
  if (
    normalizedStatus === 'PENDING' &&
    currentPlanInstanceStatus.value === 'WITHDRAWN' &&
    String(task.taskId || '') !== String(currentPlanTaskId.value || '')
  ) {
    return 'waiting'
  }
  if (String(task.taskId || '') === String(currentPlanTaskId.value || '')) {
    return 'current'
  }
  return 'pending'
}

function resolveWorkflowTaskOperatorName(task: WorkflowTaskResponse): string | undefined {
  const normalizedStatus = String(task.status || '')
    .trim()
    .toUpperCase()

  if (!['COMPLETED', 'REJECTED', 'WITHDRAWN'].includes(normalizedStatus)) {
    return undefined
  }

  return normalizeDisplayName(task.assigneeName) || normalizeDisplayName(task.approverOrgName)
}

function resolveSourceDepartmentDisplayName(): string {
  const detailSourceOrgName = normalizeDisplayName(planWorkflowDetail.value?.sourceOrgName)
  if (detailSourceOrgName) {
    return detailSourceOrgName
  }

  const activeSourceOrgName = normalizeDisplayName(
    (activePlanWorkflow.value as { sourceOrgName?: unknown } | null)?.sourceOrgName
  )
  if (activeSourceOrgName) {
    return activeSourceOrgName
  }

  const planSourceOrgName = normalizeDisplayName(
    (props.plan as { sourceOrgName?: unknown } | null)?.sourceOrgName
  )
  if (planSourceOrgName) {
    return planSourceOrgName
  }

  const ownerDeptName = props.indicators
    .map(indicator => normalizeDisplayName((indicator as { ownerDept?: unknown }).ownerDept))
    .find(Boolean)
  if (ownerDeptName) {
    return ownerDeptName
  }

  return '来源部门'
}

function resolveWorkflowTaskDisplayName(task: WorkflowTaskResponse): string {
  const rawStepName =
    normalizeDisplayName(task.currentStepName) || normalizeDisplayName(task.taskName) || '审批节点'

  if (rawStepName.includes('职能部门终审')) {
    return `${resolveSourceDepartmentDisplayName()}终审人审批`
  }

  return rawStepName
}

function resolveWorkflowTaskDisplayOperatorName(task: WorkflowTaskResponse): string | undefined {
  const resolvedOperatorName = resolveWorkflowTaskOperatorName(task)
  if (resolvedOperatorName) {
    return resolvedOperatorName
  }

  const rawStepName =
    normalizeDisplayName(task.currentStepName) || normalizeDisplayName(task.taskName) || ''

  if (rawStepName.includes('职能部门终审')) {
    return resolveSourceDepartmentDisplayName()
  }

  return undefined
}

function resolveTaskStatusLabel(task: WorkflowTaskResponse): string {
  const normalizedStatus = String(task.status || '')
    .trim()
    .toUpperCase()
  if (normalizedStatus === 'WAITING') {
    return '等待中'
  }
  if (normalizedStatus === 'WITHDRAWN') {
    return '已撤回'
  }
  if (normalizedStatus === 'REJECTED') {
    return '已驳回'
  }
  if (normalizedStatus === 'PENDING' && isPlanWorkflowTerminated.value) {
    return '等待中'
  }
  if (
    normalizedStatus === 'PENDING' &&
    currentPlanInstanceStatus.value === 'WITHDRAWN' &&
    String(task.taskId || '') !== String(currentPlanTaskId.value || '')
  ) {
    return '等待中'
  }
  if (normalizedStatus === 'COMPLETED') {
    return '已通过'
  }
  return '待审批'
}

const latestPlanTaskDisplayLabel = computed(() => {
  return latestPlanTask.value ? resolveTaskStatusLabel(latestPlanTask.value) : ''
})

const currentPlanStepDisplay = computed(() => {
  if (
    currentPlanInstanceStatus.value === 'WITHDRAWN' ||
    currentPlanInstanceStatus.value === 'CANCELLED'
  ) {
    return '已撤回'
  }
  if (
    currentPlanInstanceStatus.value === 'REJECTED' ||
    currentPlanInstanceStatus.value === 'RETURNED'
  ) {
    return '已退回'
  }
  if (
    currentPlanInstanceStatus.value === 'APPROVED' ||
    currentPlanInstanceStatus.value === 'DISTRIBUTED'
  ) {
    return '已通过'
  }

  if (normalizedPlanBusinessStatus.value === 'DRAFT') {
    if (planWorkflowStatusTag.value.label === '已撤回') {
      return '已撤回'
    }
    if (planWorkflowStatusTag.value.label === '已驳回') {
      return '已退回'
    }
    return '草稿'
  }

  if (['已撤回', '已驳回', '已通过'].includes(latestPlanTaskDisplayLabel.value)) {
    return latestPlanTaskDisplayLabel.value
  }

  return activePlanWorkflow.value?.currentStepName || latestPlanTaskDisplayLabel.value || '审批中'
})

const currentPlanApprovalItems = computed<PlanApprovalDetailItem[]>(() => {
  if (hasPlanWorkflowData.value && props.plan) {
    return [
      {
        instanceId: currentPlanInstanceId.value,
        instanceNo: String(currentPlanInstanceId.value || '待回填'),
        title: String(
          activePlanWorkflow.value?.name || props.planName || props.departmentName || '当前计划'
        ),
        submitterName: planSubmitterName.value,
        currentStepName: String(currentPlanStepDisplay.value),
        createdAt: activePlanWorkflow.value?.submittedAt || activePlanWorkflow.value?.createdAt,
        entityId: activePlanWorkflow.value?.id,
        planName: activePlanWorkflow.value?.name
      }
    ]
  }

  return scopedPlanApprovals.value.map((instance, index) => ({
    instanceId: Number(instance.instanceId) || index,
    instanceNo:
      String(
        instance.instanceNo || instance.flowInstanceNo || instance.processInstanceNo || ''
      ).trim() || `审批实例 ${index + 1}`,
    title: String(
      instance.entityTitle ||
        instance.planName ||
        instance.title ||
        instance.entityName ||
        `${props.planName || props.departmentName || '当前计划'} - 审批实例 ${index + 1}`
    ).trim(),
    submitterName: String(
      instance.submitterName || instance.applicantName || instance.submitter || '未知'
    ),
    currentStepName: String(
      instance.currentStepName ||
        instance.currentStep ||
        latestPlanTaskDisplayLabel.value ||
        '审批中'
    ),
    createdAt: typeof instance.createdAt === 'string' ? instance.createdAt : undefined,
    entityId: instance.entityId,
    planName: instance.planName
  }))
})

function isSubmissionFlow(flowCode?: string): boolean {
  return String(flowCode || '')
    .toUpperCase()
    .startsWith('PLAN_APPROVAL_')
}

function isDistributionFlow(flowCode?: string): boolean {
  return String(flowCode || '')
    .toUpperCase()
    .startsWith('PLAN_DISPATCH_')
}

function resolveApprovalRouteTitle(
  card: Pick<WorkflowHistoryCardResponse, 'flowCode' | 'sourceOrgName' | 'targetOrgName'>
): string {
  const sourceOrgName = normalizeDisplayName(card.sourceOrgName) || '战略发展部'
  const targetOrgName = normalizeDisplayName(card.targetOrgName) || '目标部门'

  if (isSubmissionFlow(card.flowCode)) {
    return `上报审批 · ${targetOrgName} -> ${sourceOrgName}`
  }

  if (isDistributionFlow(card.flowCode)) {
    return `下发审批 · ${sourceOrgName} -> ${targetOrgName}`
  }

  return normalizeDisplayName(card.flowCode) || '审批流程'
}

function resolveHistoryStatusTag(status?: string): {
  label: string
  type: 'success' | 'warning' | 'danger' | 'info'
} {
  const normalized = String(status || '').toUpperCase()
  if (normalized === 'APPROVED') {
    return { label: '已通过', type: 'success' }
  }
  if (normalized === 'REJECTED') {
    return { label: '已驳回', type: 'danger' }
  }
  if (normalized === 'WITHDRAWN') {
    return { label: '已撤回', type: 'info' }
  }
  if (normalized === 'IN_REVIEW' || normalized === 'PENDING' || normalized === 'SUBMITTED') {
    return { label: '审批中', type: 'warning' }
  }
  return { label: normalized || '未知', type: 'info' }
}

function isTerminalHistoryStatus(status?: string): boolean {
  const normalized = String(status || '')
    .trim()
    .toUpperCase()
  // 业务约定：审批历史只展示已审批完成的结果，不包含撤回中的流程。
  return ['APPROVED', 'REJECTED'].includes(normalized)
}

const historicalPlanApprovalItems = computed<PlanApprovalDetailItem[]>(() => {
  return planWorkflowHistoryCards.value
    .filter(item => isTerminalHistoryStatus(item.status) || Boolean(item.completedAt))
    .map((item, index) => {
      const statusTag = resolveHistoryStatusTag(item.status)
      return {
        instanceId: Number(item.instanceId) || index,
        instanceNo: String(item.instanceNo || item.instanceId || `审批实例 ${index + 1}`),
        title: normalizeDisplayName(item.planName) || `Plan ${item.entityId || ''}`.trim(),
        routeTitle: resolveApprovalRouteTitle(item),
        flowName: item.flowName,
        flowCode: item.flowCode,
        submitterName: normalizeDisplayName(item.requesterName) || '未知',
        currentStepName: statusTag.label,
        createdAt: item.startedAt,
        completedAt: item.completedAt,
        statusLabel: statusTag.label,
        statusType: statusTag.type,
        entityId: item.entityId,
        planName: item.planName
      }
    })
})

const currentPlanApprovalSummary = computed(() => {
  if (hasPlanWorkflowData.value && props.plan) {
    return {
      key:
        activePlanWorkflow.value?.name || props.planName || props.departmentName || 'current-plan',
      planName:
        activePlanWorkflow.value?.name ||
        props.planName ||
        `${props.departmentName || '当前部门'}计划`,
      currentStepName: currentPlanStepDisplay.value,
      submitterName: planSubmitterName.value,
      createdAt: activePlanWorkflow.value?.submittedAt || activePlanWorkflow.value?.createdAt,
      count: 1
    }
  }

  if (scopedPlanApprovals.value.length === 0) {
    return null
  }

  const sortedCreatedAt = scopedPlanApprovals.value
    .map(item => item.createdAt)
    .filter(Boolean)
    .sort()
  const latestCreatedAt = sortedCreatedAt[sortedCreatedAt.length - 1]

  return {
    key: props.planName || props.departmentName || 'current-plan',
    planName: props.planName || `${props.departmentName || '当前部门'}计划`,
    currentStepName:
      scopedPlanApprovals.value
        .map(item => item.currentStepName)
        .find(step => typeof step === 'string' && step.trim()) ||
      latestPlanTaskDisplayLabel.value ||
      '审批中',
    submitterName:
      scopedPlanApprovals.value
        .map(item => item.submitterName)
        .find(name => typeof name === 'string' && name.trim()) || '未知',
    createdAt: latestCreatedAt,
    count: scopedPlanApprovals.value.length
  }
})

// ============ 审批流程节点数据 ============
const workflowNodes = computed<WorkflowNode[]>(() => {
  if (isPlanHistoryOnlyMode.value) {
    return []
  }

  if (props.showPlanApprovals && !hasPlanWorkflowData.value) {
    return []
  }

  if (hasPlanWorkflowData.value && props.plan) {
    return planWorkflowTasks.value.map(task => ({
      id: String(task.taskId || task.taskKey || task.currentStepName || task.taskName),
      name: resolveWorkflowTaskDisplayName(task),
      status: mapWorkflowTaskStatusToNodeStatus(task),
      operatorName: resolveWorkflowTaskDisplayOperatorName(task),
      operateTime: task.approvedAt
        ? new Date(task.approvedAt)
        : task.createdTime
          ? new Date(task.createdTime)
          : undefined,
      comment:
        typeof task.comment === 'string' && task.comment.trim()
          ? task.comment
          : String(task.taskId || '') === String(currentPlanTaskId.value || '') &&
              activePlanWorkflow.value?.canWithdraw
            ? '当前仍可撤回'
            : undefined
    }))
  }

  const indicator = currentIndicator.value
  if (!indicator) return []

  // 根据指标的审批状态构建工作流节点
  const nodes: WorkflowNode[] = []

  // 1. 提交申请节点
  nodes.push({
    id: 'submit',
    name: '提交申请',
    status: indicator.progressApprovalStatus ? 'completed' : 'pending',
    operatorName: indicator.responsibleDeptName || '责任部门',
    operateTime: indicator.createdAt,
    comment: '提交进度审批申请'
  })

  // 2. 职能部门审核节点
  const hasFunctional = indicator.functionalDeptId
  if (hasFunctional) {
    nodes.push({
      id: 'functional',
      name: '职能部门审核',
      status: getFunctionalStatus(indicator.progressApprovalStatus),
      operatorName: indicator.functionalDeptName || '职能部门',
      comment: indicator.statusAudit?.find((a: Record<string, unknown>) => a.action === 'approve')
        ?.comment as string | undefined
    })
  }

  // 3. 战略部门审批节点
  nodes.push({
    id: 'strategic',
    name: '战略部门审批',
    status: getStrategicStatus(indicator.progressApprovalStatus),
    operatorName: '战略发展部',
    operateTime: indicator.updatedAt,
    comment: indicator.statusAudit?.find((a: Record<string, unknown>) => a.action === 'reject')
      ?.comment as string | undefined
  })

  return nodes
})

// 获取职能部门节点状态
function getFunctionalStatus(approvalStatus?: string): WorkflowNode['status'] {
  if (approvalStatus === 'approved') return 'completed'
  if (approvalStatus === 'rejected') return 'rejected'
  if (approvalStatus === 'pending') return 'completed'
  return 'pending'
}

// 获取战略部门节点状态
function getStrategicStatus(approvalStatus?: string): WorkflowNode['status'] {
  if (approvalStatus === 'approved') return 'completed'
  if (approvalStatus === 'rejected') return 'rejected'
  if (approvalStatus === 'pending') return 'current'
  return 'pending'
}

// ============ 审批历史数据 ============
const approvalHistory = computed<ApprovalHistoryItem[]>(() => {
  if (props.showPlanApprovals) {
    return planWorkflowHistory.value
  }

  if (planWorkflowHistory.value.length > 0) {
    return planWorkflowHistory.value
  }

  const indicator = currentIndicator.value
  if (!indicator?.statusAudit) return []

  return indicator.statusAudit.map((audit: Record<string, unknown>, index: number) => ({
    id: String(index),
    action: audit.action as ApprovalHistoryItem['action'],
    operator: String(audit.operator ?? index),
    operatorName: String(audit.operatorName ?? '系统'),
    operateTime: new Date((audit.operateTime as string | number | Date | undefined) ?? Date.now()),
    stepName: typeof audit.stepName === 'string' ? audit.stepName : undefined,
    comment: audit.comment as string | undefined,
    dataBefore: audit.dataBefore as Record<string, unknown> | undefined,
    dataAfter: audit.dataAfter as Record<string, unknown> | undefined
  }))
})

// 当前节点ID
const currentNodeId = computed(() => {
  if (hasPlanWorkflowData.value && props.plan) {
    if (isPlanPendingApproval.value && currentPlanTaskId.value) {
      return String(currentPlanTaskId.value)
    }
    return ''
  }

  const status = currentIndicator.value?.progressApprovalStatus
  if (status === 'pending') return 'strategic'
  if (status === 'approved') return ''
  return 'submit'
})

// 驳回原因
const rejectionReason = computed(() => {
  if (activePlanWorkflow.value?.lastRejectReason) {
    return activePlanWorkflow.value.lastRejectReason
  }

  const indicator = currentIndicator.value
  const rejectAudit = indicator?.statusAudit?.find(
    (a: Record<string, unknown>) => a.action === 'reject'
  )
  return rejectAudit?.comment || ''
})

// ============ 方法 ============
function handleClose() {
  emit('update:modelValue', false)
  emit('close')
}

async function refreshPlanApprovalAfterMutation(): Promise<void> {
  const planId = Number(props.plan?.id ?? scopedDepartmentPlan.value?.id ?? NaN)

  if (Number.isFinite(planId) && planId > 0) {
    await planStore.loadPlanDetails(planId, { force: true, background: true })
  }

  await Promise.all([
    loadPendingPlanApprovals(),
    loadPlanWorkflowDetail(),
    loadPlanWorkflowHistoryCards()
  ])

  emit('refresh')
}

async function loadPendingPlanApprovals() {
  if (hasPlanWorkflowData.value) {
    pendingPlanApprovals.value = []
    return
  }

  if (!props.showPlanApprovals) {
    pendingPlanApprovals.value = []
    return
  }

  planApprovalsLoading.value = true
  try {
    if (props.departmentName) {
      await planStore.loadPlans()
    }

    const userId = authStore.user?.userId || authStore.user?.id || 1
    const response = await approvalApi.getPendingApprovals(userId)
    if (response.success && Array.isArray(response.data)) {
      pendingPlanApprovals.value = response.data
      return
    }

    pendingPlanApprovals.value = []
    if (response.message) {
      ElMessage.error(response.message)
    }
  } catch (error: any) {
    pendingPlanApprovals.value = []
    logger.error('[ApprovalProgressDrawer] 加载待审批列表失败:', error)
    ElMessage.error(error?.message || '加载待审批列表失败')
  } finally {
    planApprovalsLoading.value = false
  }
}

async function loadPlanWorkflowDetail() {
  if (!props.showPlanApprovals || !props.plan) {
    planWorkflowDetail.value = null
    return
  }

  try {
    const businessEntityType = props.workflowEntityType || 'PLAN'
    const businessEntityId = Number(props.workflowEntityId ?? props.plan.id ?? 0)
    if (Number.isFinite(businessEntityId) && businessEntityId > 0) {
      const response = await getWorkflowInstanceDetailByBusiness(
        businessEntityType,
        businessEntityId
      )
      if (
        response.success &&
        response.data &&
        matchesExpectedWorkflowCode(response.data.flowCode)
      ) {
        planWorkflowDetail.value = response.data
        return
      }
    }
  } catch (error) {
    logger.warn('[ApprovalProgressDrawer] 按业务实体加载计划工作流详情失败，回退旧实例ID:', error)
  }

  const workflowInstanceId = Number(props.plan.workflowInstanceId ?? 0)
  if (Number.isFinite(workflowInstanceId) && workflowInstanceId > 0) {
    try {
      const response = await getWorkflowInstanceDetail(String(workflowInstanceId))
      if (
        response.success &&
        response.data &&
        matchesExpectedWorkflowCode(response.data.flowCode)
      ) {
        planWorkflowDetail.value = response.data
        return
      }
    } catch (error) {
      logger.warn('[ApprovalProgressDrawer] 旧实例ID详情加载失败:', {
        workflowInstanceId,
        error
      })
    }
  }

  try {
    planWorkflowDetail.value = null
  } catch (error) {
    planWorkflowDetail.value = null
    logger.warn('[ApprovalProgressDrawer] 加载计划工作流详情失败:', error)
  }
}

async function loadPlanWorkflowHistoryCards() {
  if (!props.showPlanApprovals || !props.plan) {
    planWorkflowHistoryCards.value = []
    return
  }

  if (historyTargets.value.length === 0) {
    planWorkflowHistoryCards.value = []
    return
  }

  try {
    const results = await Promise.all(
      historyTargets.value.map(target =>
        getWorkflowInstanceHistoryByBusiness(target.entityType, target.entityId)
      )
    )

    const merged = results
      .flatMap(response => (response.success && Array.isArray(response.data) ? response.data : []))
      .sort((left, right) => {
        const leftTime = new Date(left.completedAt || left.startedAt || 0).getTime()
        const rightTime = new Date(right.completedAt || right.startedAt || 0).getTime()
        return rightTime - leftTime
      })

    const seen = new Set<string>()
    planWorkflowHistoryCards.value = merged.filter(item => {
      const key = String(item.instanceId || '')
      if (!key || seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  } catch (error) {
    planWorkflowHistoryCards.value = []
    logger.warn('[ApprovalProgressDrawer] 加载计划审批历史卡片失败:', error)
  }
}

async function handleApprovePlanBatch() {
  if (!hasPlanApprovalPermission.value) {
    ElMessage.warning(`当前账号缺少审批权限：${requiredPlanApprovalPermissionCode.value}`)
    return
  }

  if (hasPlanWorkflowData.value) {
    await loadPlanWorkflowDetail()
  }

  if (currentPlanTaskId.value) {
    if (!canCurrentUserHandlePlanApproval.value) {
      ElMessage.warning('当前审批节点不是你，无法执行审批通过')
      return
    }

    try {
      const { value } = await ElMessageBox.prompt(
        `确认通过“${props.plan.name || props.planName || '当前计划'}”的审批？`,
        '审批通过',
        {
          confirmButtonText: '确认通过',
          cancelButtonText: '取消',
          inputPlaceholder: '请输入审批意见（可选）',
          inputType: 'textarea'
        }
      )
      const loadingInstance = ElLoading.service({
        lock: true,
        text: '正在审批并同步数据，请稍候...',
        background: 'rgba(0, 0, 0, 0.7)'
      })

      try {
        const userId = authStore.user?.userId || authStore.user?.id || 1
        const response = await approvalApi.approvePlan(
          currentPlanTaskId.value,
          userId,
          value || '审批通过'
        )
        if (!response.success) {
          ElMessage.error(response.message || '审批失败')
          return
        }
        await refreshPlanApprovalAfterMutation()
        ElMessage.success('审批通过')
      } finally {
        loadingInstance.close()
      }
      return
    } catch {
      return
    }
  }

  if (scopedPlanApprovals.value.length === 0) {
    ElMessage.warning('当前计划暂无待审批实例')
    return
  }

  try {
    const { value } = await ElMessageBox.prompt(
      `确认一键审批通过“${currentPlanApprovalSummary.value?.planName || '当前计划'}”下的 ${scopedPlanApprovals.value.length} 条审批实例？`,
      '审批通过',
      {
        confirmButtonText: '确认通过',
        cancelButtonText: '取消',
        inputPlaceholder: '请输入审批意见（可选）',
        inputType: 'textarea'
      }
    )

    const loadingInstance = ElLoading.service({
      lock: true,
      text: '正在审批并同步数据，请稍候...',
      background: 'rgba(0, 0, 0, 0.7)'
    })

    try {
      const userId = authStore.user?.userId || authStore.user?.id || 1
      for (const instance of scopedPlanApprovals.value) {
        const response = await approvalApi.approvePlan(
          instance.instanceId,
          userId,
          value || '审批通过'
        )
        if (!response.success) {
          ElMessage.error(response.message || '审批失败')
          return
        }
      }

      await refreshPlanApprovalAfterMutation()
      ElMessage.success(`已一键通过 ${scopedPlanApprovals.value.length} 条审批实例`)
    } finally {
      loadingInstance.close()
    }
  } catch {
    // 用户取消
  }
}

async function handleRejectPlanBatch() {
  if (!hasPlanApprovalPermission.value) {
    ElMessage.warning(`当前账号缺少审批权限：${requiredPlanApprovalPermissionCode.value}`)
    return
  }

  if (hasPlanWorkflowData.value) {
    await loadPlanWorkflowDetail()
  }

  if (currentPlanTaskId.value) {
    if (!canCurrentUserHandlePlanApproval.value) {
      ElMessage.warning('当前审批节点不是你，无法执行审批驳回')
      return
    }

    try {
      const { value } = await ElMessageBox.prompt(
        `确认驳回“${props.plan.name || props.planName || '当前计划'}”的审批？`,
        '审批驳回',
        {
          confirmButtonText: '确认驳回',
          cancelButtonText: '取消',
          inputPlaceholder: '请输入驳回原因（必填）',
          inputType: 'textarea',
          inputValidator: val => (val && val.trim() ? true : '请输入驳回原因')
        }
      )
      const loadingInstance = ElLoading.service({
        lock: true,
        text: '正在驳回并同步数据，请稍候...',
        background: 'rgba(0, 0, 0, 0.7)'
      })

      try {
        const userId = authStore.user?.userId || authStore.user?.id || 1
        const response = await approvalApi.rejectPlan(currentPlanTaskId.value, userId, value)
        if (!response.success) {
          ElMessage.error(response.message || '驳回失败')
          return
        }
        await refreshPlanApprovalAfterMutation()
        ElMessage.success('审批已驳回')
      } finally {
        loadingInstance.close()
      }
      return
    } catch {
      return
    }
  }

  if (scopedPlanApprovals.value.length === 0) {
    ElMessage.warning('当前计划暂无待审批实例')
    return
  }

  try {
    const { value } = await ElMessageBox.prompt(
      `确认一键驳回“${currentPlanApprovalSummary.value?.planName || '当前计划'}”下的 ${scopedPlanApprovals.value.length} 条审批实例？`,
      '审批拒绝',
      {
        confirmButtonText: '确认拒绝',
        cancelButtonText: '取消',
        inputPlaceholder: '请输入拒绝原因（必填）',
        inputType: 'textarea',
        inputValidator: val => (val && val.trim() ? true : '请输入拒绝原因')
      }
    )

    const loadingInstance = ElLoading.service({
      lock: true,
      text: '正在驳回并同步数据，请稍候...',
      background: 'rgba(0, 0, 0, 0.7)'
    })

    try {
      const userId = authStore.user?.userId || authStore.user?.id || 1
      for (const instance of scopedPlanApprovals.value) {
        const response = await approvalApi.rejectPlan(instance.instanceId, userId, value)
        if (!response.success) {
          ElMessage.error(response.message || '拒绝失败')
          return
        }
      }

      await refreshPlanApprovalAfterMutation()
      ElMessage.success(`已一键驳回 ${scopedPlanApprovals.value.length} 条审批实例`)
    } finally {
      loadingInstance.close()
    }
  } catch {
    // 用户取消
  }
}

function formatTime(timestamp?: Date | string) {
  if (!timestamp) {
    return '--'
  }

  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function loadSelectedHistoryInstanceDetail(instanceId?: number | string | null) {
  const normalizedInstanceId = String(instanceId || '').trim()
  if (!normalizedInstanceId) {
    selectedHistoryInstanceId.value = null
    selectedHistoryInstanceDetail.value = null
    selectedHistoryInstanceDetailLoading.value = false
    return
  }

  selectedHistoryInstanceId.value = normalizedInstanceId
  const cachedDetail = historyInstanceDetailCache.value[normalizedInstanceId]
  if (cachedDetail) {
    selectedHistoryInstanceDetail.value = cachedDetail
    selectedHistoryInstanceDetailLoading.value = false
    return
  }

  selectedHistoryInstanceDetailLoading.value = true
  selectedHistoryInstanceDetail.value = null

  try {
    const response = await getWorkflowInstanceDetail(normalizedInstanceId)
    selectedHistoryInstanceDetail.value = response.success ? (response.data ?? null) : null
    if (response.success && response.data) {
      historyInstanceDetailCache.value = {
        ...historyInstanceDetailCache.value,
        [normalizedInstanceId]: response.data
      }
    }
  } catch (error) {
    selectedHistoryInstanceDetail.value = null
    logger.warn('[ApprovalProgressDrawer] 加载历史审批实例详情失败:', {
      instanceId: normalizedInstanceId,
      error
    })
  } finally {
    selectedHistoryInstanceDetailLoading.value = false
  }
}

async function openPlanApprovalDetails(item?: PlanApprovalDetailItem) {
  if (
    currentPlanApprovalItems.value.length === 0 &&
    historicalPlanApprovalItems.value.length === 0 &&
    !hasPlanWorkflowData.value
  ) {
    ElMessage.warning('当前计划暂无待审批实例')
    return
  }

  planDetailDialogVisible.value = true

  if (item?.instanceId) {
    void loadSelectedHistoryInstanceDetail(item.instanceId)
    return
  }

  selectedHistoryInstanceId.value = null
  selectedHistoryInstanceDetail.value = null
  selectedHistoryInstanceDetailLoading.value = false
}

// 处理自定义审批流程事件
function handleAddNode() {
  // 暂不实现，可后续扩展
}

function handleUpdateApprover(_nodeId: string, _approverId: string) {
  // 暂不实现，可后续扩展
}

function handleSaveTemplate(_templateName: string, _steps: any[]) {
  // 暂不实现，可后续扩展
}

function handleApplyTemplate(_templateId: string) {
  // 暂不实现，可后续扩展
}

function normalizeWorkflowAction(action?: string): ApprovalHistoryItem['action'] {
  const normalized = String(action || '')
    .trim()
    .toUpperCase()
  if (normalized.includes('REJECT')) {
    return 'reject'
  }
  if (normalized.includes('WITHDRAW') || normalized.includes('CANCEL')) {
    return 'withdraw'
  }
  if (normalized.includes('START') || normalized.includes('SUBMIT')) {
    return 'submit'
  }
  return 'approve'
}

function shouldDisplayWorkflowHistoryItem(item: { action?: string } | null | undefined): boolean {
  const normalized = String(item?.action || '')
    .trim()
    .toUpperCase()
  return !normalized.includes('START')
}

const detailDialogStatusTag = computed(() => {
  if (hasPlanWorkflowData.value) {
    return planWorkflowStatusTag.value
  }
  return { label: '待审批', type: 'warning' as const }
})

const hasDisplayableApprovalContent = computed(() => {
  if (hasPlanWorkflowData.value) {
    return true
  }
  return hasApprovalData.value
})

const hasWorkflowTabContent = computed(() => {
  if (props.showPlanApprovals) {
    return true
  }
  return hasPlanWorkflowData.value || hasApprovalData.value
})

const isPlanHistoryOnlyMode = computed(() => {
  return Boolean(
    props.showPlanApprovals && hasPlanWorkflowData.value && isPlanCompletedApproval.value
  )
})

const showPlanPendingCard = computed(() => {
  if (isPlanHistoryOnlyMode.value) {
    return false
  }
  return Boolean(currentPlanApprovalSummary.value)
})

const showPlanHistoryCard = computed(() => {
  return Boolean(props.showPlanApprovals && historicalPlanApprovalItems.value.length > 0)
})

const showHistoryTimeline = computed(() => {
  if (props.showPlanApprovals) {
    return false
  }
  return props.historyViewMode !== 'card-only' && !showPlanHistoryCard.value
})

const showCardHistoryEmptyState = computed(() => {
  return props.showPlanApprovals && !showPlanHistoryCard.value
})

const showArchivedPlanWorkflowEmptyState = computed(() => {
  return Boolean(
    props.showPlanApprovals &&
    hasPlanWorkflowData.value &&
    (isPlanHistoryOnlyMode.value || workflowNodes.value.length === 0)
  )
})

// ============ 监听 ============
watch(
  () => props.modelValue,
  val => {
    if (val) {
      // 打开时重置到工作流标签页
      activeTab.value = props.showPlanApprovals
        ? isPlanPendingApproval.value
          ? 'pending-plans'
          : 'history'
        : hasWorkflowTabContent.value
          ? 'workflow'
          : 'history'
      cacheSubmitterName(props.plan?.submittedBy, props.plan?.submittedByName)
      cacheSubmitterName(props.plan?.createdBy, props.plan?.createdByName)
      if (!normalizeDisplayName(props.plan?.submittedByName)) {
        void ensureSubmitterNameLoaded(props.plan?.submittedBy, props.plan?.createdByName)
      }
      void loadPendingPlanApprovals()
      void loadPlanWorkflowDetail()
      void loadPlanWorkflowHistoryCards()
    } else {
      selectedHistoryInstanceId.value = null
      selectedHistoryInstanceDetail.value = null
    }
  }
)

watch(
  () => [
    props.showPlanApprovals,
    props.plan?.id,
    props.plan?.workflowInstanceId,
    props.plan?.status,
    props.plan?.workflowStatus,
    props.plan?.canWithdraw,
    props.plan?.currentStepName,
    props.workflowEntityType,
    props.workflowEntityId,
    props.secondaryWorkflowEntityType,
    props.secondaryWorkflowEntityId,
    JSON.stringify(props.plan?.workflowHistory ?? []),
    expectedWorkflowCodes.value.join('|')
  ],
  ([showPlanApprovals, planId]) => {
    if (!showPlanApprovals || !planId) {
      planWorkflowDetail.value = null
      planWorkflowHistoryCards.value = []
      return
    }

    planWorkflowDetail.value = null
    void loadPlanWorkflowDetail()
    void loadPlanWorkflowHistoryCards()
  },
  { immediate: true }
)

watch(
  () => [
    props.plan?.submittedBy,
    props.plan?.submittedByName,
    props.plan?.createdBy,
    props.plan?.createdByName
  ],
  ([submittedBy, submittedByName, createdBy, createdByName]) => {
    if (!props.modelValue) {
      return
    }

    cacheSubmitterName(submittedBy, submittedByName)
    cacheSubmitterName(createdBy, createdByName)
    if (!normalizeDisplayName(submittedByName)) {
      void ensureSubmitterNameLoaded(submittedBy, normalizeDisplayName(createdByName))
    }
  },
  { immediate: true }
)
</script>

<template>
  <ElDrawer
    :model-value="modelValue"
    title="审批进度"
    direction="rtl"
    size="600px"
    @close="handleClose"
  >
    <!-- 统计信息 -->
    <template #header>
      <div class="drawer-header">
        <h3 class="drawer-title">{{ showPlanApprovals ? '审批中心' : '审批进度' }}</h3>
        <div class="stats-tags">
          <ElTag v-if="showPlanApprovals && scopedPendingPlanCount > 0" type="warning" size="small">
            当前计划待审批: {{ scopedPendingPlanCount }}
          </ElTag>
          <ElTag v-if="!hasPlanWorkflowData && pendingCount > 0" type="warning" size="small">
            待审批: {{ pendingCount }}
          </ElTag>
          <ElTag v-if="!hasPlanWorkflowData && approvedCount > 0" type="success" size="small">
            已通过: {{ approvedCount }}
          </ElTag>
          <ElTag v-if="!hasPlanWorkflowData && rejectedCount > 0" type="danger" size="small">
            已驳回: {{ rejectedCount }}
          </ElTag>
        </div>
      </div>
    </template>

    <!-- 空状态 -->
    <ElEmpty
      v-if="!showPlanApprovals && !hasDisplayableApprovalContent"
      description="暂无审批数据"
      :image-size="120"
    />

    <!-- 审批内容 -->
    <div v-else class="approval-content">
      <!-- 标签页 -->
      <ElTabs v-model="activeTab" class="approval-tabs">
        <ElTabPane
          v-if="showPlanApprovals"
          name="pending-plans"
          :label="hasPlanWorkflowData ? '计划审批' : `待审批 (${scopedPendingPlanCount})`"
        >
          <div v-loading="planApprovalsLoading" class="plan-approval-pane">
            <ElEmpty
              v-if="!planApprovalsLoading && !showPlanPendingCard"
              description="暂无待审批的计划"
              :image-size="120"
            />
            <div v-else class="approval-list">
              <div
                v-if="showPlanPendingCard && currentPlanApprovalSummary"
                :key="currentPlanApprovalSummary.key"
                class="approval-card"
              >
                <div class="card-header">
                  <div class="plan-info">
                    <el-icon class="plan-icon"><Document /></el-icon>
                    <div class="info-text">
                      <div class="plan-name">{{ currentPlanApprovalSummary.planName }}</div>
                      <div class="plan-year">
                        {{
                          hasPlanWorkflowData
                            ? '当前审批状态已接入'
                            : `待审批实例 ${currentPlanApprovalSummary.count} 条`
                        }}
                      </div>
                    </div>
                  </div>
                  <ElTag
                    :type="hasPlanWorkflowData ? planWorkflowStatusTag.type : 'warning'"
                    size="small"
                  >
                    {{ hasPlanWorkflowData ? planWorkflowStatusTag.label : '待审批' }}
                  </ElTag>
                </div>
                <div class="submit-info">
                  <div class="info-row">
                    <el-icon><User /></el-icon>
                    <span class="label">提交人：</span>
                    <span class="value">{{ currentPlanApprovalSummary.submitterName }}</span>
                  </div>
                  <div class="info-row">
                    <el-icon><Timer /></el-icon>
                    <span class="label">提交时间：</span>
                    <span class="value">{{
                      formatTime(currentPlanApprovalSummary.createdAt)
                    }}</span>
                  </div>
                  <div class="info-row">
                    <el-icon><Right /></el-icon>
                    <span class="label">当前步骤：</span>
                    <span class="value">{{ currentPlanApprovalSummary.currentStepName }}</span>
                  </div>
                  <div v-if="currentPlanOperationLabel" class="info-row">
                    <el-icon><Right /></el-icon>
                    <span class="label">当前操作：</span>
                    <span class="value">{{ currentPlanOperationLabel }}</span>
                  </div>
                  <div v-if="activePlanWorkflow?.lastRejectReason" class="info-row">
                    <el-icon><Document /></el-icon>
                    <span class="label">驳回原因：</span>
                    <span class="value">{{ activePlanWorkflow.lastRejectReason }}</span>
                  </div>
                </div>
                <div class="card-actions">
                  <ElButton @click="openPlanApprovalDetails">查看详情</ElButton>
                  <ElButton
                    v-if="
                      hasPlanWorkflowData &&
                      isPlanPendingApproval &&
                      canCurrentUserHandlePlanApproval
                    "
                    type="success"
                    @click="handleApprovePlanBatch"
                  >
                    审批通过
                  </ElButton>
                  <ElButton
                    v-if="
                      hasPlanWorkflowData &&
                      isPlanPendingApproval &&
                      canCurrentUserHandlePlanApproval
                    "
                    type="danger"
                    @click="handleRejectPlanBatch"
                  >
                    审批驳回
                  </ElButton>
                  <template v-if="!hasPlanWorkflowData">
                    <ElButton
                      v-if="hasPlanApprovalPermission"
                      type="success"
                      @click="handleApprovePlanBatch"
                    >
                      一键通过
                    </ElButton>
                    <ElButton
                      v-if="hasPlanApprovalPermission"
                      type="danger"
                      @click="handleRejectPlanBatch"
                    >
                      一键驳回
                    </ElButton>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </ElTabPane>

        <!-- 审批流程视图（使用CustomApprovalFlow组件） -->
        <ElTabPane v-if="hasWorkflowTabContent" name="workflow" label="审批流程">
          <ElEmpty
            v-if="showArchivedPlanWorkflowEmptyState || (!hasApprovalData && !hasPlanWorkflowData)"
            description="暂无审批数据"
            :image-size="120"
          />
          <template v-else>
            <ElAlert
              v-if="rejectionReason"
              type="error"
              :title="'驳回原因：' + rejectionReason"
              show-icon
              :closable="false"
              style="margin-bottom: 16px"
            />
            <ElAlert
              v-if="hasPlanWorkflowData"
              type="info"
              title="审批人由后端流程定义自动决定，当前页面仅展示当前节点和审批结果。"
              show-icon
              :closable="false"
              style="margin-bottom: 16px"
            />
            <ElAlert
              v-if="hasPlanWorkflowData && isPlanPendingApproval && !hasPlanApprovalPermission"
              type="warning"
              :title="`当前账号缺少权限码 ${requiredPlanApprovalPermissionCode}，仅可查看审批进度和历史。`"
              show-icon
              :closable="false"
              style="margin-bottom: 16px"
            />
            <ElAlert
              v-if="
                hasPlanWorkflowData && isPlanPendingApproval && !canCurrentUserHandlePlanApproval
              "
              type="warning"
              title="当前节点按角色审批流转，你当前仅可查看审批进度和历史。"
              show-icon
              :closable="false"
              style="margin-bottom: 16px"
            />

            <CustomApprovalFlow
              :nodes="workflowNodes"
              :current-node-id="currentNodeId"
              :rejection-reason="rejectionReason"
              :readonly="readonly || hasPlanWorkflowData"
              :approval-type="approvalType"
              @add-node="handleAddNode"
              @update-approver="handleUpdateApprover"
              @save-template="handleSaveTemplate"
              @apply-template="handleApplyTemplate"
            />
          </template>
        </ElTabPane>

        <!-- 历史记录视图 -->
        <ElTabPane name="history" label="审批历史">
          <ElEmpty
            v-if="!hasApprovalData && !hasPlanWorkflowData"
            description="暂无审批历史"
            :image-size="120"
          />
          <template v-else>
            <div v-if="showPlanHistoryCard" class="approval-list" style="margin-bottom: 16px">
              <div
                v-for="item in historicalPlanApprovalItems"
                :key="`${item.instanceId}-history`"
                class="approval-card"
              >
                <div class="card-header">
                  <div class="plan-info">
                    <el-icon class="plan-icon"><Document /></el-icon>
                    <div class="info-text">
                      <div class="plan-name">{{ item.routeTitle || item.title }}</div>
                      <div class="plan-year">
                        {{ item.flowName || '已完成，详情可查看完整审批流程' }}
                      </div>
                    </div>
                  </div>
                  <ElTag :type="item.statusType || 'success'" size="small">
                    {{ item.statusLabel || '已通过' }}
                  </ElTag>
                </div>
                <div class="submit-info">
                  <div class="info-row">
                    <el-icon><User /></el-icon>
                    <span class="label">提交人：</span>
                    <span class="value">{{ item.submitterName }}</span>
                  </div>
                  <div class="info-row">
                    <el-icon><Timer /></el-icon>
                    <span class="label">提交时间：</span>
                    <span class="value">{{ formatTime(item.createdAt) }}</span>
                  </div>
                  <div class="info-row">
                    <el-icon><Right /></el-icon>
                    <span class="label">流转方向：</span>
                    <span class="value">{{ item.routeTitle || '--' }}</span>
                  </div>
                  <div class="info-row">
                    <el-icon><Timer /></el-icon>
                    <span class="label">完成时间：</span>
                    <span class="value">{{ formatTime(item.completedAt) }}</span>
                  </div>
                </div>
                <div class="card-actions">
                  <ElButton @click="openPlanApprovalDetails(item)">查看详情</ElButton>
                </div>
              </div>
            </div>
            <ElEmpty
              v-else-if="showCardHistoryEmptyState"
              description="暂无审批历史"
              :image-size="120"
            />
            <ApprovalHistory
              v-else-if="showHistoryTimeline"
              :history="approvalHistory"
              :approval-type="approvalType"
            />
          </template>
        </ElTabPane>
      </ElTabs>
    </div>

    <ElDialog
      v-model="planDetailDialogVisible"
      title="审批实例详情"
      width="680px"
      class="plan-detail-dialog"
    >
      <div v-loading="selectedHistoryInstanceDetailLoading" class="plan-detail-content">
        <div class="plan-detail-summary">
          <div class="summary-title">
            {{
              historicalPlanApprovalItems.find(
                item => String(item.instanceId) === selectedHistoryInstanceId
              )?.routeTitle ||
              currentPlanApprovalSummary?.planName ||
              '当前计划'
            }}
          </div>
          <div class="summary-subtitle">
            {{
              selectedHistoryInstanceId
                ? '当前查看审批实例'
                : isPlanPendingApproval
                  ? '待审批实例'
                  : '历史审批实例'
            }}
            {{ selectedHistoryInstanceId ? '' : currentPlanApprovalItems.length }}
          </div>
        </div>

        <div
          v-if="
            (selectedHistoryInstanceId ? historicalPlanApprovalItems : currentPlanApprovalItems)
              .length > 0
          "
          class="plan-detail-list"
        >
          <div
            v-for="item in selectedHistoryInstanceId
              ? historicalPlanApprovalItems.filter(
                  historyItem => String(historyItem.instanceId) === selectedHistoryInstanceId
                )
              : currentPlanApprovalItems"
            :key="item.instanceId"
            class="plan-detail-item"
          >
            <div class="detail-item-header">
              <div class="detail-item-title">{{ item.routeTitle || item.title }}</div>
              <ElTag
                :type="item.statusType || detailDialogStatusTag.type"
                effect="light"
                size="small"
              >
                {{ item.statusLabel || detailDialogStatusTag.label }}
              </ElTag>
            </div>
            <div class="detail-item-meta">
              <div v-if="item.flowName" class="detail-meta-row">
                <span class="detail-label">流程名称：</span>
                <span class="detail-value">{{ item.flowName }}</span>
              </div>
              <div class="detail-meta-row">
                <span class="detail-label">实例编号：</span>
                <span class="detail-value">{{ item.instanceNo }}</span>
              </div>
              <div class="detail-meta-row">
                <span class="detail-label">提交人：</span>
                <span class="detail-value">{{ item.submitterName }}</span>
              </div>
              <div class="detail-meta-row">
                <span class="detail-label">提交时间：</span>
                <span class="detail-value">{{ formatTime(item.createdAt) }}</span>
              </div>
              <div class="detail-meta-row">
                <span class="detail-label"
                  >{{ selectedHistoryInstanceId ? '实例状态' : '当前步骤' }}：</span
                >
                <span class="detail-value">{{ item.currentStepName }}</span>
              </div>
              <div v-if="item.completedAt" class="detail-meta-row">
                <span class="detail-label">完成时间：</span>
                <span class="detail-value">{{ formatTime(item.completedAt) }}</span>
              </div>
              <div v-if="item.entityId" class="detail-meta-row">
                <span class="detail-label">关联实体ID：</span>
                <span class="detail-value">{{ item.entityId }}</span>
              </div>
            </div>
          </div>
        </div>
        <ElEmpty v-else description="暂无审批实例详情" :image-size="100" />

        <div
          v-if="(selectedHistoryInstanceDetail?.history?.length || planWorkflowHistory.length) > 0"
          class="plan-detail-history"
        >
          <div class="summary-title">审批历史</div>
          <ApprovalHistory
            :history="
              selectedHistoryInstanceDetail?.history?.length
                ? selectedHistoryInstanceDetail.history
                    .filter(shouldDisplayWorkflowHistoryItem)
                    .map((historyItem, index) => ({
                      id: String(historyItem.taskId ?? index),
                      action: normalizeWorkflowAction(historyItem.action),
                      operator: String(historyItem.operatorId ?? index),
                      operatorName: String(historyItem.operatorName || '系统'),
                      operateTime: new Date(historyItem.operateTime || Date.now()),
                      stepName:
                        typeof historyItem.taskName === 'string' ? historyItem.taskName : undefined,
                      comment: historyItem.comment
                    }))
                : planWorkflowHistory
            "
            :approval-type="approvalType"
          />
        </div>
      </div>

      <template #footer>
        <ElButton @click="planDetailDialogVisible = false">关闭</ElButton>
      </template>
    </ElDialog>
  </ElDrawer>
</template>

<style scoped>
.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.drawer-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.stats-tags {
  display: flex;
  gap: 8px;
}

.approval-content {
  padding: 0;
}

.plan-approval-pane {
  min-height: 280px;
}

.approval-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.approval-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
}

.card-header,
.plan-info,
.info-row,
.card-actions {
  display: flex;
  align-items: center;
}

.card-header {
  justify-content: space-between;
  margin-bottom: 12px;
}

.plan-info {
  gap: 10px;
}

.plan-icon {
  color: var(--el-color-primary);
}

.info-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.plan-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.plan-year,
.label,
.value {
  font-size: 13px;
}

.plan-year,
.label {
  color: var(--el-text-color-secondary);
}

.submit-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.info-row {
  gap: 8px;
}

.value {
  color: var(--el-text-color-primary);
}

.card-actions {
  gap: 12px;
}

.plan-detail-summary {
  margin-bottom: 16px;
}

.summary-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.summary-subtitle {
  margin-top: 4px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.plan-detail-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 60vh;
  overflow-y: auto;
}

.plan-detail-item {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px 16px;
  background: #f8fafc;
}

.detail-item-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 12px;
}

.detail-item-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.detail-item-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 16px;
}

.detail-meta-row {
  min-width: 0;
}

.detail-label,
.detail-value {
  font-size: 13px;
}

.detail-label {
  color: var(--el-text-color-secondary);
}

.detail-value {
  color: var(--el-text-color-primary);
  word-break: break-all;
}

.current-indicator {
  padding: 12px 16px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  margin-bottom: 16px;
}

.indicator-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.indicator-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.pending-progress {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.progress-label {
  margin-right: 4px;
}

.progress-value {
  font-weight: 600;
  color: var(--el-color-warning);
  margin-right: 8px;
}

.progress-change {
  color: var(--el-text-color-secondary);
}

.approval-tabs {
  margin-top: 16px;
}

:deep(.el-tabs__content) {
  padding: 16px 0;
}

:deep(.el-tabs__item) {
  font-size: 14px;
}

@media (max-width: 768px) {
  .detail-item-meta {
    grid-template-columns: 1fr;
  }

  .card-actions {
    flex-wrap: wrap;
  }
}
</style>
