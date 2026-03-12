<script setup lang="ts">
/**
 * Indicator Distribution Dialog Component
 * 
 * Dialog for distributing indicators to target organizations.
 */

import { ref, computed } from 'vue'
import { 
  ElDialog, 
  ElForm, 
  ElFormItem, 
  ElSelect, 
  ElOption,
  ElInput,
  ElDatePicker,
  ElButton,
  ElSpace,
  ElMessage,
  type FormInstance
} from 'element-plus'
import type { Indicator } from '@/entities/indicator/model/types'
import { distributeRequestSchema } from '../model/schema'

interface Props {
  modelValue: boolean
  indicator: Indicator | null
  loading?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm', data: { targetOrgIds: number[]; message?: string; deadline?: string }): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

const emit = defineEmits<Emits>()

const formRef = ref<FormInstance>()
const formData = ref({
  targetOrgIds: [] as number[],
  message: '',
  deadline: ''
})

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const formRules = {
  targetOrgIds: [
    { required: true, message: '请至少选择一个目标组织', trigger: 'change', type: 'array', min: 1 }
  ]
}

async function handleConfirm() {
  if (!formRef.value) {return}

  try {
    await formRef.value.validate()
    
    // Validate with Zod schema
    const result = distributeRequestSchema.safeParse(formData.value)
    
    if (!result.success) {
      ElMessage.error('请检查输入数据')
      return
    }
    
    emit('confirm', formData.value)
  } catch (error) {
    console.error('Form validation failed:', error)
  }
}

function handleCancel() {
  dialogVisible.value = false
  resetForm()
}

function resetForm() {
  formData.value = {
    targetOrgIds: [],
    message: '',
    deadline: ''
  }
  formRef.value?.resetFields()
}

// Reset form when dialog opens
function handleOpen() {
  resetForm()
}
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    title="下发指标"
    width="600px"
    :close-on-click-modal="false"
    @open="handleOpen"
  >
    <div v-if="indicator" class="dialog-content">
      <div class="indicator-info">
        <p><strong>指标名称:</strong> {{ indicator.name }}</p>
        <p><strong>指标编码:</strong> {{ indicator.code || '-' }}</p>
        <p><strong>当前状态:</strong> {{ indicator.status }}</p>
      </div>

      <ElForm
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="100px"
        :disabled="loading"
      >
        <ElFormItem label="目标组织" prop="targetOrgIds" required>
          <ElSelect 
            v-model="formData.targetOrgIds" 
            multiple
            filterable
            placeholder="请选择目标组织"
            style="width: 100%"
          >
            <!-- Organization options should be loaded from parent -->
            <slot name="org-options" />
          </ElSelect>
        </ElFormItem>

        <ElFormItem label="下发说明" prop="message">
          <ElInput 
            v-model="formData.message" 
            type="textarea"
            :rows="3"
            placeholder="请输入下发说明（可选）"
            maxlength="500"
            show-word-limit
          />
        </ElFormItem>

        <ElFormItem label="截止日期" prop="deadline">
          <ElDatePicker 
            v-model="formData.deadline" 
            type="date"
            placeholder="请选择截止日期（可选）"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </ElFormItem>
      </ElForm>
    </div>

    <template #footer>
      <ElSpace>
        <ElButton @click="handleCancel">取消</ElButton>
        <ElButton type="primary" :loading="loading" @click="handleConfirm">
          确认下发
        </ElButton>
      </ElSpace>
    </template>
  </ElDialog>
</template>

<style scoped>
.dialog-content {
  padding: 0 16px;
}

.indicator-info {
  padding: 16px;
  background-color: var(--el-fill-color-light);
  border-radius: 4px;
  margin-bottom: 24px;
}

.indicator-info p {
  margin: 8px 0;
  font-size: 14px;
}

.indicator-info strong {
  color: var(--el-text-color-secondary);
  margin-right: 8px;
}
</style>
