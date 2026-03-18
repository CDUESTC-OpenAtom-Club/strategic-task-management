<template>
  <el-drawer
    v-model="visible"
    title="任务审批"
    direction="rtl"
    size="640px"
    :before-close="handleClose"
  >
    <div v-loading="loading" class="drawer-content">
      <el-empty v-if="!loading && pendingApprovals.length === 0" description="暂无待审批任务" />

      <div v-else class="approval-list">
        <div v-for="instance in pendingApprovals" :key="instance.id" class="approval-card">
          <div class="approval-header">
            <div class="approval-title">{{ instance.title || `${instance.entityType} #${instance.entityId}` }}</div>
            <el-tag type="warning" size="small">{{ instance.status }}</el-tag>
          </div>

          <div class="approval-meta">
            <div>实例ID: {{ instance.id }}</div>
            <div>实体类型: {{ instance.entityType }}</div>
            <div>实体ID: {{ instance.entityId }}</div>
            <div>发起人ID: {{ instance.requesterId }}</div>
            <div>发起时间: {{ formatTime(instance.startedAt || instance.createdAt) }}</div>
          </div>

          <div class="approval-actions">
            <el-button type="success" @click="handleApprove(instance)">通过</el-button>
            <el-button type="danger" @click="handleReject(instance)">驳回</el-button>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="drawer-footer">
        <span class="footer-summary">待审批 {{ pendingApprovals.length }} 项</span>
        <el-button @click="handleClose">关闭</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, ElLoading } from 'element-plus'
import { approvalApi } from '@/3-features/approval/api/approval'
import { useAuthStore } from '@/3-features/auth/model/store'
import { logger } from '@/5-shared/lib/utils/logger'

interface PendingApprovalInstance {
  id: number
  title?: string | null
  entityType: string
  entityId: number
  status: string
  requesterId?: number | null
  startedAt?: string | null
  createdAt?: string | null
}

const props = defineProps<{
  modelValue: boolean
  indicatorId?: string | number
  showApprovalSection?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
  refresh: []
}>()

const authStore = useAuthStore()
const loading = ref(false)
const pendingApprovals = ref<PendingApprovalInstance[]>([])

const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
})

const formatTime = (raw?: string | null) => {
  if (!raw) {
    return '-'
  }
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) {
    return raw
  }
  return date.toLocaleString('zh-CN')
}

const loadPendingApprovals = async () => {
  loading.value = true
  try {
    const userId = authStore.user?.id || 1
    const response = await approvalApi.getPendingApprovals(userId)
    pendingApprovals.value = (response.data || []) as unknown as PendingApprovalInstance[]
    logger.info('[TaskApprovalDrawer] Pending approvals loaded', {
      userId,
      count: pendingApprovals.value.length
    })
  } catch (error) {
    logger.error('[TaskApprovalDrawer] Failed to load pending approvals', error)
    ElMessage.error('加载待审批任务失败')
  } finally {
    loading.value = false
  }
}

const handleApprove = async (instance: PendingApprovalInstance) => {
  try {
    const { value } = await ElMessageBox.prompt('请输入审批意见（可选）', '审批通过', {
      confirmButtonText: '确认通过',
      cancelButtonText: '取消',
      inputType: 'textarea'
    })
    const userId = authStore.user?.id || 1
    const loadingInstance = ElLoading.service({ lock: true, text: '正在审批...' })
    try {
      const response = await approvalApi.approve(instance.id, { userId, comment: value || '审批通过' })
      if (response.success) {
        ElMessage.success(`审批通过成功（实例ID: ${instance.id}）`)
        await loadPendingApprovals()
        emit('refresh')
      } else {
        ElMessage.error(response.message || '审批失败')
      }
    } finally {
      loadingInstance.close()
    }
  } catch {
    // user cancelled
  }
}

const handleReject = async (instance: PendingApprovalInstance) => {
  try {
    const { value } = await ElMessageBox.prompt('请输入驳回原因', '审批驳回', {
      confirmButtonText: '确认驳回',
      cancelButtonText: '取消',
      inputType: 'textarea',
      inputValidator: val => {
        if (!val || !val.trim()) {
          return '请输入驳回原因'
        }
        return true
      }
    })
    const userId = authStore.user?.id || 1
    const loadingInstance = ElLoading.service({ lock: true, text: '正在驳回...' })
    try {
      const response = await approvalApi.reject(instance.id, { userId, comment: value })
      if (response.success) {
        ElMessage.success(`已驳回（实例ID: ${instance.id}）`)
        await loadPendingApprovals()
        emit('refresh')
      } else {
        ElMessage.error(response.message || '驳回失败')
      }
    } finally {
      loadingInstance.close()
    }
  } catch {
    // user cancelled
  }
}

const handleClose = () => {
  visible.value = false
  emit('close')
}

watch(
  () => props.modelValue,
  newVal => {
    if (newVal) {
      loadPendingApprovals()
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.drawer-content {
  padding: 16px;
  min-height: 360px;
}

.approval-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.approval-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 14px;
  background: #fff;
}

.approval-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.approval-title {
  font-weight: 600;
  color: #0f172a;
}

.approval-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 12px;
  color: #475569;
  font-size: 13px;
  margin-bottom: 12px;
}

.approval-actions {
  display: flex;
  gap: 10px;
}

.drawer-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.footer-summary {
  color: #64748b;
  font-size: 13px;
}
</style>
