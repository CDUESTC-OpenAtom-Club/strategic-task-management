<template>
  <div class="message-center">
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">消息中心</h1>
        <p class="page-desc">查看和管理与您相关的待处理事项和通知消息</p>
      </div>
      <div class="page-actions">
        <el-button :loading="messageStore.loading" @click="refreshData"> 刷新 </el-button>
        <el-button
          type="primary"
          plain
          :disabled="!messageStore.hasUnreadMarkableMessages"
          @click="markAllAsRead"
        >
          全部标为已读
        </el-button>
        <el-button :disabled="!messageStore.hasReadMarkableMessages" @click="clearReadMessages">
          清除已读
        </el-button>
      </div>
    </div>

    <el-alert
      v-if="messageStore.error"
      type="error"
      show-icon
      :closable="false"
      class="message-error"
      :title="messageStore.error"
      description="消息中心未再使用 mock 数据兜底，你可以点击刷新重新加载真实数据。"
    />

    <div class="summary-grid">
      <el-card v-for="card in summaryCards" :key="card.key" shadow="never" class="summary-card">
        <div class="summary-label">{{ card.label }}</div>
        <div class="summary-value">{{ card.value }}</div>
        <div class="summary-hint">{{ card.hint }}</div>
      </el-card>
    </div>

    <el-card class="message-card" shadow="never">
      <el-tabs v-model="activeTab" class="message-tabs">
        <el-tab-pane name="all">
          <template #label>
            <span class="tab-label">
              全部消息
              <el-badge
                v-if="unreadCount.all > 0"
                :value="unreadCount.all"
                :max="99"
                class="tab-badge"
              />
            </span>
          </template>
          <div v-if="activeTab === 'all'" class="message-panel">
            <div class="message-subfilters">
              <el-segmented v-model="activeTypeFilter" :options="typeFilterOptions" />
            </div>
            <MessageList
              :messages="filteredMessages"
              :empty-description="getEmptyDescription()"
              @read="handleMessageRead"
              @view="handleMessageView"
            />
          </div>
        </el-tab-pane>

        <el-tab-pane name="todo">
          <template #label>
            <span class="tab-label">
              待处理
              <el-badge
                v-if="unreadCount.todo > 0"
                :value="unreadCount.todo"
                :max="99"
                class="tab-badge"
                type="warning"
              />
            </span>
          </template>
          <div v-if="activeTab === 'todo'" class="message-panel">
            <div class="message-subfilters">
              <el-segmented v-model="activeTypeFilter" :options="typeFilterOptions" />
            </div>
            <MessageList
              :messages="filteredMessages"
              :empty-description="getEmptyDescription()"
              @read="handleMessageRead"
              @view="handleMessageView"
            />
          </div>
        </el-tab-pane>

        <el-tab-pane name="processed">
          <template #label>
            <span class="tab-label">
              已处理
              <el-badge
                v-if="processedCount > 0"
                :value="processedCount"
                :max="99"
                class="tab-badge"
                type="success"
              />
            </span>
          </template>
          <div v-if="activeTab === 'processed'" class="message-panel">
            <div class="message-subfilters">
              <el-segmented v-model="activeTypeFilter" :options="typeFilterOptions" />
            </div>
            <MessageList
              :messages="filteredMessages"
              :empty-description="getEmptyDescription()"
              @read="handleMessageRead"
              @view="handleMessageView"
            />
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-drawer v-model="detailVisible" title="消息详情" size="480px" destroy-on-close>
      <div v-if="detailMessage" class="detail-content">
        <div class="detail-tags">
          <el-tag size="small">{{ detailMessage.title }}</el-tag>
          <el-tag v-if="detailMessage.senderDisplay" type="info" size="small">
            {{ detailMessage.senderDisplay }}
          </el-tag>
          <el-tag
            v-if="
              detailMessage.bizType === 'APPROVAL_TODO' && resolveApprovalDepartment(detailMessage)
            "
            type="success"
            size="small"
          >
            审批中部门：{{ resolveApprovalDepartment(detailMessage) }}
          </el-tag>
          <el-tag
            v-if="
              detailMessage.bizType === 'APPROVAL_TODO' &&
              resolveApprovalRouteDisplay(detailMessage)
            "
            type="primary"
            size="small"
          >
            {{ resolveApprovalRouteDisplay(detailMessage) }}
          </el-tag>
          <el-tag v-if="detailMessage.currentStepName" type="warning" size="small">
            {{ detailMessage.currentStepName }}
          </el-tag>
        </div>
        <div class="detail-time">{{ formatDateTime(detailMessage.createdAt) }}</div>
        <div class="detail-body">{{ detailMessage.detailContent || detailMessage.content }}</div>

        <div class="detail-actions">
          <el-button
            v-if="canHandleMessageAction(detailMessage)"
            type="primary"
            @click="handleDetailPrimaryAction"
          >
            {{ getMessagePrimaryActionLabel(detailMessage) }}
          </el-button>
          <el-button
            v-if="detailMessage.canMarkAsRead && !detailMessage.isRead"
            @click="handleMessageRead(detailMessage.id)"
          >
            标为已读
          </el-button>
        </div>
      </div>
      <el-skeleton v-else-if="messageStore.detailLoading" :rows="6" animated />
      <el-empty v-else description="暂无可展示的详情内容" />
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import MessageList from '@/shared/ui/message/MessageList.vue'
import { useMessageStore } from '@/features/messages/model/message'
import {
  requiresApprovalCenterFallback,
  resolveApprovalRoute
} from '@/features/approval/lib/approvalNotifications'
import { useApprovalCenter } from '@/features/approval'
import { useAuthStore } from '@/features/auth/model/store'
import type { Message } from '@/shared/types'
import { formatDateTime } from '@/shared/lib/utils'

const router = useRouter()
const authStore = useAuthStore()
const messageStore = useMessageStore()
const { openApprovalCenter } = useApprovalCenter()

const activeTab = ref('all')
const activeTypeFilter = ref<'all' | 'approval' | 'reminder' | 'system'>('all')
const detailVisible = ref(false)
const detailMessage = ref<Message | null>(null)

const allMessages = computed(() => messageStore.visibleMessages)
const todoMessages = computed(() => messageStore.todoMessages)
const reminderMessages = computed(() => messageStore.reminderMessages)
const approvalMessages = computed(() => messageStore.approvalMessages)
const systemMessages = computed(() => messageStore.systemMessages)
const unreadCount = computed(() => messageStore.unreadCount)
const processedMessages = computed(() =>
  allMessages.value.filter(
    message => !messageStore.todoMessages.some(item => item.id === message.id)
  )
)
const processedCount = computed(() => processedMessages.value.length)

const typeFilterOptions = [
  { label: '全部类型', value: 'all' },
  { label: '审批通知', value: 'approval' },
  { label: '催办通知', value: 'reminder' },
  { label: '系统通知', value: 'system' }
] as const

const currentPrimaryMessages = computed(() => {
  if (activeTab.value === 'todo') {
    return todoMessages.value
  }
  if (activeTab.value === 'processed') {
    return processedMessages.value
  }
  return allMessages.value
})

const filteredMessages = computed(() => {
  const base = currentPrimaryMessages.value
  switch (activeTypeFilter.value) {
    case 'approval':
      return base.filter(message => message.type === 'approval')
    case 'reminder':
      return base.filter(message => message.type === 'reminder')
    case 'system':
      return base.filter(message => message.type === 'system')
    default:
      return base
  }
})

const summaryCards = computed(() => {
  const cards = [
    {
      key: 'todo',
      label: '待处理',
      value: messageStore.summary.todoCount,
      hint: '当前仍需你处理的审批事项'
    },
    {
      key: 'approval',
      label: '审批通知',
      value: messageStore.summary.approvalCount,
      hint: '待处理和审批结果统一归口'
    },
    {
      key: 'reminder',
      label: '催办通知',
      value: messageStore.summary.reminderCount,
      hint: '仅统计未读催办消息'
    },
    {
      key: 'system',
      label: '系统通知',
      value: messageStore.summary.systemCount,
      hint: '仅统计未读系统与业务通知'
    }
  ]

  return cards
})

function getEmptyDescription(): string {
  const scopeLabel =
    activeTab.value === 'todo' ? '待处理' : activeTab.value === 'processed' ? '已处理' : '消息'
  const typeLabel =
    activeTypeFilter.value === 'approval'
      ? '审批通知'
      : activeTypeFilter.value === 'reminder'
        ? '催办通知'
        : activeTypeFilter.value === 'system'
          ? '系统通知'
          : ''

  return typeLabel ? `当前没有${scopeLabel}中的${typeLabel}` : `当前没有${scopeLabel}`
}

async function refreshData() {
  try {
    await messageStore.refreshMessageCenter()
  } catch {
    ElMessage.error(messageStore.error || '刷新失败，请稍后重试')
  }
}

async function handleMessageRead(messageId: string) {
  try {
    await messageStore.markAsRead(messageId)
    ElMessage.success('已标记为已读')
  } catch {
    ElMessage.error('标记已读失败，请稍后重试')
  }
}

function buildApprovalCenterContext(message: Message) {
  const workflowEntityType =
    message.entityType === 'PLAN_REPORT' || message.entityType === 'PLAN'
      ? message.entityType
      : undefined
  const workflowEntityId =
    message.entityId !== undefined && message.entityId !== null && String(message.entityId).trim()
      ? message.entityId
      : undefined

  return {
    workflowEntityType,
    workflowEntityId,
    approvalInstanceId: message.approvalInstanceId,
    departmentName: resolveApprovalDepartment(message),
    planName: message.title
  }
}

function getMessageMetadataValue(message: Message, key: string): string {
  const value = message.metadata?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

function resolveApprovalDepartment(message: Message): string {
  const sourceOrgName = getMessageMetadataValue(message, 'sourceOrgName')
  const targetOrgName = getMessageMetadataValue(message, 'targetOrgName')
  return targetOrgName || sourceOrgName || message.senderDisplay || ''
}

function resolveApprovalRouteDisplay(message: Message): string {
  const sourceOrgName = getMessageMetadataValue(message, 'sourceOrgName')
  const targetOrgName = getMessageMetadataValue(message, 'targetOrgName')

  if (sourceOrgName && targetOrgName) {
    return `${sourceOrgName} -> ${targetOrgName}`
  }

  return sourceOrgName || targetOrgName || ''
}

function buildApprovalPayload(message: Message) {
  return {
    approvalInstanceId: message.approvalInstanceId,
    entityType: message.entityType,
    entityId: message.entityId,
    actionUrl: message.actionUrl,
    viewerRole: authStore.effectiveRole || authStore.userRole,
    departmentName: resolveApprovalDepartment(message)
  }
}

function resolveMessageAction(
  message?: Message | null
): { mode: 'approval-center' } | { mode: 'route'; target: string } | { mode: 'none' } {
  if (!message) {
    return { mode: 'none' }
  }

  const approvalPayload = buildApprovalPayload(message)
  const isProcessAction = Boolean(message.canProcess) || message.bizType === 'APPROVAL_TODO'

  if (message.type === 'approval') {
    const approvalRoute = resolveApprovalRoute(approvalPayload)

    if (approvalRoute && isProcessAction) {
      return { mode: 'route', target: approvalRoute }
    }

    if (requiresApprovalCenterFallback(approvalPayload)) {
      return { mode: 'approval-center' }
    }

    if (approvalRoute) {
      return { mode: 'route', target: approvalRoute }
    }
  }

  if (message.actionUrl) {
    return { mode: 'route', target: message.actionUrl }
  }

  return { mode: 'none' }
}

function canHandleMessageAction(message?: Message | null): boolean {
  return resolveMessageAction(message).mode !== 'none'
}

function getMessagePrimaryActionLabel(message?: Message | null): string {
  if (!message) {
    return '查看关联内容'
  }

  const action = resolveMessageAction(message)
  if (action.mode === 'approval-center') {
    return message.canProcess || message.bizType === 'APPROVAL_TODO'
      ? '打开审批处理'
      : '打开关联审批'
  }

  if (action.mode === 'route') {
    return message.canProcess || message.bizType === 'APPROVAL_TODO' ? '立即处理' : '查看关联内容'
  }

  return '查看详情'
}

async function handleMessageView(message: Message) {
  if (message.canProcess || message.bizType === 'APPROVAL_TODO') {
    navigateByMessage(message)
    return
  }

  if (
    (!messageStore.capabilities.detailDrawerEnabled || message.canViewDetail === false) &&
    canHandleMessageAction(message)
  ) {
    navigateByMessage(message)
    return
  }

  detailVisible.value = true
  detailMessage.value = message
  try {
    detailMessage.value = await messageStore.fetchMessageDetail(message.id)
  } catch {
    ElMessage.warning('详情加载失败，已展示列表中的摘要内容')
  }
}

function handleDetailPrimaryAction() {
  if (!detailMessage.value) {
    return
  }

  navigateByMessage(detailMessage.value)
  detailVisible.value = false
}

function navigateByMessage(message: Message) {
  const action = resolveMessageAction(message)

  if (action.mode === 'approval-center') {
    openApprovalCenter(buildApprovalCenterContext(message))
    return
  }

  if (action.mode === 'route') {
    void router.push(action.target)
    return
  }
}

async function markAllAsRead() {
  if (!messageStore.hasUnreadMarkableMessages) {
    ElMessage.warning('暂无可标记为已读的消息')
    return
  }

  try {
    await messageStore.markAllAsRead()
    ElMessage.success('已将普通通知全部标为已读')
  } catch {
    ElMessage.error('全部标记已读失败，请稍后重试')
  }
}

function clearReadMessages() {
  if (!messageStore.hasReadMarkableMessages) {
    ElMessage.warning('暂无已读消息可清理')
    return
  }

  messageStore.clearReadMessages()
  ElMessage.success('已清除当前视图中的已读消息')
}

onMounted(() => {
  void refreshData()
})
</script>

<style scoped>
.message-center {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--text-main);
}

.page-desc {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.page-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.message-error {
  margin-bottom: -4px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.summary-card {
  border: 1px solid var(--border-color);
}

.summary-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.summary-value {
  margin: 8px 0 6px;
  font-size: 28px;
  font-weight: 700;
  color: var(--text-main);
}

.summary-hint {
  font-size: 12px;
  color: var(--text-secondary);
}

.message-card {
  border: 1px solid var(--border-color);
  border-radius: 16px;
}

.message-tabs :deep(.el-tabs__header) {
  margin-bottom: 20px;
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.tab-badge {
  margin-left: 2px;
}

.message-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.message-subfilters {
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.message-subfilters :deep(.el-segmented) {
  flex-wrap: wrap;
  max-width: 100%;
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.detail-time {
  font-size: 13px;
  color: var(--text-secondary);
}

.detail-body {
  white-space: pre-wrap;
  line-height: 1.7;
  color: var(--text-main);
}

.detail-actions {
  display: flex;
  gap: 12px;
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
  }

  .page-actions {
    width: 100%;
    flex-wrap: wrap;
  }
}
</style>
