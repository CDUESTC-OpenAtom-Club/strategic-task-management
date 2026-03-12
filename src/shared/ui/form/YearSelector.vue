<script setup lang="ts">
/**
 * 年份选择器组�?
 * 用于切换系统的时间维度，控制历史快照模式和工作模�?
 */
import { computed } from 'vue'
import { Calendar, Lock, Edit } from '@element-plus/icons-vue'
import { useTimeContextStore } from '@/shared/lib/timeContext'

const timeContext = useTimeContextStore()

// 年份选项，带状态标�?
const yearOptions = computed(() => {
  return timeContext.availableYears.map(year => ({
    value: year,
    label: `${year}年度`,
    status: timeContext.getYearStatus(year),
    isCurrent: year === timeContext.realCurrentYear
  }))
})

// 处理年份切换
async function handleYearChange(year: number) {
  await timeContext.switchYear(year)
}

// 获取状态图�?
function getStatusIcon(status: 'history' | 'current' | 'future') {
  switch (status) {
    case 'history':
      return Lock
    case 'current':
      return Edit
    case 'future':
      return Calendar
    default:
      return Calendar
  }
}

// 获取状态标签类�?
function getStatusTagType(status: 'history' | 'current' | 'future') {
  switch (status) {
    case 'history':
      return 'info'
    case 'current':
      return 'success'
    case 'future':
      return 'warning'
    default:
      return 'info'
  }
}
</script>

<template>
  <div class="year-selector">
    <el-icon class="selector-icon"><Calendar /></el-icon>
    <el-select
      :model-value="timeContext.currentYear"
      placeholder="选择年份"
      size="small"
      class="year-select"
      :loading="timeContext.loading"
      @change="handleYearChange"
    >
      <el-option
        v-for="option in yearOptions"
        :key="option.value"
        :label="option.label"
        :value="option.value"
      >
        <div class="year-option">
          <el-icon class="option-icon" :class="option.status">
            <component :is="getStatusIcon(option.status)" />
          </el-icon>
          <span class="option-label">{{ option.label }}</span>
          <el-tag
            v-if="option.isCurrent"
            size="small"
            :type="getStatusTagType(option.status)"
            class="option-tag"
          >
            当前
          </el-tag>
          <el-tag
            v-else-if="option.status === 'history'"
            size="small"
            type="info"
            class="option-tag"
          >
            只读
          </el-tag>
        </div>
      </el-option>
    </el-select>

    <!-- 只读模式标识 -->
    <el-tag
      v-if="timeContext.isReadOnly"
      type="warning"
      size="small"
      class="readonly-tag"
      effect="dark"
    >
      <span class="readonly-content">
        <el-icon><Lock /></el-icon>
        <span>只读</span>
      </span>
    </el-tag>
  </div>
</template>

<style scoped>
.year-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.selector-icon {
  color: var(--el-color-warning);
  font-size: 16px;
}

.year-select {
  width: 120px;
}

.year-select :deep(.el-input__wrapper) {
  box-shadow: none !important;
  background: transparent;
  border: none;
}

.year-select :deep(.el-input__inner) {
  color: #fff;
  font-size: 13px;
  font-weight: 500;
}

.year-select :deep(.el-input__suffix) {
  color: rgba(255, 255, 255, 0.7);
}

.year-select :deep(.el-select__caret) {
  color: rgba(255, 255, 255, 0.7);
}

/* 下拉选项样式 */
.year-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.option-icon {
  font-size: 14px;
}

.option-icon.history {
  color: var(--el-color-info);
}

.option-icon.current {
  color: var(--el-color-success);
}

.option-icon.future {
  color: var(--el-color-warning);
}

.option-label {
  flex: 1;
}

.option-tag {
  margin-left: auto;
}

/* 只读标识 */
.readonly-tag {
  margin-left: 4px;
  padding: 0 10px;
  height: 28px;
  background: rgba(230, 162, 60, 0.9);
  border-color: rgba(230, 162, 60, 0.9);
}

.readonly-content {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 4px;
  white-space: nowrap;
}

.readonly-content .el-icon {
  font-size: 12px;
}

.selector-icon {
  display: flex;
  align-items: center;
}

/* 响应�?*/
@media (max-width: 768px) {
  .year-selector {
    padding: 4px 8px;
  }

  .year-select {
    width: 100px;
  }

  .readonly-tag {
    display: none;
  }
}
</style>
