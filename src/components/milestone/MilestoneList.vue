<script setup lang="ts">
import { computed } from 'vue'
import { Check } from '@element-plus/icons-vue'

interface Milestone {
  id: string | number
  name: string
  targetProgress: number
  deadline: string
  status?: 'pending' | 'completed' | 'overdue'
}

const props = defineProps<{
  milestones: Milestone[]
  currentProgress?: number
  editable?: boolean
}>()

const emit = defineEmits<{
  (e: 'edit'): void
}>()

// 判断里程碑是否已完成
const isMilestoneCompleted = (milestone: Milestone) => {
  if (props.currentProgress === undefined) return false
  return props.currentProgress >= milestone.targetProgress
}

// 格式化里程碑数据用于显示
const formattedMilestones = computed(() => {
  return props.milestones.map(ms => ({
    id: ms.id,
    name: ms.name,
    expectedDate: ms.deadline,
    progress: ms.targetProgress,
    completed: isMilestoneCompleted(ms)
  }))
})

// 处理点击编辑
const handleEdit = () => {
  if (props.editable) {
    emit('edit')
  }
}
</script>

<template>
  <div 
    class="milestone-list-container"
    :class="{ 'editable': editable }"
    @click="handleEdit"
  >
    <div class="milestone-count">
      {{ milestones.length }} 个里程碑
    </div>
    
    <!-- 里程碑详情（用于 popover） -->
    <div v-if="$slots.default" class="milestone-popover">
      <slot />
    </div>
    <div v-else class="milestone-popover">
      <div class="milestone-popover-title">里程碑列表</div>
      <div 
        v-for="(ms, idx) in formattedMilestones" 
        :key="ms.id"
        class="milestone-item"
        :class="{ 'milestone-completed': ms.completed }"
      >
        <div class="milestone-item-header">
          <span class="milestone-index">{{ idx + 1 }}.</span>
          <span class="milestone-name">{{ ms.name || '未命名' }}</span>
          <el-icon v-if="ms.completed" class="milestone-check-icon">
            <Check />
          </el-icon>
        </div>
        <div class="milestone-item-info">
          <span>预期: {{ ms.expectedDate || '未设置' }}</span>
          <span>进度: {{ ms.progress }}%</span>
        </div>
      </div>
      <div v-if="!milestones.length" class="milestone-empty">
        暂无里程碑
      </div>
    </div>
  </div>
</template>

<style scoped>
.milestone-list-container {
  display: inline-block;
}

.milestone-list-container.editable {
  cursor: pointer;
}

.milestone-count {
  font-size: 13px;
  color: var(--text-regular, #475569);
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.milestone-list-container.editable:hover .milestone-count {
  background: var(--bg-page, #f8fafc);
}

/* 里程碑弹出层 */
.milestone-popover {
  padding: 4px 0;
  max-width: 320px;
}

.milestone-popover-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main, #1e293b);
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  margin-bottom: 8px;
}

.milestone-item {
  padding: 8px 10px;
  border-radius: 6px;
  margin-bottom: 6px;
  background: var(--bg-white, #fff);
  border: 1px solid transparent;
  transition: all 0.2s;
}

.milestone-item:last-child {
  margin-bottom: 0;
  border-bottom: none;
}

/* 里程碑完成状态样式 */
.milestone-item.milestone-completed {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(34, 197, 94, 0.15) 100%);
  border-color: rgba(34, 197, 94, 0.2);
}

.milestone-item.milestone-completed .milestone-index {
  color: var(--el-color-success, #67c23a);
}

.milestone-item.milestone-completed .milestone-name {
  color: var(--el-color-success-dark-2, #529b2e);
}

.milestone-check-icon {
  color: var(--el-color-success, #67c23a);
  font-size: 16px;
  margin-left: auto;
}

.milestone-item-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.milestone-index {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary, #64748b);
  flex-shrink: 0;
}

.milestone-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-main, #1e293b);
  flex: 1;
}

.milestone-item-info {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-secondary, #64748b);
  padding-left: 20px;
}

.milestone-empty {
  text-align: center;
  padding: 16px;
  font-size: 13px;
  color: var(--text-placeholder, #94a3b8);
}
</style>
