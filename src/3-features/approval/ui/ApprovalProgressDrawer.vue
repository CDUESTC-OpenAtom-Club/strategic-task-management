<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElDrawer, ElTabs, ElTabPane, ElEmpty, ElTag, ElAlert } from 'element-plus'
import type { StrategicIndicator } from '@/5-shared/types'
import type { WorkflowNode, ApprovalHistoryItem } from '@/5-shared/types'
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
  showApprovalSection?: boolean
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

// ============ 状态 ============
const activeTab = ref('workflow')
const loading = ref(false)

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
      comment: indicator.statusAudit?.find(a => a.action === 'approve')?.comment
    })
  }

  // 3. 战略部门审批节点
  nodes.push({
    id: 'strategic',
    name: '战略部门审批',
    status: getStrategicStatus(indicator.progressApprovalStatus),
    operatorName: '战略发展部',
    operateTime: indicator.updatedAt,
    comment: indicator.statusAudit?.find(a => a.action === 'reject')?.comment
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

  return indicator.statusAudit.map((audit, index) => ({
    id: String(index),
    action: audit.action as ApprovalHistoryItem['action'],
    operator: audit.operator || String(index),
    operatorName: audit.operatorName || '系统',
    operateTime: new Date(audit.operateTime || Date.now()),
    comment: audit.comment,
    dataBefore: audit.dataBefore,
    dataAfter: audit.dataAfter
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
  const rejectAudit = indicator?.statusAudit?.find(a => a.action === 'reject')
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
    activeTab.value = 'workflow'
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
    <template v-if="indicators.length > 1" #header>
      <div class="drawer-header">
        <h3 class="drawer-title">审批进度</h3>
        <div class="stats-tags">
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
      v-if="!hasApprovalData"
      description="暂无审批数据"
      :image-size="120"
    />

    <!-- 审批内容 -->
    <div v-else class="approval-content">
      <!-- 驳回提示 -->
      <ElAlert
        v-if="currentIndicator?.progressApprovalStatus === 'rejected' && rejectionReason"
        type="error"
        :title="'驳回原因：' + rejectionReason"
        show-icon
        :closable="false"
        style="margin-bottom: 16px"
      />

      <!-- 当前指标信息 -->
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

      <!-- 标签页 -->
      <ElTabs v-model="activeTab" class="approval-tabs">
        <!-- 审批流程视图（使用CustomApprovalFlow组件） -->
        <ElTabPane name="workflow" label="审批流程">
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
        </ElTabPane>

        <!-- 历史记录视图 -->
        <ElTabPane name="history" label="审批历史">
          <ApprovalHistory :history="approvalHistory" :approval-type="approvalType" />
        </ElTabPane>
      </ElTabs>
    </div>
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
</style>
