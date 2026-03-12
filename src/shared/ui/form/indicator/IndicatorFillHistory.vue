<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElTimeline, ElTimelineItem, ElTag, ElEmpty, ElCard, ElButton, ElIcon } from 'element-plus'
import { Check, Close, Clock, Document, Picture, Download } from '@element-plus/icons-vue'
import type { IndicatorFill } from '@/types'
import { usePlanStore } from '@/features/plan/model/store'
import { logger } from '@/utils/logger'

/**
 * 指标填报历史组件
 *
 * 展示某个指标的所有填报记录，包括：
 * - 填报日期
 * - 进度值
 * - 填报说明/批注
 * - 附件列表
 * - 审核状态
 * - 审核意见
 */

const props = defineProps<{
  indicatorId: number | string
}>()

const emit = defineEmits<{
  (e: 'select', fill: IndicatorFill): void
  (e: 'close'): void
}>()

const planStore = usePlanStore()

// 状态
const loading = ref(false)
const fills = ref<IndicatorFill[]>([])

// 获取填报历史
const loadHistory = async () => {
  loading.value = true
  try {
    logger.info(`[IndicatorFillHistory] Loading history for indicator ${props.indicatorId}`)
    const history = await planStore.loadIndicatorFillHistory(props.indicatorId)
    fills.value = history
  } catch (err) {
    logger.error('[IndicatorFillHistory] Failed to load history:', err)
  } finally {
    loading.value = false
  }
}

// 排序后的历史记录（最新的在前）
const sortedFills = computed(() => {
  return [...fills.value].sort((a, b) => {
    return new Date(b.fill_date).getTime() - new Date(a.fill_date).getTime()
  })
})

// 获取状态图标
const getStatusIcon = (status?: string) => {
  switch (status) {
    case 'approved': return Check
    case 'rejected': return Close
    case 'submitted': return Clock
    default: return Document
  }
}

// 获取状态类型
const getStatusType = (status?: string) => {
  switch (status) {
    case 'approved': return 'success'
    case 'rejected': return 'danger'
    case 'submitted': return 'warning'
    default: return 'info'
  }
}

// 获取状态标签
const getStatusLabel = (status?: string) => {
  switch (status) {
    case 'approved': return '已通过'
    case 'rejected': return '已驳回'
    case 'submitted': return '待审核'
    default: return '草稿'
  }
}

// 格式化日期
const formatDate = (dateStr: string) => {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 格式化时间
const formatDateTime = (dateStr: string) => {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// 选择某条填报记录
const selectFill = (fill: IndicatorFill) => {
  emit('select', fill)
}

// 初始化
onMounted(() => {
  loadHistory()
})

// 监听 indicatorId 变化
watch(() => props.indicatorId, () => {
  loadHistory()
})
</script>

<template>
  <div class="indicator-fill-history">
    <div v-if="loading" class="loading-container">
      <el-skeleton :rows="3" animated />
    </div>

    <div v-else-if="sortedFills.length === 0" class="empty-container">
      <el-empty description="暂无填报记录" :image-size="80">
        <template #description>
          <p class="empty-text">该指标还没有填报记录</p>
        </template>
      </el-empty>
    </div>

    <el-timeline v-else>
      <el-timeline-item
        v-for="fill in sortedFills"
        :key="fill.id"
        :type="getStatusType(fill.status)"
        :icon="getStatusIcon(fill.status)"
        :timestamp="formatDateTime(fill.created_at)"
        placement="top"
      >
        <el-card class="fill-card" shadow="hover" @click="selectFill(fill)">
          <div class="fill-header">
            <div class="fill-progress">
              <span class="progress-label">进度</span>
              <span class="progress-value">{{ fill.progress }}%</span>
            </div>
            <el-tag
              v-if="fill.status"
              :type="getStatusType(fill.status)"
              size="small"
              effect="light"
            >
              {{ getStatusLabel(fill.status) }}
            </el-tag>
          </div>

          <div v-if="fill.content" class="fill-content">
            <p class="content-text">{{ fill.content }}</p>
          </div>

          <!-- 关联的里程碑 -->
          <div v-if="fill.milestone_name" class="fill-milestone">
            <el-tag size="small" type="info" effect="plain">
              里程碑: {{ fill.milestone_name }}
            </el-tag>
          </div>

          <!-- 附件列表 -->
          <div v-if="fill.attachments && fill.attachments.length > 0" class="fill-attachments">
            <div class="attachments-label">
              <el-icon><Picture /></el-icon>
              <span>附件 ({{ fill.attachments.length }})</span>
            </div>
            <div class="attachments-list">
              <div
                v-for="(attachment, idx) in fill.attachments"
                :key="idx"
                class="attachment-item"
              >
                <el-icon class="attachment-icon"><Document /></el-icon>
                <span class="attachment-name">{{ attachment.name }}</span>
                <el-button
                  type="primary"
                  link
                  size="small"
                  @click.stop
                >
                  <el-icon><Download /></el-icon>
                </el-button>
              </div>
            </div>
          </div>

          <!-- 审核信息 -->
          <div v-if="fill.status && fill.status !== 'submitted'" class="fill-audit">
            <div class="audit-info">
              <span class="audit-label">{{ fill.status === 'approved' ? '审核人' : '驳回人' }}:</span>
              <span class="audit-value">{{ fill.audited_by || '-' }}</span>
              <span class="audit-time">{{ formatDate(fill.audited_at || '') }}</span>
            </div>
            <div v-if="fill.audit_comment" class="audit-comment">
              <span class="comment-label">审核意见:</span>
              <p class="comment-text">{{ fill.audit_comment }}</p>
            </div>
          </div>

          <!-- 填报人信息 -->
          <div class="fill-footer">
            <span class="fill-author">填报人: {{ fill.filled_by_name }}</span>
            <span class="fill-date">{{ formatDate(fill.fill_date) }}</span>
          </div>
        </el-card>
      </el-timeline-item>
    </el-timeline>
  </div>
</template>

<script lang="ts">
import { watch } from 'vue'
</script>

<style scoped>
.indicator-fill-history {
  padding: 16px 0;
  min-height: 200px;
}

.loading-container {
  padding: 20px;
}

.empty-container {
  padding: 40px 20px;
}

.empty-text {
  color: var(--el-text-color-secondary);
  font-size: 14px;
  margin-top: 8px;
}

.fill-card {
  cursor: pointer;
  transition: all 0.2s;
}

.fill-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--el-box-shadow-light);
}

.fill-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.fill-progress {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.progress-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--el-color-primary);
}

.fill-content {
  margin-bottom: 12px;
  padding: 8px 12px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}

.content-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
  white-space: pre-wrap;
  word-break: break-word;
}

.fill-milestone {
  margin-bottom: 12px;
}

.fill-attachments {
  margin-bottom: 12px;
  padding: 8px 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
}

.attachments-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}

.attachments-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.attachment-icon {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.attachment-name {
  flex: 1;
  font-size: 13px;
  color: var(--el-text-color-regular);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fill-audit {
  margin-bottom: 12px;
  padding: 8px 12px;
  background: v-bind('fill.status === "approved" ? "var(--el-color-success-light-9)" : "var(--el-color-danger-light-9)"');
  border-radius: 6px;
  border-left: 3px solid v-bind('fill.status === "approved" ? "var(--el-color-success)" : "var(--el-color-danger)"');
}

.audit-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  margin-bottom: 8px;
}

.audit-label {
  color: var(--el-text-color-secondary);
}

.audit-value {
  font-weight: 500;
  color: var(--el-text-color-regular);
}

.audit-time {
  margin-left: auto;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.audit-comment {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.comment-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.comment-text {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.5;
}

.fill-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 8px;
  border-top: 1px solid var(--el-border-color-light);
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

:deep(.el-timeline-item__timestamp) {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

:deep(.el-timeline-item__icon) {
  background: var(--el-bg-color);
}
</style>
