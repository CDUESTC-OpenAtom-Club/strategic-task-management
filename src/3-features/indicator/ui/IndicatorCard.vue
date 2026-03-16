<script setup lang="ts">
/**
 * Indicator Card Component
 *
 * Displays indicator information in a card format.
 */

import { computed } from 'vue'
import { ElCard, ElTag, ElProgress, ElButton, ElSpace } from 'element-plus'
import type { Indicator } from '@/4-entities/indicator/model/types'
import { STATUS_CONFIG, LEVEL_CONFIG } from '../model/constants'
import { calculateCompletionRate, formatWeightAsPercentage } from '../lib/calculations'
import { getAvailableActions } from '../lib/validations'

interface Props {
  indicator: Indicator
  showActions?: boolean
}

interface Emits {
  (e: 'view', indicator: Indicator): void
  (e: 'edit', indicator: Indicator): void
  (e: 'delete', indicator: Indicator): void
  (e: 'distribute', indicator: Indicator): void
}

const props = withDefaults(defineProps<Props>(), {
  showActions: true
})

const emit = defineEmits<Emits>()

const statusConfig = computed(() => STATUS_CONFIG[props.indicator.status] || STATUS_CONFIG.DRAFT)
const levelConfig = computed(() => LEVEL_CONFIG[props.indicator.level] || LEVEL_CONFIG.FIRST)

const completionRate = computed(() =>
  calculateCompletionRate(props.indicator.targetValue, props.indicator.actualValue)
)

const weightDisplay = computed(() => formatWeightAsPercentage(props.indicator.weight))

const availableActions = computed(() => getAvailableActions(props.indicator))

function handleView() {
  emit('view', props.indicator)
}

function handleEdit() {
  emit('edit', props.indicator)
}

function handleDelete() {
  emit('delete', props.indicator)
}

function handleDistribute() {
  emit('distribute', props.indicator)
}
</script>

<template>
  <ElCard class="indicator-card" shadow="hover">
    <template #header>
      <div class="card-header">
        <div class="header-left">
          <ElTag :type="levelConfig.badge === '1' ? 'primary' : 'success'" size="small">
            {{ levelConfig.label }}
          </ElTag>
          <span class="indicator-name">{{ indicator.name }}</span>
        </div>
        <ElTag :type="statusConfig.type" size="small">
          {{ statusConfig.label }}
        </ElTag>
      </div>
    </template>

    <div class="card-content">
      <!-- Basic Info -->
      <div class="info-row">
        <span class="label">编码:</span>
        <span class="value">{{ indicator.code || '-' }}</span>
      </div>

      <div class="info-row">
        <span class="label">所属任务:</span>
        <span class="value">{{ indicator.taskName || '-' }}</span>
      </div>

      <div class="info-row">
        <span class="label">责任组织:</span>
        <span class="value">{{ indicator.ownerOrg || '-' }}</span>
      </div>

      <div class="info-row">
        <span class="label">目标组织:</span>
        <span class="value">{{ indicator.targetOrg || '-' }}</span>
      </div>

      <!-- Progress -->
      <div v-if="indicator.type === 'QUANTITATIVE'" class="progress-section">
        <div class="info-row">
          <span class="label">目标值:</span>
          <span class="value">{{ indicator.targetValue }} {{ indicator.unit }}</span>
        </div>

        <div class="info-row">
          <span class="label">当前值:</span>
          <span class="value">{{ indicator.actualValue || 0 }} {{ indicator.unit }}</span>
        </div>

        <ElProgress
          :percentage="completionRate"
          :status="completionRate >= 100 ? 'success' : undefined"
        />
      </div>

      <!-- Weight -->
      <div v-if="indicator.weight" class="info-row">
        <span class="label">权重:</span>
        <span class="value">{{ weightDisplay }}</span>
      </div>
    </div>

    <template v-if="showActions" #footer>
      <ElSpace>
        <ElButton v-if="availableActions.includes('view')" size="small" @click="handleView">
          查看
        </ElButton>
        <ElButton
          v-if="availableActions.includes('edit')"
          size="small"
          type="primary"
          @click="handleEdit"
        >
          编辑
        </ElButton>
        <ElButton
          v-if="availableActions.includes('distribute')"
          size="small"
          type="success"
          @click="handleDistribute"
        >
          下发
        </ElButton>
        <ElButton
          v-if="availableActions.includes('delete')"
          size="small"
          type="danger"
          @click="handleDelete"
        >
          删除
        </ElButton>
      </ElSpace>
    </template>
  </ElCard>
</template>

<style scoped>
.indicator-card {
  margin-bottom: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.indicator-name {
  font-weight: 600;
  font-size: 16px;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.label {
  color: var(--el-text-color-secondary);
  font-size: 14px;
  min-width: 80px;
}

.value {
  color: var(--el-text-color-primary);
  font-size: 14px;
}

.progress-section {
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>
