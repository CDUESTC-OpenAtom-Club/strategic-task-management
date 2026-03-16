<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  ElCard,
  ElButton,
  ElSelect,
  ElOption,
  ElTag,
  ElAvatar,
  ElIcon,
  ElEmpty,
  ElSkeleton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElSwitch,
  ElMessage,
  type FormInstance
} from 'element-plus'
import {
  Check,
  Close,
  Loading,
  Clock,
  Edit,
  User as _User,
  Setting,
  CirclePlus
} from '@element-plus/icons-vue'
import type { WorkflowNode, ApprovalTemplate, ApprovalTemplateStep } from '@/5-shared/types'

/**
 * 自定义审批流程组件
 *
 * 功能：
 * - 数据驱动的审批流程展示
 * - 支持自定义审批人
 * - 支持保存审批模板
 * - 垂直时间轴展示
 * - 当前节点呼吸灯效果
 */

const props = defineProps<{
  // 审批节点列表
  nodes: WorkflowNode[]
  // 当前节点ID
  currentNodeId?: string
  // 驳回原因
  rejectionReason?: string
  // 是否允许自定义审批人
  allowCustomApprover?: boolean
  // 是否只读
  readonly?: boolean
}>()

const emit = defineEmits<{
  // 添加节点
  (e: 'addNode'): void
  // 更新审批人
  (e: 'updateApprover', nodeId: string, approverId: string): void
  // 保存为模板
  (e: 'saveTemplate', templateName: string, steps: ApprovalTemplateStep[]): void
  // 应用模板
  (e: 'applyTemplate', templateId: string): void
}>()

// ============ 状态 ============
const loading = ref(false)
const editingNode = ref<string | null>(null)
const customApprovers = ref<Record<string, string>>({})
const showTemplateDialog = ref(false)
const showManageTemplateDialog = ref(false)
const setAsDefaultTemplate = ref(false)

// 审批模板
const templates = ref<ApprovalTemplate[]>([])
const selectedTemplateId = ref<string | null>(null)

// 新建模板表单
const newTemplateName = ref('')
const newTemplateDesc = ref('')
const _templateFormRef = ref<FormInstance>()

// 模拟组织人员数据
const organizationUsers = ref([
  { id: 'user-001', name: '张主任', org: '战略发展部', role: 'strategic_dept' },
  { id: 'user-002', name: '李主任', org: '战略发展部', role: 'strategic_dept' },
  { id: 'user-003', name: '王校长', org: '校长办公室', role: 'strategic_dept' },
  { id: 'user-004', name: '赵处长', org: '教务处', role: 'functional_dept' },
  { id: 'user-005', name: '钱处长', org: '人事处', role: 'functional_dept' }
])

// 当前激活的步骤索引
const _activeStepIndex = computed(() => {
  return props.nodes.findIndex(n => n.status === 'current')
})

// 是否有驳回
const hasRejection = computed(() => {
  return props.nodes.some(n => n.status === 'rejected')
})

// 获取节点图标
const getNodeIcon = (status: WorkflowNode['status']) => {
  switch (status) {
    case 'completed': return Check
    case 'current': return Loading
    case 'rejected': return Close
    default: return Clock
  }
}

// 获取节点状态类
const getNodeClass = (status: WorkflowNode['status']) => {
  return `node-${status}`
}

// 格式化时间
const formatTime = (date?: Date) => {
  if (!date) {return ''}
  const d = new Date(date)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

// 获取用户信息
const _getUserInfo = (userId?: string) => {
  if (!userId) {return null}
  return organizationUsers.value.find(u => u.id === userId)
}

// 检查节点是否可编辑
const canEditNode = (node: WorkflowNode) => {
  if (!props.allowCustomApprover || props.readonly) {return false}
  // 只能编辑当前或待处理的节点
  return node.status === 'current' || node.status === 'pending'
}

// 编辑审批人
const startEditApprover = (nodeId: string) => {
  editingNode.value = nodeId
}

// 确认审批人修改
const confirmApproverChange = (nodeId: string) => {
  const approverId = customApprovers.value[nodeId]
  if (approverId) {
    emit('updateApprover', nodeId, approverId)
    ElMessage.success('审批人已更新')
  }
  editingNode.value = null
}

// 取消编辑
const cancelEdit = (nodeId: string) => {
  delete customApprovers.value[nodeId]
  editingNode.value = null
}

// 打开模板管理对话框
const openTemplateDialog = () => {
  showTemplateDialog.value = true
}

// 应用模板
const applyTemplate = () => {
  if (selectedTemplateId.value) {
    emit('applyTemplate', selectedTemplateId.value)
    showTemplateDialog.value = false
    ElMessage.success('模板已应用')
  }
}

// 打开新建模板对话框
const openNewTemplateDialog = () => {
  newTemplateName.value = ''
  newTemplateDesc.value = ''
  showManageTemplateDialog.value = true
}

// 保存为模板
const saveAsTemplate = async () => {
  if (!newTemplateName.value) {
    ElMessage.warning('请输入模板名称')
    return
  }

  const steps: ApprovalTemplateStep[] = props.nodes.map((node, index) => ({
    id: `step-${Date.now()}-${index}`,
    stepOrder: index,
    stepName: node.name,
    requiredRole: 'strategic_dept', // 默认值，实际应根据业务逻辑获取
    allowCustomApprover: true,
    autoApprove: false
  }))

  emit('saveTemplate', newTemplateName.value, steps)
  showManageTemplateDialog.value = false
  showTemplateDialog.value = false
  ElMessage.success('模板保存成功')
}

// 删除模板
const _deleteTemplate = (templateId: string) => {
  templates.value = templates.value.filter(t => t.id !== templateId)
  ElMessage.success('模板已删除')
}

// 加载模板列表（模拟）
const loadTemplates = () => {
  templates.value = [
    {
      id: 'tpl-001',
      name: '标准审批流程',
      description: '撰写 → 主任审核 → 校长审批',
      isDefault: true,
      steps: [
        { id: 'step-1', stepOrder: 0, stepName: '提交申请', requiredRole: 'strategic_dept', allowCustomApprover: false, autoApprove: true },
        { id: 'step-2', stepOrder: 1, stepName: '主任审核', requiredRole: 'strategic_dept', allowCustomApprover: true, autoApprove: false },
        { id: 'step-3', stepOrder: 2, stepName: '校长审批', requiredRole: 'strategic_dept', allowCustomApprover: true, autoApprove: false }
      ],
      applicableRoles: ['strategic_dept', 'functional_dept', 'secondary_college'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'tpl-002',
      name: '简化审批流程',
      description: '直接提交 → 自动通过',
      isDefault: false,
      steps: [
        { id: 'step-1', stepOrder: 0, stepName: '提交申请', requiredRole: 'strategic_dept', allowCustomApprover: false, autoApprove: true },
        { id: 'step-2', stepOrder: 1, stepName: '系统自动审批', requiredRole: 'strategic_dept', allowCustomApprover: false, autoApprove: true }
      ],
      applicableRoles: ['secondary_college'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]
}

// ============ 生命周期 ============
onMounted(() => {
  loadTemplates()
})
</script>

<template>
  <div class="custom-approval-flow">
    <!-- 头部操作区 -->
    <div v-if="!readonly" class="flow-header">
      <div class="header-left">
        <h3 class="flow-title">审批流程</h3>
        <p class="flow-desc">配置审批流程，支持自定义审批人</p>
      </div>
      <div class="header-actions">
        <ElButton
          :icon="Setting"
          size="small"
          @click="openTemplateDialog"
        >
          应用模板
        </ElButton>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <ElSkeleton :rows="3" animated />
    </div>

    <!-- 空状态 -->
    <div v-else-if="nodes.length === 0" class="empty-container">
      <el-empty description="暂无审批流程">
        <ElButton type="primary" :icon="CirclePlus" @click="$emit('addNode')">
          添加审批节点
        </ElButton>
      </el-empty>
    </div>

    <!-- 审批流程展示 -->
    <div v-else class="flow-content">
      <!-- 垂直时间轴式审批流程 -->
      <div class="approval-timeline">
        <div
          v-for="(node, index) in nodes"
          :key="node.id"
          :class="[
            'timeline-item',
            getNodeClass(node.status),
            { 'is-current': node.status === 'current', 'is-editing': editingNode === node.id }
          ]"
        >
          <!-- 节点图标 -->
          <div class="timeline-icon">
            <el-icon :is="getNodeIcon(node.status)" class="node-icon-inner" />
          </div>

          <!-- 连接线 -->
          <div v-if="index < nodes.length - 1" class="timeline-line"></div>

          <!-- 节点内容卡片 -->
          <div class="timeline-content">
            <ElCard class="node-card" shadow="hover">
              <!-- 卡片头部 -->
              <div class="node-header">
                <div class="node-title-row">
                  <span class="node-step">步骤 {{ index + 1 }}</span>
                  <span class="node-name">{{ node.name }}</span>
                </div>

                <!-- 当前节点标识 -->
                <ElTag v-if="node.status === 'current'" type="warning" effect="light" size="small">
                  <el-icon class="pulse-icon"><Loading /></el-icon>
                  待处理
                </ElTag>
                <ElTag v-else-if="node.status === 'completed'" type="success" effect="light" size="small">
                  <el-icon><Check /></el-icon>
                  已完成
                </ElTag>
                <ElTag v-else-if="node.status === 'rejected'" type="danger" effect="light" size="small">
                  <el-icon><Close /></el-icon>
                  已驳回
                </ElTag>
                <ElTag v-else type="info" effect="light" size="small">
                  <el-icon><Clock /></el-icon>
                  等待中
                </ElTag>
              </div>

              <!-- 审批人信息 -->
              <div class="node-approver">
                <div class="approver-info">
                  <el-avatar :size="32" class="approver-avatar">
                    {{ (node.operatorName || '待定')[0] }}
                  </el-avatar>
                  <div class="approver-details">
                    <span class="approver-name">
                      {{ node.operatorName || '待分配' }}
                    </span>
                    <span v-if="node.operateTime" class="approve-time">
                      {{ formatTime(node.operateTime) }}
                    </span>
                  </div>
                </div>

                <!-- 自定义审批人按钮 -->
                <ElButton
                  v-if="canEditNode(node)"
                  :icon="editingNode === node.id ? Check : Edit"
                  size="small"
                  :type="editingNode === node.id ? 'success' : 'primary'"
                  link
                  @click="editingNode === node.id ? confirmApproverChange(node.id) : startEditApprover(node.id)"
                >
                  {{ editingNode === node.id ? '确认' : '修改审批人' }}
                </ElButton>
              </div>

              <!-- 审批意见 -->
              <div v-if="node.comment" class="node-comment">
                <div class="comment-label">审批意见：</div>
                <div class="comment-text">{{ node.comment }}</div>
              </div>

              <!-- 编辑审批人选择器 -->
              <div v-if="editingNode === node.id" class="approver-selector">
                <ElSelect
                  v-model="customApprovers[node.id]"
                  placeholder="选择审批人"
                  filterable
                  class="approver-select"
                >
                  <ElOption
                    v-for="user in organizationUsers"
                    :key="user.id"
                    :label="`${user.name} - ${user.org}`"
                    :value="user.id"
                  >
                    <div class="user-option">
                      <ElAvatar :size="24" class="user-option-avatar">
                        {{ user.name[0] }}
                      </ElAvatar>
                      <div class="user-option-info">
                        <span class="user-option-name">{{ user.name }}</span>
                        <span class="user-option-org">{{ user.org }}</span>
                      </div>
                    </div>
                  </ElOption>
                </ElSelect>
                <ElButton
                  size="small"
                  link
                  type="info"
                  @click="cancelEdit(node.id)"
                >
                  取消
                </ElButton>
              </div>
            </ElCard>
          </div>
        </div>
      </div>

      <!-- 驳回原因提示 -->
      <ElAlert
        v-if="hasRejection && rejectionReason"
        type="error"
        :title="'驳回原因：' + rejectionReason"
        show-icon
        :closable="false"
        class="rejection-alert"
      />
    </div>

    <!-- 模板选择对话框 -->
    <ElDialog
      v-model="showTemplateDialog"
      title="选择审批模板"
      width="600px"
    >
      <div class="template-list">
        <div
          v-for="template in templates"
          :key="template.id"
          :class="['template-item', { 'is-selected': selectedTemplateId === template.id }]"
          @click="selectedTemplateId = template.id"
        >
          <div class="template-info">
            <div class="template-header">
              <h4 class="template-name">{{ template.name }}</h4>
              <ElTag v-if="template.isDefault" type="success" size="small" effect="light">
                默认
              </ElTag>
            </div>
            <p class="template-desc">{{ template.description }}</p>
            <div class="template-steps">
              <ElTag
                v-for="(step, index) in template.steps"
                :key="step.id"
                size="small"
                :type="step.autoApprove ? 'info' : 'warning'"
                effect="plain"
              >
                {{ index + 1 }}. {{ step.stepName }}
              </ElTag>
            </div>
          </div>
          <div v-if="selectedTemplateId === template.id" class="template-selected">
            <el-icon><Check /></el-icon>
          </div>
        </div>
      </div>

      <template #footer>
        <ElButton @click="showTemplateDialog = false">取消</ElButton>
        <ElButton type="primary" :disabled="!selectedTemplateId" @click="applyTemplate">
          应用模板
        </ElButton>
        <ElButton type="success" :icon="CirclePlus" @click="openNewTemplateDialog">
          保存当前为模板
        </ElButton>
      </template>
    </ElDialog>

    <!-- 新建模板对话框 -->
    <ElDialog
      v-model="showManageTemplateDialog"
      title="保存审批模板"
      width="500px"
    >
      <ElForm>
        <ElFormItem label="模板名称" required>
          <ElInput
            v-model="newTemplateName"
            placeholder="请输入模板名称"
            maxlength="50"
            show-word-limit
          />
        </ElFormItem>
        <ElFormItem label="模板描述">
          <ElInput
            v-model="newTemplateDesc"
            type="textarea"
            :rows="3"
            placeholder="请输入模板描述（可选）"
            maxlength="200"
            show-word-limit
          />
        </ElFormItem>
        <ElFormItem label="设为默认">
          <ElSwitch v-model="setAsDefaultTemplate" active-text="是" inactive-text="否" />
        </ElFormItem>
      </ElForm>

      <template #footer>
        <ElButton @click="showManageTemplateDialog = false">取消</ElButton>
        <ElButton type="primary" @click="saveAsTemplate">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
.custom-approval-flow {
  padding: 16px 0;
}

/* 头部 */
.flow-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.flow-title {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.flow-desc {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.header-actions {
  display: flex;
  gap: 8px;
}

/* 加载和空状态 */
.loading-container {
  padding: 20px;
}

.empty-container {
  padding: 40px 20px;
}

/* 审批时间轴 */
.approval-timeline {
  position: relative;
}

.timeline-item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding-bottom: 24px;
}

.timeline-item:last-child {
  padding-bottom: 0;
}

.timeline-icon {
  position: relative;
  z-index: 2;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--el-fill-color-light);
  border: 2px solid var(--el-border-color);
  transition: all var(--transition-normal);
}

.timeline-item.node-completed .timeline-icon {
  background: var(--el-color-success-light-9);
  border-color: var(--el-color-success);
  color: var(--el-color-success);
}

.timeline-item.node-current .timeline-icon {
  background: var(--el-color-warning-light-9);
  border-color: var(--el-color-warning);
  color: var(--el-color-warning);
  animation: pulse 2s ease-in-out infinite;
}

.timeline-item.node-rejected .timeline-icon {
  background: var(--el-color-danger-light-9);
  border-color: var(--el-color-danger);
  color: var(--el-color-danger);
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(230, 162, 60, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(230, 162, 60, 0);
  }
}

.node-icon-inner {
  font-size: 18px;
}

.timeline-line {
  position: absolute;
  left: 20px;
  top: 40px;
  bottom: -24px;
  width: 2px;
  background: var(--el-border-color-lighter);
  z-index: 1;
}

.timeline-item:last-child .timeline-line {
  display: none;
}

.timeline-item.node-completed .timeline-line {
  background: var(--el-color-success-light-7);
}

/* 内容卡片 */
.timeline-content {
  flex: 1;
  min-width: 0;
}

.node-card {
  transition: all var(--transition-normal);
}

.timeline-item.is-current .node-card {
  border-color: var(--el-color-warning);
  box-shadow: 0 0 0 1px var(--el-color-warning-light-7);
}

.timeline-item.is-editing .node-card {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 1px var(--el-color-primary-light-7);
}

/* 节点头部 */
.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.node-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.node-step {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  padding: 2px 8px;
  border-radius: 12px;
}

.node-name {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.pulse-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 审批人信息 */
.node-approver {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--el-fill-color-lighter);
  border-radius: var(--radius-sm);
  margin-bottom: 8px;
}

.approver-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.approver-avatar {
  background: var(--el-color-primary);
  color: var(--el-color-white);
}

.approver-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.approver-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.approve-time {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* 审批意见 */
.node-comment {
  padding: 8px 12px;
  background: var(--el-fill-color-light);
  border-radius: var(--radius-sm);
  margin-bottom: 8px;
}

.comment-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}

.comment-text {
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.5;
}

/* 审批人选择器 */
.approver-selector {
  padding: 12px;
  background: var(--el-color-primary-light-9);
  border-radius: var(--radius-sm);
  display: flex;
  gap: 8px;
  align-items: center;
}

.approver-select {
  flex: 1;
}

.user-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-option-avatar {
  font-size: 12px;
  background: var(--el-color-primary);
  color: var(--el-color-white);
}

.user-option-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-option-name {
  font-size: 14px;
  font-weight: 500;
}

.user-option-org {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* 驳回提示 */
.rejection-alert {
  margin-top: 16px;
}

/* 模板列表 */
.template-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.template-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border: 2px solid var(--el-border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.template-item:hover {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-fill-color-lighter);
}

.template-item.is-selected {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.template-info {
  flex: 1;
}

.template-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.template-name {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.template-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.template-steps {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.template-selected {
  color: var(--el-color-success);
}

.template-selected .el-icon {
  font-size: 20px;
}
</style>
