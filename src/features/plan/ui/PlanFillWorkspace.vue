<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  ElCard,
  ElTree,
  ElButton,
  ElIcon,
  ElEmpty,
  ElSkeleton,
  ElBadge,
  ElTabs,
  ElTabPane,
  ElTag,
  ElAvatar as _ElAvatar,
  ElProgress,
  ElScrollbar,
  ElDescriptions as _ElDescriptions,
  ElDescriptionsItem as _ElDescriptionsItem,
  ElTimeline as _ElTimeline,
  ElTimelineItem as _ElTimelineItem
} from 'element-plus'
import {
  Document,
  ArrowRight,
  Plus,
  Refresh,
  Clock,
  Check as _Check,
  Close as _Close,
  CircleCheck,
  Download as _Download,
  Paperclip as _Paperclip
} from '@element-plus/icons-vue'
import type { Plan, Task as _Task, Indicator as _Indicator, IndicatorFill, Milestone } from '@/types'
import IndicatorFillForm from '@/shared/ui/form/indicator/IndicatorFillForm.vue'
import IndicatorFillHistory from '@/shared/ui/form/indicator/IndicatorFillHistory.vue'

/**
 * Plan 填报工作区 - 分栏式布局
 *
 * 布局：
 * - 左侧 (25%): Plan -> Task 导航树
 * - 右侧 (75%): 详情工作区
 *   - 顶部: 指标基础信息卡片
 *   - 中部: 填报历史时间轴
 *   - 底部: 操作按钮
 */

const props = defineProps<{
  planId: string | number
}>()

const router = useRouter()

// ============ 状态 ============
const loading = ref(false)
const plan = ref<Plan | null>(null)
const selectedTaskId = ref<string | number | null>(null)
const selectedIndicatorId = ref<string | number | null>(null)
const activeTab = ref<'info' | 'history' | 'fill'>('info')

// ============ 计算属性 ============

// 当前选中的任务
const selectedTask = computed(() => {
  if (!plan.value || !selectedTaskId.value) {return null}
  return plan.value.tasks.find(t => t.id === selectedTaskId.value) || null
})

// 当前选中的指标
const selectedIndicator = computed(() => {
  if (!selectedTask.value || !selectedIndicatorId.value) {return null}
  return selectedTask.value.indicators.find(i => i.id === selectedIndicatorId.value) || null
})

// 树形数据
const treeData = computed(() => {
  if (!plan.value) {return []}
  return plan.value.tasks.map(task => ({
    id: task.id,
    label: task.name,
    type: 'task',
    children: task.indicators.map(indicator => ({
      id: indicator.id,
      label: indicator.name,
      type: 'indicator',
      data: indicator
    }))
  }))
})

// 当前节点高亮
const currentKey = computed(() => {
  return selectedIndicatorId.value || selectedTaskId.value
})

// 填报统计
const _fillStats = computed(() => {
  if (!selectedIndicator.value) {return null}
  const indicator = selectedIndicator.value
  return {
    totalFills: indicator.fill_count || 0,
    latestProgress: indicator.latest_progress || 0,
    lastFillDate: indicator.latest_fill_date
  }
})

// 是否可以填报
const canFill = computed(() => {
  return selectedIndicator.value && activeTab.value === 'fill'
})

// ============ 方法 ============

// 加载 Plan 数据
const loadPlan = async () => {
  loading.value = true
  try {
    // TODO: 调用实际API
    // const response = await api.getPlan(props.planId)
    // plan.value = response.data

    // 模拟数据
    plan.value = {
      id: props.planId,
      name: '2023-2025年战略指标考核计划',
      cycle: '2023-2025',
      org_id: 'org-001',
      status: 'published',
      tasks: [
        {
          id: 'task-001',
          plan_id: props.planId,
          name: '定性指标',
          type: 'qualitative',
          sortOrder: 1,
          indicators: [
            {
              id: 'ind-001',
              task_id: 'task-001',
              name: '党建工作成效',
              definition: '根据年度党建工作考核标准，评估党组织建设、党员发展、党风廉政建设等方面的成效。',
              milestones: [
                { id: 'ms-001', name: '第一季度检查', targetProgress: 25, deadline: '2025-03-31', status: 'pending' },
                { id: 'ms-002', name: '半年总结', targetProgress: 50, deadline: '2025-06-30', status: 'pending' },
                { id: 'ms-003', name: '年度考核', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
              ],
              latest_progress: 25,
              latest_fill_date: '2025-01-15',
              fill_count: 1
            },
            {
              id: 'ind-002',
              task_id: 'task-001',
              name: '校园文化建设',
              definition: '评估校园文化活动的开展情况、文化设施建设、文化氛围营造等。',
              milestones: [
                { id: 'ms-004', name: '文化活动开展', targetProgress: 40, deadline: '2025-06-30', status: 'pending' },
                { id: 'ms-005', name: '文化设施建设', targetProgress: 70, deadline: '2025-10-31', status: 'pending' },
                { id: 'ms-006', name: '年终评估', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
              ],
              latest_progress: 0,
              fill_count: 0
            }
          ]
        },
        {
          id: 'task-002',
          plan_id: props.planId,
          name: '定量指标',
          type: 'quantitative',
          sortOrder: 2,
          indicators: [
            {
              id: 'ind-003',
              task_id: 'task-002',
              name: '科研项目立项数',
              definition: '统计年度内新增的国家级、省级科研项目立项数量。',
              milestones: [
                { id: 'ms-007', name: '第一季度目标', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
                { id: 'ms-008', name: '半年目标', targetProgress: 50, deadline: '2025-06-30', status: 'pending' },
                { id: 'ms-009', name: '年度目标', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
              ],
              latest_progress: 30,
              latest_fill_date: '2025-01-20',
              fill_count: 2
            },
            {
              id: 'ind-004',
              task_id: 'task-002',
              name: '学生就业率',
              definition: '统计应届毕业生的就业率，包括直接就业、升学、创业等。',
              milestones: [
                { id: 'ms-010', name: '初次就业率', targetProgress: 60, deadline: '2025-08-31', status: 'pending' },
                { id: 'ms-011', name: '年终就业率', targetProgress: 95, deadline: '2025-12-31', status: 'pending' }
              ],
              latest_progress: 0,
              fill_count: 0
            }
          ]
        }
      ],
      totalIndicators: 4,
      completedIndicators: 0
    }

    // 默认选中第一个任务的第一个指标
    if (plan.value.tasks.length > 0 && plan.value.tasks[0].indicators.length > 0) {
      selectedTaskId.value = plan.value.tasks[0].id
      selectedIndicatorId.value = plan.value.tasks[0].indicators[0].id
    }
  } catch (error) {
    console.error('Failed to load plan:', error)
  } finally {
    loading.value = false
  }
}

// 树节点点击
const handleNodeClick = (data: unknown) => {
  if (data.type === 'task') {
    selectedTaskId.value = data.id
    // 展开第一个指标
    if (plan.value) {
      const task = plan.value.tasks.find(t => t.id === data.id)
      if (task && task.indicators.length > 0) {
        selectedIndicatorId.value = task.indicators[0].id
      }
    }
  } else if (data.type === 'indicator') {
    // 获取父任务ID
    selectedIndicatorId.value = data.id
    // 找到父任务
    if (plan.value) {
      for (const task of plan.value.tasks) {
        if (task.indicators.some(i => i.id === data.id)) {
          selectedTaskId.value = task.id
          break
        }
      }
    }
    activeTab.value = 'info'
  }
}

// 切换到填报页面
const startFill = () => {
  activeTab.value = 'fill'
}

// 查看历史
const viewHistory = () => {
  activeTab.value = 'history'
}

// 填报成功回调
const handleFillSaved = (_fill: IndicatorFill) => {
  activeTab.value = 'history'
}

// 填报提交回调
const handleFillSubmitted = (_fill: IndicatorFill) => {
  activeTab.value = 'history'
}

// 获取里程碑状态样式
const getMilestoneStatus = (status?: Milestone['status']) => {
  switch (status) {
    case 'completed': return 'success'
    case 'overdue': return 'danger'
    default: return 'info'
  }
}

// 格式化日期
const formatDate = (dateStr: string) => {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ============ 生命周期 ============
onMounted(() => {
  loadPlan()
})

// 监听 planId 变化
watch(() => props.planId, () => {
  loadPlan()
})
</script>

<template>
  <div class="plan-fill-workspace">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <div class="loading-sidebar">
        <ElSkeleton :rows="5" animated />
      </div>
      <div class="loading-main">
        <ElSkeleton :rows="8" animated />
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else-if="!plan" class="empty-container">
      <el-empty description="未找到该计划">
        <ElButton type="primary" @click="router.back()">返回</ElButton>
      </el-empty>
    </div>

    <!-- 主内容 -->
    <div v-else class="workspace-content">
      <!-- 左侧导航树 (25%) -->
      <div class="workspace-sidebar">
        <ElCard class="sidebar-card" shadow="never">
          <template #header>
            <div class="sidebar-header">
              <span class="sidebar-title">{{ plan.name }}</span>
              <ElButton
                type="primary"
                :icon="Refresh"
                size="small"
                circle
                @click="loadPlan"
              />
            </div>
          </template>

          <ElScrollbar class="tree-scrollbar">
            <ElTree
              :data="treeData"
              :current-node-key="currentKey"
              node-key="id"
              :props="{ children: 'children', label: 'label' }"
              class="indicator-tree"
              @node-click="handleNodeClick"
            >
              <template #default="{ node, data }">
                <div class="tree-node">
                  <div class="node-label-row">
                    <el-icon v-if="data.type === 'task'" class="node-icon">
                      <Document />
                    </el-icon>
                    <el-icon v-else class="node-icon">
                      <ArrowRight />
                    </el-icon>
                    <span class="node-label">{{ node.label }}</span>
                  </div>
                  <!-- 指标进度徽章 -->
                  <ElBadge
                    v-if="data.type === 'indicator' && data.data"
                    :value="data.data.latest_progress || 0"
                    :max="100"
                    :type="data.data.latest_progress >= 100 ? 'success' : 'primary'"
                    class="node-badge"
                  >
                    <span class="badge-placeholder"></span>
                  </ElBadge>
                </div>
              </template>
            </ElTree>
          </ElScrollbar>
        </ElCard>
      </div>

      <!-- 右侧工作区 (75%) -->
      <div class="workspace-main">
        <div v-if="!selectedIndicator" class="no-selection">
          <el-empty description="请选择一个指标查看详情">
            <el-icon class="empty-icon"><Document /></el-icon>
          </el-empty>
        </div>

        <div v-else class="indicator-workspace">
          <!-- 指标信息头部卡片 -->
          <ElCard class="info-card" shadow="never">
            <div class="indicator-header">
              <div class="header-left">
                <div class="indicator-type-tag">
                  <ElTag :type="selectedTask?.type === 'qualitative' ? 'warning' : 'success'" effect="light">
                    {{ selectedTask?.type === 'qualitative' ? '定性' : '定量' }}
                  </ElTag>
                  <ElTag type="info" effect="light">{{ selectedTask?.name }}</ElTag>
                </div>
                <h2 class="indicator-name">{{ selectedIndicator.name }}</h2>
                <p class="indicator-definition">{{ selectedIndicator.definition }}</p>
              </div>
              <div class="header-right">
                <!-- 进度环形图 -->
                <div class="progress-circle">
                  <ElProgress
                    :percentage="selectedIndicator.latest_progress || 0"
                    :width="80"
                    :stroke-width="8"
                    type="circle"
                  />
                  <span class="progress-label">完成进度</span>
                </div>
              </div>
            </div>
          </ElCard>

          <!-- 标签页内容 -->
          <ElCard class="content-card" shadow="never">
            <ElTabs v-model="activeTab" class="workspace-tabs">
              <!-- 信息页签 -->
              <ElTabPane label="指标信息" name="info">
                <div class="info-content">
                  <!-- 里程碑时间轴 -->
                  <div class="section">
                    <h3 class="section-title">
                      <el-icon><Clock /></el-icon>
                      里程碑进度
                    </h3>
                    <div class="milestones-list">
                      <div
                        v-for="milestone in selectedIndicator.milestones"
                        :key="milestone.id"
                        class="milestone-item"
                      >
                        <div class="milestone-header">
                          <div class="milestone-name">{{ milestone.name }}</div>
                          <ElTag
                            :type="getMilestoneStatus(milestone.status) as any"
                            size="small"
                            effect="light"
                          >
                            <el-icon>
                              <CircleCheck v-if="milestone.status === 'completed'" />
                              <Clock v-else />
                            </el-icon>
                            {{ milestone.status === 'completed' ? '已完成' : milestone.status === 'overdue' ? '已逾期' : '进行中' }}
                          </ElTag>
                        </div>
                        <div class="milestone-details">
                          <div class="milestone-target">
                            <span class="detail-label">目标进度：</span>
                            <span class="detail-value">{{ milestone.targetProgress }}%</span>
                          </div>
                          <div class="milestone-deadline">
                            <span class="detail-label">截止日期：</span>
                            <span class="detail-value">{{ formatDate(milestone.deadline) }}</span>
                          </div>
                        </div>
                        <ElProgress
                          :percentage="milestone.targetProgress"
                          :stroke-width="6"
                          :show-text="false"
                          class="milestone-progress"
                        />
                      </div>
                    </div>
                  </div>

                  <!-- 操作按钮 -->
                  <div class="action-section">
                    <ElButton type="primary" size="large" @click="startFill">
                      <el-icon><Plus /></el-icon>
                      新增填报记录
                    </ElButton>
                    <ElButton size="large" @click="viewHistory">
                      <el-icon><Clock /></el-icon>
                      查看历史记录
                    </ElButton>
                  </div>
                </div>
              </ElTabPane>

              <!-- 填报历史页签 -->
              <ElTabPane name="history">
                <template #label>
                  <span class="tab-label">
                    <el-icon><Clock /></el-icon>
                    填报历史
                  </span>
                </template>
                <IndicatorFillHistory
                  v-if="selectedIndicator"
                  :indicator-id="selectedIndicator.id"
                  @select="(fill) => { /* 选择历史记录编辑 */ }"
                />
              </ElTabPane>

              <!-- 填报页签 -->
              <ElTabPane name="fill">
                <template #label>
                  <span class="tab-label">
                    <el-icon><Plus /></el-icon>
                    填报进度
                  </span>
                </template>
                <IndicatorFillForm
                  v-if="selectedIndicator && canFill"
                  :indicator="selectedIndicator"
                  @saved="handleFillSaved"
                  @submitted="handleFillSubmitted"
                  @cancel="activeTab = 'info'"
                />
              </ElTabPane>
            </ElTabs>
          </ElCard>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.plan-fill-workspace {
  height: calc(100vh - 140px);
  display: flex;
  flex-direction: column;
}

/* 加载状态 */
.loading-container {
  display: flex;
  gap: 20px;
  height: 100%;
}

.loading-sidebar {
  width: 25%;
  padding: 20px;
}

.loading-main {
  flex: 1;
  padding: 20px;
}

/* 空状态 */
.empty-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.empty-icon {
  font-size: 64px;
  color: var(--el-text-color-placeholder);
}

/* 主内容布局 */
.workspace-content {
  display: flex;
  gap: 20px;
  height: 100%;
}

/* 左侧边栏 */
.workspace-sidebar {
  width: 25%;
  min-width: 280px;
}

.sidebar-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.sidebar-card :deep(.el-card__body) {
  flex: 1;
  padding: 0;
  overflow: hidden;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.tree-scrollbar {
  height: 100%;
}

/* 树形组件 */
.indicator-tree {
  background: transparent;
}

.indicator-tree :deep(.el-tree-node__content) {
  height: 40px;
  padding-right: 8px;
}

.indicator-tree :deep(.el-tree-node__content:hover) {
  background: var(--el-fill-color-light);
}

.indicator-tree :deep(.is-current > .el-tree-node__content) {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.tree-node {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding-right: 8px;
}

.node-label-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.node-icon {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

.node-label {
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge-placeholder {
  width: 1px;
}

.node-badge :deep(.el-badge__content) {
  font-size: 10px;
  height: 16px;
  line-height: 16px;
  padding: 0 4px;
  border-radius: 8px;
}

/* 右侧工作区 */
.workspace-main {
  flex: 1;
  min-width: 0;
}

.no-selection {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: var(--el-bg-color-page);
  border-radius: var(--radius-lg);
}

.indicator-workspace {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 指标信息卡片 */
.info-card {
  margin-bottom: 0;
}

.indicator-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
}

.header-left {
  flex: 1;
}

.indicator-type-tag {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.indicator-name {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.indicator-definition {
  margin: 0;
  font-size: 14px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.header-right {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.progress-circle {
  text-align: center;
}

.progress-label {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* 内容卡片 */
.content-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.content-card :deep(.el-card__body) {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.workspace-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.workspace-tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow: auto;
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 信息内容 */
.info-content {
  padding: 16px 0;
}

.section {
  margin-bottom: 24px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

/* 里程碑列表 */
.milestones-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.milestone-item {
  padding: 16px;
  background: var(--el-fill-color-lighter);
  border-radius: var(--radius-md);
  border-left: 4px solid var(--el-border-color);
  transition: all var(--transition-fast);
}

.milestone-item:hover {
  background: var(--el-fill-color-light);
  border-left-color: var(--el-color-primary);
}

.milestone-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.milestone-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.milestone-details {
  display: flex;
  gap: 24px;
  margin-bottom: 12px;
}

.detail-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.detail-value {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.milestone-progress {
  margin-top: 8px;
}

/* 操作按钮区域 */
.action-section {
  display: flex;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-light);
}

/* 响应式 - 移动端适配 */
@media (max-width: 768px) {
  .workspace-content {
    flex-direction: column;
  }

  .workspace-sidebar {
    width: 100%;
    min-width: 0;
    max-height: 200px;
  }

  .indicator-header {
    flex-direction: column;
  }

  .milestone-details {
    flex-direction: column;
    gap: 8px;
  }

  .action-section {
    flex-direction: column;
  }

  .action-section .el-button {
    width: 100%;
  }
}
</style>
