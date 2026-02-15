<script setup lang="ts">
/**
 * 任务审批抽屉组件
 * 上方：待审批记录（一键通过/驳回）
 * 下方：审计日志时间线
 */
import { ref, computed } from 'vue'
import {
  Check,
  Close,
  Upload,
  Edit,
  Refresh,
  User,
  ChatDotRound,
  Document,
  Right,
  Promotion,
  Warning,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { StrategicIndicator, StatusAuditEntry } from '@/types'
import { useStrategicStore } from '@/stores/strategic'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  visible: boolean
  indicators: StrategicIndicator[]
  departmentName: string
  showApprovalSection?: boolean // 是否显示待审批区域（默认true，审批人需要，填报人不需要）
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'close'): void
  (e: 'refresh'): void
}>()

const strategicStore = useStrategicStore()
const authStore = useAuthStore()

// 计算 drawer 可见性
const drawerVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
})

// 待审批记录（只显示 pending 状态的指标，去重后显示）
const pendingApprovals = computed(() => {
  // 使用 Map 去重，key 为指标 id
  const uniqueMap = new Map()
  props.indicators
    .filter(indicator => indicator.progressApprovalStatus === 'pending')  // 只显示待审批的
    .forEach(indicator => {
      if (!uniqueMap.has(indicator.id)) {
        uniqueMap.set(indicator.id, indicator)
      }
    })
  return Array.from(uniqueMap.values())
})

// 标签页切换
const activeTab = ref<'current' | 'history'>('current')

// 当前批次的提交记录（待审批的指标及其提交信息）
const currentSubmissions = computed(() => {
  return pendingApprovals.value.map((indicator) => {
    // 找到最新的提交记录
    const submitLog = indicator.statusAudit
      ?.filter((log) => log.action === 'submit')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]

    return {
      indicator,
      submitLog,
    }
  })
})

// 历史审批记录（按审批批次分组，包含完整流程）
const historyApprovalBatches = computed(() => {
  // 收集所有审批批次
  const batches: any[] = []
  
  // 按时间戳分组审批操作
  const approvalGroups: Record<string, any[]> = {}
  
  props.indicators.forEach((indicator) => {
    if (indicator.statusAudit && indicator.statusAudit.length > 0) {
      indicator.statusAudit.forEach((entry) => {
        if (entry.action === 'approve' || entry.action === 'reject') {
          const batchKey = new Date(entry.timestamp).toISOString().slice(0, 16)
          if (!approvalGroups[batchKey]) {
            approvalGroups[batchKey] = []
          }
          approvalGroups[batchKey].push({
            ...entry,
            _indicatorName: indicator.name,
            _taskContent: indicator.taskContent,
            _indicatorId: indicator.id,
          })
        }
      })
    }
  })
  
  // 为每个审批批次找到对应的提交记录
  Object.entries(approvalGroups).forEach(([key, approvalActions]) => {
    const submitters: any[] = []
    
    // 查找这些指标的提交记录
    approvalActions.forEach((approval) => {
      const indicator = props.indicators.find(i => i.id.toString() === approval._indicatorId.toString())
      if (indicator?.statusAudit) {
        // 找到最近的提交记录（在审批之前）
        const submitLog = indicator.statusAudit
          .filter(log => 
            log.action === 'submit' && 
            new Date(log.timestamp).getTime() <= new Date(approval.timestamp).getTime()
          )
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
        
        if (submitLog && !submitters.find(s => s.operatorName === submitLog.operatorName)) {
          submitters.push({
            operatorName: submitLog.operatorName,
            operatorDept: submitLog.operatorDept,
            timestamp: submitLog.timestamp,
          })
        }
      }
    })
    
    batches.push({
      timestamp: approvalActions[0].timestamp,
      approver: approvalActions[0].operatorName,
      approverDept: approvalActions[0].operatorDept,
      action: approvalActions[0].action,
      submitters: submitters,
      actions: approvalActions,
      count: approvalActions.length,
    })
  })
  
  return batches.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
})

// 统一驳回原因输入
const batchRejectReason = ref('')

// 一键审批通过所有
const handleBatchApprove = () => {
  if (pendingApprovals.value.length === 0) {
    ElMessage.warning('暂无待审批记录')
    return
  }

  const count = pendingApprovals.value.length
  const indicatorNames = pendingApprovals.value.map(i => i.name).join('、')

  ElMessageBox.confirm(
    `确认一键审批通过所有待审批记录？\n\n共 ${count} 条记录：\n${indicatorNames}`,
    '一键审批通过',
    {
      confirmButtonText: '确认通过',
      cancelButtonText: '取消',
      type: 'success',
    }
  ).then(() => {
    let successCount = 0

    pendingApprovals.value.forEach((indicator) => {
      // 更新指标进度
      strategicStore.updateIndicator(indicator.id.toString(), {
        progress: indicator.pendingProgress || indicator.progress,
        progressApprovalStatus: 'approved',
        pendingProgress: undefined,
        pendingRemark: undefined,
        pendingAttachments: undefined,
      })

      // 添加审计日志
      strategicStore.addStatusAuditEntry(indicator.id.toString(), {
        operator: authStore.userName || 'unknown',
        operatorName: authStore.userName || '未知用户',
        operatorDept: authStore.userDepartment || '战略发展部',
        action: 'approve',
        comment: '一键审批通过',
        previousProgress: indicator.progress,
        newProgress: indicator.pendingProgress || indicator.progress,
        previousStatus: 'pending_approval',
        newStatus: 'active',
      })

      successCount++
    })

    ElMessage.success(`已成功审批通过 ${successCount} 条记录`)
    emit('refresh')
  })
}

// 一键驳回所有
const handleBatchReject = () => {
  if (pendingApprovals.value.length === 0) {
    ElMessage.warning('暂无待审批记录')
    return
  }

  if (!batchRejectReason.value || !batchRejectReason.value.trim()) {
    ElMessage.warning('请填写驳回原因')
    return
  }

  const count = pendingApprovals.value.length
  const indicatorNames = pendingApprovals.value.map(i => i.name).join('、')

  ElMessageBox.confirm(
    `确认一键驳回所有待审批记录？\n\n共 ${count} 条记录：\n${indicatorNames}\n\n驳回原因：${batchRejectReason.value}`,
    '一键驳回',
    {
      confirmButtonText: '确认驳回',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(() => {
    let successCount = 0

    pendingApprovals.value.forEach((indicator) => {
      // 设置驳回状态（保持原进度）
      strategicStore.updateIndicator(indicator.id.toString(), {
        progressApprovalStatus: 'rejected',
      })

      // 添加审计日志
      strategicStore.addStatusAuditEntry(indicator.id.toString(), {
        operator: authStore.userName || 'unknown',
        operatorName: authStore.userName || '未知用户',
        operatorDept: authStore.userDepartment || '战略发展部',
        action: 'reject',
        comment: batchRejectReason.value,
        previousProgress: indicator.progress,
        newProgress: indicator.pendingProgress || indicator.progress,
        previousStatus: 'pending_approval',
        newStatus: 'rejected',
      })

      successCount++
    })

    // 清空驳回原因
    batchRejectReason.value = ''

    ElMessage.info(`已驳回 ${successCount} 条记录`)
    emit('refresh')
  })
}

// 获取操作类型配置
const getActionConfig = (action: StatusAuditEntry['action']) => {
  const configs = {
    submit: { icon: Upload, color: '#409EFF', label: '提交进度', type: 'primary' as const },
    approve: { icon: Check, color: '#67C23A', label: '审批通过', type: 'success' as const },
    reject: { icon: Close, color: '#F56C6C', label: '审批驳回', type: 'danger' as const },
    revoke: { icon: Refresh, color: '#E6A23C', label: '撤回提交', type: 'warning' as const },
    update: { icon: Edit, color: '#909399', label: '更新进度', type: 'info' as const },
    distribute: { icon: Promotion, color: '#409EFF', label: '下发指标', type: 'primary' as const },
  }
  return configs[action] || configs.update
}

// 格式化时间
const formatTime = (timestamp: Date | string) => {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 格式化相对时间
const formatRelativeTime = (timestamp: Date | string) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins}分钟前`
  if (diffHours < 24) return `${diffHours}小时前`
  if (diffDays < 30) return `${diffDays}天前`
  return formatTime(timestamp)
}

// 关闭抽屉
const handleClose = (done?: any) => {
  drawerVisible.value = false
  emit('close')
  if (typeof done === 'function') {
    done()
  }
}
</script>

<template>
  <el-drawer
    v-model="drawerVisible"
    title="任务审批"
    direction="rtl"
    size="550px"
    :before-close="handleClose"
    class="task-approval-drawer"
  >
    <template #header>
      <div class="drawer-header">
        <div class="header-title">
          <el-icon><Check /></el-icon>
          <span>{{ props.showApprovalSection !== false ? '任务审批' : '审批进度' }}</span>
        </div>
        <!-- <div class="header-subtitle">
          <template v-if="props.showApprovalSection !== false">
            {{ departmentName }} - 待审批 {{ pendingApprovals.length }} 条
          </template>
          <template v-else>
            {{ departmentName }} - 查看提交的审批进度
          </template>
        </div> -->
      </div>
    </template>

    <div class="drawer-content">
      <!-- 待审批记录区域（仅审批人可见） -->
      <div v-if="props.showApprovalSection !== false" class="pending-section">
        <div class="section-title">
          <el-icon><Warning /></el-icon>
          <span>待审批记录</span>
          <!-- <el-badge :value="pendingApprovals.length" :max="99" class="badge" /> -->
        </div>

        <!-- 空状态 -->
        <el-empty
          v-if="pendingApprovals.length === 0"
          description="暂无待审批记录"
          :image-size="80"
        />

        <!-- 待审批卡片列表 -->
        <div v-else class="pending-list">
          <div
            v-for="indicator in pendingApprovals"
            :key="indicator.id"
            class="pending-card"
          >
            <!-- 指标信息 -->
            <div class="card-header">
              <div class="indicator-info">
                <el-icon><Document /></el-icon>
                <div class="info-text">
                  <div class="indicator-name">{{ indicator.name }}</div>
                  <div class="task-content">{{ indicator.taskContent }}</div>
                </div>
              </div>
              <el-tag type="warning" size="small">待审批</el-tag>
            </div>

            <!-- 进度变化 -->
            <div class="progress-change">
              <span class="label">进度变化：</span>
              <span class="from">{{ indicator.progress }}%</span>
              <el-icon class="arrow"><Right /></el-icon>
              <span class="to">{{ indicator.pendingProgress }}%</span>
            </div>

            <!-- 提交说明 -->
            <div v-if="indicator.pendingRemark" class="pending-remark">
              <el-icon><ChatDotRound /></el-icon>
              <span>{{ indicator.pendingRemark }}</span>
            </div>
          </div>
        </div>

        <!-- 统一驳回原因输入（仅在有待审批记录时显示） -->
        <div v-if="pendingApprovals.length > 0" class="batch-reject-section">
          <div class="reject-label">驳回原因（一键驳回时必填）：</div>
          <el-input
            v-model="batchRejectReason"
            type="textarea"
            :rows="3"
            placeholder="请填写驳回原因，将应用于所有待审批记录..."
            class="batch-reject-input"
          />
        </div>

        <!-- 一键操作按钮（仅在有待审批记录时显示） -->
        <div v-if="pendingApprovals.length > 0" class="batch-actions">
          <el-button
            type="success"
            size="large"
            :icon="Check"
            @click="handleBatchApprove"
          >
            一键审批通过
          </el-button>
          <el-button
            type="danger"
            size="large"
            :icon="Close"
            @click="handleBatchReject"
          >
            一键驳回
          </el-button>
        </div>
      </div>

      <!-- 分隔线（仅在显示待审批区域时显示） -->
      <el-divider v-if="props.showApprovalSection !== false" />

      <!-- 审批流程区域 -->
      <div class="approval-flow-section">
        <!-- 标签页切换 -->
        <el-tabs v-model="activeTab" class="approval-tabs">
          <el-tab-pane label="本次提交" name="current">
            <!-- 本次提交的审批流程时间线 -->
            <div v-if="currentSubmissions.length === 0" class="empty-state">
              <el-empty description="暂无提交记录" :image-size="80" />
            </div>
              <div v-else class="flow-timeline">
                <!-- 发起申请节点 -->
                <div class="flow-node">
                  <div class="node-icon submit-icon is-completed">
                    <el-icon><Upload /></el-icon>
                  </div>
                  <div class="node-content">
                    <div class="node-title">发起申请</div>
                    <div class="node-user">
                      {{
                        currentSubmissions[0]?.submitLog?.operatorName || '提交人'
                      }}
                    </div>
                    <div class="node-time">
                      {{
                        currentSubmissions[0]?.submitLog
                          ? formatTime(currentSubmissions[0].submitLog.timestamp)
                          : ''
                      }}
                    </div>
                  </div>
                </div>

                <!-- 连接线 -->
                <div class="flow-line"></div>

                <!-- 主管审批节点 -->
                <div class="flow-node">
                  <div class="node-icon pending-icon">
                    <el-icon><User /></el-icon>
                  </div>
                <div class="node-content">
                  <div class="node-title">主管审批</div>
                  <div class="node-user">
                    {{ authStore.userName || '审批人' }}
                  </div>
                  
                  <!-- 待审批说明 -->
                  <!-- <div class="pending-notice">
                    <el-icon><Warning /></el-icon>
                    <span>待审批 {{ pendingApprovals.length }} 条指标</span>
                  </div> -->

                  <!-- 指标列表折叠 -->
                  <el-collapse class="indicators-collapse">
                    <el-collapse-item title="查看指标详情" name="1">
                      <div class="indicators-detail">
                        <div
                          v-for="item in currentSubmissions"
                          :key="item.indicator.id"
                          class="indicator-detail-item"
                        >
                          <div class="detail-name">
                            <el-icon><Document /></el-icon>
                            <span>{{ item.indicator.name }}</span>
                          </div>
                          <div class="detail-progress">
                            <span class="from">{{ item.indicator.progress }}%</span>
                            <el-icon class="arrow"><Right /></el-icon>
                            <span class="to">{{ item.indicator.pendingProgress }}%</span>
                          </div>
                          <div
                            v-if="item.indicator.pendingRemark"
                            class="detail-remark"
                          >
                            {{ item.indicator.pendingRemark }}
                          </div>
                        </div>
                      </div>
                    </el-collapse-item>
                  </el-collapse>
                </div>
              </div>

              <!-- 连接线 -->
              <div class="flow-line dashed"></div>

              <!-- 抄送人节点（可选） -->
              <div class="flow-node">
                <div class="node-icon notify-icon">
                  <el-icon><ChatDotRound /></el-icon>
                </div>
                <div class="node-content">
                  <div class="node-title">抄送人</div>
                  <div class="node-desc">审批完成后通知相关人员</div>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane name="history">
            <template #label>
              <span>历史记录</span>
              <el-badge
                :value="historyApprovalBatches.length"
                :max="99"
                class="tab-badge"
              />
            </template>

            <!-- 历史审批记录流程时间线列表 -->
            <div v-if="historyApprovalBatches.length === 0" class="empty-state">
              <el-empty description="暂无历史记录" :image-size="80" />
            </div>
            <div v-else class="history-list">
              <div
                v-for="(batch, index) in historyApprovalBatches"
                :key="index"
                class="history-batch"
              >
                <!-- 批次时间标签 -->
                <div class="batch-time-label">
                  <span>{{ formatTime(batch.timestamp) }}</span>
                  <el-tag
                    :type="getActionConfig(batch.action).type"
                    size="small"
                    effect="plain"
                  >
                    {{ getActionConfig(batch.action).label }}
                  </el-tag>
                </div>

                  <!-- 流程时间线 -->
                  <div class="flow-timeline">
                    <!-- 发起申请节点 -->
                    <div class="flow-node">
                      <div class="node-icon submit-icon is-completed">
                        <el-icon><Upload /></el-icon>
                      </div>
                      <div class="node-content">
                        <div class="node-title">发起申请</div>
                        <div v-if="batch.submitters.length > 0" class="submitters-list">
                          <div
                            v-for="(submitter, idx) in batch.submitters"
                            :key="idx"
                            class="submitter-item"
                          >
                            <span class="node-user">{{ submitter.operatorName }}</span>
                            <span class="node-dept">{{ submitter.operatorDept }}</span>
                          </div>
                        </div>
                        <div v-else class="node-user">提交人</div>
                        <div v-if="batch.submitters.length > 0" class="node-time">
                          {{ formatTime(batch.submitters[0].timestamp) }}
                        </div>
                      </div>
                    </div>

                    <!-- 连接线 -->
                    <div class="flow-line"></div>

                    <!-- 主管审批节点 -->
                    <div class="flow-node">
                      <div
                        class="node-icon"
                        :class="[
                          batch.action === 'approve' ? 'approve-icon is-completed' : 'reject-icon',
                        ]"
                      >
                        <el-icon>
                          <Check v-if="batch.action === 'approve'" />
                          <Close v-else />
                        </el-icon>
                      </div>
                    <div class="node-content">
                      <div class="node-title">主管审批</div>
                      <div class="node-user">
                        {{ batch.approver }}
                        <el-tag
                          :type="getActionConfig(batch.action).type"
                          size="small"
                          class="status-tag"
                        >
                          {{ batch.action === 'approve' ? '已通过' : '已驳回' }}
                        </el-tag>
                      </div>
                      <div class="node-dept">{{ batch.approverDept }}</div>
                      <div class="node-time">{{ formatTime(batch.timestamp) }}</div>

                      <!-- 指标列表折叠 -->
                      <el-collapse class="indicators-collapse">
                        <el-collapse-item
                          :title="`查看指标详情（${batch.count} 条）`"
                          name="1"
                        >
                          <div class="indicators-detail">
                            <div
                              v-for="action in batch.actions"
                              :key="action._indicatorId"
                              class="indicator-detail-item"
                            >
                              <div class="detail-name">
                                <el-icon><Document /></el-icon>
                                <span>{{ action._indicatorName }}</span>
                              </div>
                              <div v-if="action._taskContent" class="detail-task">
                                {{ action._taskContent }}
                              </div>
                              <div
                                v-if="
                                  action.previousProgress !== undefined &&
                                  action.newProgress !== undefined
                                "
                                class="detail-progress"
                              >
                                <span class="from">{{ action.previousProgress }}%</span>
                                <el-icon class="arrow"><Right /></el-icon>
                                <span class="to">{{ action.newProgress }}%</span>
                              </div>
                              <div v-if="action.comment" class="detail-remark">
                                <el-icon><ChatDotRound /></el-icon>
                                <span>{{ action.comment }}</span>
                              </div>
                            </div>
                          </div>
                        </el-collapse-item>
                      </el-collapse>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>

    <template #footer>
      <div class="drawer-footer">
        <span v-if="props.showApprovalSection !== false" class="footer-info"
          >待审批 {{ pendingApprovals.length }} 条 · 历史记录
          {{ historyApprovalBatches.length }} 批次</span
        >
        <span v-else class="footer-info"
          >历史记录 {{ historyApprovalBatches.length }} 批次</span
        >
        <el-button @click="handleClose">关闭</el-button>
      </div>
    </template>
  </el-drawer>
</template>


<style scoped>
.task-approval-drawer :deep(.el-drawer__header) {
  margin-bottom: 0;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
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
  color: var(--text-main, #1e293b);
}

.header-title .el-icon {
  color: var(--color-primary, #2c5282);
}

.header-subtitle {
  margin-top: 8px;
  font-size: 13px;
  color: var(--text-secondary, #64748b);
  line-height: 1.4;
}

.drawer-content {
  padding: 20px;
  height: calc(100% - 60px);
  overflow-y: auto;
}

/* 区域标题 */
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main, #1e293b);
  margin-bottom: 16px;
}

.section-title .el-icon {
  color: var(--color-primary, #2c5282);
}

.section-title .badge {
  margin-left: auto;
}

.section-title .log-count {
  margin-left: auto;
  font-size: 12px;
  font-weight: 400;
  color: var(--text-secondary, #64748b);
}

/* 待审批区域 */
.pending-section {
  margin-bottom: 20px;
}

.pending-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pending-card {
  background: var(--bg-white, #fff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 8px;
  padding: 16px;
  transition: all 0.3s;
}

.pending-card:hover {
  border-color: var(--color-primary, #2c5282);
  box-shadow: 0 2px 8px rgba(44, 82, 130, 0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.indicator-info {
  display: flex;
  gap: 10px;
  flex: 1;
}

.indicator-info .el-icon {
  color: var(--color-primary, #2c5282);
  font-size: 18px;
  flex-shrink: 0;
  margin-top: 2px;
}

.info-text {
  flex: 1;
}

.indicator-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main, #1e293b);
  line-height: 1.4;
  margin-bottom: 4px;
}

.task-content {
  font-size: 12px;
  color: var(--text-secondary, #64748b);
}

.progress-change {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--bg-page, #f8fafc);
  border-radius: 6px;
  margin-bottom: 12px;
}

.progress-change .label {
  font-size: 13px;
  color: var(--text-secondary, #64748b);
}

.progress-change .from {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-placeholder, #94a3b8);
}

.progress-change .arrow {
  color: var(--text-placeholder, #94a3b8);
  font-size: 12px;
}

.progress-change .to {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary, #2c5282);
}

.pending-remark {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 13px;
  color: var(--text-regular, #475569);
  padding: 10px 12px;
  background: var(--bg-page, #f8fafc);
  border-radius: 6px;
  border-left: 3px solid var(--color-primary-light, #93c5fd);
  margin-bottom: 12px;
}

.pending-remark .el-icon {
  color: var(--color-primary, #2c5282);
  font-size: 14px;
  flex-shrink: 0;
  margin-top: 2px;
}

/* 统一驳回原因区域 */
.batch-reject-section {
  margin-top: 16px;
  padding: 16px;
  background: var(--bg-page, #f8fafc);
  border-radius: 8px;
  border: 1px solid var(--border-color, #e2e8f0);
}

.reject-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-main, #1e293b);
  margin-bottom: 8px;
}

.batch-reject-input {
  width: 100%;
}

/* 一键操作按钮 */
.batch-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.batch-actions .el-button {
  flex: 1;
}

/* 审批流程区域 */
.approval-flow-section {
  margin-top: 20px;
}

.approval-tabs {
  margin-top: 0;
}

.approval-tabs :deep(.el-tabs__header) {
  margin-bottom: 16px;
}

.tab-badge {
  margin-left: 8px;
}

.empty-state {
  padding: 20px 0;
}

/* 本次提交流程时间线 */
.flow-timeline {
  padding: 20px 0;
}

.flow-node {
  display: flex;
  gap: 16px;
  position: relative;
}

.node-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
  z-index: 2;
}

.node-icon .el-icon {
  font-size: 20px;
  color: #fff;
}

.submit-icon {
  background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
}

.pending-icon {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
}

.notify-icon {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
}

.node-icon.is-completed::after {
  content: '';
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 16px;
  height: 16px;
  background: #10b981;
  border: 2px solid #fff;
  border-radius: 50%;
}

.node-content {
  flex: 1;
  padding-bottom: 24px;
}

.node-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-main, #1e293b);
  margin-bottom: 6px;
}

.node-user {
  font-size: 13px;
  color: var(--text-regular, #475569);
  margin-bottom: 4px;
}

.node-time {
  font-size: 12px;
  color: var(--text-placeholder, #94a3b8);
  margin-bottom: 12px;
}

.node-desc {
  font-size: 13px;
  color: var(--text-secondary, #64748b);
}

.pending-notice {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #fef3c7;
  border-radius: 4px;
  font-size: 13px;
  color: #92400e;
  margin-bottom: 12px;
}

.pending-notice .el-icon {
  font-size: 14px;
}

.indicators-collapse {
  border: none;
  margin-top: 8px;
}

.indicators-collapse :deep(.el-collapse-item__header) {
  background: var(--bg-page, #f8fafc);
  border: 1px solid var(--border-color, #e2e8f0);
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--color-primary, #2c5282);
  height: auto;
  line-height: 1.5;
}

.indicators-collapse :deep(.el-collapse-item__wrap) {
  border: none;
  background: transparent;
}

.indicators-collapse :deep(.el-collapse-item__content) {
  padding: 12px 0 0 0;
}

.indicators-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.indicator-detail-item {
  background: var(--bg-page, #f8fafc);
  padding: 12px;
  border-radius: 6px;
  border-left: 3px solid var(--color-primary, #2c5282);
}

.detail-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-main, #1e293b);
  margin-bottom: 8px;
}

.detail-name .el-icon {
  color: var(--color-primary, #2c5282);
  font-size: 14px;
}

.detail-progress {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  margin-bottom: 6px;
}

.detail-progress .from {
  color: var(--text-placeholder, #94a3b8);
}

.detail-progress .arrow {
  color: var(--text-placeholder, #94a3b8);
  font-size: 12px;
}

.detail-progress .to {
  color: var(--color-primary, #2c5282);
  font-weight: 600;
}

.detail-remark {
  font-size: 12px;
  color: var(--text-secondary, #64748b);
  line-height: 1.5;
  padding: 8px;
  background: var(--bg-white, #fff);
  border-radius: 4px;
}

.flow-line {
  position: absolute;
  left: 23px;
  top: 48px;
  bottom: -24px;
  width: 2px;
  background: var(--border-color, #e2e8f0);
  z-index: 1;
}

.flow-line.dashed {
  background: repeating-linear-gradient(
    to bottom,
    var(--border-color, #e2e8f0) 0px,
    var(--border-color, #e2e8f0) 4px,
    transparent 4px,
    transparent 8px
  );
}

/* 历史记录流程时间线列表 */
.history-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.history-batch {
  background: var(--bg-white, #fff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 8px;
  padding: 16px;
  transition: all 0.3s;
}

.history-batch:hover {
  border-color: var(--color-primary, #2c5282);
  box-shadow: 0 2px 8px rgba(44, 82, 130, 0.1);
}

.batch-time-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}

.batch-time-label span {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-main, #1e293b);
}

.submitters-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.submitter-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.node-dept {
  font-size: 12px;
  color: var(--text-secondary, #64748b);
  margin-bottom: 4px;
}

.node-dept::before {
  content: '·';
  margin-right: 4px;
}

.status-tag {
  margin-left: 8px;
}

.approve-icon {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.reject-icon {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}

.detail-task {
  font-size: 12px;
  color: var(--text-secondary, #64748b);
  margin-bottom: 6px;
}

.drawer-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-top: 1px solid var(--border-color, #e2e8f0);
}

.footer-info {
  font-size: 13px;
  color: var(--text-secondary, #64748b);
}

/* 滚动条样式 */
.drawer-content::-webkit-scrollbar {
  width: 6px;
}

.drawer-content::-webkit-scrollbar-track {
  background: transparent;
}

.drawer-content::-webkit-scrollbar-thumb {
  background: var(--border-light, #e2e8f0);
  border-radius: 3px;
}

.drawer-content::-webkit-scrollbar-thumb:hover {
  background: var(--border-color, #cbd5e1);
}
</style>
