<script setup lang="ts">
import { computed } from 'vue'
import { Check, Close, Loading, Clock } from '@element-plus/icons-vue'
import type { WorkflowNode } from '@/types'

const props = defineProps<{
  nodes: WorkflowNode[]
  currentNodeId?: string
  rejectionReason?: string
}>()

const getNodeIcon = (status: WorkflowNode['status']) => {
  switch (status) {
    case 'completed': return Check
    case 'current': return Loading
    case 'rejected': return Close
    default: return Clock
  }
}

const getNodeClass = (status: WorkflowNode['status']) => {
  return `node-${status}`
}

const formatTime = (date?: Date) => {
  if (!date) return ''
  const d = new Date(date)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

const hasRejection = computed(() => props.nodes.some(n => n.status === 'rejected'))
</script>

<template>
  <div class="approval-workflow">
    <el-steps :active="nodes.findIndex(n => n.status === 'current')" finish-status="success" align-center>
      <el-step 
        v-for="node in nodes" 
        :key="node.id"
        :title="node.name"
        :status="node.status === 'rejected' ? 'error' : node.status === 'completed' ? 'success' : node.status === 'current' ? 'process' : 'wait'"
      >
        <template #description>
          <div class="node-desc">
            <span v-if="node.operatorName" class="operator">{{ node.operatorName }}</span>
            <span v-if="node.operateTime" class="time">{{ formatTime(node.operateTime) }}</span>
            <span v-if="node.comment" class="comment">{{ node.comment }}</span>
          </div>
        </template>
      </el-step>
    </el-steps>
    
    <!-- 驳回原因提示 -->
    <el-alert 
      v-if="hasRejection && rejectionReason" 
      type="error" 
      :title="'驳回原因：' + rejectionReason"
      show-icon
      :closable="false"
      class="rejection-alert"
    />
  </div>
</template>

<style scoped>
.approval-workflow {
  padding: 16px 0;
}

.node-desc {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.operator {
  color: var(--text-main);
}

.time {
  color: var(--text-muted);
}

.comment {
  color: var(--text-secondary);
  font-style: italic;
}

.rejection-alert {
  margin-top: 16px;
}
</style>
