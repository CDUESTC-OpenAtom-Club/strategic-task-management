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
import { logger } from '@/shared/lib/utils/logger'
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
  indicatorId?: string | number
  departmentName?: string
  planName?: string
  showApprovalSection?: boolean
  showPlanApprovals?: boolean
  readonly?: boolean
  // 审批类型：'distribution' = 下发审批, 'submission' = 上报审批
  approvalType?: 'distribution' | 'submission'
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
  indicatorId: undefined,
  departmentName: '',
  planName: '',
  showApprovalSection: true,
  showPlanApprovals: false,
  readonly: false,
  approvalType: 'submission'
})

const emit = defineEmits<Emits>()
const authStore = useAuthStore()
const currentUserId = computed(() => Number(authStore.user?.userId ?? 0))
const submitterNameCache = ref<Record<string, string>>({})

function normalizeDisplayName(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function parsePositiveUserId(value: unknown): number | null {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null
  }
  return numericValue
}

function getFallbackSubmitterValue(): string {
  return normalizeDisplayName(props.plan?.createdBy) || props.departmentName || '当前提交人'
}

async function ensureSubmitterNameLoaded(userIdValue: unknown): Promise<void> {
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

interface PlanApprovalDetailItem {
  instanceId: number
  instanceNo: string
  title: string
  submitterName: string
  currentStepName: string
  createdAt?: string
  entityId?: string | number
  planName?: string
}

// 当前选中的指标
const currentIndicator = computed(() => {
  if (props.indicatorId) {
    return props.indicators.find(i => i.id === props.indicatorId)
  }
  // 如果没有指定ID，返回第一个有待审批状态的指标
  return props.indicators.find(i =>
    i.progressApprovalStatus &&
    ['pending', 'approved', 'rejected'].includes(i.progressApprovalStatus)
  ) || props.indicators[0]
})

// 是否有审批数据
const hasApprovalData = computed(() => {
  return props.indicators.length > 0 &&
    props.indicators.some(i =>
      i.progressApprovalStatus &&
      i.progressApprovalStatus !== 'none'
    )
})

// 待审批数量
const pendingCount = computed(() => {
  return props.indicators.filter(i =>
    i.progressApprovalStatus === 'pending'
  ).length
})

// 已通过数量
const approvedCount = computed(() => {
  return props.indicators.filter(i =>
    i.progressApprovalStatus === 'approved'
  ).length
})

// 已驳回数量
const rejectedCount = computed(() => {
  return props.indicators.filter(i =>
    i.progressApprovalStatus === 'rejected'
  ).length
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

const scopedPlanApprovals = computed(() => {
  if (currentPlanEntityIds.value.size === 0) {
    return pendingPlanApprovals.value
  }

  const withEntityId = pendingPlanApprovals.value.filter(instance => {
    const entityId = Number(instance.entityId)
    return Number.isFinite(entityId) && entityId > 0
  })

  if (withEntityId.length === 0) {
    return pendingPlanApprovals.value
  }

  return withEntityId.filter(instance =>
    currentPlanEntityIds.value.has(Number(instance.entityId))
  )
})

const scopedPendingPlanCount = computed(() => scopedPlanApprovals.value.length)
const hasPlanWorkflowData = computed(() => {
  return Boolean(
    props.plan &&
      (props.plan.workflowInstanceId ||
        props.plan.workflowStatus ||
        props.plan.currentStepName ||
        (Array.isArray(props.plan.workflowHistory) && props.plan.workflowHistory.length > 0))
  )
})

const planWorkflowStatus = computed(() => {
  return String(props.plan?.workflowStatus || props.plan?.status || '').toUpperCase()
})

const isPlanPendingApproval = computed(() => {
  return ['PENDING', 'IN_REVIEW', 'SUBMITTED'].includes(planWorkflowStatus.value)
})

const canCurrentUserHandlePlanApproval = computed(() => {
  if (!hasPlanWorkflowData.value || !isPlanPendingApproval.value) {
    return false
  }

  const currentApproverId = Number(props.plan?.currentApproverId ?? 0)
  if (!Number.isFinite(currentApproverId) || currentApproverId <= 0) {
    return true
  }

  if (!Number.isFinite(currentUserId.value) || currentUserId.value <= 0) {
    return true
  }

  return currentApproverId === currentUserId.value
})

const currentPlanTaskId = computed(() => {
  const rawTaskId = Number(props.plan?.currentTaskId ?? 0)
  if (Number.isFinite(rawTaskId) && rawTaskId > 0) {
    return rawTaskId
  }

  const rawInstanceId = Number(props.plan?.workflowInstanceId ?? 0)
  if (Number.isFinite(rawInstanceId) && rawInstanceId > 0) {
    return rawInstanceId
  }

  return 0
})

const planWorkflowStatusTag = computed(() => {
  const rawStatus = String(props.plan?.workflowStatus || props.plan?.status || '').toUpperCase()
  if (rawStatus === 'DISTRIBUTED' || rawStatus === 'APPROVED') {
    return { label: '已通过', type: 'success' as const }
  }
  if (rawStatus === 'RETURNED' || rawStatus === 'REJECTED') {
    return { label: '已退回', type: 'danger' as const }
  }
  if (rawStatus === 'PENDING' || rawStatus === 'IN_REVIEW' || rawStatus === 'SUBMITTED') {
    return { label: '审批中', type: 'warning' as const }
  }
  return { label: rawStatus || '未发起', type: 'info' as const }
})

const planWorkflowHistory = computed<ApprovalHistoryItem[]>(() => {
  if (!Array.isArray(props.plan?.workflowHistory)) {
    return []
  }

  return props.plan.workflowHistory.map((item, index) => ({
    id: String(item.taskId ?? index),
    action: normalizeWorkflowAction(item.action),
    operator: String(item.operatorId ?? index),
    operatorName: String(item.operatorName || '系统'),
    operateTime: new Date(item.operateTime || Date.now()),
    stepName: typeof item.stepName === 'string' ? item.stepName : undefined,
    comment: item.comment
  }))
})

const currentPlanApprovalItems = computed<PlanApprovalDetailItem[]>(() => {
  if (hasPlanWorkflowData.value && props.plan) {
    return [{
      instanceId: currentPlanTaskId.value,
      instanceNo: String(props.plan.workflowInstanceId || '待回填'),
      title: String(props.plan.name || props.planName || props.departmentName || '当前计划'),
      submitterName: planSubmitterName.value,
      currentStepName: String(props.plan.currentStepName || '审批中'),
      createdAt: props.plan.submittedAt || props.plan.createdAt,
      entityId: props.plan.id,
      planName: props.plan.name
    }]
  }

  return scopedPlanApprovals.value.map((instance, index) => ({
    instanceId: Number(instance.instanceId) || index,
    instanceNo:
      String(instance.instanceNo || instance.flowInstanceNo || instance.processInstanceNo || '').trim() ||
      `审批实例 ${index + 1}`,
    title:
      String(
        instance.entityTitle ||
        instance.planName ||
        instance.title ||
        instance.entityName ||
        `${props.planName || props.departmentName || '当前计划'} - 审批实例 ${index + 1}`
      ).trim(),
    submitterName: String(instance.submitterName || instance.applicantName || instance.submitter || '未知'),
    currentStepName: String(instance.currentStepName || instance.currentStep || '审批中'),
    createdAt: typeof instance.createdAt === 'string' ? instance.createdAt : undefined,
    entityId: instance.entityId,
    planName: instance.planName
  }))
})

const currentPlanApprovalSummary = computed(() => {
  if (hasPlanWorkflowData.value && props.plan) {
    return {
      key: props.plan.name || props.planName || props.departmentName || 'current-plan',
      planName: props.plan.name || props.planName || `${props.departmentName || '当前部门'}计划`,
      currentStepName: props.plan.currentStepName || '审批中',
      submitterName: planSubmitterName.value,
      createdAt: props.plan.submittedAt || props.plan.createdAt,
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
        .find(step => typeof step === 'string' && step.trim()) || '审批中',
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
  if (hasPlanWorkflowData.value && props.plan) {
    const nodes: WorkflowNode[] = [{
      id: 'submit',
      name: '提交审批',
      status: 'completed',
      operatorName: planSubmitterName.value,
      operateTime: props.plan.submittedAt ? new Date(props.plan.submittedAt) : undefined,
      comment: '已发起计划审批'
    }]

    for (const item of planWorkflowHistory.value) {
      nodes.push({
        id: `history-${item.id}`,
        name: item.action === 'approve' ? '审批通过' : item.action === 'reject' ? '审批驳回' : '流程操作',
        status: item.action === 'reject' ? 'rejected' : 'completed',
        operatorName: item.operatorName,
        operateTime: item.operateTime,
        comment: item.comment
      })
    }

    const workflowStatus = planWorkflowStatus.value
    if (workflowStatus === 'PENDING' || workflowStatus === 'IN_REVIEW' || workflowStatus === 'SUBMITTED') {
      nodes.push({
        id: 'current',
        name: props.plan.currentStepName || '当前审批节点',
        status: 'current',
        operatorName: props.plan.currentApproverName || '待分配',
        comment: props.plan.canWithdraw ? '当前仍可撤回' : '当前不可撤回'
      })
    }

    if (workflowStatus === 'DISTRIBUTED' || workflowStatus === 'APPROVED') {
      nodes.push({
        id: 'finish',
        name: '审批完成',
        status: 'completed',
        operatorName: props.plan.currentApproverName || '系统'
      })
    }

    return nodes
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
    if (isPlanPendingApproval.value) {
      return 'current'
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
  if (props.plan?.lastRejectReason) {
    return props.plan.lastRejectReason
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
    const userId = authStore.user?.userId || 1
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

async function handleApprovePlanBatch() {
  if (currentPlanTaskId.value) {
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
      const userId = authStore.user?.userId || 1
      const response = await approvalApi.approvePlan(currentPlanTaskId.value, userId, value || '审批通过')
      if (!response.success) {
        ElMessage.error(response.message || '审批失败')
        return
      }
      ElMessage.success('审批通过')
      emit('refresh')
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
      text: '正在审批...',
      background: 'rgba(0, 0, 0, 0.7)'
    })

    try {
      const userId = authStore.user?.userId || 1
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

      ElMessage.success(`已一键通过 ${scopedPlanApprovals.value.length} 条审批实例`)
      await loadPendingPlanApprovals()
      emit('refresh')
    } finally {
      loadingInstance.close()
    }
  } catch {
    // 用户取消
  }
}

async function handleRejectPlanBatch() {
  if (currentPlanTaskId.value) {
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
      const userId = authStore.user?.userId || 1
      const response = await approvalApi.rejectPlan(currentPlanTaskId.value, userId, value)
      if (!response.success) {
        ElMessage.error(response.message || '驳回失败')
        return
      }
      ElMessage.success('审批已驳回')
      emit('refresh')
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
      text: '正在拒绝...',
      background: 'rgba(0, 0, 0, 0.7)'
    })

    try {
      const userId = authStore.user?.userId || 1
      for (const instance of scopedPlanApprovals.value) {
        const response = await approvalApi.rejectPlan(instance.instanceId, userId, value)
        if (!response.success) {
          ElMessage.error(response.message || '拒绝失败')
          return
        }
      }

      ElMessage.success(`已一键驳回 ${scopedPlanApprovals.value.length} 条审批实例`)
      await loadPendingPlanApprovals()
      emit('refresh')
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

function openPlanApprovalDetails() {
  if (currentPlanApprovalItems.value.length === 0 && !hasPlanWorkflowData.value) {
    ElMessage.warning('当前计划暂无待审批实例')
    return
  }

  planDetailDialogVisible.value = true
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
  const normalized = String(action || '').trim().toUpperCase()
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

// ============ 监听 ============
watch(() => props.modelValue, (val) => {
  if (val) {
    // 打开时重置到工作流标签页
    activeTab.value = props.showPlanApprovals ? 'pending-plans' : 'workflow'
    void ensureSubmitterNameLoaded(props.plan?.submittedBy)
    void ensureSubmitterNameLoaded(props.plan?.createdBy)
    void loadPendingPlanApprovals()
  }
})

watch(
  () => [props.plan?.submittedBy, props.plan?.createdBy],
  ([submittedBy, createdBy]) => {
    if (!props.modelValue) {
      return
    }

    void ensureSubmitterNameLoaded(submittedBy)
    void ensureSubmitterNameLoaded(createdBy)
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
              v-if="!planApprovalsLoading && !currentPlanApprovalSummary"
              description="暂无待审批的计划"
              :image-size="120"
            />
            <div v-else class="approval-list">
              <div v-if="currentPlanApprovalSummary" :key="currentPlanApprovalSummary.key" class="approval-card">
                <div class="card-header">
                  <div class="plan-info">
                    <el-icon class="plan-icon"><Document /></el-icon>
                    <div class="info-text">
                      <div class="plan-name">{{ currentPlanApprovalSummary.planName }}</div>
                      <div class="plan-year">
                        {{ hasPlanWorkflowData ? '当前审批状态已接入' : `待审批实例 ${currentPlanApprovalSummary.count} 条` }}
                      </div>
                    </div>
                  </div>
                  <ElTag :type="hasPlanWorkflowData ? planWorkflowStatusTag.type : 'warning'" size="small">
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
                    <span class="value">{{ formatTime(currentPlanApprovalSummary.createdAt) }}</span>
                  </div>
                  <div class="info-row">
                    <el-icon><Right /></el-icon>
                    <span class="label">当前步骤：</span>
                    <span class="value">{{ currentPlanApprovalSummary.currentStepName }}</span>
                  </div>
                  <div v-if="plan?.currentApproverName" class="info-row">
                    <el-icon><User /></el-icon>
                    <span class="label">当前审批人：</span>
                    <span class="value">{{ plan.currentApproverName }}</span>
                  </div>
                  <div v-if="typeof plan?.canWithdraw === 'boolean'" class="info-row">
                    <el-icon><Right /></el-icon>
                    <span class="label">当前操作：</span>
                    <span class="value">{{ plan.canWithdraw ? '提交方仍可撤回' : '审批流已锁定' }}</span>
                  </div>
                  <div v-if="plan?.lastRejectReason" class="info-row">
                    <el-icon><Document /></el-icon>
                    <span class="label">驳回原因：</span>
                    <span class="value">{{ plan.lastRejectReason }}</span>
                  </div>
                </div>
                <div class="card-actions">
                  <ElButton @click="openPlanApprovalDetails">查看详情</ElButton>
                  <ElButton
                    v-if="hasPlanWorkflowData && isPlanPendingApproval && canCurrentUserHandlePlanApproval"
                    type="success"
                    @click="handleApprovePlanBatch"
                  >
                    审批通过
                  </ElButton>
                  <ElButton
                    v-if="hasPlanWorkflowData && isPlanPendingApproval && canCurrentUserHandlePlanApproval"
                    type="danger"
                    @click="handleRejectPlanBatch"
                  >
                    审批驳回
                  </ElButton>
                  <template v-if="!hasPlanWorkflowData">
                    <ElButton type="success" @click="handleApprovePlanBatch">一键通过</ElButton>
                    <ElButton type="danger" @click="handleRejectPlanBatch">一键驳回</ElButton>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </ElTabPane>

        <!-- 审批流程视图（使用CustomApprovalFlow组件） -->
        <ElTabPane name="workflow" label="审批流程">
          <ElEmpty v-if="!hasApprovalData && !hasPlanWorkflowData" description="暂无审批数据" :image-size="120" />
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
              v-if="hasPlanWorkflowData && isPlanPendingApproval && !canCurrentUserHandlePlanApproval && plan?.currentApproverName"
              type="warning"
              :title="`当前节点审批人为 ${plan.currentApproverName}，你当前仅可查看审批进度和历史。`"
              show-icon
              :closable="false"
              style="margin-bottom: 16px"
            />

            <div v-if="hasPlanWorkflowData && plan" class="current-indicator">
              <div class="indicator-info">
                <span class="indicator-name">{{ plan.name || planName || '当前计划' }}</span>
                <ElTag :type="planWorkflowStatusTag.type" size="small">
                  {{ planWorkflowStatusTag.label }}
                </ElTag>
              </div>
              <div class="pending-progress">
                <span class="progress-label">当前节点：</span>
                <span class="progress-value">{{ plan.currentStepName || '待发起审批' }}</span>
                <span class="progress-change">
                  审批人：{{ plan.currentApproverName || '待分配' }}
                </span>
              </div>
            </div>

            <div v-else-if="currentIndicator" class="current-indicator">
              <div class="indicator-info">
                <span class="indicator-name">{{ currentIndicator.indicatorDesc || '未命名指标' }}</span>
                <ElTag
                  :type="currentIndicator.progressApprovalStatus === 'approved' ? 'success' :
                         currentIndicator.progressApprovalStatus === 'rejected' ? 'danger' :
                         currentIndicator.progressApprovalStatus === 'pending' ? 'warning' : 'info'"
                  size="small"
                >
                  {{ currentIndicator.progressApprovalStatus === 'approved' ? '已通过' :
                     currentIndicator.progressApprovalStatus === 'rejected' ? '已驳回' :
                     currentIndicator.progressApprovalStatus === 'pending' ? '待审批' : '未提交' }}
                </ElTag>
              </div>
              <div v-if="currentIndicator.pendingProgress !== undefined" class="pending-progress">
                <span class="progress-label">申请进度：</span>
                <span class="progress-value">{{ currentIndicator.pendingProgress }}%</span>
                <span v-if="currentIndicator.progress" class="progress-change">
                  (当前: {{ currentIndicator.progress }}%,
                  变更: {{ currentIndicator.pendingProgress - currentIndicator.progress > 0 ? '+' : '' }}
                  {{ currentIndicator.pendingProgress - currentIndicator.progress }}%)
                </span>
              </div>
            </div>

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
          <ElEmpty v-if="!hasApprovalData && !hasPlanWorkflowData" description="暂无审批历史" :image-size="120" />
          <ApprovalHistory v-else :history="approvalHistory" :approval-type="approvalType" />
        </ElTabPane>
      </ElTabs>
    </div>

    <ElDialog
      v-model="planDetailDialogVisible"
      title="审批实例详情"
      width="680px"
      class="plan-detail-dialog"
    >
      <div class="plan-detail-summary">
        <div class="summary-title">{{ currentPlanApprovalSummary?.planName || '当前计划' }}</div>
        <div class="summary-subtitle">待审批实例 {{ currentPlanApprovalItems.length }} 条</div>
      </div>

      <div v-if="currentPlanApprovalItems.length > 0" class="plan-detail-list">
        <div
          v-for="item in currentPlanApprovalItems"
          :key="item.instanceId"
          class="plan-detail-item"
        >
          <div class="detail-item-header">
            <div class="detail-item-title">{{ item.title }}</div>
            <ElTag :type="detailDialogStatusTag.type" effect="light" size="small">
              {{ detailDialogStatusTag.label }}
            </ElTag>
          </div>
          <div class="detail-item-meta">
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
              <span class="detail-label">当前步骤：</span>
              <span class="detail-value">{{ item.currentStepName }}</span>
            </div>
            <div v-if="plan?.currentApproverName" class="detail-meta-row">
              <span class="detail-label">当前审批人：</span>
              <span class="detail-value">{{ plan.currentApproverName }}</span>
            </div>
            <div v-if="item.entityId" class="detail-meta-row">
              <span class="detail-label">关联实体ID：</span>
              <span class="detail-value">{{ item.entityId }}</span>
            </div>
          </div>
        </div>
      </div>
      <ElEmpty v-else description="暂无审批实例详情" :image-size="100" />

      <div v-if="planWorkflowHistory.length > 0" class="plan-detail-history">
        <div class="summary-title">审批历史</div>
        <ApprovalHistory :history="planWorkflowHistory" :approval-type="approvalType" />
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
