<template>
  <div class="message-list">
    <div v-if="messages.length === 0" class="empty-state">
      <el-empty description="暂无消息" />
    </div>

    <div v-else class="messages">
      <div
        v-for="message in messages"
        :key="message.id"
        :class="['message-item', { 'unread': !message.isRead }]"
        @click="handleMessageClick(message)"
      >
        <!-- 未读消息左侧彩色标记条 -->
        <div v-if="!message.isRead" class="unread-indicator" :class="getIndicatorClass(message.type)"></div>
        
        <div class="message-body">
          <div class="message-header">
            <div class="message-type">
              <el-tag
                :type="getMessageTypeTag(message.type)"
                size="small"
              >
                {{ getMessageTypeLabel(message.type) }}
              </el-tag>
              <el-tag
                v-if="message.severity"
                :type="getSeverityTag(message.severity)"
                size="small"
                class="severity-tag"
              >
                {{ getSeverityLabel(message.severity) }}
              </el-tag>
            </div>
            <div class="message-time">
              <!-- 使用相对时间显示 -->
              <el-tooltip :content="formatDateTime(message.createdAt)" placement="top">
                <span>{{ getRelativeTime(message.createdAt) }}</span>
              </el-tooltip>
            </div>
          </div>

          <div class="message-title">
            {{ message.title }}
          </div>

          <div class="message-content">
            {{ message.content }}
          </div>

          <div class="message-actions">
            <el-button
              v-if="!message.isRead"
              type="primary"
              size="small"
              @click.stop="markAsRead(message.id)"
            >
              标为已读
            </el-button>
            <el-button
              size="small"
              @click.stop="viewDetails(message)"
            >
              查看详情
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'
import { formatDateTime } from '@/utils'
import type { Message, MessageType, AlertLevel } from '@/types'

interface Props {
  messages: Message[]
}

interface Emits {
  (e: 'read', messageId: string): void
  (e: 'view', message: Message): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const getMessageTypeTag = (type: MessageType): string => {
  const tags: Record<MessageType, string> = {
    alert: 'danger',
    approval: 'warning',
    system: 'info'
  }
  return tags[type]
}

const getMessageTypeLabel = (type: MessageType): string => {
  const labels: Record<MessageType, string> = {
    alert: '预警',
    approval: '审批',
    system: '系统'
  }
  return labels[type]
}

const getSeverityTag = (severity: AlertLevel): string => {
  const tags: Record<AlertLevel, string> = {
    severe: 'danger',
    moderate: 'warning',
    normal: 'success'
  }
  return tags[severity]
}

const getSeverityLabel = (severity: AlertLevel): string => {
  const labels: Record<AlertLevel, string> = {
    severe: '严重',
    moderate: '一般',
    normal: '正常'
  }
  return labels[severity]
}

// 获取未读指示器颜色类
const getIndicatorClass = (type: MessageType): string => {
  const classes: Record<MessageType, string> = {
    alert: 'indicator-danger',
    approval: 'indicator-warning',
    system: 'indicator-info'
  }
  return classes[type]
}

// 相对时间显示
const getRelativeTime = (date: Date): string => {
  const now = new Date()
  const diff = now.getTime() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  if (days < 30) return `${Math.floor(days / 7)}周前`
  return formatDateTime(date)
}

const handleMessageClick = (message: Message) => {
  if (!message.isRead) {
    markAsRead(message.id)
  }
  viewDetails(message)
}

const markAsRead = (messageId: string) => {
  emit('read', messageId)
}

const viewDetails = (message: Message) => {
  emit('view', message)
}
</script>

<style scoped>
/* ========================================
   MessageList 统一样式
   使用 colors.css 中定义的 CSS 变量
   Requirements: 2.1, 5.1, 9.1
   ======================================== */

.message-list {
  min-height: 300px;
}

/* ========================================
   空状态样式 - 统一空状态规范
   Requirements: 7.1, 7.2, 7.3
   ======================================== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: calc(var(--spacing-2xl) * 2);
  color: var(--text-secondary);
}

/* ========================================
   消息列表样式 - 统一列表规范
   Requirements: 2.1, 3.3
   ======================================== */
.messages {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

/* ========================================
   消息项样式 - 统一卡片规范
   Requirements: 2.1, 2.2, 2.3
   ======================================== */
.message-item {
  display: flex;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-normal);
  background: var(--bg-white);
  overflow: hidden;
}

.message-item:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-hover);
  transform: translateX(4px);
}

.message-item.unread {
  background: var(--bg-light);
}

/* ========================================
   未读消息指示器 - 统一状态色规范
   Requirements: 1.3
   ======================================== */
.unread-indicator {
  width: 4px;
  flex-shrink: 0;
  transition: width var(--transition-fast);
}

.indicator-danger {
  background: linear-gradient(180deg, var(--color-danger) 0%, var(--color-danger-soft) 100%);
}

.indicator-warning {
  background: linear-gradient(180deg, var(--color-warning) 0%, #f0c78a 100%);
}

.indicator-info {
  background: linear-gradient(180deg, var(--color-primary) 0%, #79bbff 100%);
}

.message-item:hover .unread-indicator {
  width: 6px;
}

/* ========================================
   消息内容区域 - 统一间距规范
   Requirements: 3.1, 3.3
   ======================================== */
.message-body {
  flex: 1;
  padding: var(--spacing-lg);
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-sm);
}

/* ========================================
   标签样式 - 统一标签规范
   Requirements: 9.1, 9.2, 9.3
   ======================================== */
.message-type {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
}

.severity-tag {
  margin-left: var(--spacing-xs);
}

/* ========================================
   消息时间样式 - 统一字体规范
   Requirements: 1.4
   ======================================== */
.message-time {
  font-size: 12px;
  color: var(--text-secondary);
  cursor: help;
}

/* ========================================
   消息标题和内容 - 统一字体规范
   Requirements: 1.4, 3.3
   ======================================== */
.message-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: var(--spacing-sm);
}

.message-content {
  font-size: 14px;
  color: var(--text-regular);
  line-height: 1.5;
  margin-bottom: var(--spacing-md);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ========================================
   操作按钮区域 - 统一按钮规范
   Requirements: 6.1
   ======================================== */
.message-actions {
  display: flex;
  gap: var(--spacing-sm);
}

/* 按钮过渡效果 */
.message-actions :deep(.el-button) {
  transition: all var(--transition-fast);
}

.message-actions :deep(.el-button:active) {
  transform: scale(0.96);
}
</style>