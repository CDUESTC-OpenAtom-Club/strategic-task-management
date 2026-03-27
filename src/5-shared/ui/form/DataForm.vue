<!--
  DataForm - 通用数据表单组件

  职责:
  - 提供统一的表单样式
  - 支持字段验证
  - 支持动态字段
  - 支持字段联动
-->
<script setup lang="ts">
// @ts-nocheck
import { ref, computed, watch, nextTick as _nextTick } from 'vue'
import type { FormInstance, FormRules, FormItemProp } from 'element-plus'
import { logger } from '@/shared/lib/utils/logger'

/** 表单字段类型 */
export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'password'
  | 'select'
  | 'multiselect'
  | 'date'
  | 'daterange'
  | 'datetime'
  | 'switch'
  | 'checkbox'
  | 'radio'
  | 'upload'

/** 表单字段配置 */
export interface FormField {
  /** 字段名 */
  prop: string
  /** 字段标签 */
  label?: string
  /** 字段类型 */
  type?: FieldType
  /** 占位提示 */
  placeholder?: string
  /** 是否必填 */
  required?: boolean
  /** 验证规则 */
  rules?: FormRules[string]
  /** 选项列表 (用于 select, radio, checkbox) */
  options?: Array<{ label: string; value: string | number | boolean; disabled?: boolean }>
  /** 字段宽度 */
  width?: string | number
  /** 占用的列数 (24栅格系统) */
  span?: number
  /** 是否禁用 */
  disabled?: boolean
  /** 是否只读 */
  readonly?: boolean
  /** 行数 (textarea) */
  rows?: number
  /** 最小值 (number) */
  min?: number
  /** 最大值 (number) */
  max?: number
  /** 步长 (number) */
  step?: number
  /** 日期格式 (date, datetime) */
  format?: string
  /** 日期值格式 (date, datetime) */
  valueFormat?: string
  /** 自定义插槽名称 */
  slot?: string
  /** 是否显示 */
  visible?: boolean | ((data: Record<string, unknown>) => boolean)
  /** 字段联动配置 */
  linkage?: {
    /** 联动触发字段 */
    trigger: string
    /** 联动条件 */
    condition: (triggerValue: unknown, formData: Record<string, unknown>) => boolean
    /** 联动结果 */
    result: Partial<FormField>
  }
}

/** 表单操作按钮配置 */
export interface FormAction {
  /** 按钮文字 */
  text: string
  /** 按钮类型 */
  type?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  /** 按钮图标 */
  icon?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 是否加载中 */
  loading?: boolean
  /** 点击事件 */
  handler: () => void | Promise<void>
  /** 显示条件 */
  visible?: boolean | ((formData: Record<string, unknown>) => boolean)
}

/** Props */
export interface DataFormProps {
  /** 表单数据 */
  model: Record<string, unknown>
  /** 字段配置 */
  fields: FormField[]
  /** 表单规则 */
  rules?: FormRules
  /** 标签宽度 */
  labelWidth?: string | number
  /** 标签位置 */
  labelPosition?: 'left' | 'right' | 'top'
  /** 列数 */
  columns?: number
  /** 是否显示行内 */
  inline?: boolean
  /** 是否禁用整个表单 */
  disabled?: boolean
  /** 加载状态 */
  loading?: boolean
}

const props = withDefaults(defineProps<DataFormProps>(), {
  rules: () => ({}),
  labelWidth: '100px',
  labelPosition: 'right',
  columns: 1,
  inline: false,
  disabled: false,
  loading: false
})

const emit = defineEmits<{
  /** 提交事件 */
  submit: [model: Record<string, unknown>]
  /** 重置事件 */
  reset: []
  /** 字段值变化事件 */
  'field-change': [prop: string, value: unknown]
  /** 取消事件 */
  cancel: []
}>()

/** 表单引用 */
const formRef = ref<FormInstance>()

/** 内部字段配置 (处理联动) */
const innerFields = ref<FormField[]>([...props.fields])

/** 监听字段配置变化 */
watch(
  () => props.fields,
  newFields => {
    innerFields.value = [...newFields]
  },
  { deep: true }
)

/** 监听表单数据变化 (处理联动) */
watch(
  () => props.model,
  newModel => {
    innerFields.value = innerFields.value.map(field => {
      if (field.linkage) {
        const { trigger, condition, result } = field.linkage
        const triggerValue = newModel[trigger]

        if (condition(triggerValue, newModel)) {
          return { ...field, ...result }
        }
      }
      return field
    })
  },
  { deep: true }
)

/** 计算每个字段的列宽 */
const fieldSpan = computed(() => {
  return Math.floor(24 / props.columns)
})

/** 过滤可见字段 */
const visibleFields = computed(() => {
  return innerFields.value.filter(field => {
    if (typeof field.visible === 'function') {
      return field.visible(props.model)
    }
    return field.visible !== false
  })
})

/** 处理字段值变化 */
const handleFieldChange = (prop: string, value: unknown) => {
  emit('field-change', prop, value)
}

/** 提交表单 */
const submit = async () => {
  if (!formRef.value) {
    return
  }

  try {
    await formRef.value.validate()
    emit('submit', props.model)
  } catch (error) {
    logger.warn('[DataForm] Validation failed:', error)
  }
}

/** 重置表单 */
const resetForm = () => {
  formRef.value?.resetFields()
  emit('reset')
}

/** 验证表单 */
const validate = async () => {
  return formRef.value?.validate()
}

/** 验证指定字段 */
const validateField = async (props: FormItemProp) => {
  return formRef.value?.validateField(props)
}

/** 清除验证 */
const clearValidate = (props?: FormItemProp) => {
  formRef.value?.clearValidate(props)
}

/** 暴露方法给父组件 */
defineExpose({
  formRef,
  submit,
  resetForm,
  validate,
  validateField,
  clearValidate
})
</script>

<template>
  <div class="data-form" :class="{ 'data-form--inline': inline }">
    <el-form
      ref="formRef"
      :model="model"
      :rules="rules"
      :label-width="labelWidth"
      :label-position="labelPosition"
      :inline="inline"
      :disabled="disabled"
    >
      <el-row :gutter="16">
        <el-col
          v-for="field in visibleFields"
          :key="field.prop"
          :span="inline ? undefined : field.span || fieldSpan"
        >
          <!-- 文本输入 -->
          <el-form-item
            v-if="!field.type || field.type === 'text'"
            :prop="field.prop"
            :label="field.label"
            :required="field.required"
          >
            <el-input
              :model-value="model[field.prop]"
              :placeholder="field.placeholder"
              :disabled="field.disabled"
              :readonly="field.readonly"
              @update:model-value="handleFieldChange(field.prop, $event)"
            />
          </el-form-item>

          <!-- 文本域 -->
          <el-form-item
            v-else-if="field.type === 'textarea'"
            :prop="field.prop"
            :label="field.label"
            :required="field.required"
          >
            <el-input
              :model-value="model[field.prop]"
              type="textarea"
              :rows="field.rows || 3"
              :placeholder="field.placeholder"
              :disabled="field.disabled"
              :readonly="field.readonly"
              @update:model-value="handleFieldChange(field.prop, $event)"
            />
          </el-form-item>

          <!-- 数字输入 -->
          <el-form-item
            v-else-if="field.type === 'number'"
            :prop="field.prop"
            :label="field.label"
            :required="field.required"
          >
            <el-input-number
              :model-value="model[field.prop]"
              :min="field.min"
              :max="field.max"
              :step="field.step"
              :disabled="field.disabled"
              :controls-position="inline ? 'right' : undefined"
              @update:model-value="handleFieldChange(field.prop, $event)"
            />
          </el-form-item>

          <!-- 密码输入 -->
          <el-form-item
            v-else-if="field.type === 'password'"
            :prop="field.prop"
            :label="field.label"
            :required="field.required"
          >
            <el-input
              :model-value="model[field.prop]"
              type="password"
              :placeholder="field.placeholder"
              :disabled="field.disabled"
              :readonly="field.readonly"
              show-password
              @update:model-value="handleFieldChange(field.prop, $event)"
            />
          </el-form-item>

          <!-- 选择器 -->
          <el-form-item
            v-else-if="field.type === 'select'"
            :prop="field.prop"
            :label="field.label"
            :required="field.required"
          >
            <el-select
              :model-value="model[field.prop]"
              :placeholder="field.placeholder"
              :disabled="field.disabled"
              @update:model-value="handleFieldChange(field.prop, $event)"
            >
              <el-option
                v-for="option in field.options"
                :key="option.value"
                :label="option.label"
                :value="option.value"
                :disabled="option.disabled"
              />
            </el-select>
          </el-form-item>

          <!-- 多选选择器 -->
          <el-form-item
            v-else-if="field.type === 'multiselect'"
            :prop="field.prop"
            :label="field.label"
            :required="field.required"
          >
            <el-select
              :model-value="model[field.prop]"
              :placeholder="field.placeholder"
              :disabled="field.disabled"
              multiple
              @update:model-value="handleFieldChange(field.prop, $event)"
            >
              <el-option
                v-for="option in field.options"
                :key="option.value"
                :label="option.label"
                :value="option.value"
                :disabled="option.disabled"
              />
            </el-select>
          </el-form-item>

          <!-- 日期选择 -->
          <el-form-item
            v-else-if="field.type === 'date'"
            :prop="field.prop"
            :label="field.label"
            :required="field.required"
          >
            <el-date-picker
              :model-value="model[field.prop]"
              type="date"
              :placeholder="field.placeholder"
              :format="field.format"
              :value-format="field.valueFormat"
              :disabled="field.disabled"
              @update:model-value="handleFieldChange(field.prop, $event)"
            />
          </el-form-item>

          <!-- 日期范围选择 -->
          <el-form-item
            v-else-if="field.type === 'daterange'"
            :prop="field.prop"
            :label="field.label"
            :required="field.required"
          >
            <el-date-picker
              :model-value="model[field.prop]"
              type="daterange"
              range-separator="-"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              :format="field.format"
              :value-format="field.valueFormat"
              :disabled="field.disabled"
              @update:model-value="handleFieldChange(field.prop, $event)"
            />
          </el-form-item>

          <!-- 日期时间选择 -->
          <el-form-item
            v-else-if="field.type === 'datetime'"
            :prop="field.prop"
            :label="field.label"
            :required="field.required"
          >
            <el-date-picker
              :model-value="model[field.prop]"
              type="datetime"
              :placeholder="field.placeholder"
              :format="field.format"
              :value-format="field.valueFormat"
              :disabled="field.disabled"
              @update:model-value="handleFieldChange(field.prop, $event)"
            />
          </el-form-item>

          <!-- 开关 -->
          <el-form-item
            v-else-if="field.type === 'switch'"
            :prop="field.prop"
            :label="field.label"
            :required="field.required"
          >
            <el-switch
              :model-value="model[field.prop]"
              :disabled="field.disabled"
              @update:model-value="handleFieldChange(field.prop, $event)"
            />
          </el-form-item>

          <!-- 自定义插槽 -->
          <el-form-item
            v-else-if="field.slot"
            :prop="field.prop"
            :label="field.label"
            :required="field.required"
          >
            <slot :name="field.slot" :field="field" :model="model" />
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>

    <!-- 操作按钮 -->
    <div v-if="$slots.actions" class="data-form__actions">
      <slot name="actions" :submit="submit" :reset="resetForm" />
    </div>
  </div>
</template>

<style scoped>
.data-form {
  width: 100%;
}

.data-form--inline {
  display: flex;
  flex-wrap: wrap;
}

.data-form--inline :deep(.el-form-item) {
  margin-right: 16px;
  margin-bottom: 12px;
}

.data-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color);
}
</style>
