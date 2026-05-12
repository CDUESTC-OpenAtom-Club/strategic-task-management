<script setup lang="ts">
/**
 * AssignmentDialog - Shared task assignment dialog component
 *
 * Extracts the duplicated assignment dialog pattern from:
 * - StrategicTaskView.vue
 * - IndicatorDistributeView.vue
 * - IndicatorListView.vue
 *
 * @example
 * ```vue
 * <AssignmentDialog
 *   v-model="showAssignmentDialog"
 *   :selected-items="selectedIndicators"
 *   :selected-role="selectedRole"
 *   :departments="functionalDepartments"
 *   :assignment-method="assignmentMethod"
 *   :assignment-target="assignmentTarget"
 *   @confirm="confirmAssignment"
 *   @cancel="handleCancelAssignment"
 * />
 * ```
 */

import { computed, ref, watch } from 'vue'

export interface AssignmentItem {
  id: string | number
  name: string
  [key: string]: unknown
}

export interface AssignmentDialogProps {
  /** Dialog visibility (v-model) */
  modelValue: boolean
  /** Selected items to assign */
  selectedItems?: AssignmentItem[]
  /** Current user role */
  selectedRole?: string
  /** Available departments for assignment */
  departments?: string[]
  /** Assignment method */
  assignmentMethod?: 'self' | 'college'
  /** Assignment target department */
  assignmentTarget?: string
  /** Dialog title */
  title?: string
  /** Items section title */
  itemsTitle?: string
}

const props = withDefaults(defineProps<AssignmentDialogProps>(), {
  selectedItems: () => [],
  selectedRole: '',
  departments: () => [],
  assignmentMethod: 'self',
  assignmentTarget: '',
  title: '任务下发',
  itemsTitle: '选中的指标'
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:assignmentMethod': [method: 'self' | 'college']
  'update:assignmentTarget': [target: string]
  confirm: []
  cancel: []
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

const localMethod = computed({
  get: () => props.assignmentMethod,
  set: (value: 'self' | 'college') => emit('update:assignmentMethod', value)
})

const localTarget = computed({
  get: () => props.assignmentTarget,
  set: (value: string) => emit('update:assignmentTarget', value)
})

const isStrategicDept = computed(() => props.selectedRole === '战略发展部')
const isFunctionalDept = computed(
  () => props.selectedRole === '教务处' || props.selectedRole === '科研处'
)

const showTargetSelect = computed(() => localMethod.value === 'college')

const isConfirmDisabled = computed(() => {
  return localMethod.value === 'college' && !localTarget.value
})

const handleCancel = () => {
  visible.value = false
  emit('cancel')
}

const handleConfirm = () => {
  emit('confirm')
}
</script>

<template>
  <el-dialog v-model="visible" :title="title" width="600px" :before-close="handleCancel">
    <div class="assignment-dialog">
      <!-- Selected items -->
      <div class="selected-items">
        <h4>{{ itemsTitle }} ({{ selectedItems.length }}项)</h4>
        <ul>
          <li v-for="item in selectedItems" :key="item.id">
            {{ item.name }}
          </li>
        </ul>
      </div>

      <!-- Assignment form -->
      <el-form
        :model="{ assignmentMethod: localMethod, assignmentTarget: localTarget }"
        label-width="120px"
      >
        <el-form-item label="下发方式">
          <el-radio-group v-model="localMethod">
            <el-radio v-if="isStrategicDept" value="self"> 职能部门完成 </el-radio>
            <el-radio v-if="isStrategicDept" value="college"> 分解到职能部门 </el-radio>
            <el-radio v-if="isFunctionalDept" value="self"> 自己完成 </el-radio>
            <el-radio v-if="isFunctionalDept" value="college"> 下发给学院 </el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item v-if="showTargetSelect" label="目标部门">
          <el-select v-model="localTarget" placeholder="选择学院" style="width: 100%">
            <el-option v-for="dept in departments" :key="dept" :label="dept" :value="dept" />
          </el-select>
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <el-button @click="handleCancel">取消</el-button>
      <el-button type="primary" :disabled="isConfirmDisabled" @click="handleConfirm">
        确认下发
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.selected-items {
  margin-bottom: 20px;
}

.selected-items h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.selected-items ul {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 200px;
  overflow-y: auto;
}

.selected-items li {
  padding: 8px 12px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  margin-bottom: 4px;
  font-size: 14px;
  color: var(--el-text-color-regular);
}
</style>
