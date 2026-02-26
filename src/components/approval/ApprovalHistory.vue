<script setup lang="ts">
import { computed } from 'vue'
import { Check, Close, Upload, RefreshLeft } from '@element-plus/icons-vue'
import type { ApprovalHistoryItem } from '@/types'

const props = defineProps<{
  history: ApprovalHistoryItem[]
}>()

const sortedHistory = computed(() => 
  [...props.history].sort((a, b) => 
    new Date(b.operateTime).getTime() - new Date(a.operateTime).getTime()
  )
)

const getActionIcon = (action: ApprovalHistoryItem['action']) => {
  switch (action) {
    case 'approve': return Check
    case 'reject': return Close
    case 'submit': return Upload
    case 'withdraw': return RefreshLeft
    default: return Check
  }
}

const getActionType = (action: ApprovalHistoryItem['action']) => {
  switch (action) {
    case 'approve': return 'success'
    case 'reject': return 'danger'
    case 'submit': return 'primary'
    case 'withdraw': return 'warning'
    default: return 'info'
  }
}

const getActionLabel = (action: ApprovalHistoryItem['action']) => {
  switch (action) {
    case 'approve': return '审批通过'
    case 'reject': return '审批驳回'
    case 'submit': return '提交审批'
    case 'withdraw': return '撤回申请'
    default: return action
  }
}

const formatTime = (date: Date) => {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<template>
  <div class="approval-history">
    <el-timeline>
      <el-timeline-item
        v-for="item in sortedHistory"
        :key="item.id"
        :type="getActionType(item.action)"
        :icon="getActionIcon(item.action)"
        :timestamp="formatTime(item.operateTime)"
        placement="top"
      >
        <div class="history-item">
          <div class="history-header">
            <el-tag :type="getActionType(item.action)" size="small" effect="light">
              {{ getActionLabel(item.action) }}
            </el-tag>
            <span class="operator-name">{{ item.operatorName }}</span>
          </div>
          <p v-if="item.comment" class="history-comment">{{ item.comment }}</p>
        </div>
      </el-timeline-item>
    </el-timeline>
    
    <el-empty v-if="sortedHistory.length === 0" description="暂无审批记录" :image-size="60" />
  </div>
</template>

<style scoped>
.approval-history {
  padding: 8px 0;
}

.history-item {
  padding: 8px 12px;
  background: var(--bg-light);
  border-radius: 8px;
}

.history-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.operator-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-main);
}

.history-comment {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

:deep(.el-timeline-item__timestamp) {
  font-size: 12px;
}
</style>
