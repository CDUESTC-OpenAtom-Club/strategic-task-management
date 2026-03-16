<script setup lang="ts">
/**
 * Indicator Edit View
 *
 * Full-page view for creating or editing strategic indicators.
 */

import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElCard } from 'element-plus'
import type { Indicator } from '@/4-entities/indicator/model/types'
import { useIndicatorStore, IndicatorForm } from '@/3-features/indicator'
import { logger } from '@/5-shared/lib/utils/logger'

const router = useRouter()
const route = useRoute()
const indicatorStore = useIndicatorStore()

const loading = ref(false)
const submitting = ref(false)
const formData = ref<Partial<Indicator>>({
  type: 'QUANTITATIVE',
  level: 'FIRST',
  status: 'DRAFT'
})

const indicatorId = computed(() => (route.params.id ? Number(route.params.id) : null))
const isEditMode = computed(() => indicatorId.value !== null)
const pageTitle = computed(() => (isEditMode.value ? '编辑指标' : '新建指标'))

onMounted(() => {
  if (isEditMode.value) {
    fetchIndicatorDetail()
  }
})

async function fetchIndicatorDetail() {
  if (!indicatorId.value) {
    return
  }

  loading.value = true
  try {
    const data = await indicatorStore.fetchIndicatorById(indicatorId.value)
    formData.value = { ...data }
  } catch (error) {
    ElMessage.error('加载指标信息失败')
    logger.error('Failed to fetch indicator:', error)
  } finally {
    loading.value = false
  }
}

async function handleSubmit(data: Partial<Indicator>) {
  submitting.value = true
  try {
    if (isEditMode.value && indicatorId.value) {
      await indicatorStore.updateIndicator(indicatorId.value, data)
      ElMessage.success('更新成功')
    } else {
      await indicatorStore.createIndicator(data)
      ElMessage.success('创建成功')
    }

    router.push({ name: 'IndicatorList' })
  } catch (error) {
    ElMessage.error(isEditMode.value ? '更新失败' : '创建失败')
    logger.error('Failed to save indicator:', error)
  } finally {
    submitting.value = false
  }
}

function handleCancel() {
  router.back()
}

function handleBack() {
  router.back()
}
</script>

<template>
  <div class="indicator-edit-view">
    <!-- Header -->
    <div class="edit-header">
      <el-button @click="handleBack">返回</el-button>
      <h2>{{ pageTitle }}</h2>
    </div>

    <!-- Form -->
    <div class="edit-content">
      <el-card class="form-card" shadow="never">
        <IndicatorForm
          v-model="formData"
          :mode="isEditMode ? 'edit' : 'create'"
          :loading="submitting || loading"
          @submit="handleSubmit"
          @cancel="handleCancel"
        >
          <template #task-options>
            <!-- Task options would be loaded from API -->
            <el-option label="战略任务A" :value="1" />
            <el-option label="战略任务B" :value="2" />
            <el-option label="战略任务C" :value="3" />
          </template>

          <template #owner-org-options>
            <!-- Owner organization options -->
            <el-option label="战略规划部" :value="1" />
            <el-option label="职能部门" :value="2" />
            <el-option label="学院A" :value="3" />
          </template>

          <template #target-org-options>
            <!-- Target organization options -->
            <el-option label="战略规划部" :value="1" />
            <el-option label="职能部门" :value="2" />
            <el-option label="学院A" :value="3" />
          </template>
        </IndicatorForm>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.indicator-edit-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 24px;
  background-color: #f5f7fa;
  overflow: auto;
}

.edit-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  padding: 16px;
  background: #fff;
  border-radius: 4px;
}

.edit-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.edit-content {
  flex: 1;
}

.form-card {
  max-width: 900px;
  margin: 0 auto;
}
</style>
