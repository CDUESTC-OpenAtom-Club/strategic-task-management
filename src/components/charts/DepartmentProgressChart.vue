<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowDown, ArrowUp } from '@element-plus/icons-vue'
import type { DepartmentProgress } from '@/types'
import { useOrgStore } from '@/stores/org'

const orgStore = useOrgStore()

const props = defineProps<{
  departments: DepartmentProgress[]
}>()

const progressValues = ref<Record<string, number>>({})
const showAll = ref(false) // 是否显示全部
const defaultShowCount = 5 // 默认显示数量

const sortedDepartments = computed(() =>
  [...props.departments].sort((a, b) => b.progress - a.progress)
)

// 显示的部门列表（默认前5个，可展开）
const displayedDepartments = computed(() => {
  if (showAll.value || sortedDepartments.value.length <= defaultShowCount) {
    return sortedDepartments.value
  }
  return sortedDepartments.value.slice(0, defaultShowCount)
})

// 是否需要显示"显示更多"按钮
const needShowMore = computed(() => sortedDepartments.value.length > defaultShowCount)

// 切换显示全部/收起
const toggleShowAll = () => {
  showAll.value = !showAll.value
}

watch(() => props.departments, (newVal) => {
  // Initialize new items to 0 if not present
  newVal.forEach(item => {
    if (progressValues.value[item.dept] === undefined) {
      progressValues.value[item.dept] = 0
    }
  })

  // Animate to target value
  setTimeout(() => {
    newVal.forEach(item => {
      progressValues.value[item.dept] = item.progress
    })
  }, 100)
}, { immediate: true, deep: true })

const getProgressStatus = (status: string) => {
  switch (status) {
    case 'success': return 'success'
    case 'warning': return 'warning'
    case 'exception': return 'exception'
    default: return ''
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'success': return '#67C23A'
    case 'warning': return '#E6A23C'
    case 'exception': return '#F56C6C'
    default: return '#409EFF'
  }
}

// 根据部门类型获取显示文字（职能部门显示"任务"，学院显示"指标"）
const getItemLabel = (deptName: string) => {
  return orgStore.isCollege(deptName) ? '个指标' : '个任务'
}
</script>

<template>
  <div class="department-progress-chart">
    <!-- 部门统计摘要 -->
    <div v-if="sortedDepartments.length > 0" class="chart-summary">
      <span class="summary-text">
        共 <strong>{{ sortedDepartments.length }}</strong> 个部门
        <template v-if="!showAll && needShowMore">
          ，显示前 <strong>{{ defaultShowCount }}</strong> 个
        </template>
      </span>
    </div>

    <!-- 部门进度列表 -->
    <div
      v-for="item in displayedDepartments"
      :key="item.dept"
      class="dept-item"
    >
      <div class="dept-header">
        <span class="dept-name">{{ item.dept }}</span>
        <div class="dept-stats">
          <el-tag size="small" :type="item.alertCount > 0 ? 'danger' : 'info'" effect="plain">
            {{ item.totalIndicators }}{{ getItemLabel(item.dept) }}
          </el-tag>
          <span class="dept-score" :style="{ color: getStatusColor(item.status) }">
            {{ item.score }}分
          </span>
        </div>
      </div>
      <el-progress
        :percentage="progressValues[item.dept] || 0"
        :status="getProgressStatus(item.status)"
        :stroke-width="10"
        :show-text="true"
        :format="() => `${progressValues[item.dept] || 0}%`"
      />
    </div>

    <!-- 显示更多/收起按钮 -->
    <div v-if="needShowMore" class="show-more-section">
      <el-button
        text
        type="primary"
        @click="toggleShowAll"
        class="show-more-btn"
      >
        <template v-if="!showAll">
          显示全部 ({{ sortedDepartments.length - defaultShowCount }} 个)
          <el-icon class="el-icon--right"><ArrowDown /></el-icon>
        </template>
        <template v-else>
          收起
          <el-icon class="el-icon--right"><ArrowUp /></el-icon>
        </template>
      </el-button>
    </div>

    <!-- 空状态 -->
    <el-empty v-if="sortedDepartments.length === 0" description="暂无部门数据" :image-size="80" />
  </div>
</template>

<style scoped>
.department-progress-chart {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 统计摘要 */
.chart-summary {
  padding: 12px 16px;
  background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
  border-radius: 8px;
  border-left: 4px solid var(--color-primary);
}

.summary-text {
  font-size: 14px;
  color: var(--text-secondary);
}

.summary-text strong {
  color: var(--color-primary);
  font-weight: 600;
}

/* 部门项 */
.dept-item {
  padding: 12px;
  border-radius: 8px;
  background: var(--bg-light);
}

.dept-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.dept-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-main);
}

.dept-stats {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dept-score {
  font-size: 16px;
  font-weight: 600;
  min-width: 50px;
  text-align: right;
}

/* 显示更多按钮区域 */
.show-more-section {
  display: flex;
  justify-content: center;
  padding: 16px 0 8px;
}

.show-more-btn {
  font-size: 14px;
  padding: 8px 24px;
  transition: all 0.3s ease;
}

.show-more-btn:hover {
  transform: translateY(-2px);
}

:deep(.el-progress-bar__outer) {
  border-radius: 5px;
  background-color: #f0f2f5;
  overflow: hidden;
}

:deep(.el-progress-bar__inner) {
  border-radius: 5px;
  position: relative;
  overflow: hidden;
  background-image: linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent);
  background-size: 1rem 1rem;
  animation: progress-bar-stripes 1s linear infinite !important;
  transition: width 1.5s ease-out !important;
}

@keyframes progress-bar-stripes {
  from {
    background-position: 1rem 0;
  }
  to {
    background-position: 0 0;
  }
}
</style>