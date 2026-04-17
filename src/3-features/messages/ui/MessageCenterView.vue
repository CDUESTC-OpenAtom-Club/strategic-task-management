<template>
  <div class="message-center">
    <!-- 页面头部 - Requirements: 5.1, 5.2, 5.3, 5.4 -->
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">消息中心</h1>
        <p class="page-desc">查看和管理您的所有通知消息</p>
      </div>
      <div class="page-actions">
        <el-button type="primary" plain @click="goToWorkflowTasks"> 进入待办中心 </el-button>
        <el-button type="primary" @click="markAllAsRead"> 全部标为已读 </el-button>
        <el-button @click="clearReadMessages"> 清除已读 </el-button>
      </div>
    </div>

    <!-- 消息内容卡片 - Requirements: 2.1, 2.2 -->
    <el-card class="message-card card-animate" shadow="never">
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
          <transition name="tab-fade" mode="out-in">
            <MessageList
              v-if="activeTab === 'all'"
              :messages="allMessages"
              @read="handleMessageRead"
              @view="handleMessageView"
            />
          </transition>
        </el-tab-pane>
        <el-tab-pane name="reminders">
          <template #label>
            <span class="tab-label">
              催办通知
              <el-badge
                v-if="unreadCount.reminders > 0"
                :value="unreadCount.reminders"
                :max="99"
                class="tab-badge"
                type="primary"
              />
            </span>
          </template>
          <transition name="tab-fade" mode="out-in">
            <MessageList
              v-if="activeTab === 'reminders'"
              :messages="reminderMessages"
              @read="handleMessageRead"
              @view="handleMessageView"
            />
          </transition>
        </el-tab-pane>
        <el-tab-pane name="alerts">
          <template #label>
            <span class="tab-label">
              预警通知
              <el-badge
                v-if="unreadCount.alerts > 0"
                :value="unreadCount.alerts"
                :max="99"
                class="tab-badge"
                type="danger"
              />
            </span>
          </template>
          <transition name="tab-fade" mode="out-in">
            <MessageList
              v-if="activeTab === 'alerts'"
              :messages="alertMessages"
              @read="handleMessageRead"
              @view="handleMessageView"
            />
          </transition>
        </el-tab-pane>
        <el-tab-pane name="approvals">
          <template #label>
            <span class="tab-label">
              审批通知
              <el-badge
                v-if="unreadCount.approvals > 0"
                :value="unreadCount.approvals"
                :max="99"
                class="tab-badge"
                type="warning"
              />
            </span>
          </template>
          <transition name="tab-fade" mode="out-in">
            <MessageList
              v-if="activeTab === 'approvals'"
              :messages="approvalMessages"
              @read="handleMessageRead"
              @view="handleMessageView"
            />
          </transition>
        </el-tab-pane>
        <el-tab-pane name="system">
          <template #label>
            <span class="tab-label">
              系统通知
              <el-badge
                v-if="unreadCount.system > 0"
                :value="unreadCount.system"
                :max="99"
                class="tab-badge"
                type="info"
              />
            </span>
          </template>
          <transition name="tab-fade" mode="out-in">
            <MessageList
              v-if="activeTab === 'system'"
              :messages="systemMessages"
              @read="handleMessageRead"
              @view="handleMessageView"
            />
          </transition>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import MessageList from '@/shared/ui/message/MessageList.vue'
import { useApprovalCenter } from '@/features/approval'
import { useMessageStore } from '@/features/messages/model/message'
import type { Message } from '@/shared/types'

const router = useRouter()

// 使用消息 Store
const messageStore = useMessageStore()
const { openApprovalCenter } = useApprovalCenter()

const activeTab = ref('all')

// 从 store 获取消息数据
const allMessages = computed(() => messageStore.visibleMessages)
const reminderMessages = computed(() => messageStore.reminderMessages)
const alertMessages = computed(() => messageStore.alertMessages)
const approvalMessages = computed(() => messageStore.approvalMessages)
const systemMessages = computed(() => messageStore.systemMessages)

// 未读消息计数
const unreadCount = computed(() => messageStore.unreadCount)

const handleMessageRead = (messageId: string) => {
  messageStore.markAsRead(messageId)
}

const handleMessageView = (message: Message) => {
  if (message.type === 'approval') {
    openApprovalCenter()
  }
}

const markAllAsRead = () => {
  messageStore.markAllAsRead()
  ElMessage.success('已将所有消息标为已读')
}

const clearReadMessages = () => {
  const unread = messageStore.unreadCount.all
  const total = messageStore.visibleMessages.length

  if (unread === total) {
    ElMessage.warning('没有已读消息可清理')
    return
  }

  messageStore.clearReadMessages()
  ElMessage.success('已清除所有已读消息')
}

const goToWorkflowTasks = () => {
  router.push('/workflow-tasks')
}

onMounted(() => {
  void messageStore.fetchMessages()
})
</script>

<style scoped>
/* ========================================
   MessageCenterView 统一样式
   使用 colors.css 中定义的 CSS 变量
   Requirements: 2.1, 5.1, 9.1
   ======================================== */

/* 页面主容器 - 使用统一的页面容器样式 */
.message-center {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2xl);
}

/* ========================================
   页面头部样式 - 统一页面头部规范
   Requirements: 5.1, 5.2, 5.3, 5.4
   ======================================== */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-md);
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
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
  gap: var(--spacing-md);
}

/* ========================================
   消息卡片样式 - 统一卡片规范
   Requirements: 2.1, 2.2, 2.4
   ======================================== */
.message-card {
  background: var(--bg-white);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-card);
  transition: box-shadow var(--transition-normal);
  min-height: 500px;
}

.message-card:hover {
  box-shadow: var(--shadow-hover);
}

/* ========================================
   Tab 样式定制 - 统一 Tab 规范
   Requirements: 5.1, 9.1
   ======================================== */
.message-tabs :deep(.el-tabs__header) {
  margin-bottom: var(--spacing-xl);
  border-bottom: 1px solid var(--border-light);
}

.message-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.message-tabs :deep(.el-tabs__item) {
  font-size: 15px;
  padding: 0 var(--spacing-xl);
  height: 48px;
  line-height: 48px;
  color: var(--text-regular);
  transition: all var(--transition-fast);
}

.message-tabs :deep(.el-tabs__item:hover) {
  color: var(--color-primary);
}

.message-tabs :deep(.el-tabs__item.is-active) {
  color: var(--color-primary);
  font-weight: 600;
}

.message-tabs :deep(.el-tabs__active-bar) {
  height: 3px;
  border-radius: 2px;
  background-color: var(--color-primary);
  transition: transform var(--transition-normal);
}

/* Tab 标签样式 - Requirements: 9.1, 9.3 */
.tab-label {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.tab-badge {
  margin-left: var(--spacing-xs);
}

.tab-badge :deep(.el-badge__content) {
  font-size: 10px;
  height: 16px;
  line-height: 16px;
  padding: 0 5px;
  border-radius: var(--radius-sm);
}

/* ========================================
   Tab 切换过渡动画 - 统一过渡动画规范
   Requirements: 6.1
   ======================================== */
.tab-fade-enter-active,
.tab-fade-leave-active {
  transition: all var(--transition-normal);
}

.tab-fade-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.tab-fade-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* ========================================
   卡片入场动画 - 统一动画规范
   Requirements: 6.1
   ======================================== */
.card-animate {
  animation: fadeInUp 0.4s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ========================================
   按钮过渡效果 - 统一过渡动画规范
   Requirements: 6.1
   ======================================== */
:deep(.el-button) {
  transition: all var(--transition-fast);
}

:deep(.el-button:active) {
  transform: scale(0.96);
}
</style>
