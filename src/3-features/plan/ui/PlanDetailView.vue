<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  ElCard,
  ElButton,
  ElTag,
  ElProgress,
  ElIcon,
  ElTabs,
  ElTabPane,
  ElEmpty,
  ElSkeleton
} from 'element-plus'
import { ArrowLeft, Edit, Upload, Document } from '@element-plus/icons-vue'
import type { Plan, Task as _Task, Indicator as _Indicator } from '@/5-shared/types'
import { usePlanStore } from '@/3-features/plan/model/store'
import { useAuthStore } from '@/3-features/auth/model/store'
import { logger } from '@/5-shared/lib/utils/logger'

/**
 * Plan 详情页
 *
 * 功能：
 * - 展示 Plan 的完整信息
 * - 显示关联的 Task 和 Indicator 列表
 * - 支持编辑和提交操作
 */

const router = useRouter()
const route = useRoute()
const planStore = usePlanStore()
const authStore = useAuthStore()

// 状态
const loading = ref(true)
const plan = ref<Plan | null>(null)
const activeTab = ref('overview')

// 获取 Plan ID
const planId = computed(() => route.params.id as string)

// 计算属性
const canEdit = computed(() => {
  return authStore.user?.role === 'strategic_dept' && plan.value?.status === 'draft'
})

const canSubmit = computed(() => {
  return plan.value?.status === 'draft' || plan.value?.status === 'pending'
})

const getStatusConfig = (status: string) => {
  const configs: Record<string, { label: string; type: string }> = {
    draft: { label: '草稿', type: 'info' },
    pending: { label: '待审核', type: 'warning' },
    published: { label: '已发布', type: 'success' },
    archived: { label: '已归档', type: 'info' }
  }
  return configs[status] || { label: status, type: 'info' }
}

// 计算完成进度
const getProgress = () => {
  if (!plan.value) {
    return 0
  }
  const totalIndicators =
    plan.value.tasks?.reduce((sum, task) => {
      return sum + (task.indicators?.length || 0)
    }, 0) || 0
  if (totalIndicators === 0) {
    return 0
  }
  return Math.round(((plan.value.completedIndicators || 0) / totalIndicators) * 100)
}

// 操作方法
const handleBack = () => {
  router.push({ name: 'PlanList' })
}

const handleEdit = () => {
  if (plan.value) {
    router.push({ name: 'plan-edit', params: { id: plan.value.id } })
  }
}

const handleSubmit = () => {
  // TODO: 实现提交逻辑
}

// 加载 Plan 详情
const loadPlan = async () => {
  loading.value = true
  try {
    await planStore.loadPlan(planId.value)
    plan.value = planStore.currentPlan
  } catch (error) {
    logger.error('Failed to load plan:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadPlan()
})
</script>

<template>
  <div class="plan-detail-view">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <el-skeleton :rows="5" animated />
    </div>

    <!-- 空状态 -->
    <div v-else-if="!plan" class="empty-container">
      <el-empty description="计划不存在">
        <el-button type="primary" @click="handleBack"> 返回列表 </el-button>
      </el-empty>
    </div>

    <!-- 详情内容 -->
    <div v-else class="detail-content">
      <!-- 头部 -->
      <div class="page-header">
        <div class="header-left">
          <el-button :icon="ArrowLeft" circle @click="handleBack" />
          <div class="plan-info">
            <h1 class="plan-name">{{ plan.name }}</h1>
            <div class="plan-meta">
              <el-tag :type="getStatusConfig(plan.status).type as any" effect="light">
                {{ getStatusConfig(plan.status).label }}
              </el-tag>
              <span class="plan-cycle">{{ plan.cycle }}</span>
            </div>
          </div>
        </div>
        <div class="header-actions">
          <el-button v-if="canEdit" :icon="Edit" @click="handleEdit"> 编辑 </el-button>
          <el-button v-if="canSubmit" type="primary" :icon="Upload" @click="handleSubmit">
            提交审核
          </el-button>
        </div>
      </div>

      <!-- 进度卡片 -->
      <el-card class="progress-card" shadow="never">
        <div class="progress-content">
          <div class="progress-info">
            <span class="progress-label">完成进度</span>
            <span class="progress-value">{{ getProgress() }}%</span>
          </div>
          <el-progress :percentage="getProgress()" :stroke-width="12" />
        </div>
      </el-card>

      <!-- 详情标签页 -->
      <el-tabs v-model="activeTab" class="detail-tabs">
        <el-tab-pane label="概览" name="overview">
          <el-card shadow="never">
            <div v-if="plan.description" class="description">
              <h3>计划描述</h3>
              <p>{{ plan.description }}</p>
            </div>
            <div v-if="plan.tasks && plan.tasks.length > 0" class="tasks-summary">
              <h3>任务列表</h3>
              <div class="task-list">
                <div v-for="task in plan.tasks" :key="task.id" class="task-item">
                  <div class="task-header">
                    <el-icon><Document /></el-icon>
                    <span class="task-name">{{ task.name }}</span>
                    <el-tag size="small" type="info">
                      {{ task.indicators?.length || 0 }} 个指标
                    </el-tag>
                  </div>
                </div>
              </div>
            </div>
          </el-card>
        </el-tab-pane>

        <el-tab-pane label="指标" name="indicators">
          <el-card shadow="never">
            <div v-if="!plan.tasks || plan.tasks.length === 0" class="empty-indicators">
              <el-empty description="暂无指标数据" />
            </div>
            <div v-else class="indicators-list">
              <div v-for="task in plan.tasks" :key="task.id" class="task-indicators">
                <h4>{{ task.name }}</h4>
                <div v-if="task.indicators && task.indicators.length > 0" class="indicator-items">
                  <div
                    v-for="indicator in task.indicators"
                    :key="indicator.id"
                    class="indicator-item"
                  >
                    <div class="indicator-name">{{ indicator.name }}</div>
                    <div class="indicator-progress">
                      <el-progress
                        :percentage="indicator.latest_progress || 0"
                        :show-text="false"
                        :stroke-width="6"
                      />
                      <span class="progress-text">{{ indicator.latest_progress || 0 }}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </el-card>
        </el-tab-pane>

        <el-tab-pane label="提交记录" name="history">
          <el-card shadow="never">
            <el-empty description="暂无提交记录" />
          </el-card>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<style scoped>
.plan-detail-view {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.loading-container {
  padding: 40px;
}

.empty-container {
  padding: 60px 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.header-left {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.plan-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.plan-name {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.plan-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.plan-cycle {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.header-actions {
  display: flex;
  gap: 12px;
}

.progress-card {
  margin-bottom: 20px;
}

.progress-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-label {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.progress-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--el-color-primary);
}

.detail-tabs {
  margin-bottom: 20px;
}

.description h3 {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
}

.description p {
  margin: 0;
  line-height: 1.6;
  color: var(--el-text-color-regular);
}

.tasks-summary {
  margin-top: 24px;
}

.tasks-summary h3 {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-item {
  padding: 12px 16px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}

.task-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.task-name {
  flex: 1;
  font-weight: 500;
}

.empty-indicators {
  padding: 40px 20px;
}

.indicators-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.task-indicators h4 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.indicator-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.indicator-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

.indicator-name {
  flex: 1;
  font-size: 14px;
}

.indicator-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 150px;
}

.progress-text {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  min-width: 35px;
  text-align: right;
}
</style>
