<script setup lang="ts">
import { computed } from 'vue'
import { Check, Clock, Warning } from '@element-plus/icons-vue'
import type { Milestone, MilestoneUI } from '@/shared/types'
import { sortMilestonesByProgress } from '@/shared/lib/utils/milestoneSort'
import { resolveMilestoneDisplayState } from '@/shared/lib/utils/milestoneDisplay'

const props = defineProps<{
  milestones: Milestone[]
  currentProgress?: number
  currentDate?: Date
}>()

const now = computed(() => props.currentDate || new Date())

const sortedMilestones = computed(() => sortMilestonesByProgress(props.milestones || []))

const getDisplayState = (milestone: MilestoneUI) =>
  resolveMilestoneDisplayState(milestone, props.currentProgress, now.value)

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) {
    return dateStr || '-'
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const getRelativeDeadlineText = (deadline: string) => {
  const deadlineDate = new Date(deadline)
  if (Number.isNaN(deadlineDate.getTime())) {
    return ''
  }

  const endOfDay = new Date(deadlineDate)
  endOfDay.setHours(23, 59, 59, 999)
  const diffMs = endOfDay.getTime() - now.value.getTime()
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (days < 0) {
    return `已逾期 ${Math.abs(days)} 天`
  }

  if (days === 0) {
    return '今日截止'
  }

  return `剩余 ${days} 天`
}

const getProgressColor = (milestone: MilestoneUI) => {
  switch (getDisplayState(milestone).status) {
    case 'completed':
      return '#67c23a'
    case 'overdue':
      return '#f56c6c'
    default:
      return '#409eff'
  }
}

const getStatusIcon = (milestone: MilestoneUI) => {
  switch (getDisplayState(milestone).status) {
    case 'completed':
      return Check
    case 'overdue':
      return Warning
    default:
      return Clock
  }
}
</script>

<template>
  <div class="indicator-milestone-timeline">
    <div v-if="sortedMilestones.length === 0" class="empty-state">
      <el-empty description="暂无里程碑" :image-size="60" />
    </div>

    <el-timeline v-else class="timeline">
      <el-timeline-item
        v-for="milestone in sortedMilestones"
        :key="milestone.id"
        :type="getDisplayState(milestone).timelineType"
        :icon="getStatusIcon(milestone)"
        :hollow="getDisplayState(milestone).status === 'pending'"
      >
        <div class="timeline-card">
          <div class="timeline-card__header">
            <div class="timeline-card__title">{{ milestone.name }}</div>
            <el-tag :type="getDisplayState(milestone).tagType" size="small" effect="light">
              {{ getDisplayState(milestone).label }}
            </el-tag>
          </div>

          <div class="timeline-card__meta">
            <span>截止: {{ formatDate(milestone.deadline) }}</span>
            <span
              v-if="
                getDisplayState(milestone).status !== 'completed' &&
                getRelativeDeadlineText(milestone.deadline)
              "
              :class="[
                'timeline-card__deadline',
                {
                  'timeline-card__deadline--overdue':
                    getDisplayState(milestone).status === 'overdue'
                }
              ]"
            >
              {{ getRelativeDeadlineText(milestone.deadline) }}
            </span>
          </div>

          <div class="timeline-card__progress">
            <el-progress
              :percentage="Number(milestone.targetProgress) || 0"
              :stroke-width="8"
              :show-text="false"
              :color="getProgressColor(milestone)"
            />
            <div class="timeline-card__progress-footer">
              <span>目标进度</span>
              <span>{{ Number(milestone.targetProgress) || 0 }}%</span>
            </div>
          </div>
        </div>
      </el-timeline-item>
    </el-timeline>
  </div>
</template>

<style scoped>
.indicator-milestone-timeline {
  padding-top: 4px;
}

.timeline {
  padding-left: 2px;
}

.timeline-card {
  padding: 10px 12px 9px;
  background: #f8fbff;
  border: 1px solid #eef3fb;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
}

.timeline-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.timeline-card__title {
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.3;
}

.timeline-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
  color: #909399;
  font-size: 12px;
  line-height: 1.25;
}

.timeline-card__deadline {
  color: #409eff;
  font-weight: 500;
}

.timeline-card__deadline--overdue {
  color: #f56c6c;
}

.timeline-card__progress {
  margin-top: 6px;
}

.timeline-card__progress-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 12px;
  color: #606266;
  line-height: 1.2;
}

.empty-state {
  padding: 8px 0;
}

:deep(.el-timeline-item__node) {
  width: 14px;
  height: 14px;
}

:deep(.el-timeline-item__wrapper) {
  padding-left: 14px;
}

:deep(.el-timeline-item) {
  padding-bottom: 12px;
}

:deep(.el-tag) {
  --el-tag-font-size: 11px;
  height: 22px;
  line-height: 20px;
  padding: 0 7px;
}

:deep(.el-progress-bar__outer) {
  height: 6px !important;
}

:deep(.el-progress-bar__outer) {
  border-radius: 999px;
  background: #edf2f7;
}

:deep(.el-progress-bar__inner) {
  border-radius: 999px;
}
</style>
