<script setup lang="ts">
/**
 * 计划审批抽屉组件
 * 用于审批战略发展部提交的年度计划
 */
import { ref, computed, onMounted, watch } from 'vue'
import { Check, Close, Document, User, Timer, Right } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, ElLoading } from 'element-plus'
import { approvalApi } from '@/features/task/api/strategicApi'
import { useAuthStore } from '@/features/auth/model/store'
import { notifyApprovalStateRefresh } from '@/features/approval/lib'
import { usePermission } from '@/5-shared/lib/permissions'
import { PermissionCode } from '@/shared/types'
import BaseApprovalDrawer from '@/shared/ui/layout/BaseApprovalDrawer.vue'
import { logger } from '@/shared/lib/utils/logger'
import type { PendingApproval } from '@/shared/types'

const props = defineProps<{
  visible: boolean
}>()

interface PendingPlanApproval {
  instanceId: number
  planName?: string
  year?: number
  submitterName?: string
  createdAt?: string
  currentStepName?: string
}

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'close'): void
  (e: 'refresh'): void
}>()

const authStore = useAuthStore()
const permissionUtil = usePermission()
const PLAN_DISPATCH_APPROVE_PERMISSION = PermissionCode.BTN_STRATEGY_TASK_DISPATCH_APPROVE
const canApprovePlan = computed(() => {
  return permissionUtil.hasPermission(PLAN_DISPATCH_APPROVE_PERMISSION)
})

// 计算 drawer 可见性
const drawerVisible = computed({
  get: () => props.visible,
  set: val => emit('update:visible', val)
})

// 待审批列表
const pendingApprovals = ref<PendingPlanApproval[]>([])
const loading = ref(false)

const normalizePendingApproval = (
  approval: PendingApproval,
  index: number
): PendingPlanApproval => ({
  instanceId: Number(approval.id) || index + 1,
  planName: approval.title,
  submitterName: approval.submitter,
  createdAt: approval.time,
  currentStepName: approval.approvalStatus
})

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return (error as { message?: string }).message || fallback
}

// 加载待审批列表
const loadPendingApprovals = async () => {
  loading.value = true
  try {
    const userId = authStore.user?.userId || 1
    const response = await approvalApi.getPendingApprovals(userId)

    if (response.success && response.data) {
      pendingApprovals.value = response.data.map(normalizePendingApproval)
      logger.info('[PlanApprovalDrawer] 加载待审批列表成功', { count: response.data.length })
    } else {
      ElMessage.error(response.message || '加载待审批列表失败')
    }
  } catch (error: unknown) {
    logger.error('[PlanApprovalDrawer] 加载待审批列表失败:', error)
    ElMessage.error(getErrorMessage(error, '加载失败'))
  } finally {
    loading.value = false
  }
}

// 审批通过
const handleApprove = async (instance: PendingPlanApproval) => {
  if (!canApprovePlan.value) {
    ElMessage.warning(`当前账号缺少审批权限：${PLAN_DISPATCH_APPROVE_PERMISSION}`)
    return
  }

  try {
    const { value } = await ElMessageBox.prompt(
      `确认审批通过计划"${instance.planName || '年度计划'}"？`,
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
      const comment = value || '审批通过'

      const response = await approvalApi.approvePlan(instance.instanceId, userId, comment)

      if (response.success) {
        ElMessage.success('审批通过成功')
        await loadPendingApprovals()
        notifyApprovalStateRefresh({ source: 'plan-approval-drawer' })
        emit('refresh')
      } else {
        ElMessage.error(response.message || '审批失败')
      }
    } finally {
      loadingInstance.close()
    }
  } catch {
    // 用户取消
  }
}

// 审批拒绝
const handleReject = async (instance: PendingPlanApproval) => {
  if (!canApprovePlan.value) {
    ElMessage.warning(`当前账号缺少审批权限：${PLAN_DISPATCH_APPROVE_PERMISSION}`)
    return
  }

  try {
    const { value } = await ElMessageBox.prompt(
      `确认拒绝计划"${instance.planName || '年度计划'}"？`,
      '审批拒绝',
      {
        confirmButtonText: '确认拒绝',
        cancelButtonText: '取消',
        inputPlaceholder: '请输入拒绝原因（必填）',
        inputType: 'textarea',
        inputValidator: val => {
          if (!val || !val.trim()) {
            return '请输入拒绝原因'
          }
          return true
        }
      }
    )

    const loadingInstance = ElLoading.service({
      lock: true,
      text: '正在拒绝...',
      background: 'rgba(0, 0, 0, 0.7)'
    })

    try {
      const userId = authStore.user?.userId || 1
      const response = await approvalApi.rejectPlan(instance.instanceId, userId, value)

      if (response.success) {
        ElMessage.success('已拒绝该计划')
        await loadPendingApprovals()
        notifyApprovalStateRefresh({ source: 'plan-approval-drawer' })
        emit('refresh')
      } else {
        ElMessage.error(response.message || '拒绝失败')
      }
    } finally {
      loadingInstance.close()
    }
  } catch {
    // 用户取消
  }
}

// 格式化时间
const formatTime = (timestamp: Date | string) => {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 获取当前步骤描述
const _getCurrentStepDesc = async (instanceId: number) => {
  try {
    const response = await approvalApi.getCurrentStep(instanceId)
    return response.data || '未知步骤'
  } catch {
    return '未知步骤'
  }
}

// 关闭抽屉
const handleClose = () => {
  drawerVisible.value = false
  emit('close')
}

// 组件挂载时加载数据
onMounted(() => {
  if (props.visible) {
    loadPendingApprovals()
  }
})

// 监听 visible 变化
watch(
  () => props.visible,
  newVal => {
    if (newVal) {
      loadPendingApprovals()
    }
  }
)
</script>

<template>
  <BaseApprovalDrawer
    v-model="drawerVisible"
    title="计划审批"
    :subtitle="`待审批 ${pendingApprovals.length} 个计划`"
    size="600px"
    :loading="loading"
    :show-empty="pendingApprovals.length === 0"
    empty-description="暂无待审批的计划"
    custom-class="plan-approval-drawer"
    content-padding="20px"
    min-content-height="400px"
  >
    <template #header>
      <div class="drawer-header">
        <div class="header-title">
          <el-icon><Check /></el-icon>
          <span>计划审批</span>
        </div>
        <div class="header-subtitle">待审批 {{ pendingApprovals.length }} 个计划</div>
      </div>
    </template>

    <el-alert
      v-if="pendingApprovals.length > 0 && !canApprovePlan"
      type="warning"
      :closable="false"
      title="当前账号缺少计划审批按钮权限，仅可查看待办列表。"
      style="margin-bottom: 16px"
    />

    <div class="approval-list">
      <div v-for="instance in pendingApprovals" :key="instance.instanceId" class="approval-card">
        <div class="card-header">
          <div class="plan-info">
            <el-icon class="plan-icon"><Document /></el-icon>
            <div class="info-text">
              <div class="plan-name">{{ instance.planName || '年度计划' }}</div>
              <div class="plan-year">{{ instance.year || '2025' }}年度</div>
            </div>
          </div>
          <el-tag type="warning" size="small">待审批</el-tag>
        </div>

        <div class="submit-info">
          <div class="info-row">
            <el-icon><User /></el-icon>
            <span class="label">提交人：</span>
            <span class="value">{{ instance.submitterName || '未知' }}</span>
          </div>
          <div class="info-row">
            <el-icon><Timer /></el-icon>
            <span class="label">提交时间：</span>
            <span class="value">{{
              instance.createdAt ? formatTime(instance.createdAt) : '--'
            }}</span>
          </div>
          <div class="info-row">
            <el-icon><Right /></el-icon>
            <span class="label">当前步骤：</span>
            <span class="value">{{ instance.currentStepName || '审批中' }}</span>
          </div>
        </div>

        <div v-if="canApprovePlan" class="card-actions">
          <el-button type="success" size="default" :icon="Check" @click="handleApprove(instance)">
            审批通过
          </el-button>
          <el-button type="danger" size="default" :icon="Close" @click="handleReject(instance)">
            审批拒绝
          </el-button>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="drawer-footer">
        <span class="footer-info">待审批 {{ pendingApprovals.length }} 个计划</span>
        <el-button @click="handleClose">关闭</el-button>
      </div>
    </template>
  </BaseApprovalDrawer>
</template>

<style scoped>
.plan-approval-drawer :deep(.el-drawer__header) {
  margin-bottom: 0;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
}

.drawer-header {
  width: 100%;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.header-title .el-icon {
  color: #2c5282;
}

.header-subtitle {
  margin-top: 8px;
  font-size: 13px;
  color: #64748b;
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
  padding: 20px;
  transition: all 0.3s;
}

.approval-card:hover {
  border-color: #2c5282;
  box-shadow: 0 4px 12px rgba(44, 82, 130, 0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f1f5f9;
}

.plan-info {
  display: flex;
  gap: 12px;
  flex: 1;
}

.plan-icon {
  color: #2c5282;
  font-size: 24px;
  flex-shrink: 0;
}

.info-text {
  flex: 1;
}

.plan-name {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 4px;
}

.plan-year {
  font-size: 13px;
  color: #64748b;
}

.submit-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.info-row .el-icon {
  color: #64748b;
  font-size: 14px;
}

.info-row .label {
  color: #64748b;
}

.info-row .value {
  color: #1e293b;
  font-weight: 500;
}

.card-actions {
  display: flex;
  gap: 12px;
}

.card-actions .el-button {
  flex: 1;
}

.drawer-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-top: 1px solid #e2e8f0;
}

.footer-info {
  font-size: 13px;
  color: #64748b;
}
</style>
