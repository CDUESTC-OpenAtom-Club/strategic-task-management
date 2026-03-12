<script setup lang="ts">
/**
 * Indicator Edit Page
 * 
 * Full page for creating or editing strategic indicators.
 */

import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElCard } from 'element-plus'
import { PageHeader } from '@/shared/ui/layout'
import { IndicatorForm, useIndicatorStore } from '@/features/strategic-indicator'
import type { Indicator } from '@/entities/indicator/model/types'

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

const indicatorId = computed(() => route.params.id ? Number(route.params.id) : null)
const isEditMode = computed(() => indicatorId.value !== null)
const pageTitle = computed(() => isEditMode.value ? '编辑指标' : '新建指标')

onMounted(() => {
  if (isEditMode.value) {
    fetchIndicatorDetail()
  }
})

async function fetchIndicatorDetail() {
  if (!indicatorId.value) {return}
  
  loading.value = true
  try {
    const data = await indicatorStore.fetchIndicatorById(indicatorId.value)
    formData.value = { ...data }
  } catch (error) {
    ElMessage.error('加载指标信息失败')
    console.error('Failed to fetch indicator:', error)
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
    console.error('Failed to save indicator:', error)
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
  <div class="indicator-edit-page">
    <PageHeader
      :title="pageTitle"
      show-back
      @back="handleBack"
    />

    <div class="page-content">
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
.indicator-edit-page {
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

.form-card {
  max-width: 900px;
  margin: 0 auto;
}
</style>
