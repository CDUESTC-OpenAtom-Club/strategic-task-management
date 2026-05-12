<script setup lang="ts">
/**
 * ApprovalSetupDialog - Shared approval setup dialog component
 *
 * Extracts the duplicated approval setup dialog pattern from:
 * - StrategicTaskView.vue
 * - IndicatorDistributeView.vue
 * - IndicatorListView.vue
 *
 * @example
 * ```vue
 * <ApprovalSetupDialog
 *   v-model="approvalSetupDialogVisible"
 *   :loading="approvalPreviewLoading"
 *   :submitting="approvalSubmitting"
 *   :plan-name="currentPlan?.name"
 *   :workflow-name="approvalWorkflowPreview?.workflowName"
 *   :workflow-code="PLAN_APPROVAL_SUBMIT_WORKFLOW_CODE"
 *   :steps="approvalWorkflowPreview?.steps"
 *   :has-preview="hasApprovalPreview"
 *   :can-submit="canSubmitApproval"
 *   :submit-disabled-reason="submitDisabledReason"
 *   @submit="confirmPlanApprovalSubmission"
 *   @close="handleCloseApprovalSetupDialog"
 * />
 * ```
 */

import { computed } from 'vue'
import AppAvatar from '@/shared/ui/avatar/AppAvatar.vue'

export interface ApprovalStepCandidate {
  userId: string | number
  name?: string
  realName?: string
  userName?: string
}

export interface ApprovalStepPreview {
  stepDefId: string | number
  stepOrder: number
  stepName: string
  candidateApprovers?: ApprovalStepCandidate[]
}

export interface ApprovalSetupDialogProps {
  /** Dialog visibility (v-model) */
  modelValue: boolean
  /** Whether the preview is loading */
  loading?: boolean
  /** Whether the approval is being submitted */
  submitting?: boolean
  /** Plan name to display */
  planName?: string
  /** Workflow name to display */
  workflowName?: string
  /** Workflow code fallback */
  workflowCode?: string
  /** Approval steps preview */
  steps?: ApprovalStepPreview[]
  /** Whether the preview data is available */
  hasPreview?: boolean
  /** Whether the submit button should be enabled */
  canSubmit?: boolean
  /** Reason why submit is disabled (tooltip) */
  submitDisabledReason?: string
}

const props = withDefaults(defineProps<ApprovalSetupDialogProps>(), {
  loading: false,
  submitting: false,
  planName: '',
  workflowName: '',
  workflowCode: '',
  steps: () => [],
  hasPreview: false,
  canSubmit: true,
  submitDisabledReason: ''
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: []
  close: []
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

const displayWorkflowName = computed(() => {
  return props.workflowName || props.workflowCode || '未知流程'
})

const hasSteps = computed(() => {
  return props.steps && props.steps.length > 0
})

const normalizeCandidateDisplayName = (candidate: ApprovalStepCandidate): string => {
  return candidate.name || candidate.realName || candidate.userName || '未知用户'
}

const hasApprovalStepCandidates = (candidates?: ApprovalStepCandidate[]): boolean => {
  return Boolean(candidates && candidates.length > 0)
}

const handleClose = () => {
  visible.value = false
  emit('close')
}

const handleSubmit = () => {
  emit('submit')
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="确认审批流程"
    width="640px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <div v-loading="loading" class="approval-setup-dialog">
      <!-- Plan summary -->
      <div v-if="planName" class="approval-setup-summary">
        <div class="summary-row">
          <span class="summary-label">当前计划：</span>
          <span class="summary-value">{{ planName }}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">审批流程：</span>
          <span class="summary-value">{{ displayWorkflowName }}</span>
        </div>
      </div>

      <!-- Steps list -->
      <div v-if="hasPreview && hasSteps" class="approval-step-list">
        <div v-for="step in steps" :key="step.stepDefId" class="approval-step-card">
          <div class="approval-step-header">
            <div class="approval-step-order">步骤 {{ step.stepOrder }}</div>
            <div class="approval-step-name">{{ step.stepName }}</div>
          </div>
          <div class="approval-step-users">
            <span class="approval-step-users-label">可审批用户：</span>
            <div
              v-if="hasApprovalStepCandidates(step.candidateApprovers)"
              class="approval-step-user-list"
            >
              <div
                v-for="candidate in step.candidateApprovers"
                :key="candidate.userId"
                class="approval-step-user-item"
              >
                <AppAvatar
                  :size="32"
                  :name="normalizeCandidateDisplayName(candidate)"
                  class="approval-step-user-avatar"
                />
                <span class="approval-step-user-name">
                  {{ normalizeCandidateDisplayName(candidate) }}
                </span>
              </div>
            </div>
            <span v-else class="approval-step-users-value">系统自动分配</span>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <el-empty
        v-if="!loading && !hasPreview"
        description="暂未加载到审批流程定义"
        :image-size="88"
      />
    </div>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-tooltip :content="submitDisabledReason" :disabled="!submitDisabledReason" placement="top">
        <el-button
          type="primary"
          :loading="submitting"
          :disabled="loading || !hasPreview || !canSubmit"
          @click="handleSubmit"
        >
          确认发起审批
        </el-button>
      </el-tooltip>
    </template>
  </el-dialog>
</template>

<style scoped>
.approval-setup-summary {
  margin-bottom: 20px;
}

.summary-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.summary-label {
  color: var(--el-text-color-secondary);
  margin-right: 8px;
  white-space: nowrap;
}

.summary-value {
  color: var(--el-text-color-primary);
  font-weight: 500;
}

.approval-step-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.approval-step-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 16px;
  background: var(--el-fill-color-blank);
}

.approval-step-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.approval-step-order {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.approval-step-name {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.approval-step-users {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.approval-step-users-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.approval-step-user-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.approval-step-user-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
}

.approval-step-user-avatar {
  flex-shrink: 0;
}

.approval-step-user-name {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.approval-step-users-value {
  font-size: 13px;
  color: var(--el-text-color-placeholder);
  font-style: italic;
}
</style>
