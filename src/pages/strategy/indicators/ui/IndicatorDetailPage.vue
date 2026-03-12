<script setup lang="ts">
/**
 * Indicator Detail Page
 * 
 * Full page for viewing indicator details with related information.
 */

import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { 
  ElDescriptions, 
  ElDescriptionsItem, 
  ElTag, 
  ElProgress,
  ElButton,
  ElSpace,
  ElMessage,
  ElCard,
  ElEmpty
} from 'element-plus'
import { PageHeader } from '@/shared/ui/layout'
import { StatusBadge } from '@/shared/ui/display'
import { useIndicatorStore, STATUS_CONFIG, LEVEL_CONFIG } from '@/features/strategic-indicator'
import { calculateCompletionRate, formatWeightAsPercentage } from '@/features/strategic-indicator'
import type { Indicator } from '@/entities/indicator/model/types'

const router = useRouter()
const route = useRoute()
const indicatorStore = useIndicatorStore()

const loading = ref(false)
const indicator = ref<Indicator | null>(null)

const indicatorId = computed(() => Number(route.params.id))

const statusConfig = computed(() => 
  indicator.value ? STATUS_CONFIG[indicator.value.status] || STATUS_CONFIG.DRAFT : STATUS_CONFIG.DRAFT
)

const levelConfig = computed(() => 
  indicator.value ? LEVEL_CONFIG[indicator.value.level] || LEVEL_CONFIG.FIRST : LEVEL_CONFIG.FIRST
)

const completionRate = computed(() => {
  if (!indicator.value) {return 0}
  return calculateCompletionRate(indicator.value.targetValue, indicator.value.actualValue)
})

const weightDisplay = computed(() => 
  formatWeightAsPercentage(indicator.value?.weight)
)

onMounted(() => {
  fetchIndicatorDetail()
})

async function fetchIndicatorDetail() {
  loading.value = true
  try {
    const data = await indicatorStore.fetchIndicatorById(indicatorId.value)
    indicator.value = data
  } catch (error) {
    ElMessage.error('加载指标详情失败')
    console.error('Failed to fetch indicator detail:', error)
  } finally {
    loading.value = false
  }
}

function handleBack() {
  router.back()
}

function handleEdit() {
  router.push({
    name: 'IndicatorEdit',
    params: { id: indicatorId.value }
  })
}

function handleDistribute() {
  router.push({
    name: 'IndicatorDistribute',
    params: { id: indicatorId.value }
  })
}
</script>

<template>
  <div class="indicator-detail-page">
    <PageHeader
      :title="indicator?.name || '指标详情'"
      show-back
      @back="handleBack"
    >
      <template #actions>
        <el-space>
          <el-button @click="handleEdit">
            编辑
          </el-button>
          <el-button type="primary" @click="handleDistribute">
            下发
          </el-button>
        </el-space>
      </template>
    </PageHeader>

    <div class="page-content">
      <div v-if="loading" class="loading-container">
        <el-empty description="加载中..." />
      </div>

      <div v-else-if="indicator" class="detail-container">
        <!-- Basic Information -->
        <el-card class="info-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span class="card-title">基本信息</span>
              <el-space>
                <el-tag :type="levelConfig.badge === '1' ? 'primary' : 'success'" size="small">
                  {{ levelConfig.label }}
                </el-tag>
                <StatusBadge :status="indicator.status" :config="statusConfig" />
              </el-space>
            </div>
          </template>

          <el-descriptions :column="2" border>
            <el-descriptions-item label="指标编码">
              {{ indicator.code || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="指标名称">
              {{ indicator.name }}
            </el-descriptions-item>
            <el-descriptions-item label="指标类型">
              {{ indicator.type === 'QUANTITATIVE' ? '定量' : '定性' }}
            </el-descriptions-item>
            <el-descriptions-item label="指标层级">
              {{ levelConfig.label }}
            </el-descriptions-item>
            <el-descriptions-item label="所属任务">
              {{ indicator.taskName || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="权重">
              {{ weightDisplay }}
            </el-descriptions-item>
            <el-descriptions-item label="年份">
              {{ indicator.year || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="截止日期">
              {{ indicator.deadline || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="指标描述" :span="2">
              {{ indicator.description || '-' }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- Organization Information -->
        <el-card class="info-card" shadow="never">
          <template #header>
            <span class="card-title">组织信息</span>
          </template>

          <el-descriptions :column="2" border>
            <el-descriptions-item label="责任组织">
              {{ indicator.ownerOrg || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="目标组织">
              {{ indicator.targetOrg || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="责任人">
              {{ indicator.responsiblePerson || '-' }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- Progress Information (for quantitative indicators) -->
        <el-card v-if="indicator.type === 'QUANTITATIVE'" class="info-card" shadow="never">
          <template #header>
            <span class="card-title">进度信息</span>
          </template>

          <el-descriptions :column="2" border>
            <el-descriptions-item label="目标值">
              {{ indicator.targetValue }} {{ indicator.unit }}
            </el-descriptions-item>
            <el-descriptions-item label="当前值">
              {{ indicator.actualValue || 0 }} {{ indicator.unit }}
            </el-descriptions-item>
            <el-descriptions-item label="完成率" :span="2">
              <el-progress 
                :percentage="completionRate" 
                :status="completionRate >= 100 ? 'success' : undefined"
              />
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- Additional Information -->
        <el-card class="info-card" shadow="never">
          <template #header>
            <span class="card-title">其他信息</span>
          </template>

          <el-descriptions :column="2" border>
            <el-descriptions-item label="创建时间">
              {{ indicator.createdAt }}
            </el-descriptions-item>
            <el-descriptions-item label="更新时间">
              {{ indicator.updatedAt }}
            </el-descriptions-item>
            <el-descriptions-item label="备注" :span="2">
              {{ indicator.remark || '-' }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </div>

      <div v-else class="empty-container">
        <el-empty description="未找到指标信息" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.indicator-detail-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.page-content {
  flex: 1;
  padding: 24px;
  background-color: #f5f7fa;
  overflow: auto;
}

.loading-container,
.empty-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.detail-container {
  max-width: 1200px;
  margin: 0 auto;
}

.info-card {
  margin-bottom: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-weight: 600;
  font-size: 16px;
}
</style>
