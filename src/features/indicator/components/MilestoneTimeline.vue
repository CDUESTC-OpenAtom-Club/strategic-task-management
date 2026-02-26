<script setup lang="ts">
import { computed } from 'vue'
import { Check, Clock, Warning } from '@element-plus/icons-vue'
import type { Milestone } from '@/types'

const props = defineProps<{
  milestones: Milestone[]
  currentDate?: Date
}>()

const now = computed(() => props.currentDate || new Date())

const sortedMilestones = computed(() => 
  [...props.milestones].sort((a, b) => 
    new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
  )
)

const getStatusIcon = (status: Milestone['status']) => {
  switch (status) {
    case 'completed': return Check
    case 'overdue': return Warning
    default: return Clock
  }
}

const getStatusType = (status: Milestone['status']) => {
  switch (status) {
    case 'completed': return 'success'
    case 'overdue': return 'danger'
    default: return 'primary'
  }
}

const getStatusLabel = (status: Milestone['status']) => {
  switch (status) {
    case 'completed': return '已完成'
    case 'overdue': return '已逾期'
    default: return '进行中'
  }
}

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const getDaysRemaining = (deadline: string) => {
  const deadlineDate = new Date(deadline)
  const diff = deadlineDate.getTime() - now.value.getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  if (days < 0) return `已逾期 ${Math.abs(days)} 天`
  if (days === 0) return '今日截止'
  return `剩余 ${days} 天`
}
</script>

<template>
  <div class="milestone-timeline">
    <el-timeline>
      <el-timeline-item
        v-for="milestone in sortedMilestones"
        :key="milestone.id"
        :type="getStatusType(milestone.status)"
        :icon="getStatusIcon(milestone.status)"
        :hollow="milestone.status === 'pending'"
      >
        <div class="milestone-item">
          <div class="milestone-header">
            <span class="milestone-name">{{ milestone.name }}</span>
            <el-tag :type="getStatusType(milestone.status)" size="small" effect="light">
              {{ getStatusLabel(milestone.status) }}
            </el-tag>
          </div>
          <div class="milestone-meta">
            <span class="deadline">截止: {{ formatDate(milestone.deadline) }}</span>
            <span 
              v-if="milestone.status !== 'completed'" 
              class="remaining"
              :class="{ 'is-overdue': milestone.status === 'overdue' }"
            >
              {{ getDaysRemaining(milestone.deadline) }}
            </span>
          </div>
          <el-progress 
            :percentage="milestone.targetProgress" 
            :status="milestone.status === 'completed' ? 'success' : milestone.status === 'overdue' ? 'exception' : ''"
            :stroke-width="6"
            class="milestone-progress"
          />
        </div>
      </el-timeline-item>
    </el-timeline>
    
    <el-empty v-if="sortedMilestones.length === 0" description="暂无里程碑" :image-size="60" />
  </div>
</template>

<style scoped>
.milestone-timeline {
  padding: 8px 0;
}

.milestone-item {
  padding: 12px;
  background: var(--bg-light);
  border-radius: 8px;
}

.milestone-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.milestone-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-main);
}

.milestone-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.remaining {
  color: var(--color-primary);
}

.remaining.is-overdue {
  color: var(--color-danger);
  font-weight: 500;
}

.milestone-progress {
  margin-top: 4px;
}

:deep(.el-progress-bar__outer) {
  border-radius: 3px;
}

:deep(.el-progress-bar__inner) {
  border-radius: 3px;
}
</style>
