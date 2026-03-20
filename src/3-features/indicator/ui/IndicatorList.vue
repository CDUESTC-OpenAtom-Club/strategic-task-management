<script setup lang="ts">
/**
 * Indicator List Component
 *
 * Displays indicators in a table with filtering and pagination.
 */

import { ref } from 'vue'
import {
  ElTable,
  ElTableColumn,
  ElTag,
  ElButton,
  ElSpace,
  ElPagination,
  ElEmpty
} from 'element-plus'
import type { Indicator } from '@/entities/indicator/model/types'
import {
  STATUS_CONFIG,
  LEVEL_CONFIG,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS
} from '../model/constants'
import { formatWeightAsPercentage } from '../lib/calculations'
import { getAvailableActions } from '../lib/validations'

interface Props {
  data: Indicator[]
  loading?: boolean
  total?: number
  currentPage?: number
  pageSize?: number
}

interface Emits {
  (e: 'view', indicator: Indicator): void
  (e: 'edit', indicator: Indicator): void
  (e: 'delete', indicator: Indicator): void
  (e: 'distribute', indicator: Indicator): void
  (e: 'page-change', page: number): void
  (e: 'size-change', size: number): void
}

withDefaults(defineProps<Props>(), {
  loading: false,
  total: 0,
  currentPage: 1,
  pageSize: DEFAULT_PAGE_SIZE
})

const emit = defineEmits<Emits>()

const selectedRows = ref<Indicator[]>([])

function handleSelectionChange(selection: Indicator[]) {
  selectedRows.value = selection
}

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT
}

function getLevelConfig(level: string) {
  return LEVEL_CONFIG[level] || LEVEL_CONFIG.FIRST
}

function formatWeight(weight: number | undefined) {
  return formatWeightAsPercentage(weight)
}

function formatCompletionRate(indicator: Indicator) {
  if (!indicator.targetValue) {
    return '-'
  }
  const rate = indicator.completionRate || 0
  return `${rate.toFixed(1)}%`
}

function handleView(indicator: Indicator) {
  emit('view', indicator)
}

function handleEdit(indicator: Indicator) {
  emit('edit', indicator)
}

function handleDelete(indicator: Indicator) {
  emit('delete', indicator)
}

function handleDistribute(indicator: Indicator) {
  emit('distribute', indicator)
}

function handlePageChange(page: number) {
  emit('page-change', page)
}

function handleSizeChange(size: number) {
  emit('size-change', size)
}

defineExpose({
  selectedRows
})
</script>

<template>
  <div class="indicator-list">
    <ElTable :data="data" :loading="loading" stripe @selection-change="handleSelectionChange">
      <ElTableColumn type="selection" width="55" />

      <ElTableColumn prop="code" label="编码" width="120" />

      <ElTableColumn prop="name" label="指标名称" min-width="200" show-overflow-tooltip />

      <ElTableColumn prop="level" label="层级" width="100">
        <template #default="{ row }">
          <ElTag :type="row.level === 'FIRST' ? 'primary' : 'success'" size="small">
            {{ getLevelConfig(row.level).label }}
          </ElTag>
        </template>
      </ElTableColumn>

      <ElTableColumn prop="type" label="类型" width="100">
        <template #default="{ row }">
          {{ row.type === 'QUANTITATIVE' ? '定量' : '定性' }}
        </template>
      </ElTableColumn>

      <ElTableColumn prop="taskName" label="所属任务" width="150" show-overflow-tooltip />

      <ElTableColumn prop="ownerOrg" label="责任组织" width="150" show-overflow-tooltip />

      <ElTableColumn prop="targetOrg" label="目标组织" width="150" show-overflow-tooltip />

      <ElTableColumn label="目标/当前" width="120">
        <template #default="{ row }">
          <span v-if="row.type === 'QUANTITATIVE'">
            {{ row.targetValue || 0 }} / {{ row.actualValue || 0 }}
          </span>
          <span v-else>-</span>
        </template>
      </ElTableColumn>

      <ElTableColumn label="完成率" width="100">
        <template #default="{ row }">
          {{ formatCompletionRate(row) }}
        </template>
      </ElTableColumn>

      <ElTableColumn prop="weight" label="权重" width="80">
        <template #default="{ row }">
          {{ formatWeight(row.weight) }}
        </template>
      </ElTableColumn>

      <ElTableColumn prop="status" label="状态" width="100">
        <template #default="{ row }">
          <ElTag :type="getStatusConfig(row.status).type" size="small">
            {{ getStatusConfig(row.status).label }}
          </ElTag>
        </template>
      </ElTableColumn>

      <ElTableColumn label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <ElSpace>
            <ElButton size="small" link @click="handleView(row)"> 查看 </ElButton>
            <ElButton
              v-if="getAvailableActions(row).includes('edit')"
              size="small"
              type="primary"
              link
              @click="handleEdit(row)"
            >
              编辑
            </ElButton>
            <ElButton
              v-if="getAvailableActions(row).includes('distribute')"
              size="small"
              type="success"
              link
              @click="handleDistribute(row)"
            >
              下发
            </ElButton>
            <ElButton
              v-if="getAvailableActions(row).includes('delete')"
              size="small"
              type="danger"
              link
              @click="handleDelete(row)"
            >
              删除
            </ElButton>
          </ElSpace>
        </template>
      </ElTableColumn>

      <template #empty>
        <ElEmpty description="暂无数据" />
      </template>
    </ElTable>

    <div v-if="total > 0" class="pagination-container">
      <ElPagination
        :current-page="currentPage"
        :page-size="pageSize"
        :page-sizes="PAGE_SIZE_OPTIONS"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>
  </div>
</template>

<style scoped>
.indicator-list {
  width: 100%;
}

.pagination-container {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
