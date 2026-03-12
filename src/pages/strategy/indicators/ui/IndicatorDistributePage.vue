<script setup lang="ts">
/**
 * Indicator Distribute Page
 * 
 * Full page for distributing indicators to target organizations with detailed configuration.
 */

import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { 
  ElCard,
  ElForm,
  ElFormItem,
  ElSelect,
  ElOption,
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
import { PageHeader } from '@/shared/ui/layout'
import { StatusBadge } from '@/shared/ui/display'
import { useIndicatorStore, STATUS_CONFIG, LEVEL_CONFIG } from '@/features/strategic-indicator'
import type { Indicator } from '@/entities/indicator/model/types'

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
  indicator.value ? STATUS_CONFIG[indicator.value.status] || STATUS_CONFIG.DRAFT : STATUS_CONFIG.DRAFT
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
    console.error('Failed to fetch indicator:', error)
  } finally {
    loading.value = false
  }
}

async function handleSubmit() {
  if (!formRef.value || !indicator.value) {return}

  try {
    await formRef.value.validate()
    
    submitting.value = true
    await indicatorStore.distributeIndicator(indicator.value.id, formData.value)
    ElMessage.success('下发成功')
    router.push({ name: 'IndicatorList' })
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('下发失败')
      console.error('Failed to distribute indicator:', error)
    }
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
  <div class="indicator-distribute-page">
    <PageHeader
      title="下发指标"
      show-back
      @back="handleBack"
    />

    <div class="page-content">
      <div class="content-container">
        <!-- Indicator Information -->
        <el-card v-if="indicator" class="info-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span class="card-title">指标信息</span>
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
            <el-descriptions-item label="所属任务">
              {{ indicator.taskName || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="责任组织">
              {{ indicator.ownerOrg || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="当前状态">
              {{ statusConfig.label }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- Distribution Form -->
        <el-card class="form-card" shadow="never">
          <template #header>
            <span class="card-title">下发配置</span>
          </template>

          <el-form
            ref="formRef"
            :model="formData"
            :rules="formRules"
            label-width="120px"
            :disabled="submitting || loading"
          >
            <el-form-item label="目标组织" prop="targetOrgIds" required>
              <el-select 
                v-model="formData.targetOrgIds" 
                multiple
                filterable
                placeholder="请选择目标组织"
                style="width: 100%"
              >
                <el-option label="战略规划部" :value="1" />
                <el-option label="人事处" :value="21" />
                <el-option label="财务处" :value="22" />
                <el-option label="教务处" :value="23" />
                <el-option label="计算机学院" :value="31" />
                <el-option label="管理学院" :value="32" />
                <el-option label="外国语学院" :value="33" />
              </el-select>
              <div class="form-tip">
                可以选择多个组织同时下发
              </div>
            </el-form-item>

            <el-form-item label="下发说明" prop="message">
              <el-input 
                v-model="formData.message" 
                type="textarea"
                :rows="4"
                placeholder="请输入下发说明，如工作要求、注意事项等（可选）"
                maxlength="500"
                show-word-limit
              />
            </el-form-item>

            <el-form-item label="截止日期" prop="deadline">
              <el-date-picker 
                v-model="formData.deadline" 
                type="date"
                placeholder="请选择截止日期（可选）"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
              <div class="form-tip">
                设置目标组织完成该指标的截止时间
              </div>
            </el-form-item>

            <el-form-item>
              <el-space>
                <el-button type="primary" :loading="submitting" @click="handleSubmit">
                  确认下发
                </el-button>
                <el-button @click="handleCancel">
                  取消
                </el-button>
              </el-space>
            </el-form-item>
          </el-form>
        </el-card>

        <!-- Distribution Tips -->
        <el-card class="tips-card" shadow="never">
          <template #header>
            <span class="card-title">下发说明</span>
          </template>

          <div class="tips-content">
            <p><strong>下发流程：</strong></p>
            <ol>
              <li>选择需要下发的目标组织</li>
              <li>填写下发说明和截止日期</li>
              <li>确认下发后，目标组织将收到通知</li>
              <li>目标组织需要确认接收并开始执行</li>
            </ol>

            <p><strong>注意事项：</strong></p>
            <ul>
              <li>只有状态为"已批准"的指标才能下发</li>
              <li>下发后指标状态将变更为"已下发"</li>
              <li>目标组织可以查看指标详情并填报进度</li>
              <li>下发后可以撤回，但需要目标组织未开始填报</li>
            </ul>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.indicator-distribute-page {
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

.content-container {
  max-width: 1000px;
  margin: 0 auto;
}

.info-card,
.form-card,
.tips-card {
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

.form-tip {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.tips-content {
  font-size: 14px;
  line-height: 1.8;
}

.tips-content p {
  margin: 12px 0;
}

.tips-content strong {
  color: var(--el-text-color-primary);
}

.tips-content ol,
.tips-content ul {
  margin: 8px 0;
  padding-left: 24px;
}

.tips-content li {
  margin: 4px 0;
  color: var(--el-text-color-regular);
}
</style>
