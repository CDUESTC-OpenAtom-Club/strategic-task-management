<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  ElCard,
  ElForm,
  ElFormItem,
  ElInput,
  ElButton,
  ElIcon as _ElIcon,
  ElMessage,
  ElSelect,
  ElOption
} from 'element-plus'
import { ArrowLeft, Plus, Delete as _Delete } from '@element-plus/icons-vue'
import type { Plan, Task } from '@/shared/types'
import { usePlanStore } from '@/features/plan/model/store'
import { useAuthStore } from '@/features/auth/model/store'

/**
 * Plan 编辑页
 *
 * 功能：
 * - 创建新的 Plan
 * - 编辑已有的 Plan
 * - 管理 Plan 的 Task 列表
 */

const router = useRouter()
const route = useRoute()
const planStore = usePlanStore()
const authStore = useAuthStore()

// 状态
const loading = ref(false)
const saving = ref(false)
const isEdit = ref(false)
const planId = ref<string | null>(null)

// 表单数据
const formData = ref<Partial<Plan>>({
  name: '',
  cycle: new Date().getFullYear().toString(),
  description: '',
  status: 'draft',
  tasks: []
})

// 任务表单
const taskForm = ref<Partial<Task>>({
  name: '',
  type: 'qualitative',
  description: ''
})

const showTaskForm = ref(false)
const editingTaskIndex = ref<number | null>(null)

// 表单引用
const formRef = ref<InstanceType<typeof ElForm>>()
const taskFormRef = ref<InstanceType<typeof ElForm>>()

// 表单验证规则
const rules = {
  name: [
    { required: true, message: '请输入计划名称', trigger: 'blur' },
    { min: 2, max: 100, message: '计划名称长度应在 2-100 个字符之间', trigger: 'blur' }
  ],
  cycle: [{ required: true, message: '请输入周期', trigger: 'blur' }]
}

const taskRules = {
  name: [{ required: true, message: '请输入任务名称', trigger: 'blur' }]
}

// 计算属性
const pageTitle = computed(() => (isEdit.value ? '编辑计划' : '新建计划'))

// 获取用户部门
const userOrgId = computed(() => {
  const value = authStore.user?.orgId
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
})

// 操作方法
const handleBack = () => {
  router.push({ name: 'PlanList' })
}

const handleSave = async () => {
  if (!formRef.value) {
    return
  }

  try {
    await formRef.value.validate()
  } catch {
    return
  }

  saving.value = true

  try {
    // 设置组织 ID
    if (userOrgId.value == null) {
      throw new Error('当前用户缺少有效组织 ID')
    }
    formData.value.org_id = userOrgId.value

    if (isEdit.value && planId.value) {
      await planStore.updatePlan(planId.value, formData.value)
    } else {
      const newPlan = await planStore.createPlan(formData.value)
      planId.value = newPlan.id?.toString() || null
      isEdit.value = true
    }
    ElMessage.success('保存成功')
  } catch (error) {
    // Error handled in store
  } finally {
    saving.value = false
  }
}

const handleSaveAndExit = async () => {
  await handleSave()
  handleBack()
}

// 任务管理
const openAddTask = () => {
  taskForm.value = {
    name: '',
    type: 'qualitative',
    description: ''
  }
  editingTaskIndex.value = null
  showTaskForm.value = true
}

const openEditTask = (index: number) => {
  const task = formData.value.tasks?.[index]
  if (task) {
    taskForm.value = { ...task }
    editingTaskIndex.value = index
    showTaskForm.value = true
  }
}

const handleSaveTask = () => {
  if (!taskForm.value.name) {
    ElMessage.warning('请输入任务名称')
    return
  }

  const tasks = formData.value.tasks || []

  if (editingTaskIndex.value !== null) {
    // 编辑现有任务
    tasks[editingTaskIndex.value] = { ...tasks[editingTaskIndex.value], ...taskForm.value }
  } else {
    // 添加新任务
    tasks.push({
      id: Date.now(),
      plan_id: planId.value || 0,
      name: taskForm.value.name,
      type: taskForm.value.type || 'qualitative',
      description: taskForm.value.description,
      indicators: []
    } as Task)
  }

  formData.value.tasks = tasks
  showTaskForm.value = false
  taskForm.value = { name: '', type: 'qualitative', description: '' }
}

const handleDeleteTask = (index: number) => {
  const tasks = formData.value.tasks || []
  tasks.splice(index, 1)
  formData.value.tasks = tasks
}

const handleCancelTask = () => {
  showTaskForm.value = false
  taskForm.value = { name: '', type: 'qualitative', description: '' }
}

// 加载 Plan 数据（编辑模式）
const loadPlan = async () => {
  if (!planId.value) {
    return
  }

  loading.value = true
  try {
    await planStore.loadPlan(planId.value)
    if (planStore.currentPlan) {
      formData.value = { ...planStore.currentPlan }
    }
  } catch (error) {
    ElMessage.error('加载计划失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  const id = route.params.id as string
  if (id && id !== 'create') {
    planId.value = id
    isEdit.value = true
    loadPlan()
  }
})
</script>

<template>
  <div class="plan-edit-view">
    <!-- 头部 -->
    <div class="page-header">
      <div class="header-left">
        <el-button :icon="ArrowLeft" circle @click="handleBack" />
        <h1 class="page-title">{{ pageTitle }}</h1>
      </div>
      <div class="header-actions">
        <el-button @click="handleBack">取消</el-button>
        <el-button :loading="saving" @click="handleSave">保存</el-button>
        <el-button type="primary" :loading="saving" @click="handleSaveAndExit">
          保存并返回
        </el-button>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="content-area">
      <!-- 基本信息 -->
      <el-card class="form-card" shadow="never">
        <template #header>
          <h3 class="card-title">基本信息</h3>
        </template>

        <el-form
          ref="formRef"
          :model="formData"
          :rules="rules"
          label-width="100px"
          label-position="top"
        >
          <el-form-item label="计划名称" prop="name">
            <el-input
              v-model="formData.name"
              placeholder="请输入计划名称"
              maxlength="100"
              show-word-limit
            />
          </el-form-item>

          <el-form-item label="周期" prop="cycle">
            <el-input v-model="formData.cycle" placeholder="例如：2025、2025-Q1" maxlength="20" />
          </el-form-item>

          <el-form-item label="描述">
            <el-input
              v-model="formData.description"
              type="textarea"
              :rows="4"
              placeholder="请输入计划描述（可选）"
              maxlength="500"
              show-word-limit
            />
          </el-form-item>
        </el-form>
      </el-card>

      <!-- 任务列表 -->
      <el-card class="form-card" shadow="never">
        <template #header>
          <div class="card-header">
            <h3 class="card-title">任务列表</h3>
            <el-button :icon="Plus" type="primary" @click="openAddTask"> 添加任务 </el-button>
          </div>
        </template>

        <div v-if="!formData.tasks || formData.tasks.length === 0" class="empty-tasks">
          <el-empty description="暂无任务，点击上方按钮添加">
            <el-button :icon="Plus" type="primary" @click="openAddTask"> 添加第一个任务 </el-button>
          </el-empty>
        </div>

        <div v-else class="task-list">
          <div v-for="(task, index) in formData.tasks" :key="task.id" class="task-item">
            <div class="task-info">
              <div class="task-name">{{ task.name }}</div>
              <el-tag size="small" type="info">
                {{ task.type === 'qualitative' ? '定性' : '定量' }}
              </el-tag>
            </div>
            <div class="task-actions">
              <el-button link type="primary" @click="openEditTask(index)"> 编辑 </el-button>
              <el-button link type="danger" @click="handleDeleteTask(index)"> 删除 </el-button>
            </div>
          </div>
        </div>

        <!-- 任务表单 -->
        <div v-if="showTaskForm" class="task-form-container">
          <div class="task-form-header">
            <h4>{{ editingTaskIndex !== null ? '编辑任务' : '添加任务' }}</h4>
          </div>
          <el-form ref="taskFormRef" :model="taskForm" :rules="taskRules" label-width="80px">
            <el-form-item label="任务名称" prop="name">
              <el-input v-model="taskForm.name" placeholder="请输入任务名称" maxlength="100" />
            </el-form-item>

            <el-form-item label="任务类型">
              <el-select v-model="taskForm.type" style="width: 200px">
                <el-option label="定性指标" value="qualitative" />
                <el-option label="定量指标" value="quantitative" />
              </el-select>
            </el-form-item>

            <el-form-item label="描述">
              <el-input
                v-model="taskForm.description"
                type="textarea"
                :rows="3"
                placeholder="请输入任务描述（可选）"
              />
            </el-form-item>

            <el-form-item>
              <el-button type="primary" @click="handleSaveTask">
                {{ editingTaskIndex !== null ? '更新' : '添加' }}
              </el-button>
              <el-button @click="handleCancelTask">取消</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.plan-edit-view {
  padding: 20px;
  max-width: 900px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.form-card {
  margin-bottom: 20px;
}

.card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header .card-title {
  margin: 0;
}

.empty-tasks {
  padding: 20px;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}

.task-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.task-name {
  font-weight: 500;
}

.task-actions {
  display: flex;
  gap: 8px;
}

.task-form-container {
  margin-top: 20px;
  padding: 16px;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
}

.task-form-header h4 {
  margin: 0 0 16px;
  font-size: 14px;
  font-weight: 600;
}
</style>
