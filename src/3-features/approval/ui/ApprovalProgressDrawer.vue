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
import { Check, Close, Document, User, Timer, Right } from '@element-plus/icons-vue'
import type { StrategicIndicator } from '@/5-shared/types'
import type { WorkflowNode, ApprovalHistoryItem } from '@/5-shared/types'
import { approvalApi } from '@/3-features/task/api/strategicApi'
import { useAuthStore } from '@/3-features/auth/model/store'
import { logger } from '@/5-shared/lib/utils/logger'
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
  readonly: false
})

const emit = defineEmits<Emits>()
const authStore = useAuthStore()

// ============ 状态 ============
const activeTab = ref('workflow')
const loading = ref(false)
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

const pendingPlanCount = computed(() => pendingPlanApprovals.value.length)
const currentPlanEntityIds = computed(() => {
  return new Set(
    props.indicators
      .map(item => Number(item.id))
      .filter(entityId => Number.isFinite(entityId) && entityId > 0)
  )
})

const scopedPlanApprovals = computed(() => {
  if (currentPlanEntityIds.value.size === 0) {
    return pendingPlanApprovals.value
  }

  return pendingPlanApprovals.value.filter(instance =>
    currentPlanEntityIds.value.has(Number(instance.entityId))
  )
})

const scopedPendingPlanCount = computed(() => scopedPlanApprovals.value.length)
const currentPlanApprovalItems = computed<PlanApprovalDetailItem[]>(() => {
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
  const indicator = currentIndicator.value
  if (!indicator?.statusAudit) return []

  return indicator.statusAudit.map((audit: Record<string, unknown>, index: number) => ({
    id: String(index),
    action: audit.action as ApprovalHistoryItem['action'],
    operator: String(audit.operator ?? index),
    operatorName: String(audit.operatorName ?? '系统'),
    operateTime: new Date((audit.operateTime as string | number | Date | undefined) ?? Date.now()),
    comment: audit.comment as string | undefined,
    dataBefore: audit.dataBefore as Record<string, unknown> | undefined,
    dataAfter: audit.dataAfter as Record<string, unknown> | undefined
  }))
})

// 当前节点ID
const currentNodeId = computed(() => {
  const status = currentIndicator.value?.progressApprovalStatus
  if (status === 'pending') return 'strategic'
  if (status === 'approved') return ''
  return 'submit'
})

// 驳回原因
const rejectionReason = computed(() => {
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

function handleRefresh() {
  emit('refresh')
}

async function loadPendingPlanApprovals() {
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
  if (currentPlanApprovalItems.value.length === 0) {
    ElMessage.warning('当前计划暂无待审批实例')
    return
  }

  planDetailDialogVisible.value = true
}

// 处理自定义审批流程事件
function handleAddNode() {
  // 暂不实现，可后续扩展
}

function handleUpdateApprover(nodeId: string, approverId: string) {
  // 暂不实现，可后续扩展
}

function handleSaveTemplate(templateName: string, steps: any[]) {
  // 暂不实现，可后续扩展
}

function handleApplyTemplate(templateId: string) {
  // 暂不实现，可后续扩展
}

// ============ 监听 ============
watch(() => props.modelValue, (val) => {
  if (val) {
    // 打开时重置到工作流标签页
    activeTab.value = props.showPlanApprovals ? 'pending-plans' : 'workflow'
    void loadPendingPlanApprovals()
  }
})
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
          <ElTag v-if="pendingCount > 0" type="warning" size="small">
            待审批: {{ pendingCount }}
          </ElTag>
          <ElTag v-if="approvedCount > 0" type="success" size="small">
            已通过: {{ approvedCount }}
          </ElTag>
          <ElTag v-if="rejectedCount > 0" type="danger" size="small">
            已驳回: {{ rejectedCount }}
          </ElTag>
        </div>
      </div>
    </template>

    <!-- 空状态 -->
    <ElEmpty
      v-if="!showPlanApprovals && !hasApprovalData"
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
          :label="`待审批 (${scopedPendingPlanCount})`"
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
                      <div class="plan-year">待审批实例 {{ currentPlanApprovalSummary.count }} 条</div>
                    </div>
                  </div>
                  <ElTag type="warning" size="small">待审批</ElTag>
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
                </div>
                <div class="card-actions">
                  <ElButton @click="openPlanApprovalDetails">查看详情</ElButton>
                  <ElButton type="success" @click="handleApprovePlanBatch">一键通过</ElButton>
                  <ElButton type="danger" @click="handleRejectPlanBatch">一键驳回</ElButton>
                </div>
              </div>
            </div>
          </div>
        </ElTabPane>

        <!-- 审批流程视图（使用CustomApprovalFlow组件） -->
        <ElTabPane name="workflow" label="审批流程">
          <ElEmpty v-if="!hasApprovalData" description="暂无审批数据" :image-size="120" />
          <template v-else>
            <ElAlert
              v-if="currentIndicator?.progressApprovalStatus === 'rejected' && rejectionReason"
              type="error"
              :title="'驳回原因：' + rejectionReason"
              show-icon
              :closable="false"
              style="margin-bottom: 16px"
            />

            <div v-if="currentIndicator" class="current-indicator">
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
              :readonly="readonly"
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
          <ElEmpty v-if="!hasApprovalData" description="暂无审批历史" :image-size="120" />
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
            <ElTag type="warning" effect="light" size="small">待审批</ElTag>
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
            <div v-if="item.entityId" class="detail-meta-row">
              <span class="detail-label">关联实体ID：</span>
              <span class="detail-value">{{ item.entityId }}</span>
            </div>
          </div>
        </div>
      </div>
      <ElEmpty v-else description="暂无审批实例详情" :image-size="100" />

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
