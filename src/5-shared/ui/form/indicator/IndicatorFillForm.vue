<script setup lang="ts">
import { ref, computed, watch, onMounted as _onMounted } from 'vue'
import {
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElSlider,
  ElButton,
  ElUpload,
  ElMessage,
  ElTag,
  ElIcon,
  type UploadUserFile,
  type UploadFile as _UploadFile,
  type UploadProps
} from 'element-plus'
import { Delete as _Delete, UploadFilled, Paperclip } from '@element-plus/icons-vue'
import type { Indicator, IndicatorFill, IndicatorFillForm, Milestone as _Milestone } from '@/5-shared/types'
import { usePlanStore } from '@/3-features/plan/model/store'
import { logger } from '@/5-shared/lib/utils/logger'
import { sortMilestonesByProgress } from '@/5-shared/lib/utils/milestoneSort'

/**
 * 指标填报表单组件
 *
 * 功能：
 * - 填报进度值
 * - 添加填报说明/批注
 * - 上传附件
 * - 关联里程碑
 * - 保存为草稿或提交
 */

const props = defineProps<{
  indicator: Indicator
  fill?: IndicatorFill | null // 编辑模式：传入已有填报记录
  readonly?: boolean // 只读模式
}>()

const emit = defineEmits<{
  (e: 'saved', fill: IndicatorFill): void
  (e: 'submitted', fill: IndicatorFill): void
  (e: 'cancel'): void
}>()

const planStore = usePlanStore()

// 表单数据
const formData = ref<IndicatorFillForm>({
  indicator_id: props.indicator.id,
  progress: 0,
  content: '',
  milestone_id: undefined
})

// 附件列表
const fileList = ref<UploadUserFile[]>([])

// 提交中状态
const saving = ref(false)
const submitting = ref(false)

// 表单引用
const formRef = ref<InstanceType<typeof ElForm>>()

// 表单验证规则
const rules = {
  progress: [
    { required: true, message: '请输入进度值', trigger: 'blur' },
    { type: 'number', min: 0, max: 100, message: '进度值范围为0-100', trigger: 'blur' }
  ],
  content: [
    { required: true, message: '请填写填报说明', trigger: 'blur' },
    { min: 10, message: '填报说明至少10个字符', trigger: 'blur' }
  ]
}

// 获取当前里程碑（用于关联）
const currentMilestone = computed(() => {
  if (!props.indicator.milestones || props.indicator.milestones.length === 0) {
    return null
  }

  const sortedMilestones = sortMilestonesByProgress(props.indicator.milestones)

  // 找到第一个未完成的里程碑
  return sortedMilestones.find(m => m.status !== 'completed') || sortedMilestones[0]
})

// 初始化表单数据（编辑模式）
const initFormData = () => {
  if (props.fill) {
    formData.value = {
      indicator_id: props.fill.indicator_id,
      progress: props.fill.progress,
      content: props.fill.content,
      milestone_id: props.fill.milestone_id
    }

    // 恢复附件列表
    if (props.fill.attachments && props.fill.attachments.length > 0) {
      fileList.value = props.fill.attachments.map((att, idx) => ({
        name: att.name,
        url: att.url,
        uid: Date.now() + idx,
        status: 'success'
      }))
    }
  } else {
    // 新建模式，使用默认值
    formData.value = {
      indicator_id: props.indicator.id,
      progress: props.indicator.latest_progress || 0,
      content: '',
      milestone_id: currentMilestone.value?.id
    }
  }
}

// 保存草稿
const handleSave = async () => {
  if (!formRef.value) {
    return
  }

  try {
    await formRef.value.validate()
  } catch {
    ElMessage.warning('请完善必填信息')
    return
  }

  saving.value = true

  try {
    logger.info('[IndicatorFillForm] Saving fill...', formData.value)

    const response = await planStore.saveIndicatorFill(formData.value)

    if (response) {
      ElMessage.success('保存成功')
      emit('saved', response)
    }
  } catch (err) {
    logger.error('[IndicatorFillForm] Failed to save fill:', err)
    if (!(err instanceof Error) || !err.message) {
      ElMessage.error('保存失败，请重试')
    }
  } finally {
    saving.value = false
  }
}

// 提交审核
const handleSubmit = async () => {
  if (!formRef.value) {
    return
  }

  try {
    await formRef.value.validate()
  } catch {
    ElMessage.warning('请完善必填信息')
    return
  }

  submitting.value = true

  try {
    logger.info('[IndicatorFillForm] Submitting fill...', formData.value)

    // 先保存，再提交到待审核队列
    const savedFill = await planStore.saveIndicatorFill(formData.value)

    if (savedFill?.id != null) {
      const response = await planStore.submitIndicatorFill(savedFill.id)
      ElMessage.success('提交成功')
      emit('submitted', response)
    }
  } catch (err) {
    logger.error('[IndicatorFillForm] Failed to submit fill:', err)
    if (!(err instanceof Error) || !err.message) {
      ElMessage.error('提交失败，请重试')
    }
  } finally {
    submitting.value = false
  }
}

// 取消
const handleCancel = () => {
  emit('cancel')
}

// 附件上传相关
const handleFileChange: UploadProps['onChange'] = (uploadFile, uploadFiles) => {
  fileList.value = uploadFiles
}

const handleFileRemove: UploadProps['onRemove'] = () => {
  // 文件移除时的处理
}

const beforeUpload: UploadProps['beforeUpload'] = file => {
  const isLt10M = file.size / 1024 / 1024 < 10
  if (!isLt10M) {
    ElMessage.error('附件大小不能超过 10MB')
  }
  return isLt10M
}

// 进度条格式化
const progressFormat = (val: number) => {
  return `${val}%`
}

// 监听 props.fill 变化
watch(
  () => props.fill,
  () => {
    initFormData()
  },
  { immediate: true }
)
</script>

<template>
  <div class="indicator-fill-form">
    <!-- 指标信息头部 -->
    <div class="form-header">
      <div class="indicator-info">
        <h3 class="indicator-name">{{ indicator.name }}</h3>
        <p class="indicator-definition">{{ indicator.definition }}</p>
      </div>

      <!-- 关联里程碑 -->
      <div v-if="currentMilestone" class="milestone-tag">
        <el-tag type="info" effect="light">
          <el-icon><Document /></el-icon>
          {{ currentMilestone.name }} (目标: {{ currentMilestone.targetProgress }}%)
        </el-tag>
      </div>
    </div>

    <!-- 表单 -->
    <ElForm ref="formRef" :model="formData" :rules="rules" label-position="top" class="fill-form">
      <!-- 进度值 -->
      <ElFormItem label="当前进度" prop="progress">
        <div class="progress-input">
          <ElInputNumber
            v-model="formData.progress"
            :min="0"
            :max="100"
            :disabled="readonly"
            :precision="0"
            class="progress-number"
          />
          <ElSlider
            v-model="formData.progress"
            :min="0"
            :max="100"
            :disabled="readonly"
            :format-tooltip="progressFormat"
            class="progress-slider"
          />
        </div>
      </ElFormItem>

      <!-- 填报说明 -->
      <ElFormItem label="填报说明" prop="content">
        <ElInput
          v-model="formData.content"
          type="textarea"
          :disabled="readonly"
          :rows="5"
          :maxlength="1000"
          show-word-limit
          placeholder="请详细描述当前指标的完成情况、取得的成果、存在的问题等..."
        />
      </ElFormItem>

      <!-- 附件上传 -->
      <ElFormItem label="附件">
        <ElUpload
          v-model:file-list="fileList"
          :disabled="readonly"
          :auto-upload="false"
          :on-change="handleFileChange"
          :on-remove="handleFileRemove"
          :before-upload="beforeUpload"
          multiple
          drag
          class="fill-upload"
        >
          <div v-if="fileList.length === 0" class="upload-content">
            <el-icon class="upload-icon"><UploadFilled /></el-icon>
            <div class="upload-text">
              <p>拖拽文件到此处或点击上传</p>
              <p class="upload-hint">支持图片、PDF、Word等格式，单个文件不超过10MB</p>
            </div>
          </div>
          <template #tip>
            <div class="upload-tip">
              <el-icon><Paperclip /></el-icon>
              <span>支持上传证明材料，如截图、报告等</span>
            </div>
          </template>
        </ElUpload>
      </ElFormItem>

      <!-- 历史记录摘要 -->
      <div v-if="indicator.latest_fill_date" class="history-summary">
        <div class="summary-header">
          <span class="summary-label">上次填报</span>
          <span class="summary-date">{{ indicator.latest_fill_date }}</span>
        </div>
        <div class="summary-progress">
          <span class="progress-label">进度</span>
          <ElTag type="info" size="small">{{ indicator.latest_progress }}%</ElTag>
        </div>
      </div>
    </ElForm>

    <!-- 操作按钮 -->
    <div v-if="!readonly" class="form-actions">
      <ElButton @click="handleCancel">取消</ElButton>
      <ElButton type="primary" :loading="saving" @click="handleSave"> 保存草稿 </ElButton>
      <ElButton type="success" :loading="submitting" @click="handleSubmit"> 提交审核 </ElButton>
    </div>
  </div>
</template>

<script lang="ts">
import { Document } from '@element-plus/icons-vue'
</script>

<style scoped>
.indicator-fill-form {
  padding: 20px 0;
}

.form-header {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.indicator-info {
  margin-bottom: 12px;
}

.indicator-name {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.indicator-definition {
  margin: 0;
  font-size: 14px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.milestone-tag {
  display: flex;
  gap: 8px;
}

.fill-form {
  margin-bottom: 24px;
}

.progress-input {
  width: 100%;
}

.progress-number {
  margin-bottom: 16px;
}

.progress-slider {
  width: calc(100% - 120px);
}

.fill-upload {
  width: 100%;
}

.upload-content {
  padding: 20px;
  text-align: center;
}

.upload-icon {
  font-size: 48px;
  color: var(--el-color-primary);
  margin-bottom: 12px;
}

.upload-text p {
  margin: 4px 0;
}

.upload-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.upload-tip {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.history-summary {
  padding: 12px 16px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  border-left: 3px solid var(--el-color-info);
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.summary-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.summary-date {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.summary-progress {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-light);
}

:deep(.el-upload-dragger) {
  width: 100%;
  min-height: 120px;
}

:deep(.el-form-item__label) {
  font-weight: 500;
  color: var(--el-text-color-regular);
}
</style>
