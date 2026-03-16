<script setup lang="ts">
/**
 * Indicator Form Component
 *
 * Form for creating/editing indicators with validation.
 */

import { ref, computed, watch } from 'vue'
import {
  ElForm,
  ElFormItem,
  ElInput,
  ElSelect,
  ElOption,
  ElInputNumber,
  ElDatePicker,
  ElButton,
  ElSpace,
  type FormInstance,
  type FormRules
} from 'element-plus'
import type { Indicator } from '@/entities/indicator/model/types'
import { INDICATOR_TYPE_OPTIONS, VALIDATION_RULES } from '../model/constants'
import { indicatorCreateSchema, indicatorUpdateSchema } from '../model/schema'
import { logger } from '@/shared/lib/utils/logger'

interface Props {
  modelValue: Partial<Indicator>
  mode?: 'create' | 'edit'
  loading?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: Partial<Indicator>): void
  (e: 'submit', value: Partial<Indicator>): void
  (e: 'cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'create',
  loading: false
})

const emit = defineEmits<Emits>()

const formRef = ref<FormInstance>()
const formData = ref<Partial<Indicator>>({ ...props.modelValue })

// Watch for external changes
watch(
  () => props.modelValue,
  newValue => {
    formData.value = { ...newValue }
  },
  { deep: true }
)

// Emit changes
watch(
  formData,
  newValue => {
    emit('update:modelValue', newValue)
  },
  { deep: true }
)

const isQuantitative = computed(() => formData.value.type === 'QUANTITATIVE')

const formRules = computed<FormRules>(() => ({
  name: [
    { required: true, message: '请输入指标名称', trigger: 'blur' },
    {
      max: VALIDATION_RULES.NAME_MAX_LENGTH,
      message: `指标名称不能超过${VALIDATION_RULES.NAME_MAX_LENGTH}个字符`,
      trigger: 'blur'
    }
  ],
  code: [
    {
      max: VALIDATION_RULES.CODE_MAX_LENGTH,
      message: `指标编码不能超过${VALIDATION_RULES.CODE_MAX_LENGTH}个字符`,
      trigger: 'blur'
    }
  ],
  type: [{ required: true, message: '请选择指标类型', trigger: 'change' }],
  taskId: [{ required: true, message: '请选择所属任务', trigger: 'change' }],
  ownerOrgId: [{ required: true, message: '请选择责任组织', trigger: 'change' }],
  targetOrgId: [{ required: true, message: '请选择目标组织', trigger: 'change' }],
  targetValue: [{ required: isQuantitative.value, message: '请输入目标值', trigger: 'blur' }],
  unit: [
    { required: isQuantitative.value, message: '请输入单位', trigger: 'blur' },
    {
      max: VALIDATION_RULES.UNIT_MAX_LENGTH,
      message: `单位不能超过${VALIDATION_RULES.UNIT_MAX_LENGTH}个字符`,
      trigger: 'blur'
    }
  ]
}))

async function handleSubmit() {
  if (!formRef.value) {
    return
  }

  try {
    await formRef.value.validate()

    // Validate with Zod schema
    const schema = props.mode === 'create' ? indicatorCreateSchema : indicatorUpdateSchema
    const result = schema.safeParse(formData.value)

    if (!result.success) {
      logger.error('Validation failed:', result.error)
      return
    }

    emit('submit', formData.value)
  } catch (error) {
    logger.error('Form validation failed:', error)
  }
}

function handleCancel() {
  emit('cancel')
}

function handleReset() {
  formRef.value?.resetFields()
}

defineExpose({
  validate: () => formRef.value?.validate(),
  resetFields: () => formRef.value?.resetFields()
})
</script>

<template>
  <ElForm
    ref="formRef"
    :model="formData"
    :rules="formRules"
    label-width="120px"
    :disabled="loading"
  >
    <ElFormItem label="指标名称" prop="name">
      <ElInput
        v-model="formData.name"
        placeholder="请输入指标名称"
        :maxlength="VALIDATION_RULES.NAME_MAX_LENGTH"
        show-word-limit
      />
    </ElFormItem>

    <ElFormItem label="指标编码" prop="code">
      <ElInput
        v-model="formData.code"
        placeholder="请输入指标编码（可选）"
        :maxlength="VALIDATION_RULES.CODE_MAX_LENGTH"
      />
    </ElFormItem>

    <ElFormItem label="指标描述" prop="description">
      <ElInput
        v-model="formData.description"
        type="textarea"
        :rows="3"
        placeholder="请输入指标描述"
        :maxlength="VALIDATION_RULES.DESCRIPTION_MAX_LENGTH"
        show-word-limit
      />
    </ElFormItem>

    <ElFormItem label="指标类型" prop="type">
      <ElSelect v-model="formData.type" placeholder="请选择指标类型">
        <ElOption
          v-for="option in INDICATOR_TYPE_OPTIONS"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </ElSelect>
    </ElFormItem>

    <ElFormItem label="所属任务" prop="taskId">
      <ElSelect v-model="formData.taskId" placeholder="请选择所属任务" filterable>
        <!-- Task options should be loaded from parent -->
        <slot name="task-options" />
      </ElSelect>
    </ElFormItem>

    <ElFormItem label="责任组织" prop="ownerOrgId">
      <ElSelect v-model="formData.ownerOrgId" placeholder="请选择责任组织" filterable>
        <!-- Organization options should be loaded from parent -->
        <slot name="owner-org-options" />
      </ElSelect>
    </ElFormItem>

    <ElFormItem label="目标组织" prop="targetOrgId">
      <ElSelect v-model="formData.targetOrgId" placeholder="请选择目标组织" filterable>
        <!-- Organization options should be loaded from parent -->
        <slot name="target-org-options" />
      </ElSelect>
    </ElFormItem>

    <template v-if="isQuantitative">
      <ElFormItem label="目标值" prop="targetValue">
        <ElInputNumber
          v-model="formData.targetValue"
          :min="0"
          :precision="2"
          placeholder="请输入目标值"
        />
      </ElFormItem>

      <ElFormItem label="单位" prop="unit">
        <ElInput
          v-model="formData.unit"
          placeholder="请输入单位（如：分、万元）"
          :maxlength="VALIDATION_RULES.UNIT_MAX_LENGTH"
        />
      </ElFormItem>

      <ElFormItem label="当前值" prop="actualValue">
        <ElInputNumber
          v-model="formData.actualValue"
          :min="0"
          :precision="2"
          placeholder="请输入当前值"
        />
      </ElFormItem>
    </template>

    <ElFormItem label="权重" prop="weight">
      <ElInputNumber
        v-model="formData.weight"
        :min="0"
        :max="1"
        :step="0.01"
        :precision="2"
        placeholder="请输入权重（0-1）"
      />
    </ElFormItem>

    <ElFormItem label="年份" prop="year">
      <ElInputNumber v-model="formData.year" :min="2020" :max="2100" placeholder="请输入年份" />
    </ElFormItem>

    <ElFormItem label="截止日期" prop="deadline">
      <ElDatePicker
        v-model="formData.deadline"
        type="date"
        placeholder="请选择截止日期"
        value-format="YYYY-MM-DD"
      />
    </ElFormItem>

    <ElFormItem label="备注" prop="remark">
      <ElInput v-model="formData.remark" type="textarea" :rows="2" placeholder="请输入备注" />
    </ElFormItem>

    <ElFormItem>
      <ElSpace>
        <ElButton type="primary" :loading="loading" @click="handleSubmit">
          {{ mode === 'create' ? '创建' : '保存' }}
        </ElButton>
        <ElButton @click="handleCancel">取消</ElButton>
        <ElButton @click="handleReset">重置</ElButton>
      </ElSpace>
    </ElFormItem>
  </ElForm>
</template>

<style scoped>
.el-form {
  max-width: 800px;
}
</style>
