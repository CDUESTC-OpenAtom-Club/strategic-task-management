<script setup lang="ts">
/**
 * 任务审批卡片组件
 * 展示任务/指标信息，支持内联审批操作
 */
import { ref, computed } from 'vue'
import {
  Check, Close, View, Document, Clock,
  User, OfficeBuilding, TrendCharts, Warning
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { StrategicIndicator, StatusAuditEntry } from '@/types'

const props = defineProps<{
  indicator: StrategicIndicator
  canApprove?: boolean
  isReadOnly?: boolean
}>()

const emit = defineEmits<{
  (e: 'approve', indicator: StrategicIndicator, comment: string): void
  (e: 'reject', indicator: StrategicIndicator, comment: string): void
  (e: 'view-detail', indicator: StrategicIndicator): void
  (e: 'view-audit-log', indicator: StrategicIndicator): void
}>()

// 审批评论
const approvalComment = ref('')
const showApprovalForm = ref(false)
const approvalAction = ref<'approve' | 'reject'>('approve')

// 计算进度状态
const progressStatus = computed(() => {
  const progress = props.indicator.progress || 0
  if (progress >= 80) return 'success'
  if (progress >= 50) return 'warning'
  return 'exception'
})

// 计算进度颜色
const progressColor = computed(() => {
  if (props.indicator.canWithdraw) return '#C0C4CC' // 未下发：灰色
  const progress = props.indicator.progress || 0
  if (progress >= 80) return '#67C23A' // 绿色
  if (progress >= 50) return '#E6A23C' // 黄色
  return '#F56C6C' // 红色
})

// 判断是否有待审批
const hasPendingApproval = computed(() => {
  const audit = props.indicator.statusAudit || []
  if (audit.length === 0) return false
  const lastEntry = audit[audit.length - 1]
  return lastEntry.action === 'submit'
})

// 获取最近一次提交记录
const latestSubmission = computed(() => {
  const audit = props.indicator.statusAudit || []
  for (let i = audit.length - 1; i >= 0; i--) {
    if (audit[i].action === 'submit') {
      return audit[i]
    }
  }
  return null
})

// 获取状态标签
const statusTag = computed(() => {
  if (props.indicator.canWithdraw) {
    return { text: '待下发', type: 'info' }
  }
  if (hasPendingApproval.value) {
    return { text: '待审批', type: 'warning' }
  }
  const progress = props.indicator.progress || 0
  if (progress >= 100) {
    return { text: '已完成', type: 'success' }
  }
  return { text: '进行中', type: 'primary' }
})

// 打开审批表单
const openApprovalForm = (action: 'approve' | 'reject') => {
  approvalAction.value = action
  showApprovalForm.value = true
  approvalComment.value = ''
}

// 提交审批
const submitApproval = () => {
  if (approvalAction.value === 'reject' && !approvalComment.value.trim()) {
    ElMessage.warning('驳回时必须填写原因')
    return
  }

  const actionText = approvalAction.value === 'approve' ? '通过' : '驳回'
  ElMessageBox.confirm(
    `确认${actionText}该指标的进度提交？`,
    `${actionText}确认`,
    {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: approvalAction.value === 'approve' ? 'success' : 'warning'
    }
  ).then(() => {
    if (approvalAction.value === 'approve') {
      emit('approve', props.indicator, approvalComment.value)
    } else {
      emit('reject', props.indicator, approvalComment.value)
    }
    showApprovalForm.value = false
    approvalComment.value = ''
  })
}

// 取消审批
const cancelApproval = () => {
  showApprovalForm.value = false
  approvalComment.value = ''
}

// 查看详情
const handleViewDetail = () => {
  emit('view-detail', props.indicator)
}

// 查看审计日志
const handleViewAuditLog = () => {
  emit('view-audit-log', props.indicator)
}
</script>

<template>
  <div :class="['task-approval-card', { 'has-pending': hasPendingApproval }]">
    <!-- 卡片头部 -->
    <div class="card-header">
      <div class="header-left">
        <el-tag :type="statusTag.type" size="small" effect="dark">
          {{ statusTag.text }}
        </el-tag>
        <el-tag
          :type="indicator.type1 === '定量' ? 'primary' : 'warning'"
          size="small"
          effect="plain"
        >
          {{ indicator.type1 }}
        </el-tag>
        <el-tag
          :type="indicator.type2 === '发展性' ? '' : 'success'"
          size="small"
          effect="plain"
        >
          {{ indicator.type2 }}
        </el-tag>
      </div>
      <div class="header-right">
        <el-button
          link
          type="primary"
          size="small"
          @click="handleViewAuditLog"
        >
          <el-icon><Document /></el-icon>
          审计日志
        </el-button>
      </div>
    </div>

    <!-- 卡片内容 -->
    <div class="card-body">
      <h3 class="indicator-name">{{ indicator.name }}</h3>

      <div class="indicator-meta">
        <div class="meta-item">
          <el-icon><OfficeBuilding /></el-icon>
          <span>{{ indicator.responsibleDept }}</span>
        </div>
        <div class="meta-item">
          <el-icon><User /></el-icon>
          <span>{{ indicator.responsiblePerson }}</span>
        </div>
        <div class="meta-item" v-if="indicator.taskContent">
          <el-icon><TrendCharts /></el-icon>
          <span>{{ indicator.taskContent }}</span>
        </div>
      </div>

      <!-- 进度条 -->
      <div class="progress-section">
        <div class="progress-header">
          <span class="progress-label">当前进度</span>
          <span class="progress-value">{{ indicator.progress || 0 }}%</span>
        </div>
        <el-progress
          :percentage="indicator.progress || 0"
          :stroke-width="10"
          :color="progressColor"
          :show-text="false"
        />
        <div class="progress-footer" v-if="indicator.targetValue">
          <span>目标: {{ indicator.targetValue }}{{ indicator.unit }}</span>
          <span>权重: {{ indicator.weight }}</span>
        </div>
      </div>

      <!-- 待审批信息 -->
      <div v-if="hasPendingApproval && latestSubmission" class="pending-info">
        <el-alert type="warning" :closable="false" show-icon>
          <template #title>
            <div class="pending-title">
              <span>{{ latestSubmission.operatorName }} 于 {{ new Date(latestSubmission.timestamp).toLocaleString() }} 提交了进度更新</span>
            </div>
          </template>
          <div class="pending-detail" v-if="latestSubmission.comment">
            {{ latestSubmission.comment }}
          </div>
          <div class="pending-progress" v-if="latestSubmission.previousProgress !== undefined">
            进度: {{ latestSubmission.previousProgress }}% → {{ latestSubmission.newProgress }}%
          </div>
        </el-alert>
      </div>

      <!-- 审批表单 -->
      <div v-if="showApprovalForm" class="approval-form">
        <el-input
          v-model="approvalComment"
          type="textarea"
          :rows="2"
          :placeholder="approvalAction === 'reject' ? '请填写驳回原因（必填）' : '填写审批意见（可选）'"
        />
        <div class="form-actions">
          <el-button size="small" @click="cancelApproval">取消</el-button>
          <el-button
            size="small"
            :type="approvalAction === 'approve' ? 'success' : 'danger'"
            @click="submitApproval"
          >
            确认{{ approvalAction === 'approve' ? '通过' : '驳回' }}
          </el-button>
        </div>
      </div>
    </div>

    <!-- 卡片底部操作 -->
    <div class="card-footer">
      <el-button link type="primary" @click="handleViewDetail">
        <el-icon><View /></el-icon>
        查看详情
      </el-button>

      <div class="footer-actions" v-if="canApprove && hasPendingApproval && !isReadOnly && !showApprovalForm">
        <el-button
          type="success"
          size="small"
          :icon="Check"
          @click="openApprovalForm('approve')"
        >
          通过
        </el-button>
        <el-button
          type="danger"
          size="small"
          :icon="Close"
          @click="openApprovalForm('reject')"
        >
          驳回
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-approval-card {
  background: var(--bg-white, #fff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 8px;
  transition: all 0.2s ease;
  overflow: hidden;
}

.task-approval-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border-color: var(--color-primary-light, #93c5fd);
}

.task-approval-card.has-pending {
  border-left: 4px solid var(--el-color-warning);
}

.card-header {
  padding: 12px 16px;
  background: var(--bg-page, #f8fafc);
  border-bottom: 1px solid var(--border-light, #f1f5f9);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.header-right {
  display: flex;
  gap: 8px;
}

.card-body {
  padding: 16px;
}

.indicator-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-main, #1e293b);
  margin: 0 0 12px 0;
  line-height: 1.5;
}

.indicator-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 16px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--text-secondary, #64748b);
}

.meta-item .el-icon {
  font-size: 14px;
  color: var(--text-placeholder, #94a3b8);
}

.progress-section {
  background: var(--bg-page, #f8fafc);
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 12px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.progress-label {
  font-size: 13px;
  color: var(--text-secondary, #64748b);
}

.progress-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-main, #1e293b);
}

.progress-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-placeholder, #94a3b8);
}

.pending-info {
  margin-bottom: 12px;
}

.pending-title {
  font-size: 13px;
}

.pending-detail {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-secondary, #64748b);
}

.pending-progress {
  margin-top: 4px;
  font-size: 12px;
  font-weight: 500;
}

.approval-form {
  background: var(--bg-page, #f8fafc);
  padding: 12px;
  border-radius: 6px;
  margin-top: 12px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.card-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border-light, #f1f5f9);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-actions {
  display: flex;
  gap: 8px;
}
</style>
