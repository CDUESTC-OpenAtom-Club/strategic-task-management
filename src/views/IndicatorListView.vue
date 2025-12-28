<script setup lang="ts">
import { ref, computed } from 'vue'
import { Plus, View, Download, Delete, ArrowDown, Promotion, RefreshLeft, Check, Close, Upload, Edit, Refresh, User, ChatDotRound, Right } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { ElTable } from 'element-plus'
import type { StrategicTask, StrategicIndicator, Milestone } from '@/types'
import { useStrategicStore } from '@/stores/strategic'
import { useAuthStore } from '@/stores/auth'
import { useTimeContextStore } from '@/stores/timeContext'
import { getProgressStatus, getProgressColor, getStatusTagType } from '@/utils'
import type { StatusAuditEntry } from '@/types'
import { FUNCTIONAL_DEPARTMENTS } from '@/config/departments'

// --- 自定义指令，用于自动聚焦 ---
const vFocus = {
  mounted: (el: HTMLElement) => {
    const input = el.querySelector('input') || el.querySelector('textarea')
    if (input) {
      input.focus()
    } else {
      el.focus()
    }
  }
}

// 获取操作类型配置（与 AuditLogDrawer 保持一致）
const getActionConfig = (action: StatusAuditEntry['action']) => {
  const configs = {
    submit: { icon: Upload, label: '提交进度', type: 'primary' },
    approve: { icon: Check, label: '审批通过', type: 'success' },
    reject: { icon: Close, label: '审批驳回', type: 'danger' },
    revoke: { icon: Refresh, label: '撤回提交', type: 'warning' },
    update: { icon: Edit, label: '更新进度', type: 'info' },
    distribute: { icon: Promotion, label: '下发指标', type: 'primary' }
  }
  return configs[action] || configs.update
}

// 格式化时间
const formatAuditTime = (timestamp: Date | string) => {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 格式化相对时间
const formatRelativeTime = (timestamp: Date | string) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins}分钟前`
  if (diffHours < 24) return `${diffHours}小时前`
  if (diffDays < 30) return `${diffDays}天前`
  return formatAuditTime(timestamp)
}

// 使用共享 Store
const strategicStore = useStrategicStore()
const authStore = useAuthStore()
const timeContext = useTimeContextStore()

// 接收父组件传递的选中角色
const props = defineProps<{
  viewingRole?: string
}>()

// 判断当前是否为战略发展部角色
const isStrategicDept = computed(() => {
  // 只有明确是战略发展部角色时才返回 true
  return props.viewingRole === '战略发展部' || props.viewingRole === 'strategic_dept'
})

// 判断是否可以编辑（只有战略发展部可以编辑，职能部门不能新增指标，历史年份只读）
const canEdit = computed(() => authStore.userRole === 'strategic_dept' && isStrategicDept.value && !timeContext.isReadOnly)

// 是否显示责任部门列（只有战略发展部才显示）
const showResponsibleDeptColumn = computed(() => isStrategicDept.value)

// 当前选中任务索引
const currentTaskIndex = ref(0)
const isAddingOrEditing = ref(false)

// 选中的部门
const selectedDepartment = ref('')

// 筛选条件
const filterType2 = ref('')  // 任务类型筛选
const filterType1 = ref('')  // 指标类型筛选
const filterDept = ref('')   // 责任部门筛选

// 重置筛选条件
const resetFilters = () => {
  filterType2.value = ''
  filterType1.value = ''
  filterDept.value = ''
}

// 职能部门列表（从配置文件导入）
const functionalDepartments = [...FUNCTIONAL_DEPARTMENTS]

// 表格引用和选中的指标
const tableRef = ref<InstanceType<typeof ElTable>>()
const selectedIndicators = ref<StrategicIndicator[]>([])

// 从 Store 获取任务列表
const taskList = computed(() => strategicStore.tasks.map(t => ({
  id: Number(t.id),
  title: t.title,
  desc: t.desc,
  createTime: t.createTime,
  cycle: t.cycle
})))

// 当前选中的任务
const currentTask = computed(() => taskList.value[currentTaskIndex.value] || {
  id: 0,
  title: '暂无任务',
  desc: '',
  createTime: '',
  cycle: ''
})

// 从 Store 获取指标列表（带里程碑），按任务类型和战略任务分组排序，并应用筛选
const indicators = computed(() => {
  let list = strategicStore.indicators.map(i => ({
    ...i,
    id: Number(i.id)
  }))

  // 按当前年份过滤
  // 没有 year 字段的指标默认为当前真实年份（2025）
  const currentYear = timeContext.currentYear
  const realYear = timeContext.realCurrentYear
  list = list.filter(i => {
    const indicatorYear = i.year || realYear
    return indicatorYear === currentYear
  })

  // 根据当前角色过滤数据
  // 如果不是战略发展部，只显示下发给当前部门的指标（responsibleDept 或 ownerDept 匹配）
  if (!isStrategicDept.value && props.viewingRole) {
    list = list.filter(i => {
      // 匹配责任部门（当前部门负责的指标）
      const isResponsible = i.responsibleDept === props.viewingRole
      // 匹配下发部门（当前部门下发的指标）
      const isOwner = i.ownerDept === props.viewingRole
      return isResponsible || isOwner
    })
  }

  // 应用筛选条件
  if (filterType2.value) {
    list = list.filter(i => i.type2 === filterType2.value)
  }
  if (filterType1.value) {
    list = list.filter(i => i.type1 === filterType1.value)
  }
  if (filterDept.value) {
    list = list.filter(i => i.responsibleDept === filterDept.value)
  }

  // 先按 type2（任务类型）排序，再按 taskContent（战略任务）排序
  return list.sort((a, b) => {
    const type2A = a.type2 || ''
    const type2B = b.type2 || ''
    if (type2A !== type2B) {
      // 发展性排在前面
      return type2A === '发展性' ? -1 : 1
    }
    const taskA = a.taskContent || ''
    const taskB = b.taskContent || ''
    return taskA.localeCompare(taskB)
  })
})

// 计算单元格合并信息
const getSpanMethod = ({ row, column, rowIndex, columnIndex }: { row: any; column: any; rowIndex: number; columnIndex: number }) => {
  const dataList = indicators.value

  // 批量操作列的索引：添加了说明列后，如果显示责任部门列则是8，否则是7
  const batchColumnIndex = showResponsibleDeptColumn.value ? 8 : 7

  // 战略任务列（第0列）和批量操作列合并
  if (columnIndex === 0 || columnIndex === batchColumnIndex) {
    const currentTask = row.taskContent || '未关联任务'

    // 计算当前任务在列表中的起始位置
    let startIndex = rowIndex
    while (startIndex > 0 && (dataList[startIndex - 1].taskContent || '未关联任务') === currentTask) {
      startIndex--
    }

    // 如果是该任务的第一行，计算合并行数
    if (startIndex === rowIndex) {
      let count = 1
      while (rowIndex + count < dataList.length && (dataList[rowIndex + count].taskContent || '未关联任务') === currentTask) {
        count++
      }
      return { rowspan: count, colspan: 1 }
    } else {
      // 不是第一行，隐藏该单元格
      return { rowspan: 0, colspan: 0 }
    }
  }
  return { rowspan: 1, colspan: 1 }
}

// 获取当前行所属的任务组
const getTaskGroup = (row: StrategicIndicator) => {
  const taskContent = row.taskContent || '未命名任务'
  const rows = indicators.value.filter(i => (i.taskContent || '未命名任务') === taskContent)
  return { taskContent, rows }
}

// 按任务组批量分解（战略发展部专用）
const handleBatchDistributeByTask = (group: { taskContent: string; rows: StrategicIndicator[] }) => {
  const departments = ['教务处', '科研处', '人事处']
  const indicatorNames = group.rows.map(ind => ind.name).join('、')

  ElMessageBox.confirm(
    `确认将任务 "${group.taskContent}" 下的 ${group.rows.length} 个指标分解到各职能部门？\n\n${indicatorNames}\n\n目标部门：${departments.join('、')}`,
    '批量分解确认',
    {
      confirmButtonText: '确定分解',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    ElMessage.success(`成功分解${group.rows.length}项指标到职能部门`)
  })
}

// 按任务组批量提交（职能部门/二级学院专用）
const handleBatchFillByTask = (group: { taskContent: string; rows: StrategicIndicator[] }) => {
  const indicatorNames = group.rows.map(ind => ind.name).join('、')

  ElMessageBox.confirm(
    `确认对任务 "${group.taskContent}" 下的 ${group.rows.length} 个指标进行批量提交？\n\n${indicatorNames}`,
    '批量提交确认',
    {
      confirmButtonText: '确定提交',
      cancelButtonText: '取消',
      type: 'info'
    }
  ).then(() => {
    // TODO: 打开批量提交对话框或跳转到提交页面
    ElMessage.success(`已选择${group.rows.length}项指标进行提交`)
  })
}

// 获取任务类型对应的颜色
const getTaskTypeColor = (type2: string) => {
  return type2 === '发展性' ? '#409EFF' : '#67C23A'
}

// 按类别筛选指标
const developmentIndicators = computed(() => indicators.value.filter(i => i.type2 === '发展性'))
const basicIndicators = computed(() => indicators.value.filter(i => i.type2 === '基础性'))

// 新增行数据
const newRow = ref({
  taskContent: '',
  name: '',
  type1: '定性' as '定性' | '定量',
  type2: '发展性' as '发展性' | '基础性',
  weight: '',
  remark: '',
  milestones: [] as Milestone[]
})

// 获取任务选项列表（从 Store 中的 tasks 获取）
const taskOptions = computed(() => strategicStore.tasks.map(t => ({
  value: t.title,
  label: t.title
})))

// 里程碑输入状态
const showMilestoneInput = ref(false)

// 任务下发相关状态
const showAssignmentDialog = ref(false)
const assignmentTarget = ref('')
const assignmentMethod = ref<'self' | 'college'>('self')

// 添加新里程碑
const addMilestone = () => {
  newRow.value.milestones.push({
    id: Date.now(),
    name: '',
    targetProgress: 0,
    deadline: '',
    status: 'pending'
  })
}

// 删除里程碑
const removeMilestone = (index: number) => {
  newRow.value.milestones.splice(index, 1)
}

// 当前日期
const currentDate = '2025年12月5日'

// 编辑状态管理（任务详情）
const editingField = ref<string | null>(null)
const editingValue = ref('')

// 指标列表编辑状态
const editingIndicatorId = ref<number | null>(null)
const editingIndicatorField = ref<string | null>(null)
const editingIndicatorValue = ref<any>(null)

// 任务详情双击编辑处理
const handleDoubleClick = (field: 'title' | 'desc' | 'cycle' | 'createTime', value: string) => {
  if (!canEdit.value) return
  editingField.value = field
  editingValue.value = value
}

// 任务详情保存编辑
const saveEdit = (field: 'title' | 'desc' | 'cycle' | 'createTime') => {
  if (editingValue.value === undefined || editingValue.value === null) {
    cancelEdit()
    return
  }

  const task = taskList.value[currentTaskIndex.value]
  if (field === 'title') task.title = editingValue.value
  else if (field === 'desc') task.desc = editingValue.value
  else if (field === 'cycle') task.cycle = editingValue.value
  else if (field === 'createTime') task.createTime = editingValue.value

  cancelEdit()
}

// 任务详情取消编辑
const cancelEdit = () => {
  editingField.value = null
  editingValue.value = ''
}

// 指标双击编辑
const handleIndicatorDblClick = (row: StrategicIndicator, field: string) => {
  if (!canEdit.value) return
  editingIndicatorId.value = row.id
  editingIndicatorField.value = field
  editingIndicatorValue.value = row[field as keyof StrategicIndicator]
}

// 保存指标编辑
const saveIndicatorEdit = (row: StrategicIndicator, field: string) => {
  if (editingIndicatorId.value === null) return

  if (editingIndicatorValue.value === null || editingIndicatorValue.value === undefined) {
    cancelIndicatorEdit()
    return
  }

  const updates: Partial<StrategicIndicator> = {}

  if (field === 'type1' || field === 'type2') {
    updates[field] = editingIndicatorValue.value
    if (field === 'type1') {
      updates.isQualitative = editingIndicatorValue.value === '定性'
    }
  } else {
    (updates as any)[field] = editingIndicatorValue.value
  }

  strategicStore.updateIndicator(row.id.toString(), updates)
  cancelIndicatorEdit()
}

// 取消指标编辑
const cancelIndicatorEdit = () => {
  editingIndicatorId.value = null
  editingIndicatorField.value = null
  editingIndicatorValue.value = null
}

// 方法
const addNewRow = () => {
  isAddingOrEditing.value = true
}

// 在指定类别中添加新指标
const addIndicatorToCategory = (category: '发展性' | '基础性') => {
  newRow.value.type2 = category
  isAddingOrEditing.value = true
}

const cancelAdd = () => {
  isAddingOrEditing.value = false
  newRow.value = { taskContent: '', name: '', type1: '定性', type2: '发展性', weight: '', remark: '', milestones: [] }
}

const saveNewRow = () => {
  if (!newRow.value.taskContent) {
    ElMessage.warning('请先选择所属战略任务')
    return
  }
  if (!newRow.value.name) {
    ElMessage.warning('请输入指标名称')
    return
  }

  strategicStore.addIndicator({
    id: Date.now().toString(),
    name: newRow.value.name,
    isQualitative: newRow.value.type1 === '定性',
    type1: newRow.value.type1,
    type2: newRow.value.type2,
    progress: 0,
    createTime: currentDate,
    weight: Number(newRow.value.weight) || 0,
    remark: newRow.value.remark || '无备注',
    canWithdraw: true,
    milestones: [...newRow.value.milestones],
    targetValue: 100,
    unit: '%',
    responsibleDept: authStore.userDepartment || '未分配',
    responsiblePerson: authStore.userName || '未分配',
    status: 'active',
    isStrategic: true,
    taskContent: newRow.value.taskContent
  })
  ElMessage.success('指标添加成功')
  cancelAdd()
}

// 里程碑状态计算
const calculateMilestoneStatus = (indicator: StrategicIndicator): 'success' | 'warning' | 'exception' => {
  if (!indicator.milestones || indicator.milestones.length === 0) {
    return getProgressStatus(indicator.progress)
  }

  const currentDate = new Date()

  const hasOverdueMilestone = indicator.milestones.some(milestone => {
    const deadlineDate = new Date(milestone.deadline)
    return milestone.status === 'pending' && deadlineDate < currentDate
  })

  const hasUpcomingMilestone = indicator.milestones.some(milestone => {
    if (milestone.status === 'completed') return false
    const deadlineDate = new Date(milestone.deadline)
    const daysUntilDeadline = Math.ceil((deadlineDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24))
    return daysUntilDeadline > 0 && daysUntilDeadline <= 30
  })

  if (hasOverdueMilestone) {
    return 'exception'
  } else if (hasUpcomingMilestone) {
    return 'warning'
  } else {
    return 'success'
  }
}

// 获取里程碑进度文本
const getMilestoneProgressText = (indicator: StrategicIndicator): string => {
  if (!indicator.milestones || indicator.milestones.length === 0) {
    return `当前进度: ${indicator.progress}%`
  }

  const pendingMilestones = indicator.milestones.filter(m => m.status === 'pending').length

  const currentDate = new Date()
  const overdueMilestonesCount = indicator.milestones.filter(m => {
    if (m.status !== 'pending') return false
    const deadlineDate = new Date(m.deadline)
    return deadlineDate < currentDate
  }).length

  if (overdueMilestonesCount > 0) {
    return `逾期: ${overdueMilestonesCount} 个里程碑`
  } else if (pendingMilestones > 0) {
    return `待完成: ${pendingMilestones} 个里程碑`
  } else {
    return '所有里程碑已完成'
  }
}

const selectDepartment = (dept: string) => {
  selectedDepartment.value = dept
}

const selectTask = (index: number) => {
  currentTaskIndex.value = index
}

// 表格选择变化处理
const handleSelectionChange = (selection: StrategicIndicator[]) => {
  selectedIndicators.value = selection
}

// 任务下发相关方法
const confirmAssignment = () => {
  if (!assignmentTarget.value) {
    ElMessage.warning('请选择下发目标')
    return
  }

  const indicatorNames = selectedIndicators.value.map(ind => ind.name).join('、')
  const targetName = assignmentMethod.value === 'self' ? '自己完成' : `下发给${assignmentTarget.value}`

  ElMessageBox.confirm(
    `确认将以下指标${targetName}？\n\n${indicatorNames}`,
    '确认下发',
    {
      confirmButtonText: '确定下发',
      cancelButtonText: '取消',
      type: 'info'
    }
  ).then(() => {
    ElMessage.success(`成功下发${selectedIndicators.value.length}项指标到${assignmentTarget.value}`)
    showAssignmentDialog.value = false
    assignmentTarget.value = ''
    assignmentMethod.value = 'self'
  })
}

// 批量分解到职能部门（战略发展部专用）
const batchDistributeToDepartments = () => {
  const departments = ['教务处', '科研处', '人事处']
  const indicatorNames = selectedIndicators.value.map(ind => ind.name).join('、')

  ElMessageBox.confirm(
    `确认将以下指标分解到各职能部门？\n\n${indicatorNames}\n\n目标部门：${departments.join('、')}`,
    '确认分解',
    {
      confirmButtonText: '确定分解',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    ElMessage.success(`成功分解${selectedIndicators.value.length}项指标到职能部门`)
    tableRef.value?.clearSelection()
  })
}

// 详情抽屉状态
const detailDrawerVisible = ref(false)
const currentDetail = ref<StrategicIndicator | null>(null)

// 查看详情
const handleViewDetail = (row: StrategicIndicator) => {
  currentDetail.value = row
  detailDrawerVisible.value = true
}

// 删除指标
const handleDeleteIndicator = (row: StrategicIndicator) => {
  ElMessageBox.confirm(
    `确定要删除指标 "${row.name}" 吗？删除后无法恢复。`,
    '删除确认',
    {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    strategicStore.deleteIndicator(row.id.toString())
    ElMessage.success('指标已删除')
  })
}

// 表格滚动状态
const tableScrollRef = ref<HTMLElement | null>(null)
const isTableScrolling = ref(false)

const handleTableScroll = (e: Event) => {
  const target = e.target as HTMLElement
  const scrollLeft = target.scrollLeft
  const scrollWidth = target.scrollWidth
  const clientWidth = target.clientWidth
  isTableScrolling.value = scrollLeft < scrollWidth - clientWidth - 2
}

// ================== 进度填报相关 ==================

// 填报弹窗状态
const reportDialogVisible = ref(false)
const currentReportIndicator = ref<StrategicIndicator | null>(null)

// 填报表单数据
const reportForm = ref({
  newProgress: 0,
  remark: '',
  attachments: [] as string[]
})

// 获取文件名
const getFileName = (url: string) => {
  if (!url) return ''
  const parts = url.split('/')
  const fileName = parts[parts.length - 1]
  return fileName.split('?')[0]
}

// 打开填报弹窗
const handleOpenReportDialog = (row: StrategicIndicator) => {
  currentReportIndicator.value = row
  // 初始化表单，新进度默认为当前进度
  reportForm.value = {
    newProgress: row.progress || 0,
    remark: '',
    attachments: []
  }
  reportDialogVisible.value = true
}

// 关闭填报弹窗
const closeReportDialog = () => {
  reportDialogVisible.value = false
  currentReportIndicator.value = null
  reportForm.value = {
    newProgress: 0,
    remark: '',
    attachments: []
  }
}

// 保存进度填报（设为待提交状态）
const submitProgressReport = () => {
  if (!currentReportIndicator.value) return

  const indicator = currentReportIndicator.value
  const currentProgress = indicator.progress || 0

  // 验证：进度只能递增
  if (reportForm.value.newProgress < currentProgress) {
    ElMessage.warning(`进度只能递增，当前进度为 ${currentProgress}%，不能填报更低的进度`)
    return
  }

  // 验证：进度不能超过100
  if (reportForm.value.newProgress > 100) {
    ElMessage.warning('进度不能超过 100%')
    return
  }

  // 验证：必须填写说明
  if (!reportForm.value.remark.trim()) {
    ElMessage.warning('请填写进度说明')
    return
  }

  // 直接保存，设为待提交状态
  strategicStore.updateIndicator(indicator.id.toString(), {
    progressApprovalStatus: 'draft',  // 待提交状态
    pendingProgress: reportForm.value.newProgress,
    pendingRemark: reportForm.value.remark,
    pendingAttachments: reportForm.value.attachments
  })

  ElMessage.success('进度已保存，可在批量操作中提交')
  closeReportDialog()
}

// 撤回进度填报
const handleRevokeReport = (row: StrategicIndicator) => {
  ElMessageBox.confirm(
    `确认撤回进度填报？\n\n指标：${row.name}\n待审批进度：${row.pendingProgress}%\n\n撤回后可重新填报`,
    '撤回确认',
    {
      confirmButtonText: '确认撤回',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    // 清除待审批状态
    strategicStore.updateIndicator(row.id.toString(), {
      progressApprovalStatus: 'none',
      pendingProgress: undefined,
      pendingRemark: undefined,
      pendingAttachments: undefined
    })

    // 添加审计日志
    strategicStore.addStatusAuditEntry(row.id.toString(), {
      operator: authStore.userName || 'unknown',
      operatorName: authStore.userName || '未知用户',
      operatorDept: authStore.userDepartment || '未知部门',
      action: 'revoke',
      comment: '撤回进度填报',
      previousStatus: 'pending_approval',
      newStatus: 'active'
    })

    ElMessage.info('已撤回进度填报')
  })
}
</script>


<template>
  <div class="indicator-list-container page-fade-enter">
    <!-- 页面头部 - 统一页面头部样式 (Requirements: 5.1, 5.2) -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">指标列表</h1>
        <p class="page-desc">管理和查看所有战略考核指标</p>
      </div>
      <div class="page-actions">
        <el-button type="primary" @click="addNewRow" v-if="canEdit">
          <el-icon><Plus /></el-icon>
          新增指标
        </el-button>
        <el-button>
          <el-icon><Download /></el-icon>
          导出
        </el-button>
      </div>
    </div>

    <!-- 主内容区域 -->
    <div class="content-wrapper">
      <!-- 筛选卡片 - 统一卡片样式 (Requirements: 2.1, 2.2, 8.1) -->
      <div class="filter-card card-base card-animate">
        <div class="card-body">
          <el-form :inline="true" class="filter-form">
            <el-form-item label="任务类型">
              <el-select v-model="filterType2" placeholder="全部类型" clearable style="width: 140px;">
                <el-option label="发展性" value="发展性" />
                <el-option label="基础性" value="基础性" />
              </el-select>
            </el-form-item>
            <el-form-item label="责任部门" v-if="showResponsibleDeptColumn">
              <el-select v-model="filterDept" placeholder="全部部门" clearable style="width: 200px;">
                <el-option v-for="dept in functionalDepartments" :key="dept" :label="dept" :value="dept" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button @click="resetFilters">重置</el-button>
            </el-form-item>
          </el-form>
        </div>
      </div>

      <!-- 指标表格卡片 - 统一表格样式 (Requirements: 4.1, 4.2, 4.3) -->
      <div class="table-card card-base card-animate" style="animation-delay: 0.1s;">
        <div class="card-header">
          <span class="card-title">指标列表</span>
          <span class="indicator-count">共 {{ indicators.length }} 条记录</span>
        </div>
        <div class="card-body table-body">
          <div class="table-container">
            <el-table
              ref="tableRef"
              :data="indicators"
              :span-method="getSpanMethod"
              border
              highlight-current-row
              @selection-change="handleSelectionChange"
              class="unified-table"
            >

              <el-table-column prop="taskContent" label="战略任务" width="200">
                <template #default="{ row }">
                  <el-tooltip :content="row.type2 === '发展性' ? '发展性任务' : '基础性任务'" placement="top">
                    <span
                      class="task-content-colored"
                      :style="{ color: getTaskTypeColor(row.type2) }"
                    >{{ row.taskContent || '未关联任务' }}</span>
                  </el-tooltip>
                </template>
              </el-table-column>
              <el-table-column prop="name" label="核心指标" min-width="280">
                <template #default="{ row }">
                  <div class="indicator-name-cell" @dblclick="handleIndicatorDblClick(row, 'name')">
                    <el-input
                      v-if="editingIndicatorId === row.id && editingIndicatorField === 'name'"
                      v-model="editingIndicatorValue"
                      v-focus
                      type="textarea"
                      :autosize="{ minRows: 2, maxRows: 6 }"
                      @blur="saveIndicatorEdit(row, 'name')"
                    />
                    <el-tooltip v-else :content="row.type1 === '定性' ? '定性指标' : '定量指标'" placement="top">
                      <span
                        class="indicator-name-text"
                        :class="row.type1 === '定性' ? 'indicator-qualitative' : 'indicator-quantitative'"
                      >{{ row.name }}</span>
                    </el-tooltip>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="remark" label="说明" width="130">
                <template #default="{ row }">
                  <div class="indicator-name-cell" @dblclick="handleIndicatorDblClick(row, 'remark')">
                    <el-input
                      v-if="editingIndicatorId === row.id && editingIndicatorField === 'remark'"
                      v-model="editingIndicatorValue"
                      v-focus
                      type="textarea"
                      :autosize="{ minRows: 2, maxRows: 6 }"
                      @blur="saveIndicatorEdit(row, 'remark')"
                    />
                    <span v-else class="remark-text">{{ row.remark || '' }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="weight" label="权重" width="80" align="center">
                <template #default="{ row }">
                  <div class="weight-cell" @dblclick="handleIndicatorDblClick(row, 'weight')">
                    <el-input
                      v-if="editingIndicatorId === row.id && editingIndicatorField === 'weight'"
                      v-model="editingIndicatorValue"
                      v-focus
                      size="small"
                      style="width: 50px"
                      @blur="saveIndicatorEdit(row, 'weight')"
                    />
                    <span v-else class="weight-text">{{ row.weight }}</span>
                  </div>
                </template>
              </el-table-column>
              <!-- 进度条 - 统一进度条样式 (Requirements: 10.1, 10.2) -->
              <el-table-column prop="progress" label="进度" width="100" align="center">
                <template #default="{ row }">
                  <div class="progress-cell">
                    <el-progress
                      :percentage="row.progress || 0"
                      :stroke-width="8"
                      :status="getProgressStatus(row.progress || 0)"
                      :show-text="false"
                      style="width: 50px;"
                    />
                    <span class="progress-text">{{ row.progress || 0 }}%</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="responsibleDept" label="责任部门" min-width="140" v-if="showResponsibleDeptColumn">
                <template #default="{ row }">
                  <span class="dept-text">{{ row.responsibleDept || '未分配' }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="status" label="状态" width="85" align="center">
                <template #default="{ row }">
                  <div class="status-cell">
                    <!-- 优先显示进度审批状态（draft状态不显示，仍显示原状态） -->
                    <el-tag v-if="row.progressApprovalStatus === 'pending'" type="warning" size="small">待审批</el-tag>
                    <el-tag v-else-if="row.progressApprovalStatus === 'rejected'" type="danger" size="small">已驳回</el-tag>
                    <el-tag v-else :type="getStatusTagType(row.status)" size="small">
                      {{ row.status === 'active' ? '进行中' : row.status }}
                    </el-tag>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="160" align="center">
                <template #default="{ row }">
                  <div class="action-cell">
                    <el-button link type="primary" size="small" @click="handleViewDetail(row)">查看</el-button>
                      <!-- 职能部门/二级学院显示填报按钮（历史年份禁用，待审批时禁用） -->
                      <el-tooltip
                        v-if="!isStrategicDept && (row.pendingProgress !== undefined || row.pendingRemark || (row.pendingAttachments && row.pendingAttachments.length > 0))"
                        placement="top"
                        effect="light"
                        popper-class="report-tooltip"
                      >
                        <template #content>
                          <div class="report-tooltip-content">
                            <div v-if="row.pendingProgress !== undefined" class="tooltip-item">
                              <span class="tooltip-label">上次填报进度：</span>
                              <span class="tooltip-value highlight">{{ row.pendingProgress }}%</span>
                            </div>
                            <div v-if="row.pendingRemark" class="tooltip-item">
                              <span class="tooltip-label">进度说明：</span>
                              <div class="tooltip-value remark">{{ row.pendingRemark }}</div>
                            </div>
                            <div v-if="row.pendingAttachments && row.pendingAttachments.length > 0" class="tooltip-item">
                              <span class="tooltip-label">附件：</span>
                              <div class="tooltip-files">
                                <div v-for="(file, idx) in row.pendingAttachments" :key="idx" class="file-name">
                                  {{ getFileName(file) }}
                                </div>
                              </div>
                            </div>
                          </div>
                        </template>
                        <el-button 
                          link 
                          type="success" 
                          size="small" 
                          :disabled="row.progressApprovalStatus === 'pending' || timeContext.isReadOnly"
                          @click="handleOpenReportDialog(row)"
                        >{{ row.progressApprovalStatus === 'rejected' ? '重新填报' : '填报' }}</el-button>
                      </el-tooltip>
                      <el-button 
                        v-else-if="!isStrategicDept" 
                        link 
                        type="success" 
                        size="small" 
                        :disabled="row.progressApprovalStatus === 'pending' || timeContext.isReadOnly"
                        @click="handleOpenReportDialog(row)"
                      >{{ row.progressApprovalStatus === 'rejected' ? '重新填报' : '填报' }}</el-button>
                    <!-- 职能部门/二级学院在待审批状态下可撤回 -->
                    <el-button 
                      v-if="!isStrategicDept && row.progressApprovalStatus === 'pending'" 
                      link 
                      type="warning" 
                      size="small" 
                      @click="handleRevokeReport(row)"
                    >撤回</el-button>
                    <el-button link type="danger" size="small" @click="handleDeleteIndicator(row)" v-if="canEdit">删除</el-button>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="批量" width="75" align="center" class-name="batch-column">
                <template #default="{ row }">
                  <div class="batch-cell">
                    <!-- 战略发展部显示分解按钮 -->
                    <el-button 
                      v-if="isStrategicDept" 
                      type="primary" 
                      size="small" 
                      @click="handleBatchDistributeByTask(getTaskGroup(row))"
                    >分解</el-button>
                    <!-- 职能部门/二级学院显示填报按钮（历史年份禁用） -->
                    <el-button 
                      v-else 
                      type="success" 
                      size="small" 
                      :disabled="timeContext.isReadOnly"
                      @click="handleBatchFillByTask(getTaskGroup(row))"
                    >提交</el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <!-- 空状态 - 统一空状态样式 (Requirements: 7.1, 7.2, 7.3) -->
          <div v-if="indicators.length === 0" class="empty-state">
            <el-empty description="暂无指标数据">
              <el-button type="primary" @click="addNewRow" v-if="canEdit">
                <el-icon><Plus /></el-icon>
                新增指标
              </el-button>
            </el-empty>
          </div>
        </div>
      </div>
    </div>

    <!-- 新增指标表单 - 统一表单样式 (Requirements: 8.1, 8.2, 8.3) -->
    <el-dialog
      v-model="isAddingOrEditing"
      title="新增指标"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form label-width="100px" class="add-form">
        <el-form-item label="战略任务" required>
          <el-select v-model="newRow.taskContent" placeholder="请选择所属战略任务" style="width: 100%;">
            <el-option
              v-for="task in taskOptions"
              :key="task.value"
              :label="task.label"
              :value="task.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="指标名称" required>
          <el-input v-model="newRow.name" placeholder="请输入指标名称" />
        </el-form-item>
        <el-form-item label="任务类型">
          <el-select v-model="newRow.type2" style="width: 100%;">
            <el-option label="发展性" value="发展性" />
            <el-option label="基础性" value="基础性" />
          </el-select>
        </el-form-item>
        <el-form-item label="指标类型">
          <el-select v-model="newRow.type1" style="width: 100%;">
            <el-option label="定性" value="定性" />
            <el-option label="定量" value="定量" />
          </el-select>
        </el-form-item>
        <el-form-item label="权重">
          <el-input v-model="newRow.weight" placeholder="请输入权重" type="number" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="newRow.remark" type="textarea" :rows="3" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="cancelAdd">取消</el-button>
        <el-button type="primary" @click="saveNewRow">保存</el-button>
      </template>
    </el-dialog>

    <!-- 详情抽屉 -->
    <el-drawer
      v-model="detailDrawerVisible"
      title="指标详情"
      size="45%"
    >
      <div v-if="currentDetail" class="detail-container">
        <!-- 基础信息 -->
        <div class="detail-header">
          <h3>{{ currentDetail.name }}</h3>
          <div class="detail-tags">
            <el-tag size="small" :type="currentDetail.type1 === '定量' ? 'primary' : 'warning'">{{ currentDetail.type1 }}</el-tag>
            <el-tag size="small" :style="{ backgroundColor: getTaskTypeColor(currentDetail.type2), color: '#fff', border: 'none' }">
              {{ currentDetail.type2 }}任务
            </el-tag>
            <el-tag size="small" :type="currentDetail.canWithdraw ? 'info' : 'success'">
              {{ currentDetail.canWithdraw ? '待下发' : '已下发' }}
            </el-tag>
          </div>
        </div>

        <el-descriptions :column="2" border class="detail-desc">
          <el-descriptions-item label="战略任务" :span="2">{{ currentDetail.taskContent }}</el-descriptions-item>
          <el-descriptions-item label="任务类别">{{ currentDetail.type2 }}任务</el-descriptions-item>
          <el-descriptions-item label="指标类型">{{ currentDetail.type1 }}</el-descriptions-item>
          <el-descriptions-item label="权重">{{ currentDetail.weight }}</el-descriptions-item>
          <el-descriptions-item label="当前进度">{{ currentDetail.progress || 0 }}%</el-descriptions-item>
          <el-descriptions-item label="责任部门">{{ currentDetail.responsibleDept || '未分配' }}</el-descriptions-item>
          <el-descriptions-item label="责任人">{{ currentDetail.responsiblePerson || '未分配' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间" :span="2">{{ currentDetail.createTime }}</el-descriptions-item>
          <el-descriptions-item label="说明" :span="2">{{ currentDetail.remark || '暂无说明' }}</el-descriptions-item>
        </el-descriptions>

        <!-- 里程碑信息 -->
        <div v-if="currentDetail.milestones && currentDetail.milestones.length > 0" class="milestone-section">
          <div class="divider"></div>
          <h4>里程碑节点</h4>
          <el-timeline style="margin-top: 20px; padding-left: 5px;">
            <el-timeline-item
              v-for="(milestone, index) in currentDetail.milestones"
              :key="index"
              :timestamp="milestone.deadline"
              :type="milestone.status === 'completed' ? 'success' : milestone.status === 'overdue' ? 'danger' : 'primary'"
              placement="top"
            >
              <div class="timeline-card">
                <div class="timeline-header">
                  <span class="action-text">{{ milestone.name }}</span>
                  <el-tag size="small" :type="milestone.status === 'completed' ? 'success' : milestone.status === 'overdue' ? 'danger' : 'warning'">
                    {{ milestone.status === 'completed' ? '已完成' : milestone.status === 'overdue' ? '已逾期' : '进行中' }}
                  </el-tag>
                </div>
                <div class="timeline-comment">
                  目标进度: {{ milestone.targetProgress }}%
                </div>
              </div>
            </el-timeline-item>
          </el-timeline>
        </div>

        <!-- 审计日志 -->
        <div class="audit-log-section">
          <div class="divider"></div>
          <div class="audit-log-header">
            <div class="audit-log-title">
              <el-icon><ChatDotRound /></el-icon>
              <h4>审计日志</h4>
            </div>
            <span v-if="currentDetail.statusAudit && currentDetail.statusAudit.length > 0" class="log-count">
              共 {{ currentDetail.statusAudit.length }} 条记录
            </span>
          </div>
          
          <!-- 审计日志时间线 -->
          <div v-if="currentDetail.statusAudit && currentDetail.statusAudit.length > 0" class="audit-log-timeline">
            <el-timeline>
              <el-timeline-item
                v-for="(log, index) in [...currentDetail.statusAudit].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())"
                :key="log.id"
                :timestamp="formatRelativeTime(log.timestamp)"
                :type="getActionConfig(log.action).type"
                :hollow="index !== 0"
                placement="top"
              >
                <div class="log-card">
                  <div class="log-header">
                    <el-tag
                      :type="getActionConfig(log.action).type"
                      size="small"
                      effect="dark"
                    >
                      <div style="display: flex; align-items: center; gap: 4px;">
                        <el-icon><component :is="getActionConfig(log.action).icon" /></el-icon>
                        {{ getActionConfig(log.action).label }}
                      </div>
                    </el-tag>
                    <span class="log-time">{{ formatAuditTime(log.timestamp) }}</span>
                  </div>
                  <div class="log-operator">
                    <el-icon><User /></el-icon>
                    <span class="operator-name">{{ log.operatorName }}</span>
                    <span class="operator-dept">{{ log.operatorDept }}</span>
                  </div>
                  <div v-if="log.previousProgress !== undefined && log.newProgress !== undefined" class="log-progress">
                    <span class="progress-label">进度变化:</span>
                    <span class="progress-from">{{ log.previousProgress }}%</span>
                    <el-icon class="progress-arrow"><Right /></el-icon>
                    <span class="progress-to">{{ log.newProgress }}%</span>
                  </div>
                  <div v-if="log.comment" class="log-comment">
                    <el-icon><ChatDotRound /></el-icon>
                    <span>{{ log.comment }}</span>
                  </div>
                </div>
              </el-timeline-item>
            </el-timeline>
          </div>
          
          <div v-else class="audit-log-empty">
            <el-empty description="暂无审计日志" :image-size="60" />
          </div>
        </div>
      </div>
    </el-drawer>

    <!-- 进度填报弹窗 -->
    <el-dialog
      v-model="reportDialogVisible"
      title="进度填报"
      width="500px"
      :close-on-click-modal="false"
      @close="closeReportDialog"
    >
      <div v-if="currentReportIndicator" class="report-dialog">
        <!-- 指标信息 -->
        <div class="report-indicator-info">
          <div class="info-row">
            <span class="info-label">指标名称：</span>
            <span class="info-value">{{ currentReportIndicator.name }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">当前进度：</span>
            <span class="info-value highlight">{{ currentReportIndicator.progress || 0 }}%</span>
          </div>
          <div class="info-row">
            <span class="info-label">目标值：</span>
            <span class="info-value">{{ currentReportIndicator.targetValue }}{{ currentReportIndicator.unit }}</span>
          </div>
        </div>

        <el-divider />

        <!-- 填报表单 -->
        <el-form label-width="100px" class="report-form">
          <el-form-item label="填报进度" required>
            <el-input-number
              v-model="reportForm.newProgress"
              :min="currentReportIndicator.progress || 0"
              :max="100"
              :step="5"
              style="width: 200px;"
            />
            <span class="form-hint">%（只能递增，不能低于当前进度）</span>
          </el-form-item>
          <el-form-item label="进度说明" required>
            <el-input
              v-model="reportForm.remark"
              type="textarea"
              :rows="4"
              placeholder="请详细说明本次进度更新的工作内容和完成情况..."
              maxlength="500"
              show-word-limit
            />
          </el-form-item>
          <el-form-item label="附件（可选）">
            <el-upload
              action="#"
              :auto-upload="false"
              :limit="5"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
            >
              <el-button size="small" type="primary" plain>选择文件</el-button>
              <template #tip>
                <div class="upload-tip">支持 PDF、Word、Excel、图片格式，最多5个文件</div>
              </template>
            </el-upload>
          </el-form-item>
        </el-form>

        <!-- 提示信息 -->
        <div class="report-tips">
          <el-alert
            title="保存后可在批量操作中统一提交审批"
            type="info"
            :closable="false"
            show-icon
          />
        </div>
      </div>

      <template #footer>
        <el-button @click="closeReportDialog">取消</el-button>
        <el-button type="primary" @click="submitProgressReport">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>


<style scoped>
/* ========================================
   页面容器 - 统一页面布局样式
   Requirements: 2.1, 3.1
   ======================================== */
.indicator-list-container {
  padding: var(--spacing-2xl);
  background: var(--bg-page);
  min-height: calc(100vh - 120px);
}

/* ========================================
   页面头部 - 统一页面头部样式
   Requirements: 5.1, 5.2, 5.3, 5.4
   ======================================== */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-2xl);
}

.header-left {
  display: flex;
  flex-direction: column;
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--text-main);
}

.page-desc {
  font-size: 14px;
  color: var(--text-secondary);
  margin-top: var(--spacing-sm);
}

.page-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

/* ========================================
   内容区域
   ======================================== */
.content-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

/* ========================================
   筛选卡片 - 统一卡片样式
   Requirements: 2.1, 2.2, 8.1
   ======================================== */
.filter-card {
  background: var(--bg-white);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}

.filter-card .card-body {
  padding: var(--spacing-lg) var(--spacing-2xl);
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-md);
}

.filter-form :deep(.el-form-item) {
  margin-bottom: 0;
  margin-right: var(--spacing-lg);
}

.filter-form :deep(.el-form-item__label) {
  color: var(--text-regular);
}

/* ========================================
   表格卡片 - 统一卡片和表格样式
   Requirements: 2.1, 2.2, 4.1, 4.2, 4.3
   ======================================== */
.table-card {
  background: var(--bg-white);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.table-card .card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-lg) var(--spacing-2xl);
  border-bottom: 1px solid var(--border-color);
}

.table-card .card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-main);
}

.indicator-count {
  font-size: 13px;
  color: var(--text-secondary);
}

.table-body {
  padding: 0;
}

.table-container {
  width: 100%;
  overflow-x: auto;
}

/* 确保表头不换行，列宽自适应 */
.table-container .unified-table {
  width: 100%;
}

.table-container .unified-table :deep(.el-table__header) th .cell {
  white-space: nowrap;
  overflow: visible;
}

/* 确保表格单元格内容不被截断 */
.unified-table :deep(.el-table__cell .cell) {
  overflow: visible;
}

/* 批量操作列样式 */
.unified-table :deep(.batch-column) {
  background-color: var(--bg-page) !important;
}

.unified-table :deep(.batch-column) .el-button {
  font-size: 12px;
}

/* ========================================
   统一表格样式
   Requirements: 4.1, 4.2, 4.3, 4.4
   ======================================== */
.unified-table {
  width: 100%;
}

/* 禁用省略号 */
.unified-table :deep(.no-ellipsis) .cell {
  overflow: visible !important;
  text-overflow: unset !important;
  white-space: nowrap !important;
}

.unified-table :deep(td.no-ellipsis) {
  overflow: visible !important;
}

.unified-table :deep(td.no-ellipsis .cell) {
  overflow: visible !important;
  text-overflow: unset !important;
  white-space: nowrap !important;
}

.unified-table :deep(.el-table__header th) {
  background: var(--bg-light) !important;
  color: var(--text-main);
  font-weight: 600;
  padding: var(--spacing-md) var(--spacing-lg);
}

.unified-table :deep(.el-table__body td) {
  padding: var(--spacing-md) var(--spacing-lg);
  color: var(--text-regular);
}

/* 斑马纹 */
.unified-table :deep(.el-table__row--striped td) {
  background: var(--bg-page) !important;
}

/* 悬停效果 */
.unified-table :deep(.el-table__body tr:hover > td) {
  background: rgba(64, 158, 255, 0.08) !important;
}

.task-content-text {
  color: var(--text-main);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 合并单元格样式 */
.unified-table :deep(td[rowspan]) {
  vertical-align: middle;
  background-color: var(--bg-light) !important;
}

.unified-table :deep(.el-table__body td) {
  border-right: 1px solid var(--border-color);
}

.unified-table :deep(.el-table__body td:last-child) {
  border-right: none;
}

.indicator-name-cell {
  width: 100%;
}

.indicator-name-text {
  font-weight: 500;
  color: var(--text-main);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  display: block;
  cursor: default;
}

/* 定性指标颜色（紫色） */
.indicator-qualitative {
  color: var(--color-qualitative);
  font-weight: 500;
}

/* 定量指标颜色（青色） */
.indicator-quantitative {
  color: var(--color-quantitative);
  font-weight: 500;
}

.dept-text {
  color: var(--text-regular);
}

/* 权重单元格样式 */
.weight-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.weight-text {
  font-weight: 500;
  color: var(--text-main);
  white-space: nowrap;
}

/* 状态单元格样式 */
.status-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

/* 操作单元格样式 */
.action-cell {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  white-space: nowrap;
}

/* 批量单元格样式 */
.batch-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

/* ========================================
   进度条样式 - 统一进度条规范
   Requirements: 10.1, 10.2
   ======================================== */
.progress-cell {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  justify-content: center;
}

.progress-text {
  font-size: 12px;
  color: var(--text-regular);
  min-width: 35px;
}

/* ========================================
   空状态样式
   Requirements: 7.1, 7.2, 7.3
   ======================================== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: calc(var(--spacing-2xl) * 2);
  color: var(--text-secondary);
}

/* ========================================
   新增表单样式 - 统一表单样式
   Requirements: 8.1, 8.2, 8.3
   ======================================== */
.add-form :deep(.el-form-item__label) {
  color: var(--text-regular);
}

.add-form :deep(.el-input__wrapper),
.add-form :deep(.el-textarea__inner) {
  border-radius: var(--radius-sm);
}

.add-form :deep(.el-input__wrapper:focus-within),
.add-form :deep(.el-textarea__inner:focus) {
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2) !important;
}

/* ========================================
   详情抽屉样式
   ======================================== */
.detail-container {
  padding: 0 var(--spacing-xl);
}

.detail-header {
  margin-bottom: var(--spacing-2xl);
}

.detail-header h3 {
  margin: 0 0 var(--spacing-md) 0;
  font-size: 18px;
  color: var(--text-main);
}

.detail-tags {
  display: flex;
  gap: var(--spacing-sm);
}

.detail-section {
  margin-bottom: var(--spacing-xl);
}

.detail-section h4 {
  font-size: 15px;
  color: var(--text-main);
  margin: 0 0 var(--spacing-md) 0;
  font-weight: 600;
}

.detail-item {
  display: flex;
  margin-bottom: var(--spacing-sm);
  font-size: 14px;
}

.detail-label {
  color: var(--text-secondary);
  min-width: 80px;
}

.detail-value {
  color: var(--text-regular);
}

.divider {
  height: 1px;
  background: var(--border-color);
  margin: var(--spacing-xl) 0;
}

/* 战略任务带颜色样式 */
.task-content-colored {
  font-weight: 500;
  cursor: default;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  display: block;
}

.progress-detail {
  padding: var(--spacing-md);
  background: var(--bg-page);
  border-radius: var(--radius-md);
}

.progress-hint {
  margin: var(--spacing-sm) 0 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.detail-remark {
  margin: 0;
  font-size: 14px;
  color: var(--text-regular);
  line-height: 1.6;
}

/* ========================================
   详情抽屉样式 - 与战略任务管理页面一致
   ======================================== */
.detail-desc {
  margin-bottom: var(--spacing-2xl);
}

.milestone-section h4 {
  font-size: 16px;
  color: var(--text-main);
  margin: 0 0 var(--spacing-lg) 0;
}

.timeline-card {
  padding: var(--spacing-md);
  background: var(--bg-page);
  border-radius: var(--radius-sm);
}

.timeline-header {
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  color: var(--text-main);
}

.action-text {
  color: var(--text-main);
}

.timeline-comment {
  margin-top: var(--spacing-sm);
  color: var(--text-regular);
  font-size: 13px;
}

/* 审计日志区域样式 - 与 AuditLogDrawer 保持一致 */
.audit-log-section {
  margin-top: var(--spacing-lg);
}

.audit-log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.audit-log-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.audit-log-title .el-icon {
  color: var(--color-primary, #2c5282);
  font-size: 18px;
}

.audit-log-title h4 {
  font-size: 16px;
  color: var(--text-main);
  margin: 0;
  font-weight: 600;
}

.audit-log-header .log-count {
  font-size: 13px;
  color: var(--text-secondary);
}

.audit-log-timeline {
  max-height: 400px;
  overflow-y: auto;
  padding-right: 8px;
}

.audit-log-timeline::-webkit-scrollbar {
  width: 6px;
}

.audit-log-timeline::-webkit-scrollbar-track {
  background: transparent;
}

.audit-log-timeline::-webkit-scrollbar-thumb {
  background: var(--border-light, #e2e8f0);
  border-radius: 3px;
}

.audit-log-timeline::-webkit-scrollbar-thumb:hover {
  background: var(--border-color, #cbd5e1);
}

.audit-log-timeline .log-card {
  background: var(--bg-page, #f8fafc);
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 4px;
}

.audit-log-timeline .log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.audit-log-timeline .log-header .el-tag {
  width: fit-content;
}

.audit-log-timeline .log-time {
  font-size: 12px;
  color: var(--text-placeholder, #94a3b8);
}

.audit-log-timeline .log-operator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-regular, #475569);
  margin-bottom: 8px;
}

.audit-log-timeline .log-operator .el-icon {
  color: var(--text-placeholder, #94a3b8);
  font-size: 14px;
}

.audit-log-timeline .operator-name {
  font-weight: 500;
}

.audit-log-timeline .operator-dept {
  color: var(--text-secondary, #64748b);
}

.audit-log-timeline .operator-dept::before {
  content: "·";
  margin: 0 4px;
}

.audit-log-timeline .log-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  margin-bottom: 8px;
  padding: 8px 10px;
  background: var(--bg-white, #fff);
  border-radius: 4px;
}

.audit-log-timeline .progress-label {
  color: var(--text-secondary, #64748b);
}

.audit-log-timeline .progress-from {
  color: var(--text-placeholder, #94a3b8);
}

.audit-log-timeline .progress-arrow {
  color: var(--text-placeholder, #94a3b8);
  font-size: 12px;
}

.audit-log-timeline .progress-to {
  color: var(--color-primary, #2c5282);
  font-weight: 600;
}

.audit-log-timeline .log-comment {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 13px;
  color: var(--text-regular, #475569);
  padding: 8px 10px;
  background: var(--bg-white, #fff);
  border-radius: 4px;
  border-left: 3px solid var(--color-primary-light, #93c5fd);
}

.audit-log-timeline .log-comment .el-icon {
  color: var(--color-primary, #2c5282);
  font-size: 14px;
  flex-shrink: 0;
  margin-top: 2px;
}

.audit-log-empty {
  padding: var(--spacing-lg);
}

/* ========================================
   动画效果 - 统一过渡动画
   Requirements: 6.1, 6.2, 6.3
   ======================================== */
.page-fade-enter {
  animation: fadeIn var(--transition-slow) ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.card-animate {
  animation: slideUp 0.4s ease-out;
  animation-fill-mode: both;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ========================================
   标签样式 - 统一标签间距
   Requirements: 9.1, 9.3
   ======================================== */
.detail-tags :deep(.el-tag) {
  margin-right: 0;
}

/* ========================================
   响应式适配
   ======================================== */
@media (max-width: 768px) {
  .indicator-list-container {
    padding: var(--spacing-lg);
  }

  .page-header {
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .page-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .filter-form {
    flex-direction: column;
  }

  .filter-form :deep(.el-form-item) {
    width: 100%;
    margin-right: 0;
  }
}

/* ========================================
   进度填报弹窗样式
   ======================================== */
.report-dialog {
  padding: 0 var(--spacing-md);
}

.report-indicator-info {
  background: var(--bg-page);
  padding: var(--spacing-lg);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-md);
}

.report-indicator-info .info-row {
  display: flex;
  margin-bottom: var(--spacing-sm);
}

.report-indicator-info .info-row:last-child {
  margin-bottom: 0;
}

.report-indicator-info .info-label {
  color: var(--text-secondary);
  min-width: 80px;
  font-size: 14px;
}

.report-indicator-info .info-value {
  color: var(--text-main);
  font-size: 14px;
}

.report-indicator-info .info-value.highlight {
  color: var(--color-primary);
  font-weight: 600;
  font-size: 16px;
}

.report-form {
  margin-top: var(--spacing-lg);
}

.report-form .form-hint {
  margin-left: var(--spacing-sm);
  color: var(--text-secondary);
  font-size: 12px;
}

.report-form .upload-tip {
  font-size: 12px;
  color: var(--text-placeholder);
  margin-top: var(--spacing-xs);
}

.report-tips {
  margin-top: var(--spacing-lg);
}

.report-tips :deep(.el-alert) {
  border-radius: var(--radius-sm);
}

/* 填报提示 Tooltip 样式 */
.report-tooltip-content {
  padding: 4px;
  max-width: 300px;
}

.tooltip-item {
  margin-bottom: 8px;
}

.tooltip-item:last-child {
  margin-bottom: 0;
}

.tooltip-label {
  font-size: 12px;
  color: var(--text-secondary);
  display: block;
  margin-bottom: 2px;
}

.tooltip-value {
  font-size: 13px;
  color: var(--text-main);
  word-break: break-all;
}

.tooltip-value.highlight {
  color: var(--color-primary);
  font-weight: 600;
  font-size: 15px;
}

.tooltip-value.remark {
  white-space: pre-wrap;
  line-height: 1.4;
  background: var(--bg-page);
  padding: 6px 8px;
  border-radius: 4px;
}

.tooltip-files {
  margin-top: 4px;
}

.file-name {
  font-size: 12px;
  color: var(--color-primary);
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 2px;
}

.file-name::before {
  content: "📎";
}
</style>
