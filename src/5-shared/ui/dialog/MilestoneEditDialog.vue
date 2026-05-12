<script setup lang="ts">
/**
 * MilestoneEditDialog - Shared milestone editing dialog component
 *
 * Extracts the duplicated milestone edit dialog pattern from:
 * - StrategicTaskView.vue
 * - IndicatorDistributeView.vue
 * - IndicatorListView.vue
 *
 * @example
 * ```vue
 * <MilestoneEditDialog
 *   v-model="milestoneEditDialogVisible"
 *   :indicator-name="editingMilestoneIndicator?.name"
 *   :indicator-type="editingMilestoneIndicator?.type1"
 *   :milestones="editingMilestones"
 *   :saving="isSavingMilestoneEdit"
 *   @save="saveMilestoneEdit"
 *   @close="cancelMilestoneEdit"
 * />
 * ```
 */

import { computed, ref } from 'vue'
import { Plus, Delete, Timer } from '@element-plus/icons-vue'

export interface MilestoneFormData {
  id: string | number
  name: string
  targetProgress: number
  deadline?: string
}

export interface MilestoneEditDialogProps {
  /** Dialog visibility (v-model) */
  modelValue: boolean
  /** Indicator name to display */
  indicatorName?: string
  /** Indicator type (qualitative/quantitative) */
  indicatorType?: string
  /** Milestones to edit */
  milestones?: MilestoneFormData[]
  /** Whether the dialog is saving */
  saving?: boolean
  /** Whether the indicator type is quantitative */
  isQuantitative?: boolean
}

const props = withDefaults(defineProps<MilestoneEditDialogProps>(), {
  indicatorName: '',
  indicatorType: '',
  milestones: () => [],
  saving: false,
  isQuantitative: false
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:milestones': [milestones: MilestoneFormData[]]
  save: []
  close: []
  add: []
  generate: []
  remove: [index: number]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

const milestoneCount = computed(() => props.milestones.length)

const handleAdd = () => {
  emit('add')
}

const handleGenerate = () => {
  emit('generate')
}

const handleRemove = (index: number) => {
  emit('remove', index)
}

const handleSave = () => {
  emit('save')
}

const handleClose = () => {
  if (!props.saving) {
    visible.value = false
    emit('close')
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="编辑里程碑"
    width="700px"
    :close-on-click-modal="false"
    :close-on-press-escape="!saving"
    :show-close="!saving"
    @close="handleClose"
  >
    <div class="milestone-edit-dialog">
      <!-- Indicator info header -->
      <div v-if="indicatorName" class="indicator-info-header">
        <div class="info-item">
          <span class="label">指标名称：</span>
          <span class="value">{{ indicatorName }}</span>
        </div>
        <div v-if="indicatorType" class="info-item">
          <span class="label">指标类型：</span>
          <el-tag size="small" :type="isQuantitative ? 'primary' : 'warning'">
            {{ indicatorType }}
          </el-tag>
        </div>
      </div>

      <el-divider v-if="indicatorName" />

      <!-- Action buttons -->
      <div class="milestone-actions">
        <el-button size="small" type="primary" :icon="Plus" @click="handleAdd">
          添加里程碑
        </el-button>
        <el-button
          v-if="isQuantitative"
          size="small"
          type="success"
          :icon="Timer"
          @click="handleGenerate"
        >
          生成12个月里程碑
        </el-button>
        <span class="milestone-count-hint"> 当前共 {{ milestoneCount }} 个里程碑 </span>
      </div>

      <!-- Milestone list -->
      <div class="milestone-edit-list">
        <el-empty
          v-if="milestones.length === 0"
          description="暂无里程碑，点击上方按钮添加"
          :image-size="80"
        />

        <!-- Milestone edit form -->
        <div v-for="(ms, idx) in milestones" :key="ms.id" class="milestone-edit-item">
          <div class="milestone-index">{{ idx + 1 }}.</div>
          <div class="milestone-fields">
            <el-input v-model="ms.name" placeholder="里程碑名称" size="small" class="field-name" />
            <el-input-number
              v-model="ms.targetProgress"
              :min="0"
              :max="100"
              placeholder="目标进度%"
              size="small"
              class="field-progress"
            />
            <el-date-picker
              v-model="ms.deadline"
              type="date"
              placeholder="截止日期"
              size="small"
              value-format="YYYY-MM-DD"
              class="field-date"
            />
            <el-button
              type="danger"
              size="small"
              :icon="Delete"
              circle
              @click="handleRemove(idx)"
            />
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button :disabled="saving" @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="saving" @click="handleSave"> 保存 </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.indicator-info-header {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 8px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-item .label {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.info-item .value {
  color: var(--el-text-color-primary);
  font-weight: 500;
}

.milestone-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.milestone-count-hint {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin-left: auto;
}

.milestone-edit-list {
  max-height: 400px;
  overflow-y: auto;
}

.milestone-edit-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.milestone-edit-item:last-child {
  border-bottom: none;
}

.milestone-index {
  color: var(--el-text-color-secondary);
  font-weight: 500;
  min-width: 24px;
}

.milestone-fields {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.field-name {
  flex: 2;
}

.field-progress {
  flex: 1;
}

.field-date {
  flex: 1.5;
}
</style>
