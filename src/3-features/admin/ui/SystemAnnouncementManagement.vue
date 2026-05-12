<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  ElButton,
  ElCard,
  ElDatePicker,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElTable,
  ElTableColumn,
  ElTag,
  type FormInstance
} from 'element-plus'
import { Bell, Plus, Promotion, RefreshLeft, Refresh } from '@element-plus/icons-vue'
import { announcementApi, type AnnouncementItem } from '@/features/admin/api/announcementApi'

const loading = ref(false)
const announcements = ref<AnnouncementItem[]>([])
const totalElements = ref(0)
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()

const form = reactive({
  title: '',
  content: '',
  scheduledAt: ''
})

const formRules = {
  title: [{ required: true, message: '请输入公告标题', trigger: 'blur' }],
  content: [{ required: true, message: '请输入公告内容', trigger: 'blur' }]
}

const sortedAnnouncements = computed(() =>
  [...announcements.value].sort((a, b) => {
    const left = new Date(a.createdAt || a.publishedAt || '').getTime()
    const right = new Date(b.createdAt || b.publishedAt || '').getTime()
    return right - left
  })
)

const statusTagType = (status: AnnouncementItem['status']) => {
  switch (status) {
    case 'PUBLISHED':
      return 'success'
    case 'WITHDRAWN':
      return 'info'
    default:
      return 'warning'
  }
}

const statusLabel = (status: AnnouncementItem['status']) => {
  switch (status) {
    case 'PUBLISHED':
      return '已发布'
    case 'WITHDRAWN':
      return '已撤回'
    default:
      return '草稿'
  }
}

const resetForm = () => {
  form.title = ''
  form.content = ''
  form.scheduledAt = ''
}

const loadAnnouncements = async () => {
  loading.value = true
  try {
    const page = await announcementApi.list(undefined, 0, 50)
    announcements.value = page.content || []
    totalElements.value = page.totalElements || 0
  } catch (error) {
    ElMessage.error('加载公告列表失败')
  } finally {
    loading.value = false
  }
}

const handleCreate = async () => {
  if (!formRef.value) {
    return
  }
  await formRef.value.validate()
  try {
    await announcementApi.create({
      title: form.title.trim(),
      content: form.content.trim(),
      scheduledAt: form.scheduledAt || null
    })
    ElMessage.success('公告创建成功')
    dialogVisible.value = false
    resetForm()
    await loadAnnouncements()
  } catch (error) {
    ElMessage.error('公告创建失败')
  }
}

const handlePublish = async (row: AnnouncementItem) => {
  try {
    await announcementApi.publish(row.id)
    ElMessage.success('公告已发布')
    await loadAnnouncements()
  } catch (error) {
    ElMessage.error('公告发布失败')
  }
}

const handleWithdraw = async (row: AnnouncementItem) => {
  try {
    await announcementApi.withdraw(row.id)
    ElMessage.success('公告已撤回')
    await loadAnnouncements()
  } catch (error) {
    ElMessage.error('公告撤回失败')
  }
}

onMounted(() => {
  void loadAnnouncements()
})
</script>

<template>
  <el-card class="announcement-card">
    <template #header>
      <div class="announcement-header">
        <div>
          <h3 class="announcement-title">
            <el-icon><Bell /></el-icon>
            系统公告管理
          </h3>
          <p class="announcement-desc">
            发布、定时发布和撤回系统维护公告，发布后会通知全体活跃用户。
          </p>
        </div>
        <div class="announcement-actions">
          <el-button :icon="Refresh" @click="loadAnnouncements">刷新</el-button>
          <el-button type="primary" :icon="Plus" @click="dialogVisible = true">新建公告</el-button>
        </div>
      </div>
    </template>

    <div class="announcement-summary">当前共 {{ totalElements }} 条公告</div>

    <el-table v-loading="loading" :data="sortedAnnouncements" border>
      <el-table-column prop="title" label="标题" min-width="240" />
      <el-table-column prop="content" label="内容" min-width="320" show-overflow-tooltip />
      <el-table-column label="状态" width="120">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="定时发布时间" min-width="180">
        <template #default="{ row }">{{ row.scheduledAt || '--' }}</template>
      </el-table-column>
      <el-table-column label="实际发布时间" min-width="180">
        <template #default="{ row }">{{ row.publishedAt || '--' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.status === 'DRAFT'"
            type="success"
            size="small"
            :icon="Promotion"
            @click="handlePublish(row)"
          >
            立即发布
          </el-button>
          <el-button
            v-if="row.status === 'PUBLISHED'"
            type="warning"
            size="small"
            :icon="RefreshLeft"
            @click="handleWithdraw(row)"
          >
            撤回
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" title="新建系统公告" width="720px" @closed="resetForm">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="110px">
        <el-form-item label="公告标题" prop="title">
          <el-input v-model="form.title" maxlength="255" show-word-limit />
        </el-form-item>
        <el-form-item label="公告内容" prop="content">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="6"
            maxlength="4000"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="定时发布">
          <el-date-picker
            v-model="form.scheduledAt"
            type="datetime"
            value-format="YYYY-MM-DDTHH:mm:ss"
            placeholder="留空表示创建后手动发布"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreate">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<style scoped>
.announcement-card {
  margin-top: 24px;
}

.announcement-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.announcement-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
}

.announcement-desc {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.announcement-actions {
  display: flex;
  gap: 12px;
}

.announcement-summary {
  margin-bottom: 16px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
</style>
