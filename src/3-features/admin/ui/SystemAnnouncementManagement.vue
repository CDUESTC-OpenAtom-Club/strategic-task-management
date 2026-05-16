<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
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
import { invalidateQueries } from '@/shared/lib/utils/cache'

const loading = ref(false)
const announcements = ref<AnnouncementItem[]>([])
const totalElements = ref(0)
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const editingAnnouncementId = ref<number | null>(null)
const inlineEditingAnnouncementId = ref<number | null>(null)
const tableWrapperRef = ref<HTMLElement | null>(null)

const form = reactive({
  title: '',
  content: '',
  scheduledAt: ''
})
const inlineEditForm = reactive({
  title: '',
  content: '',
  scheduledAt: ''
})
const inlineEditOriginal = reactive({
  title: '',
  content: '',
  scheduledAt: ''
})

const buildScheduleDefaultDate = () => new Date(Date.now() + 30 * 60 * 1000)

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
  editingAnnouncementId.value = null
  form.title = ''
  form.content = ''
  form.scheduledAt = ''
}

const canEdit = (row: AnnouncementItem) => row.status !== 'PUBLISHED'
const isInlineEditing = (row: AnnouncementItem) => inlineEditingAnnouncementId.value === row.id
const isAnyInlineEditing = computed(() => inlineEditingAnnouncementId.value !== null)

const openCreateDialog = () => {
  resetForm()
  dialogVisible.value = true
}

const startInlineEdit = (row: AnnouncementItem) => {
  if (!canEdit(row)) {
    ElMessage.warning('已发布公告不允许编辑')
    return
  }
  inlineEditingAnnouncementId.value = row.id
  inlineEditForm.title = row.title
  inlineEditForm.content = row.content
  inlineEditForm.scheduledAt = row.scheduledAt || ''
  inlineEditOriginal.title = row.title
  inlineEditOriginal.content = row.content
  inlineEditOriginal.scheduledAt = row.scheduledAt || ''
}

const cancelInlineEdit = () => {
  inlineEditingAnnouncementId.value = null
  inlineEditForm.title = ''
  inlineEditForm.content = ''
  inlineEditForm.scheduledAt = ''
  inlineEditOriginal.title = ''
  inlineEditOriginal.content = ''
  inlineEditOriginal.scheduledAt = ''
}

const hasInlineChanges = () =>
  inlineEditForm.title.trim() !== inlineEditOriginal.title.trim() ||
  inlineEditForm.content.trim() !== inlineEditOriginal.content.trim() ||
  (inlineEditForm.scheduledAt || '') !== (inlineEditOriginal.scheduledAt || '')

const exitInlineEditByOutsideClick = async () => {
  if (inlineEditingAnnouncementId.value === null) {
    return
  }
  if (!hasInlineChanges()) {
    cancelInlineEdit()
    return
  }
  await saveInlineEdit()
}

const saveInlineEdit = async () => {
  if (inlineEditingAnnouncementId.value === null) {
    return
  }
  if (!inlineEditForm.title.trim()) {
    ElMessage.warning('请输入公告标题')
    return
  }
  if (!inlineEditForm.content.trim()) {
    ElMessage.warning('请输入公告内容')
    return
  }
  try {
    await announcementApi.update(inlineEditingAnnouncementId.value, {
      title: inlineEditForm.title.trim(),
      content: inlineEditForm.content.trim(),
      scheduledAt: inlineEditForm.scheduledAt || null
    })
    ElMessage.success('公告更新成功')
    cancelInlineEdit()
    await loadAnnouncements()
  } catch {
    ElMessage.error('公告更新失败')
  }
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
    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      scheduledAt: form.scheduledAt || null
    }
    if (editingAnnouncementId.value === null) {
      await announcementApi.create(payload)
      ElMessage.success('公告创建成功')
    } else {
      await announcementApi.update(editingAnnouncementId.value, payload)
      ElMessage.success('公告更新成功')
    }
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
    invalidateQueries(['messages.summary', 'messages.unread', 'messages.list'])
    ElMessage.success('公告已发布')
    await loadAnnouncements()
  } catch (error) {
    ElMessage.error('公告发布失败')
  }
}

const handleWithdraw = async (row: AnnouncementItem) => {
  try {
    await announcementApi.withdraw(row.id)
    invalidateQueries(['messages.summary', 'messages.unread', 'messages.list'])
    ElMessage.success('公告已撤回')
    await loadAnnouncements()
  } catch (error) {
    ElMessage.error('公告撤回失败')
  }
}

onMounted(() => {
  const handleDocumentPointerDown = async (event: PointerEvent) => {
    if (inlineEditingAnnouncementId.value === null) {
      return
    }

    const eventPath = typeof event.composedPath === 'function' ? event.composedPath() : []
    const isFromProtectedOverlay = eventPath.some(node => {
      return (
        node instanceof HTMLElement &&
        Boolean(
          node.closest('.announcement-date-popper') ||
          node.closest('.el-picker-panel') ||
          node.closest('.el-time-panel') ||
          node.closest('.el-popper')
        )
      )
    })

    if (isFromProtectedOverlay) {
      return
    }

    const target = event.target
    if (!(target instanceof Node)) {
      return
    }
    if (tableWrapperRef.value?.contains(target)) {
      return
    }
    await exitInlineEditByOutsideClick()
  }

  document.addEventListener('pointerdown', handleDocumentPointerDown)
  void loadAnnouncements()

  onUnmounted(() => {
    document.removeEventListener('pointerdown', handleDocumentPointerDown)
  })
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
          <el-button type="primary" :icon="Plus" @click="openCreateDialog">新建公告</el-button>
        </div>
      </div>
    </template>

    <div class="announcement-summary">当前共 {{ totalElements }} 条公告</div>

    <div ref="tableWrapperRef">
      <el-table
        v-loading="loading"
        :data="sortedAnnouncements"
        border
        @row-dblclick="startInlineEdit"
      >
        <el-table-column prop="title" label="标题" min-width="240">
          <template #default="{ row }">
            <el-input
              v-if="isInlineEditing(row)"
              v-model="inlineEditForm.title"
              maxlength="255"
              show-word-limit
            />
            <span v-else>{{ row.title }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="content" label="内容" min-width="320" show-overflow-tooltip>
          <template #default="{ row }">
            <el-input
              v-if="isInlineEditing(row)"
              v-model="inlineEditForm.content"
              type="textarea"
              :rows="3"
              maxlength="4000"
              show-word-limit
            />
            <span v-else>{{ row.content }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="定时发布时间" min-width="180">
          <template #default="{ row }">
            <el-date-picker
              v-if="isInlineEditing(row)"
              v-model="inlineEditForm.scheduledAt"
              type="datetime"
              popper-class="announcement-date-popper"
              :default-value="buildScheduleDefaultDate()"
              value-format="YYYY-MM-DDTHH:mm:ss"
              placeholder="留空表示手动发布"
              style="width: 100%"
            />
            <span v-else>{{ row.scheduledAt || '--' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="实际发布时间" min-width="180">
          <template #default="{ row }">{{ row.publishedAt || '--' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="!isInlineEditing(row) && row.status !== 'PUBLISHED'"
              type="success"
              size="small"
              :icon="Promotion"
              :disabled="isAnyInlineEditing"
              @click="handlePublish(row)"
            >
              立即发布
            </el-button>
            <el-button
              v-else-if="row.status === 'PUBLISHED'"
              type="warning"
              size="small"
              :icon="RefreshLeft"
              :disabled="isAnyInlineEditing"
              @click="handleWithdraw(row)"
            >
              撤回
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

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
            :default-value="buildScheduleDefaultDate()"
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

:global(.announcement-date-popper) {
  z-index: 4000 !important;
  background: #ffffff !important;
  border: 1px solid rgba(15, 23, 42, 0.14) !important;
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.18) !important;
  backdrop-filter: none !important;
  opacity: 1 !important;
}

:global(.announcement-date-popper .el-picker-panel),
:global(.announcement-date-popper .el-date-picker),
:global(.announcement-date-popper .el-date-range-picker),
:global(.announcement-date-popper .el-time-panel) {
  background: #ffffff !important;
  opacity: 1 !important;
}
</style>
