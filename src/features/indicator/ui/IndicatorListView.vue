<script setup lang="ts">
/**
 * Indicator List View
 *
 * Container component for indicator list functionality.
 * Handles business logic and delegates to IndicatorList for presentation.
 */

import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { Indicator } from '@/entities/indicator/model/types'
import {
  useIndicatorStore,
  canDeleteIndicator,
  canDistributeIndicator,
  IndicatorList,
  IndicatorDetailDialog,
  IndicatorDistributionDialog
} from '@/features/indicator'

const router = useRouter()
const indicatorStore = useIndicatorStore()

const loading = ref(false)
const selectedIndicators = ref<Indicator[]>([])
const showDetailDialog = ref(false)
const showDistributionDialog = ref(false)
const selectedIndicator = ref<Indicator | null>(null)

// Computed from store
const indicators = computed(() => indicatorStore.indicators)
const total = computed(() => indicatorStore.total)
const currentPage = computed(() => indicatorStore.filters.page || 0)
const pageSize = computed(() => indicatorStore.filters.size || 20)

onMounted(() => {
  loadData()
})

async function loadData() {
  loading.value = true
  try {
    await indicatorStore.fetchIndicators()
  } catch (error) {
    ElMessage.error('加载指标列表失败')
  } finally {
    loading.value = false
  }
}

function handleView(indicator: Indicator) {
  selectedIndicator.value = indicator
  showDetailDialog.value = true
}

function handleEdit(indicator: Indicator) {
  router.push({
    name: 'IndicatorEdit',
    params: { id: indicator.id }
  })
}

function handleDelete(indicator: Indicator) {
  if (!canDeleteIndicator(indicator)) {
    ElMessage.warning('该指标状态不允许删除')
    return
  }

  ElMessageBox.confirm('确定要删除该指标吗？删除后无法恢复。', '删除确认', {
    type: 'warning',
    confirmButtonText: '确定',
    cancelButtonText: '取消'
  })
    .then(async () => {
      try {
        await indicatorStore.deleteIndicator(indicator.id)
        ElMessage.success('删除成功')
        await loadData()
      } catch (error) {
        ElMessage.error('删除失败')
      }
    })
    .catch(() => {
      // User cancelled
    })
}

function handleDistribute(indicator: Indicator) {
  if (!canDistributeIndicator(indicator)) {
    ElMessage.warning('该指标状态不允许下发')
    return
  }
  selectedIndicator.value = indicator
  showDistributionDialog.value = true
}

function handleBatchDistribute() {
  if (selectedIndicators.value.length === 0) {
    ElMessage.warning('请先选择要下发的指标')
    return
  }
  showDistributionDialog.value = true
}

function handlePageChange(page: number) {
  indicatorStore.filters.page = page - 1 // Convert 1-based to 0-based
  loadData()
}

function handleSizeChange(size: number) {
  indicatorStore.filters.size = size
  loadData()
}

async function handleDistributionSubmit() {
  try {
    // Handle distribution logic
    ElMessage.success('下发成功')
    showDistributionDialog.value = false
    await loadData()
  } catch (error) {
    ElMessage.error('下发失败')
  }
}

function handleCloseDialog() {
  showDetailDialog.value = false
  showDistributionDialog.value = false
  selectedIndicator.value = null
}
</script>

<template>
  <div class="indicator-list-view">
    <!-- Toolbar -->
    <div class="toolbar">
      <el-space>
        <el-button type="primary" @click="router.push({ name: 'IndicatorEdit' })">
          新建指标
        </el-button>
        <el-button :disabled="selectedIndicators.length === 0" @click="handleBatchDistribute">
          批量下发
        </el-button>
        <el-button @click="loadData"> 刷新 </el-button>
      </el-space>
    </div>

    <!-- List -->
    <IndicatorList
      :data="indicators"
      :loading="loading || indicatorStore.loading"
      :total="total"
      :current-page="currentPage + 1"
      :page-size="pageSize"
      @view="handleView"
      @edit="handleEdit"
      @delete="handleDelete"
      @distribute="handleDistribute"
      @page-change="handlePageChange"
      @size-change="handleSizeChange"
    />

    <!-- Detail Dialog -->
    <IndicatorDetailDialog
      v-if="selectedIndicator"
      :visible="showDetailDialog"
      :indicator="selectedIndicator"
      @close="handleCloseDialog"
    />

    <!-- Distribution Dialog -->
    <IndicatorDistributionDialog
      :visible="showDistributionDialog"
      :indicators="selectedIndicator ? [selectedIndicator] : selectedIndicators"
      @submit="handleDistributionSubmit"
      @cancel="handleCloseDialog"
    />
  </div>
</template>

<style scoped>
.indicator-list-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.toolbar {
  margin-bottom: 16px;
  padding: 16px;
  background: #fff;
  border-radius: 4px;
}
</style>
