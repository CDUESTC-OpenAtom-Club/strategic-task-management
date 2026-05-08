<template>
  <div class="workflow-task-center">
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">待办中心</h1>
        <p class="page-desc">集中查看待我处理、我已处理和我发起的流程事项。</p>
      </div>
      <div class="page-actions">
        <el-button @click="goToMessages">消息中心</el-button>
        <el-button
          type="primary"
          :icon="Refresh"
          :loading="activeLoading"
          @click="refreshActiveTab"
        >
          刷新
        </el-button>
      </div>
    </div>

    <div class="summary-grid">
      <el-card shadow="never" class="summary-card">
        <div class="summary-card__icon summary-card__icon--pending">
          <el-icon><Clock /></el-icon>
        </div>
        <div class="summary-card__body">
          <span class="summary-card__label">待我处理</span>
          <strong class="summary-card__value">{{ pendingState.total }}</strong>
        </div>
      </el-card>
      <el-card shadow="never" class="summary-card">
        <div class="summary-card__icon summary-card__icon--processed">
          <el-icon><Finished /></el-icon>
        </div>
        <div class="summary-card__body">
          <span class="summary-card__label">我已处理</span>
          <strong class="summary-card__value">{{ approvedState.total }}</strong>
        </div>
      </el-card>
      <el-card shadow="never" class="summary-card">
        <div class="summary-card__icon summary-card__icon--applied">
          <el-icon><Promotion /></el-icon>
        </div>
        <div class="summary-card__body">
          <span class="summary-card__label">我发起的</span>
          <strong class="summary-card__value">{{ appliedState.total }}</strong>
        </div>
      </el-card>
    </div>

    <el-card shadow="never" class="workflow-card">
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane name="pending">
          <template #label>
            <span class="tab-label">
              待办任务
              <el-badge v-if="pendingState.total > 0" :value="pendingState.total" :max="99" />
            </span>
          </template>

          <el-alert
            v-if="pendingState.error"
            type="warning"
            :closable="false"
            :title="pendingState.error"
            show-icon
            class="list-alert"
          />

          <el-table
            v-loading="pendingState.loading"
            :data="pendingState.items"
            empty-text="当前没有待办任务"
            class="workflow-table"
          >
            <el-table-column label="任务名称" min-width="220">
              <template #default="{ row }">
                <div class="task-name-cell">
                  <strong>{{ row.taskName || '未命名任务' }}</strong>
                  <span class="task-name-cell__sub">{{ row.taskKey || '无任务键' }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="currentStepName" label="当前环节" min-width="160">
              <template #default="{ row }">
                {{ row.currentStepName || '待分配' }}
              </template>
            </el-table-column>
            <el-table-column label="归属组织" min-width="160">
              <template #default="{ row }">
                {{ row.approverOrgName || '未识别' }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="120">
              <template #default="{ row }">
                <el-tag :type="getTaskStatusType(row.status)">
                  {{ row.status || 'UNKNOWN' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="创建时间" width="180">
              <template #default="{ row }">
                {{ formatDisplayTime(row.createdTime || row.startedAt) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="140" fixed="right">
              <template #default>
                <el-button link type="primary" @click="goToWorkbench">前往工作台</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="pagination-wrap">
            <el-pagination
              v-if="pendingState.total > pendingState.pageSize"
              layout="prev, pager, next"
              :current-page="pendingState.pageNum"
              :page-size="pendingState.pageSize"
              :total="pendingState.total"
              @current-change="handlePendingPageChange"
            />
          </div>
        </el-tab-pane>

        <el-tab-pane name="approved">
          <template #label>
            <span class="tab-label">
              已办任务
              <el-badge v-if="approvedState.total > 0" :value="approvedState.total" :max="99" />
            </span>
          </template>

          <el-alert
            v-if="approvedState.error"
            type="warning"
            :closable="false"
            :title="approvedState.error"
            show-icon
            class="list-alert"
          />

          <el-table
            v-loading="approvedState.loading"
            :data="approvedState.items"
            empty-text="当前没有已办任务"
            class="workflow-table"
          >
            <el-table-column label="实例编号" min-width="180">
              <template #default="{ row }">
                {{ row.instanceId || '未生成实例号' }}
              </template>
            </el-table-column>
            <el-table-column prop="currentStepName" label="最后环节" min-width="180">
              <template #default="{ row }">
                {{ row.currentStepName || '已结束' }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="140">
              <template #default="{ row }">
                <el-tag :type="getInstanceStatusType(row.status)">
                  {{ row.status || 'UNKNOWN' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="当前处理人" min-width="160">
              <template #default="{ row }">
                {{ row.currentApproverName || '系统记录为空' }}
              </template>
            </el-table-column>
            <el-table-column label="结束时间" width="180">
              <template #default="{ row }">
                {{ formatDisplayTime(row.endTime || row.startTime) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="140" fixed="right">
              <template #default>
                <el-button link type="primary" @click="goToWorkbench">查看业务页</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="pagination-wrap">
            <el-pagination
              v-if="approvedState.total > approvedState.pageSize"
              layout="prev, pager, next"
              :current-page="approvedState.pageNum"
              :page-size="approvedState.pageSize"
              :total="approvedState.total"
              @current-change="handleApprovedPageChange"
            />
          </div>
        </el-tab-pane>

        <el-tab-pane name="applied">
          <template #label>
            <span class="tab-label">
              我发起的
              <el-badge v-if="appliedState.total > 0" :value="appliedState.total" :max="99" />
            </span>
          </template>

          <el-alert
            v-if="appliedState.error"
            type="warning"
            :closable="false"
            :title="appliedState.error"
            show-icon
            class="list-alert"
          />

          <el-table
            v-loading="appliedState.loading"
            :data="appliedState.items"
            empty-text="当前没有我发起的流程"
            class="workflow-table"
          >
            <el-table-column label="实例编号" min-width="180">
              <template #default="{ row }">
                {{ row.instanceId || '未生成实例号' }}
              </template>
            </el-table-column>
            <el-table-column prop="currentStepName" label="当前环节" min-width="180">
              <template #default="{ row }">
                {{ row.currentStepName || '流程已结束' }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="140">
              <template #default="{ row }">
                <el-tag :type="getInstanceStatusType(row.status)">
                  {{ row.status || 'UNKNOWN' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="当前处理人" min-width="160">
              <template #default="{ row }">
                {{ row.currentApproverName || '等待系统分配' }}
              </template>
            </el-table-column>
            <el-table-column label="发起时间" width="180">
              <template #default="{ row }">
                {{ formatDisplayTime(row.startTime) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="140" fixed="right">
              <template #default>
                <el-button link type="primary" @click="goToWorkbench">查看业务页</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="pagination-wrap">
            <el-pagination
              v-if="appliedState.total > appliedState.pageSize"
              layout="prev, pager, next"
              :current-page="appliedState.pageNum"
              :page-size="appliedState.pageSize"
              :total="appliedState.total"
              @current-change="handleAppliedPageChange"
            />
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Clock, Finished, Promotion, Refresh } from '@element-plus/icons-vue'
import {
  getMyAppliedInstances,
  getMyApprovedInstances,
  getMyPendingTasks,
  type WorkflowInstanceResponse,
  type WorkflowTaskResponse
} from '@/features/workflow/api'
import { formatDateTime } from '@/shared/lib/format'

type TaskCenterTab = 'pending' | 'approved' | 'applied'

interface ListState<T> {
  loading: boolean
  loaded: boolean
  error: string
  items: T[]
  total: number
  pageNum: number
  pageSize: number
}

const router = useRouter()

const activeTab = ref<TaskCenterTab>('pending')

const pendingState = reactive<ListState<WorkflowTaskResponse>>({
  loading: false,
  loaded: false,
  error: '',
  items: [],
  total: 0,
  pageNum: 1,
  pageSize: 10
})

const approvedState = reactive<ListState<WorkflowInstanceResponse>>({
  loading: false,
  loaded: false,
  error: '',
  items: [],
  total: 0,
  pageNum: 1,
  pageSize: 10
})

const appliedState = reactive<ListState<WorkflowInstanceResponse>>({
  loading: false,
  loaded: false,
  error: '',
  items: [],
  total: 0,
  pageNum: 1,
  pageSize: 10
})

const activeLoading = computed(() => {
  switch (activeTab.value) {
    case 'approved':
      return approvedState.loading
    case 'applied':
      return appliedState.loading
    default:
      return pendingState.loading
  }
})

const formatDisplayTime = (value?: string) => {
  return value ? formatDateTime(value, 'YYYY-MM-DD HH:mm') : '未设置'
}

const getTaskStatusType = (status?: string) => {
  if (!status) {
    return 'info'
  }

  const normalized = status.toUpperCase()
  if (normalized.includes('PENDING') || normalized.includes('RUNNING')) {
    return 'warning'
  }
  if (normalized.includes('APPROVED') || normalized.includes('COMPLETED')) {
    return 'success'
  }
  if (normalized.includes('REJECTED') || normalized.includes('FAILED')) {
    return 'danger'
  }
  return 'info'
}

const getInstanceStatusType = (status?: string) => {
  if (!status) {
    return 'info'
  }

  const normalized = status.toUpperCase()
  if (normalized.includes('REVIEW') || normalized.includes('PENDING')) {
    return 'warning'
  }
  if (normalized.includes('APPROVED') || normalized.includes('COMPLETED')) {
    return 'success'
  }
  if (
    normalized.includes('REJECTED') ||
    normalized.includes('FAILED') ||
    normalized.includes('CANCEL')
  ) {
    return 'danger'
  }
  return 'info'
}

const loadPendingTasks = async (pageNum: number = pendingState.pageNum) => {
  pendingState.loading = true
  pendingState.error = ''
  pendingState.pageNum = pageNum

  try {
    const response = await getMyPendingTasks(pageNum)
    pendingState.items = response.data?.items ?? []
    pendingState.total = response.data?.total ?? 0
    pendingState.pageSize = response.data?.pageSize ?? pendingState.pageSize
    pendingState.loaded = true
  } catch (error) {
    pendingState.error = '待办任务加载失败，请稍后重试。'
    pendingState.items = []
    pendingState.total = 0
    ElMessage.error('待办任务加载失败')
  } finally {
    pendingState.loading = false
  }
}

const loadApprovedTasks = async (pageNum: number = approvedState.pageNum) => {
  approvedState.loading = true
  approvedState.error = ''
  approvedState.pageNum = pageNum

  try {
    const response = await getMyApprovedInstances(pageNum, approvedState.pageSize)
    approvedState.items = response.data?.items ?? []
    approvedState.total = response.data?.total ?? 0
    approvedState.pageSize = response.data?.pageSize ?? approvedState.pageSize
    approvedState.loaded = true
  } catch (error) {
    approvedState.error = '已办任务加载失败，请稍后重试。'
    approvedState.items = []
    approvedState.total = 0
    ElMessage.error('已办任务加载失败')
  } finally {
    approvedState.loading = false
  }
}

const loadAppliedTasks = async (pageNum: number = appliedState.pageNum) => {
  appliedState.loading = true
  appliedState.error = ''
  appliedState.pageNum = pageNum

  try {
    const response = await getMyAppliedInstances(pageNum, appliedState.pageSize)
    appliedState.items = response.data?.items ?? []
    appliedState.total = response.data?.total ?? 0
    appliedState.pageSize = response.data?.pageSize ?? appliedState.pageSize
    appliedState.loaded = true
  } catch (error) {
    appliedState.error = '我发起的流程加载失败，请稍后重试。'
    appliedState.items = []
    appliedState.total = 0
    ElMessage.error('我发起的流程加载失败')
  } finally {
    appliedState.loading = false
  }
}

const refreshActiveTab = async () => {
  switch (activeTab.value) {
    case 'approved':
      await loadApprovedTasks(approvedState.pageNum)
      break
    case 'applied':
      await loadAppliedTasks(appliedState.pageNum)
      break
    default:
      await loadPendingTasks(pendingState.pageNum)
      break
  }
}

const handleTabChange = async (name: string | number) => {
  const nextTab = String(name) as TaskCenterTab
  activeTab.value = nextTab

  if (nextTab === 'approved' && !approvedState.loaded) {
    await loadApprovedTasks(1)
    return
  }

  if (nextTab === 'applied' && !appliedState.loaded) {
    await loadAppliedTasks(1)
    return
  }

  if (nextTab === 'pending' && !pendingState.loaded) {
    await loadPendingTasks(1)
  }
}

const handlePendingPageChange = async (pageNum: number) => {
  await loadPendingTasks(pageNum)
}

const handleApprovedPageChange = async (pageNum: number) => {
  await loadApprovedTasks(pageNum)
}

const handleAppliedPageChange = async (pageNum: number) => {
  await loadAppliedTasks(pageNum)
}

const goToMessages = () => {
  router.push('/messages')
}

const goToWorkbench = () => {
  router.push('/strategic-tasks')
}

onMounted(() => {
  void loadPendingTasks()
})
</script>

<style scoped>
.workflow-task-center {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2xl);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-lg);
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--text-main);
}

.page-desc {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.page-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--spacing-lg);
}

.summary-card {
  border: 1px solid var(--border-color);
}

.summary-card :deep(.el-card__body) {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
}

.summary-card__icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.summary-card__icon--pending {
  background: rgba(230, 162, 60, 0.14);
  color: var(--warning-color);
}

.summary-card__icon--processed {
  background: rgba(103, 194, 58, 0.14);
  color: var(--success-color);
}

.summary-card__icon--applied {
  background: rgba(64, 158, 255, 0.14);
  color: var(--primary-color);
}

.summary-card__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-card__label {
  font-size: 14px;
  color: var(--text-secondary);
}

.summary-card__value {
  font-size: 28px;
  line-height: 1;
  color: var(--text-main);
}

.workflow-card {
  border: 1px solid var(--border-color);
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.list-alert {
  margin-bottom: var(--spacing-lg);
}

.workflow-table {
  width: 100%;
}

.task-name-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.task-name-cell strong {
  color: var(--text-main);
  font-weight: 600;
}

.task-name-cell__sub {
  color: var(--text-secondary);
  font-size: 12px;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--spacing-lg);
}

@media (max-width: 960px) {
  .page-header {
    flex-direction: column;
  }

  .page-actions {
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
