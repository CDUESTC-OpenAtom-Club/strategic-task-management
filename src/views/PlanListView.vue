<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  ElCard,
  ElTable,
  ElTableColumn,
  ElTag,
  ElButton,
  ElInput,
  ElSelect,
  ElOption,
  ElMessage,
  ElMessageBox,
  ElDialog,
  ElProgress,
  ElIcon,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu
} from 'element-plus'
import {
  Plus,
  View,
  Edit,
  Delete,
  Upload,
  Refresh,
  Search,
  Filter,
  MoreFilled,
  Clock,
  Check,
  Document
} from '@element-plus/icons-vue'
import type { Plan, PlanStatus } from '@/types'
import { usePlanStore } from '@/stores/plan'
import { useAuthStore } from '@/stores/auth'

/**
 * Plan 列表页
 *
 * 功能：
 * - 展示所有 Plan 列表
 * - 按状态、组织筛选
 * - 创建、编辑、删除 Plan
 * - 整包提交 Plan
 * - 查看 Plan 详情
 */

const router = useRouter()
const planStore = usePlanStore()
const authStore = useAuthStore()

// ============ 状态 ============
const searchKeyword = ref('')
const filterStatus = ref<PlanStatus | 'all'>('all')

// 对话框状态
const showSubmitDialog = ref(false)
const submittingPlanId = ref<number | string | null>(null)
const submitComment = ref('')

// ============ 计算属性 ============

// 过滤后的 Plan 列表
const filteredPlans = computed(() => {
  let result = planStore.visiblePlans

  // 关键词搜索
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    result = result.filter(p =>
      p.name.toLowerCase().includes(keyword) ||
      p.cycle.toLowerCase().includes(keyword) ||
      (p.description && p.description.toLowerCase().includes(keyword))
    )
  }

  // 状态筛选
  if (filterStatus.value !== 'all') {
    result = result.filter(p => p.status === filterStatus.value)
  }

  return result
})

// 状态选项
const statusOptions: Array<{ value: PlanStatus | 'all'; label: string; type?: string }> = [
  { value: 'all', label: '全部状态' },
  { value: 'draft', label: '草稿', type: 'info' },
  { value: 'pending', label: '待审核', type: 'warning' },
  { value: 'published', label: '已发布', type: 'success' },
  { value: 'archived', label: '已归档', type: 'info' }
]

import type { Component } from 'vue'

// 获取状态配置
const getStatusConfig = (status: PlanStatus) => {
  const configs: Record<PlanStatus, { label: string; type: string; icon: Component }> = {
    draft: { label: '草稿', type: 'info', icon: Document },
    pending: { label: '待审核', type: 'warning', icon: Clock },
    published: { label: '已发布', type: 'success', icon: Check },
    archived: { label: '已归档', type: 'info', icon: Document }
  }
  return configs[status]
}

// 计算 Plan 的完成进度
const getPlanProgress = (plan: Plan) => {
  if (!plan.totalIndicators || plan.totalIndicators === 0) {return 0}
  return Math.round((plan.completedIndicators || 0) / plan.totalIndicators * 100)
}

// 检查是否可以提交
const canSubmitPlan = (plan: Plan) => {
  return plan.status === 'draft' || plan.status === 'pending'
}

// 检查是否可以编辑
const canEditPlan = (plan: Plan) => {
  if (authStore.user?.role !== 'strategic_dept') {return false}
  return plan.status === 'draft'
}

// 检查是否可以删除
const canDeletePlan = (plan: Plan) => {
  if (authStore.user?.role !== 'strategic_dept') {return false}
  return plan.status === 'draft'
}

// ============ 操作方法 ============

// 刷新列表
const handleRefresh = async () => {
  await planStore.loadPlans()
  ElMessage.success('刷新成功')
}

// 查看 Plan 详情
const handleView = (plan: Plan) => {
  router.push({
    name: 'plan-detail',
    params: { id: plan.id }
  })
}

// 编辑 Plan
const handleEdit = (plan: Plan) => {
  router.push({
    name: 'plan-edit',
    params: { id: plan.id }
  })
}

// 删除 Plan
const handleDelete = async (plan: Plan) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除计划「${plan.name}」吗？此操作不可撤销。`,
      '删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await planStore.deletePlan(plan.id)
  } catch {
    // 用户取消
  }
}

// 打开提交对话框
const openSubmitDialog = (plan: Plan) => {
  submittingPlanId.value = plan.id
  submitComment.value = ''
  showSubmitDialog.value = true
}

// 提交 Plan
const handleSubmit = async () => {
  if (!submittingPlanId.value) {return}

  try {
    await planStore.submitPlan({
      plan_id: submittingPlanId.value,
      comment: submitComment.value
    })

    showSubmitDialog.value = false
    submittingPlanId.value = null
  } catch {
    // 错误已在 store 中处理
  }
}

// 取消提交
const cancelSubmit = () => {
  showSubmitDialog.value = false
  submittingPlanId.value = null
  submitComment.value = ''
}

// 创建新 Plan
const handleCreate = () => {
  router.push({ name: 'plan-create' })
}

// 应用筛选
const applyFilter = (status: PlanStatus | 'all') => {
  filterStatus.value = status
  planStore.setFilter(status)
}

// 重置筛选
const resetFilter = () => {
  searchKeyword.value = ''
  filterStatus.value = 'all'
  planStore.resetFilter()
}

// ============ 生命周期 ============
onMounted(() => {
  planStore.loadPlans()
})
</script>

<template>
  <div class="plan-list-view">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">
          <el-icon><Document /></el-icon>
          计划管理
        </h1>
        <p class="page-subtitle">管理战略指标考核计划，整包提交审核</p>
      </div>
      <div class="header-actions">
        <ElButton
          v-if="authStore.user?.role === 'strategic_dept'"
          type="primary"
          :icon="Plus"
          @click="handleCreate"
        >
          新建计划
        </ElButton>
        <ElButton :icon="Refresh" @click="handleRefresh">刷新</ElButton>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <div class="filter-left">
        <ElInput
          v-model="searchKeyword"
          placeholder="搜索计划名称、周期..."
          :prefix-icon="Search"
          clearable
          class="search-input"
        />
        <ElSelect
          v-model="filterStatus"
          placeholder="状态筛选"
          :icon="Filter"
          class="filter-select"
          @change="applyFilter"
        >
          <ElOption
            v-for="option in statusOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </ElSelect>
      </div>
      <div class="filter-right">
        <ElButton
          v-if="searchKeyword || filterStatus !== 'all'"
          link
          @click="resetFilter"
        >
          重置筛选
        </ElButton>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <ElCard class="stat-card" shadow="hover">
        <div class="stat-content">
          <div class="stat-value">{{ filteredPlans.length }}</div>
          <div class="stat-label">总计划数</div>
        </div>
      </ElCard>
      <ElCard class="stat-card" shadow="hover">
        <div class="stat-content">
          <div class="stat-value warning">{{ filteredPlans.filter(p => p.status === 'pending').length }}</div>
          <div class="stat-label">待审核</div>
        </div>
      </ElCard>
      <ElCard class="stat-card" shadow="hover">
        <div class="stat-content">
          <div class="stat-value success">{{ filteredPlans.filter(p => p.status === 'published').length }}</div>
          <div class="stat-label">已发布</div>
        </div>
      </ElCard>
      <ElCard class="stat-card" shadow="hover">
        <div class="stat-content">
          <div class="stat-value info">{{ filteredPlans.filter(p => p.status === 'draft').length }}</div>
          <div class="stat-label">草稿</div>
        </div>
      </ElCard>
    </div>

    <!-- 表格视图 -->
    <ElCard class="table-card" shadow="never">
      <ElTable
        v-loading="planStore.loading"
        :data="filteredPlans"
        stripe
        class="plan-table"
      >
        <ElTableColumn prop="name" label="计划名称" min-width="200">
          <template #default="{ row }">
            <div class="plan-name-cell">
              <span class="plan-name">{{ row.name }}</span>
              <ElTag v-if="row.description" size="small" type="info" class="plan-desc-tag">
                {{ row.description.slice(0, 20) }}...
              </ElTag>
            </div>
          </template>
        </ElTableColumn>

        <ElTableColumn prop="cycle" label="周期" width="120" />

        <ElTableColumn label="状态" width="100" align="center">
          <template #default="{ row }">
            <ElTag :type="getStatusConfig(row.status).type as any" effect="light">
              <el-icon class="tag-icon"><component :is="getStatusConfig(row.status).icon" /></el-icon>
              {{ getStatusConfig(row.status).label }}
            </ElTag>
          </template>
        </ElTableColumn>

        <ElTableColumn label="任务数" width="80" align="center">
          <template #default="{ row }">
            <span class="task-count">{{ row.tasks?.length || 0 }}</span>
          </template>
        </ElTableColumn>

        <ElTableColumn label="完成进度" width="150">
          <template #default="{ row }">
            <div class="progress-cell">
              <ElProgress
                :percentage="getPlanProgress(row)"
                :stroke-width="8"
                :show-text="false"
              />
              <span class="progress-text">{{ getPlanProgress(row) }}%</span>
            </div>
          </template>
        </ElTableColumn>

        <ElTableColumn prop="latestFillDate" label="最近填报" width="120">
          <template #default="{ row }">
            <span v-if="row.latestFillDate" class="fill-date">
              {{ row.latestFillDate }}
            </span>
            <span v-else class="no-data">-</span>
          </template>
        </ElTableColumn>

        <ElTableColumn label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <div class="action-buttons">
              <ElButton
                type="primary"
                link
                :icon="View"
                @click="handleView(row)"
              >
                查看
              </ElButton>

              <ElButton
                v-if="canEditPlan(row)"
                type="primary"
                link
                :icon="Edit"
                @click="handleEdit(row)"
              >
                编辑
              </ElButton>

              <ElButton
                v-if="canSubmitPlan(row)"
                type="success"
                link
                :icon="Upload"
                @click="openSubmitDialog(row)"
              >
                提交
              </ElButton>

              <ElDropdown v-if="canEditPlan(row) || canDeletePlan(row)">
                <ElButton link :icon="MoreFilled" />
                <template #dropdown>
                  <ElDropdownMenu>
                    <ElDropdownItem
                      v-if="canDeletePlan(row)"
                      :icon="Delete"
                      @click="handleDelete(row)"
                    >
                      删除
                    </ElDropdownItem>
                  </ElDropdownMenu>
                </template>
              </ElDropdown>
            </div>
          </template>
        </ElTableColumn>
      </ElTable>

      <!-- 空状态 -->
      <div v-if="!planStore.loading && filteredPlans.length === 0" class="empty-state">
        <el-empty :image-size="120">
          <template #description>
            <p class="empty-text">{{ searchKeyword || filterStatus !== 'all' ? '没有找到匹配的计划' : '暂无计划数据' }}</p>
          </template>
          <ElButton v-if="!searchKeyword && filterStatus === 'all'" type="primary" :icon="Plus" @click="handleCreate">
            创建第一个计划
          </ElButton>
        </el-empty>
      </div>
    </ElCard>

    <!-- 提交确认对话框 -->
    <ElDialog
      v-model="showSubmitDialog"
      title="提交计划审核"
      width="500px"
      :close-on-click-modal="false"
    >
      <div class="submit-dialog-content">
        <p class="submit-hint">您即将提交以下计划进行审核：</p>
        <div class="submit-plan-info">
          <div class="info-label">计划名称</div>
          <div class="info-value">{{ filteredPlans.find(p => p.id === submittingPlanId)?.name }}</div>
        </div>
        <ElInput
          v-model="submitComment"
          type="textarea"
          :rows="3"
          placeholder="请输入提交说明（可选）"
          maxlength="200"
          show-word-limit
        />
      </div>
      <template #footer>
        <ElButton @click="cancelSubmit">取消</ElButton>
        <ElButton
          type="primary"
          :loading="planStore.submitting"
          @click="handleSubmit"
        >
          确认提交
        </ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
.plan-list-view {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.header-left {
  flex: 1;
}

.page-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.page-subtitle {
  margin: 0;
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.header-actions {
  display: flex;
  gap: 12px;
}

.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 16px;
  background: var(--el-bg-color-page);
  border-radius: 8px;
}

.filter-left {
  display: flex;
  gap: 12px;
  flex: 1;
}

.search-input {
  width: 280px;
}

.filter-select {
  width: 140px;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  --el-card-padding: 20px;
}

.stat-content {
  text-align: center;
}

.stat-value {
  font-size: 32px;
  font-weight: 600;
  color: var(--el-color-primary);
  margin-bottom: 8px;
}

.stat-value.warning {
  color: var(--el-color-warning);
}

.stat-value.success {
  color: var(--el-color-success);
}

.stat-value.info {
  color: var(--el-color-info);
}

.stat-label {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.table-card {
  margin-bottom: 20px;
}

.plan-table {
  width: 100%;
}

.plan-name-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.plan-name {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.plan-desc-tag {
  align-self: flex-start;
}

.tag-icon {
  margin-right: 4px;
  font-size: 12px;
}

.task-count {
  font-weight: 500;
  color: var(--el-text-color-regular);
}

.progress-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-text {
  min-width: 40px;
  text-align: right;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.fill-date {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.no-data {
  color: var(--el-text-color-placeholder);
}

.action-buttons {
  display: flex;
  gap: 8px;
  align-items: center;
}

.empty-state {
  padding: 40px 20px;
}

.empty-text {
  margin: 0 0 16px;
  color: var(--el-text-color-secondary);
}

.submit-dialog-content {
  padding: 8px 0;
}

.submit-hint {
  margin: 0 0 16px;
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.submit-plan-info {
  padding: 12px 16px;
  margin-bottom: 16px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}

.info-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}

.info-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}
</style>
