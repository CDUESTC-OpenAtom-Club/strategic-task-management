<template>
  <el-card class="task-card" :class="{ 'task-card--strategic': task.strategic }">
    <template #header>
      <div class="task-card__header">
        <div class="task-card__title">
          <h3>{{ task.name }}</h3>
          <el-tag v-if="task.strategic" type="success" size="small">战略级</el-tag>
        </div>
        <el-tag :type="getTaskStatusColor(task.status)" size="small">
          {{ TASK_STATUS_LABELS[task.status] }}
        </el-tag>
      </div>
    </template>

    <div class="task-card__content">
      <p class="task-card__description">{{ task.description }}</p>
      
      <div class="task-card__meta">
        <div class="task-card__meta-item">
          <span class="label">编码:</span>
          <span>{{ task.code }}</span>
        </div>
        <div class="task-card__meta-item">
          <span class="label">权重:</span>
          <span>{{ formatTaskWeight(task.weight) }}</span>
        </div>
        <div class="task-card__meta-item">
          <span class="label">负责部门:</span>
          <span>{{ task.ownerOrgName }}</span>
        </div>
        <div class="task-card__meta-item">
          <span class="label">指标数量:</span>
          <span>{{ task.indicatorCount }}</span>
        </div>
      </div>

      <div class="task-card__timeline">
        <div class="task-card__timeline-item">
          <span class="label">开始时间:</span>
          <span>{{ formatDate(task.startDate) }}</span>
        </div>
        <div class="task-card__timeline-item">
          <span class="label">结束时间:</span>
          <span>{{ formatDate(task.endDate) }}</span>
        </div>
      </div>

      <div class="task-card__progress">
        <div class="task-card__progress-label">
          <span>进度</span>
          <span>{{ Math.round(taskProgress) }}%</span>
        </div>
        <el-progress 
          :percentage="taskProgress" 
          :status="isTaskOverdue(task) ? 'exception' : undefined"
          :stroke-width="6"
        />
      </div>
    </div>

    <template #footer>
      <div class="task-card__actions">
        <el-button size="small" @click="$emit('view', task)">
          查看详情
        </el-button>
        <el-button size="small" type="primary" @click="$emit('edit', task)">
          编辑
        </el-button>
        <el-button 
          size="small" 
          type="danger" 
          :disabled="task.status === 'ACTIVE'"
          @click="$emit('delete', task)"
        >
          删除
        </el-button>
      </div>
    </template>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { StrategicTask } from '../model/types'
import { TASK_STATUS_LABELS } from '../model/constants'
import { calculateTaskProgress, isTaskOverdue, getTaskStatusColor, formatTaskWeight } from '../lib/utils'

interface Props {
  task: StrategicTask
}

interface Emits {
  (e: 'view', task: StrategicTask): void
  (e: 'edit', task: StrategicTask): void
  (e: 'delete', task: StrategicTask): void
}

const props = defineProps<Props>()
defineEmits<Emits>()

const taskProgress = computed(() => calculateTaskProgress(props.task))

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('zh-CN')
}
</script>

<style scoped>
.task-card {
  margin-bottom: 16px;
}

.task-card--strategic {
  border-left: 4px solid var(--el-color-success);
}

.task-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.task-card__title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.task-card__title h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.task-card__content {
  padding: 16px 0;
}

.task-card__description {
  color: var(--el-text-color-regular);
  margin-bottom: 16px;
  line-height: 1.5;
}

.task-card__meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 16px;
}

.task-card__meta-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.task-card__timeline {
  display: flex;
  gap: 24px;
  margin-bottom: 16px;
}

.task-card__timeline-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.task-card__progress {
  margin-bottom: 16px;
}

.task-card__progress-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
}

.task-card__actions {
  display: flex;
  gap: 8px;
}

.label {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  min-width: 60px;
}
</style>