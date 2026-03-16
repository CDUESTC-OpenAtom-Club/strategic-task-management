<script setup lang="ts">
/**
 * Indicator Distribute View
 *
 * Full-page view for distributing indicators to target organizations.
 */

import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  ElCard,
  ElForm,
  ElFormItem,
  ElInput,
  ElDatePicker,
  ElButton,
  ElSpace,
  ElMessage,
  ElDescriptions,
  ElDescriptionsItem,
  ElTag,
  ElTree,
  type FormInstance
} from 'element-plus'
import type { Indicator } from '@/entities/indicator/model/types'
import { useIndicatorStore, STATUS_CONFIG, LEVEL_CONFIG } from '@/features/strategic-indicator'
import { logger } from '@/shared/lib/utils/logger'

const router = useRouter()
const route = useRoute()
const indicatorStore = useIndicatorStore()

const loading = ref(false)
const submitting = ref(false)
const indicator = ref<Indicator | null>(null)
const formRef = ref<FormInstance>()

const formData = ref({
  targetOrgIds: [] as number[],
  message: '',
  deadline: ''
})

const indicatorId = computed(() => Number(route.params.id))

const statusConfig = computed(() =>
  indicator.value
    ? STATUS_CONFIG[indicator.value.status] || STATUS_CONFIG.DRAFT
    : STATUS_CONFIG.DRAFT
)

const levelConfig = computed(() =>
  indicator.value ? LEVEL_CONFIG[indicator.value.level] || LEVEL_CONFIG.FIRST : LEVEL_CONFIG.FIRST
)

const formRules = {
  targetOrgIds: [
    { required: true, message: '请至少选择一个目标组织', trigger: 'change', type: 'array', min: 1 }
  ]
}

// Mock organization tree data
const orgTreeData = ref([
  {
    id: 1,
    label: '战略规划部',
    children: []
  },
  {
    id: 2,
    label: '职能部门',
    children: [
      { id: 21, label: '人事处' },
      { id: 22, label: '财务处' },
      { id: 23, label: '教务处' }
    ]
  },
  {
    id: 3,
    label: '学院',
    children: [
      { id: 31, label: '计算机学院' },
      { id: 32, label: '管理学院' },
      { id: 33, label: '外国语学院' }
    ]
  }
])

onMounted(() => {
  fetchIndicatorDetail()
})

async function fetchIndicatorDetail() {
  loading.value = true
  try {
    const data = await indicatorStore.fetchIndicatorById(indicatorId.value)
    indicator.value = data
  } catch (error) {
    ElMessage.error('加载指标信息失败')
    logger.error('Failed to fetch indicator:', error)
  } finally {
    loading.value = false
  }
}

async function handleSubmit() {
  if (!formRef.value) {
    return
  }

  await formRef.value.validate(async valid => {
    if (!valid) {
      return
    }

    submitting.value = true
    try {
      // Handle distribution logic
      await indicatorStore.distributeIndicator(indicatorId.value, {
        targetOrgIds: formData.value.targetOrgIds,
        message: formData.value.message,
        deadline: formData.value.deadline
      })
      ElMessage.success('下发成功')
      router.back()
    } catch (error) {
      ElMessage.error('下发失败')
      logger.error('Failed to distribute indicator:', error)
    } finally {
      submitting.value = false
    }
  })
}

function handleCancel() {
  router.back()
}

function handleBack() {
  router.back()
}
</script>

<template>
  <div class="indicator-distribute-view">
    <!-- Header -->
    <div class="distribute-header">
      <el-button @click="handleBack">返回</el-button>
      <h2>下发指标</h2>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <el-skeleton :rows="5" animated />
    </div>

    <!-- Content -->
    <div v-else-if="indicator" class="distribute-content">
      <!-- Indicator Info Card -->
      <el-card class="info-card" shadow="never">
        <template #header>
          <span class="card-title">指标信息</span>
        </template>

        <el-descriptions :column="2" border>
          <el-descriptions-item label="指标名称">
            {{ indicator.name }}
          </el-descriptions-item>
          <el-descriptions-item label="指标编码">
            {{ indicator.code || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="指标类型">
            <el-tag size="small">
              {{ indicator.type === 'QUANTITATIVE' ? '定量' : '定性' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="指标层级">
            <el-tag :type="levelConfig.badge === '1' ? 'primary' : 'success'" size="small">
              {{ levelConfig.label }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusConfig.type" size="small">
              {{ statusConfig.label }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="权重"> {{ indicator.weight }}% </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- Distribution Form Card -->
      <el-card class="form-card" shadow="never">
        <template #header>
          <span class="card-title">下发配置</span>
        </template>

        <el-form ref="formRef" :model="formData" :rules="formRules" label-width="120px">
          <el-form-item label="目标组织" prop="targetOrgIds">
            <el-tree
              v-model="formData.targetOrgIds"
              :data="orgTreeData"
              show-checkbox
              node-key="id"
              :props="{ label: 'label', children: 'children' }"
              placeholder="请选择目标组织"
            />
          </el-form-item>

          <el-form-item label="截止日期" prop="deadline">
            <el-date-picker
              v-model="formData.deadline"
              type="date"
              placeholder="请选择截止日期"
              style="width: 100%"
            />
          </el-form-item>

          <el-form-item label="下发说明" prop="message">
            <el-input
              v-model="formData.message"
              type="textarea"
              :rows="4"
              placeholder="请输入下发说明（可选）"
            />
          </el-form-item>

          <el-form-item>
            <el-space>
              <el-button type="primary" :loading="submitting" @click="handleSubmit">
                确认下发
              </el-button>
              <el-button @click="handleCancel"> 取消 </el-button>
            </el-space>
          </el-form-item>
        </el-form>
      </el-card>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-container">
      <el-empty description="未找到指标信息" />
    </div>
  </div>
</template>

<style scoped>
.indicator-distribute-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 24px;
  background-color: #f5f7fa;
  overflow: auto;
}

.distribute-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  padding: 16px;
  background: #fff;
  border-radius: 4px;
}

.distribute-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.loading-container,
.empty-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.distribute-content {
  max-width: 900px;
  margin: 0 auto;
}

.info-card,
.form-card {
  margin-bottom: 16px;
}

.card-title {
  font-weight: 600;
  font-size: 16px;
}
</style>
