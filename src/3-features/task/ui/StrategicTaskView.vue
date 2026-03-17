﻿﻿<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import {
  Plus,
  View,
  Download,
  Delete,
  ArrowDown,
  Promotion,
  RefreshLeft,
  Check,
  Close,
  Upload,
  Edit,
  Refresh,
  User,
  ChatDotRound,
  Right,
  Timer
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, ElLoading } from 'element-plus'
import type { ElTable } from 'element-plus'
// eslint-disable-next-line no-restricted-syntax -- Backend-aligned types
import type { StrategicTask as _StrategicTask, StrategicIndicator } from '@/5-shared/types'
import { IndicatorStatus, ProgressApprovalStatus } from '@/5-shared/types/entities'
import { useStrategicStore } from '@/3-features/task/model/strategic'
import { useAuthStore } from '@/3-features/auth/model/store'
import { useTimeContextStore } from '@/5-shared/lib/timeContext'
import { useOrgStore } from '@/3-features/organization/model/store'
import { logger } from '@/5-shared/lib/utils/logger'
import { approvalApi } from '@/3-features/task/api/strategicApi'
import { milestoneApi } from '@/4-entities/milestone/api/milestoneApi'
import {
  getStatusText as _getStatusText,
  getStatusType as _getStatusType,
  getStatusIcon as _getStatusIcon
} from '@/5-shared/lib/utils/indicatorStatus'
import AuditLogDrawer from '@/3-features/task/ui/AuditLogDrawer.vue'
import TaskApprovalDrawer from '@/3-features/task/ui/TaskApprovalDrawer.vue'
import PlanApprovalDrawer from '@/3-features/approval/ui/PlanApprovalDrawer.vue'
import _MilestoneList from '@/3-features/milestone/ui/MilestoneList.vue'
import { indicatorApi } from '@/3-features/indicator/api'

// 使用共享 Store
const strategicStore = useStrategicStore()
const authStore = useAuthStore()
const timeContext = useTimeContextStore()
const orgStore = useOrgStore()

// 获取操作类型配置（与 AuditLogDrawer 保持一致）
const getActionConfig = (action: string) => {
  const configs: Record<string, { icon: unknown; label: string; type: string }> = {
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

  if (diffMins < 1) {
    return '刚刚'
  }
  if (diffMins < 60) {
    return `${diffMins}分钟前`
  }
  if (diffHours < 24) {
    return `${diffHours}小时前`
  }
  if (diffDays < 30) {
    return `${diffDays}天前`
  }
  return formatAuditTime(timestamp)
}

// 只读模式（历史年份为只读）
const isReadOnly = computed(() => timeContext.isReadOnly)

// 接收父组件传递的选中角色
const props = defineProps<{
  selectedRole: string
}>()

// 判断是否可以编辑（只有战略发展部可以编辑，且非只读模式）
const canEdit = computed(() => {
  if (isReadOnly.value) {
    return false
  }
  return authStore.userRole === 'strategic_dept' || props.selectedRole === 'strategic_dept'
})

// 当前选中任务索引
const currentTaskIndex = ref(0)
const isAddingOrEditing = ref(false)

// 视图模式：table（表格视图）或 card（卡片视图）
const viewMode = ref<'table' | 'card'>('table')

// 卡片视图当前指标索引
const currentIndicatorIndex = ref(0)

// 职能部门列表（从 orgStore 动态获取）
const functionalDepartments = computed(() => orgStore.getAllFunctionalDepartmentNames())

// 选中的部门 - 默认选中第一个
const selectedDepartment = ref('')

// 初始化选中部门 - 默认选中第一个职能部门
watch(
  functionalDepartments,
  newDeps => {
    if (newDeps.length > 0 && !selectedDepartment.value) {
      selectedDepartment.value = newDeps[0]
    }
  },
  { immediate: true }
)

const departmentIdNameMap = computed(() => {
  const map = new Map<string, string>()
  orgStore.departments.forEach(dept => {
    map.set(String(dept.id), dept.name)
  })
  return map
})

const normalizeDepartmentName = (value?: string | null): string => {
  if (!value) {
    return ''
  }

  const trimmed = String(value).trim()
  if (!trimmed) {
    return ''
  }

  return departmentIdNameMap.value.get(trimmed) || trimmed
}

const milestoneMap = ref<Record<string, Array<Record<string, unknown>>>>({})
const loadedMilestoneIds = ref(new Set<string>())
const loadingMilestoneIds = ref(new Set<string>())

const toMilestoneStatus = (status?: string): 'pending' | 'completed' | 'overdue' => {
  const normalized = String(status || '').toUpperCase()
  if (normalized === 'COMPLETED') {
    return 'completed'
  }
  if (normalized === 'DELAYED' || normalized === 'CANCELED' || normalized === 'OVERDUE') {
    return 'overdue'
  }
  return 'pending'
}

const normalizeMilestone = (raw: Record<string, unknown>, index: number) => ({
  id: String(raw.id ?? raw.milestoneId ?? `milestone-${index}`),
  name: String(raw.name ?? raw.milestoneName ?? `里程碑${index + 1}`),
  targetProgress: Number(raw.targetProgress ?? raw.weightPercent ?? 0),
  deadline: String(raw.deadline ?? raw.dueDate ?? ''),
  status: toMilestoneStatus(String(raw.status ?? '')),
  isPaired: Boolean(raw.isPaired ?? false),
  weightPercent: Number(raw.weightPercent ?? 0),
  sortOrder: Number(raw.sortOrder ?? index)
})

const extractMilestones = (payload: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(payload)) {
    return payload as Array<Record<string, unknown>>
  }
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    if (Array.isArray(record.items)) {
      return record.items as Array<Record<string, unknown>>
    }
  }
  return []
}

const normalizedIndicators = computed(() =>
  strategicStore.indicators.map(i => {
    const indicatorId = String(i.id)
    const mappedMilestones = milestoneMap.value[indicatorId]
    return {
      ...i,
      ownerDept: normalizeDepartmentName(i.ownerDept),
      responsibleDept: normalizeDepartmentName(i.responsibleDept),
      milestones: mappedMilestones ?? i.milestones ?? []
    }
  })
)

const getCurrentScopeIndicatorsForMilestones = () => {
  let list = strategicStore.indicators.filter(i => !i.year || i.year === timeContext.currentYear)
  const normalized = list.map(i => ({
    ...i,
    ownerDept: normalizeDepartmentName(i.ownerDept),
    responsibleDept: normalizeDepartmentName(i.responsibleDept)
  }))

  if (selectedDepartment.value) {
    return normalized.filter(
      i =>
        i.ownerDept === '战略发展部' &&
        i.responsibleDept === selectedDepartment.value &&
        i.isStrategic === true
    )
  }

  return normalized.filter(i => i.ownerDept === '战略发展部' && i.isStrategic === true)
}

const loadMilestonesForCurrentScope = async () => {
  const indicatorsToLoad = getCurrentScopeIndicatorsForMilestones()
  const ids = indicatorsToLoad
    .map(i => String(i.id))
    .filter(id => id && !loadedMilestoneIds.value.has(id) && !loadingMilestoneIds.value.has(id))

  if (ids.length === 0) {
    return
  }

  await Promise.all(
    ids.map(async indicatorId => {
      loadingMilestoneIds.value.add(indicatorId)
      try {
        const response = await milestoneApi.getMilestonesByIndicator(indicatorId)
        if (response.success) {
          const rawMilestones = extractMilestones(response.data)
          milestoneMap.value[indicatorId] = rawMilestones.map((m, idx) => normalizeMilestone(m, idx))
        } else {
          milestoneMap.value[indicatorId] = []
        }
      } catch (error) {
        logger.warn(`[StrategicTaskView] 加载指标 ${indicatorId} 里程碑失败`, error)
        milestoneMap.value[indicatorId] = []
      } finally {
        loadingMilestoneIds.value.delete(indicatorId)
        loadedMilestoneIds.value.add(indicatorId)
      }
    })
  )
}

const isMilestoneLoading = (indicatorId: string | number): boolean =>
  loadingMilestoneIds.value.has(String(indicatorId))

watch(
  [
    selectedDepartment,
    () => strategicStore.indicators.length,
    () => orgStore.departments.length,
    () => timeContext.currentYear
  ],
  () => {
    void loadMilestonesForCurrentScope()
  },
  { immediate: true }
)

watch(
  () => timeContext.currentYear,
  () => {
    milestoneMap.value = {}
    loadedMilestoneIds.value = new Set<string>()
    loadingMilestoneIds.value = new Set<string>()
    void loadMilestonesForCurrentScope()
  }
)

// 计算当前选中部门的所有指标权重之和（用于下发验证）
// 只计算战略指标（isStrategic=true）且 responsibleDept 匹配的指标
const departmentTotalWeight = computed(() => {
  if (!selectedDepartment.value) {
    return 0
  }

  const deptIndicators = normalizedIndicators.value.filter(
    i =>
      (!i.year || i.year === timeContext.currentYear) &&
      i.isStrategic === true && // 只计算战略指标（一级指标）
      i.responsibleDept === selectedDepartment.value // 只看 responsibleDept
  )

  // 计算权重之和
  return deptIndicators.reduce((sum, i) => sum + (i.weight || 0), 0)
})

// 计算当前页面整体状态（基于所有指标的生命周期状态，不考虑审批状态）
const overallStatus = computed(() => {
  const list = indicators.value
  if (list.length === 0) {
    return { label: '暂无指标', type: 'info' }
  }

  // 只基于指标生命周期状态计算整体状态（使用大写枚举值）
  // 注意：ACTIVE 是旧状态，等同于 DISTRIBUTED
  const allDraft = list.every(i => !i.status || i.status === IndicatorStatus.DRAFT)
  const allPendingReview = list.every(i => i.status === IndicatorStatus.PENDING_REVIEW)
  const allDistributed = list.every(
    i =>
      i.status === IndicatorStatus.DISTRIBUTED ||
      i.status === IndicatorStatus.ACTIVE ||
      i.status === 'ACTIVE' // 兼容数据库中的旧状态
  )
  const hasDistributed = list.some(
    i =>
      i.status === IndicatorStatus.DISTRIBUTED ||
      i.status === IndicatorStatus.ACTIVE ||
      i.status === 'ACTIVE' // 兼容数据库中的旧状态
  )
  const hasPendingReview = list.some(i => i.status === IndicatorStatus.PENDING_REVIEW)

  if (allDistributed) {
    return { label: '已下发', type: 'success' }
  }
  if (allPendingReview) {
    return { label: '待审核', type: 'warning' }
  }
  if (allDraft) {
    return { label: '草稿', type: 'info' }
  }
  // 业务要求: 页面状态仅保留四种（暂无指标/草稿/待审核/已下发），不显示“部分”状态。
  // 若出现混合状态（历史数据或中间态），按优先级收敛展示:
  // 待审核 > 草稿 > 已下发
  if (hasPendingReview) {
    return { label: '待审核', type: 'warning' }
  }
  if (allDraft || list.some(i => !i.status || i.status === IndicatorStatus.DRAFT)) {
    return { label: '草稿', type: 'info' }
  }
  if (hasDistributed) {
    return { label: '已下发', type: 'success' }
  }

  // Defensive fallback
  return { label: '草稿', type: 'info' }
})

// 判断当前部门是否有指标已下发（用于控制下发/撤回按钮和编辑权限）
const hasDistributedIndicators = computed(() => {
  return indicators.value.some(
    i =>
      i.status === IndicatorStatus.DISTRIBUTED ||
      i.status === IndicatorStatus.ACTIVE ||
      i.status === 'ACTIVE' // 兼容数据库中的旧状态
  )
})

// 判断是否可以编辑（未下发状态才能编辑）
const canEditIndicators = computed(() => {
  if (isReadOnly.value) {
    return false
  }
  if (!canEdit.value) {
    return false
  }
  return !hasDistributedIndicators.value
})

// 判断单个指标是否可以删除（未下发状态才能删除）
const canDeleteIndicator = (indicator: StrategicIndicator): boolean => {
  if (isReadOnly.value) {
    return false
  }
  if (!canEdit.value) {
    return false
  }

  // 只有草稿状态才能删除（使用大写枚举值）
  return !indicator.status || indicator.status === IndicatorStatus.DRAFT
}

// 待审批进度数量计算（独立于生命周期状态）
const pendingApprovalCount = computed(() => {
  return indicators.value.filter(i => i.progressApprovalStatus === ProgressApprovalStatus.PENDING)
    .length
})

// 判断是否可以下发（没有待审批的进度时才能下发）
const _canDistribute = computed(() => {
  if (isReadOnly.value) {
    return false
  }
  if (!canEdit.value) {
    return false
  }

  // 检查是否有指标可以下发（草稿或待审核状态，使用大写枚举值）
  const hasUndistributed = indicators.value.some(
    i => !i.status || i.status === IndicatorStatus.DRAFT || i.status === IndicatorStatus.PENDING
  )

  // 检查是否有待审批的进度
  const _hasPendingApproval = pendingApprovalCount.value > 0

  // 如果有待审批的进度，不允许下发
  if (_hasPendingApproval) {
    return false
  }

  return hasUndistributed
})

// 表格引用和选中的指标
const tableRef = ref<InstanceType<typeof ElTable>>()
const selectedIndicators = ref<StrategicIndicator[]>([])

// 当前指标（卡片视图用）
const currentIndicator = computed(() => {
  const list = indicators.value
  return list[currentIndicatorIndex.value] || null
})

// 切换视图模式
const _toggleViewMode = () => {
  viewMode.value = viewMode.value === 'table' ? 'card' : 'table'
  // 切换到卡片视图时，如果没有指标则重置索引
  if (viewMode.value === 'card' && indicators.value.length === 0) {
    currentIndicatorIndex.value = 0
  }
}

// 卡片视图导航
const goToPrevIndicator = () => {
  if (currentIndicatorIndex.value > 0) {
    currentIndicatorIndex.value--
  }
}

const goToNextIndicator = () => {
  if (currentIndicatorIndex.value < indicators.value.length - 1) {
    currentIndicatorIndex.value++
  }
}

// 跳转到指定指标
const _goToIndicator = (index: number) => {
  if (index >= 0 && index < indicators.value.length) {
    currentIndicatorIndex.value = index
  }
}

// 从 Store 获取任务列表
const taskList = computed(() =>
  strategicStore.tasks.map(t => ({
    id: Number(t.id),
    title: t.title,
    desc: t.desc,
    createTime: t.createTime,
    cycle: t.cycle
  }))
)

// 当前选中的任务
const _currentTask = computed(
  () =>
    taskList.value[currentTaskIndex.value] || {
      id: 0,
      title: '暂无任务',
      desc: '',
      createTime: '',
      cycle: ''
    }
)

// 从 Store 获取指标列表（带里程碑），按年份和部门过滤，按任务类型和战略任务分组排序
const indicators = computed(() => {
  // 过滤当前年份的指标
  let list = normalizedIndicators.value.filter(i => !i.year || i.year === timeContext.currentYear)

  // 根据选中的部门筛选指标
  if (selectedDepartment.value) {
    list = list.filter(
      i =>
        i.ownerDept === '战略发展部' && // 由战略发展部创建的指标
        i.responsibleDept === selectedDepartment.value && // 下发给选中部门的指标
        i.isStrategic === true // 只显示战略指标，不显示子指标
    )
  } else {
    // 没有选择部门：显示所有战略发展部创建的战略指标
    list = list.filter(i => i.ownerDept === '战略发展部' && i.isStrategic === true)
  }

  const mappedList = list.map(i => ({
    ...i
    // 移除 ID 转换，保持原始字符串格式
  }))

  // 先按 type2（任务类型）排序，再按 taskContent（战略任务）排序
  return mappedList.sort((a, b) => {
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
const getSpanMethod = ({
  row,
  column: _column,
  rowIndex,
  columnIndex
}: {
  row: Record<string, unknown>
  column: unknown
  rowIndex: number
  columnIndex: number
}) => {
  const dataList = indicators.value

  // 战略任务列（第0列）需要合并
  // 列顺序: 0战略任务, 1核心指标, 2说明, 3权重, 4里程碑, 5进度, 6状态, 7操作
  if (columnIndex === 0) {
    const currentTask = row.taskContent || '未关联任务'

    let startIndex = rowIndex
    while (
      startIndex > 0 &&
      (dataList[startIndex - 1].taskContent || '未关联任务') === currentTask
    ) {
      startIndex--
    }

    if (startIndex === rowIndex) {
      let count = 1
      while (
        rowIndex + count < dataList.length &&
        (dataList[rowIndex + count].taskContent || '未关联任务') === currentTask
      ) {
        count++
      }
      return { rowspan: count, colspan: 1 }
    } else {
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

// 获取任务级别状态（基于同一战略任务下所有指标的状态）
const getTaskStatus = (row: StrategicIndicator) => {
  const group = getTaskGroup(row)
  const allDistributed = group.rows.every(r => !r.canWithdraw)
  const hasPendingApproval = group.rows.some(r => r.progressApprovalStatus === 'PENDING')

  if (hasPendingApproval) {
    return { label: '待审批', type: 'warning', canWithdraw: false }
  }
  if (allDistributed) {
    return { label: '已下发', type: 'success', canWithdraw: false }
  }
  return { label: '待下发', type: 'info', canWithdraw: true }
}

// 撤回整个任务（撤回同一战略任务下的所有指标）
const _handleWithdrawTask = async (row: StrategicIndicator) => {
  const group = getTaskGroup(row)
  const distributedRows = group.rows.filter(r => !r.canWithdraw)

  if (distributedRows.length === 0) {
    ElMessage.warning('该任务下没有已下发的指标')
    return
  }

  ElMessageBox.confirm(
    `确认撤回任务 "${group.taskContent}" 下的 ${distributedRows.length} 个已下发指标？`,
    '撤回确认',
    {
      confirmButtonText: '确认撤回',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )
    .then(async () => {
      // 显示加载状态
      const loading = ElMessage({
        message: '正在撤回指标...',
        type: 'info',
        duration: 0
      })

      try {
        // 等待所有指标撤回完成
        await Promise.all(
          distributedRows.map(r =>
            strategicStore.updateIndicator(r.id.toString(), { canWithdraw: true })
          )
        )

        loading.close()
        ElMessage.success(`已成功撤回 ${distributedRows.length} 个指标`)
        updateEditTime()
      } catch (err) {
        loading.close()
        ElMessage.error('撤回失败，请稍后重试')
        logger.error('Withdraw task failed:', err)
      }
    })
    .catch(() => {
      // 用户取消操作
    })
}

// 查看任务级别审计日志
const taskAuditLogVisible = ref(false)
const currentTaskAuditGroup = ref<{ taskContent: string; rows: StrategicIndicator[] } | null>(null)

const _handleViewTaskAuditLog = (row: StrategicIndicator) => {
  currentTaskAuditGroup.value = getTaskGroup(row)
  taskAuditLogVisible.value = true
}

// 查看里程碑
const milestoneDrawerVisible = ref(false)
const currentMilestoneIndicator = ref<StrategicIndicator | null>(null)

const _handleViewMilestones = (row: StrategicIndicator) => {
  currentMilestoneIndicator.value = row
  milestoneDrawerVisible.value = true
}

// 里程碑编辑弹窗
const milestoneEditDialogVisible = ref(false)
const editingMilestoneIndicator = ref<StrategicIndicator | null>(null)
const editingMilestones = ref<Milestone[]>([])

// 打开里程碑编辑弹窗
const handleEditMilestones = (row: StrategicIndicator) => {
  // 只有未下发状态且有编辑权限时才能编辑
  if (!canEditIndicators.value) {
    ElMessage.warning('已下发的指标不可编辑里程碑')
    return
  }

  logger.info(`[StrategicTaskView] Opening milestone editor for indicator:`, {
    id: row.id,
    name: row.name,
    indicator_desc: row.indicator_desc,
    responsibleDept: row.responsibleDept,
    milestonesCount: row.milestones?.length || 0
  })

  editingMilestoneIndicator.value = row
  // 深拷贝里程碑数据
  editingMilestones.value = JSON.parse(JSON.stringify(row.milestones || []))
  milestoneEditDialogVisible.value = true
}

// 通过索引编辑里程碑（避免表格合并导致的行数据错位）
const handleEditMilestonesByIndex = (index: number) => {
  const row = indicators.value[index]
  if (!row) {
    logger.error(`[StrategicTaskView] Cannot find indicator at index ${index}`)
    return
  }
  handleEditMilestones(row)
}

// 添加里程碑（编辑弹窗内）
const addMilestoneInDialog = () => {
  const autoName =
    editingMilestoneIndicator.value?.type1 === '定量' ? editingMilestoneIndicator.value?.name : ''
  editingMilestones.value.push({
    id: Date.now(),
    name: autoName,
    targetProgress: 0,
    deadline: '',
    status: 'pending'
  })
}

// 生成12个月里程碑（编辑弹窗内）
const generateMonthlyMilestonesInDialog = () => {
  const _currentYear = timeContext.currentYear
  // 获取指标名称并清理空白字符
  const rawName =
    editingMilestoneIndicator.value?.name ||
    editingMilestoneIndicator.value?.indicator_desc ||
    '指标完成'
  const indicatorName = rawName.trim() // 清理首尾空白

  logger.info(
    `[generateMonthlyMilestonesInDialog] Generating milestones for indicator: ${indicatorName}`,
    {
      indicator: editingMilestoneIndicator.value,
      name: editingMilestoneIndicator.value?.name,
      indicator_desc: editingMilestoneIndicator.value?.indicator_desc,
      rawNameLength: rawName.length,
      trimmedNameLength: indicatorName.length
    }
  )
  editingMilestones.value = []

  for (let month = 1; month <= 12; month++) {
    const lastDay = new Date(_currentYear, month, 0).getDate()
    const deadline = `${_currentYear}-${String(month).padStart(2, '0')}-${lastDay}`
    const progress = Math.round((month / 12) * 100)

    editingMilestones.value.push({
      id: -month, // 使用负数作为临时 ID，避免 Vue key 重复，后端会识别为新里程碑
      name: `${indicatorName} - ${month}月`,
      targetProgress: progress,
      deadline: deadline,
      status: 'NOT_STARTED' // 使用后端枚举值
    })
  }
  logger.info(
    `[generateMonthlyMilestonesInDialog] Generated ${editingMilestones.value.length} milestones`
  )
}

// 删除里程碑（编辑弹窗内）
const removeMilestoneInDialog = (index: number) => {
  editingMilestones.value.splice(index, 1)
}

// 保存里程碑编辑
const saveMilestoneEdit = async () => {
  if (!editingMilestoneIndicator.value) {
    return
  }

  // 验证里程碑数据
  for (const ms of editingMilestones.value) {
    if (!ms.name || !ms.name.trim()) {
      ElMessage.warning('请填写里程碑名称')
      return
    }
    if (!ms.deadline) {
      ElMessage.warning('请设置里程碑截止日期')
      return
    }
    if (ms.targetProgress < 0 || ms.targetProgress > 100) {
      ElMessage.warning('目标进度必须在0-100之间')
      return
    }
  }

  try {
    // 从当前指标列表中查找最新的指标对象（使用 id 匹配）
    const currentIndicator = indicators.value.find(
      i => i.id === editingMilestoneIndicator.value?.id
    )

    if (!currentIndicator) {
      ElMessage.error('找不到对应的指标，请刷新页面后重试')
      return
    }

    logger.info(
      `[StrategicTaskView] Saving ${editingMilestones.value.length} milestones for indicator ${currentIndicator.id}`
    )

    // 使用最新的指标 ID 进行更新
    await strategicStore.updateIndicator(currentIndicator.id.toString(), {
      milestones: [...editingMilestones.value]
    })

    logger.info(`[StrategicTaskView] Reloading indicators after milestone update...`)

    // 重新加载指标数据以获取后端更新后的里程碑
    await strategicStore.loadIndicatorsByYear(timeContext.currentYear)

    // 验证重新加载后的里程碑数量
    const reloadedIndicator = indicators.value.find(i => i.id === currentIndicator.id)
    if (reloadedIndicator) {
      logger.info(
        `[StrategicTaskView] After reload, indicator ${reloadedIndicator.id} has ${reloadedIndicator.milestones?.length || 0} milestones`
      )
      logger.info(`[StrategicTaskView] Indicator details:`, {
        id: reloadedIndicator.id,
        name: reloadedIndicator.name,
        indicator_desc: reloadedIndicator.indicator_desc,
        responsibleDept: reloadedIndicator.responsibleDept,
        milestonesCount: reloadedIndicator.milestones?.length
      })
    } else {
      logger.warn(
        `[StrategicTaskView] Could not find indicator ${currentIndicator.id} after reload!`
      )
    }

    // 额外验证：检查 store 中的原始数据
    const storeIndicator = strategicStore.indicators.find(i => i.id === currentIndicator.id)
    if (storeIndicator) {
      logger.info(
        `[StrategicTaskView] Store indicator ${storeIndicator.id} has ${storeIndicator.milestones?.length || 0} milestones`
      )
    }

    ElMessage.success('里程碑已更新')
    milestoneEditDialogVisible.value = false
    editingMilestoneIndicator.value = null
    editingMilestones.value = []
    updateEditTime()
  } catch (error) {
    logger.error('Failed to save milestones:', error)
    ElMessage.error('里程碑更新失败')
  }
}

// 取消里程碑编辑
const cancelMilestoneEdit = () => {
  milestoneEditDialogVisible.value = false
  editingMilestoneIndicator.value = null
  editingMilestones.value = []
}

// 格式化更新时间
const _formatUpdateTime = (time: string | Date | undefined) => {
  if (!time) {
    return '-'
  }
  const date = new Date(time)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

// 获取进度数字的样式类
const _getProgressClass = (progress: number) => {
  if (progress >= 80) {
    return 'progress-success'
  }
  if (progress >= 50) {
    return 'progress-warning'
  }
  return 'progress-danger'
}

// 按类别筛选指标
const developmentIndicators = computed(() => indicators.value.filter(i => i.type2 === '发展性'))
const basicIndicators = computed(() => indicators.value.filter(i => i.type2 === '基础性'))

const groupIndicatorsByTask = (list: StrategicIndicator[]) => {
  const groups: Array<{ taskContent: string; rows: StrategicIndicator[] }> = []
  const indexMap: Record<string, number> = {}

  list.forEach(item => {
    const key = item.taskContent || '未命名任务'
    if (indexMap[key] === undefined) {
      groups.push({ taskContent: key, rows: [item] })
      indexMap[key] = groups.length - 1
    } else {
      groups[indexMap[key]].rows.push(item)
    }
  })

  return groups
}

const _groupedDevelopmentIndicators = computed(() =>
  groupIndicatorsByTask(developmentIndicators.value)
)
const _groupedBasicIndicators = computed(() => groupIndicatorsByTask(basicIndicators.value))

// 获取已有的任务名称列表（从当前部门的指标中提取）
const existingTaskNames = computed(() => {
  // 从当前显示的指标中提取已使用的 taskContent（战略任务名称）
  const taskNames = indicators.value
    .filter(i => i.taskContent && i.taskContent !== '未命名任务')
    .map(i => i.taskContent)

  // 去重
  return [...new Set(taskNames)]
})

// 获取任务名称对应的任务类型映射
const taskTypeMap = computed(() => {
  const map: Record<string, '发展性' | '基础性'> = {}
  indicators.value.forEach(i => {
    if (i.taskContent && i.taskContent !== '未命名任务' && i.type2) {
      map[i.taskContent] = i.type2
    }
  })
  return map
})

// 选择战略任务时自动更新任务类型
const handleTaskSelect = (taskName: string) => {
  if (taskTypeMap.value[taskName]) {
    newRow.value.type2 = taskTypeMap.value[taskName]
  }
}

// 战略任务选择器ref
const taskSelectRef = ref<{
  $el?: { querySelector: (selector: string) => HTMLInputElement }
} | null>(null)

// 处理战略任务下拉框关闭 - 保存输入的值
const handleTaskVisibleChange = (visible: boolean) => {
  if (!visible && taskSelectRef.value) {
    // 下拉框关闭时，如果有输入内容但未选择，则保存输入的值
    const inputEl = taskSelectRef.value.$el?.querySelector('input')
    const inputValue = inputEl?.value || ''
    if (inputValue.trim() && !newRow.value.taskContent) {
      newRow.value.taskContent = inputValue.trim()
    }
  }
}

// 新增行数据
const newRow = ref({
  taskContent: '',
  name: '',
  type1: '定量' as '定性' | '定量',
  type2: '基础性' as '发展性' | '基础性',
  weight: '',
  remark: '',
  milestones: [] as Milestone[]
})

// 任务下发相关状态
const showAssignmentDialog = ref(false)
const assignmentTarget = ref('')
const assignmentMethod = ref<'self' | 'college'>('self')

// 添加新里程碑（单个）
const addMilestone = () => {
  // 定量指标时，里程碑名称自动填充为核心指标内容
  const autoName = newRow.value.type1 === '定量' ? newRow.value.name : ''
  newRow.value.milestones.push({
    id: Date.now(),
    name: autoName,
    targetProgress: 0,
    deadline: '',
    status: 'pending'
  })
}

// 生成12个月里程碑（定量指标默认）
const generateMonthlyMilestones = () => {
  const _currentYear = timeContext.currentYear
  const indicatorName = newRow.value.name || '指标完成'
  newRow.value.milestones = []

  for (let month = 1; month <= 12; month++) {
    const lastDay = new Date(_currentYear, month, 0).getDate()
    const deadline = `${_currentYear}-${String(month).padStart(2, '0')}-${lastDay}`
    const progress = Math.round((month / 12) * 100)

    newRow.value.milestones.push({
      id: 0, // 使用 0 表示新里程碑，后端会创建新记录
      name: `${indicatorName} - ${month}月`,
      targetProgress: progress,
      deadline: deadline,
      status: 'pending'
    })
  }
}

// 删除里程碑
const removeMilestone = (index: number) => {
  newRow.value.milestones.splice(index, 1)
}

// 当前日期
const _currentDate = '2025年12月5日'

// 编辑状态管理（任务详情）
const editingField = ref<string | null>(null)
const editingValue = ref('')

// 指标列表编辑状态
const editingIndicatorId = ref<number | null>(null)
const editingIndicatorField = ref<string | null>(null)
const editingIndicatorValue = ref<Record<string, unknown> | null>(null)

// 任务详情双击编辑处理
const _handleDoubleClick = (field: 'title' | 'desc' | 'cycle' | 'createTime', value: string) => {
  if (!canEdit.value) {
    return
  }
  editingField.value = field
  editingValue.value = value
}

// 任务详情保存编辑
const _saveEdit = (field: 'title' | 'desc' | 'cycle' | 'createTime') => {
  // 如果值没有变化或者被清空（根据需求，这里假设如果不填则取消编辑或保留原值，这里逻辑是如果不填则取消）
  if (editingValue.value === undefined || editingValue.value === null) {
    cancelEdit()
    return
  }

  const task = taskList.value[currentTaskIndex.value]
  if (field === 'title') {
    task.title = editingValue.value
  } else if (field === 'desc') {
    task.desc = editingValue.value
  } else if (field === 'cycle') {
    task.cycle = editingValue.value
  } else if (field === 'createTime') {
    task.createTime = editingValue.value
  }

  cancelEdit()
}

// 任务详情取消编辑
const cancelEdit = () => {
  editingField.value = null
  editingValue.value = ''
}

// 指标双击编辑
const handleIndicatorDblClick = (row: StrategicIndicator, field: string) => {
  if (!canEdit.value) {
    return
  }
  // 已下发状态下不允许编辑
  if (hasDistributedIndicators.value) {
    return
  }
  editingIndicatorId.value = row.id
  editingIndicatorField.value = field
  editingIndicatorValue.value = row[field as keyof StrategicIndicator]
}

// 保存指标编辑
const saveIndicatorEdit = async (row: StrategicIndicator, field: string) => {
  // 如果已经在取消过程中或值无效，直接退出
  if (editingIndicatorId.value === null) {
    return
  }

  if (editingIndicatorValue.value === null || editingIndicatorValue.value === undefined) {
    cancelIndicatorEdit()
    return
  }

  try {
    // 使用 Store 更新指标
    const updates: Partial<StrategicIndicator> = {}

    if (field === 'weight') {
      // 权重字段强制转换为数字
      ;(updates as Record<string, unknown>)[field] = Number(editingIndicatorValue.value)
    } else if (field === 'type1' || field === 'type2') {
      updates[field] = editingIndicatorValue.value
      // 更新 isQualitative 状态如果修改的是 type1
      if (field === 'type1') {
        updates.isQualitative = editingIndicatorValue.value === '定性'
      }
    } else {
      ;(updates as Record<string, unknown>)[field] = editingIndicatorValue.value
    }

    // 如果编辑的是核心指标名称，且当前没有指标类型，则设置默认类型为"定性"
    if (field === 'name' && !row.type1) {
      updates.type1 = '定性'
      updates.isQualitative = true
    }

    await strategicStore.updateIndicator(row.id.toString(), updates)
    cancelIndicatorEdit()
    updateEditTime()
  } catch (error) {
    logger.error('[StrategicTaskView] Failed to save indicator:', error)
    // 错误已经在Store中显示，这里不需要再显示
  }
}

// 取消指标编辑
const cancelIndicatorEdit = () => {
  editingIndicatorId.value = null
  editingIndicatorField.value = null
  editingIndicatorValue.value = null
}

// 全局点击事件处理 - 点击编辑区域外退出编辑
const handleGlobalClick = (event: MouseEvent) => {
  // 如果没有正在编辑的字段，直接返回
  if (editingIndicatorId.value === null) {
    return
  }

  const target = event.target as HTMLElement

  // 检查点击是否在 el-select 或其下拉菜单内
  const isInSelect = target.closest('.el-select') || target.closest('.el-select-dropdown')
  // 检查点击是否在 el-input 内
  const isInInput = target.closest('.el-input') || target.closest('.el-textarea')

  // 如果点击不在编辑组件内，则退出编辑
  if (!isInSelect && !isInInput) {
    cancelIndicatorEdit()
  }
}

// 挂载和卸载全局点击监听
onMounted(async () => {
  if (strategicStore.indicators.length === 0) {
    try {
      await strategicStore.loadIndicatorsByYear(timeContext.currentYear)
    } catch (error) {
      logger.error('[StrategicTaskView] 初始加载指标失败:', error)
    }
  }

  if (orgStore.departments.length === 0) {
    try {
      await orgStore.loadDepartments()
    } catch (error) {
      logger.error('[StrategicTaskView] 初始加载部门失败:', error)
    }
  }

  document.addEventListener('click', handleGlobalClick, true)
})

onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick, true)
})

// 方法
const addNewRow = () => {
  isAddingOrEditing.value = true
  // 由于默认是定量指标，自动生成12个里程碑
  if (newRow.value.type1 === '定量') {
    generateMonthlyMilestones()
  }
}

// 在指定类别中添加新指标
const _addIndicatorToCategory = (category: '发展性' | '基础性') => {
  logger.info(`[StrategicTaskView] addIndicatorToCategory called with category: ${category}`)
  newRow.value.type2 = category
  isAddingOrEditing.value = true
}

// 为指定任务新增指标（点击单元格右下角加号）
const handleAddIndicatorToTask = (row: StrategicIndicator) => {
  newRow.value.taskContent = row.taskContent || ''
  newRow.value.type2 = row.type2 || '发展性'
  isAddingOrEditing.value = true
}

const cancelAdd = () => {
  isAddingOrEditing.value = false
  newRow.value = {
    taskContent: '',
    name: '',
    type1: '定量',
    type2: '基础性',
    weight: '',
    remark: '',
    milestones: []
  }
  updateEditTime()
}

// 保存新行
const saveNewRow = async () => {
  if (!newRow.value.name) {
    ElMessage.warning('请填写核心指标内容')
    return
  }

  // 显示加载状态
  const loading = ElLoading.service({
    lock: true,
    text: '正在保存指标...',
    background: 'rgba(0, 0, 0, 0.7)'
  })

  try {
    // 添加日志记录 taskContent
    logger.info(
      `[StrategicTaskView] Saving indicator with taskContent: "${newRow.value.taskContent}"`
    )

    // 调用 Store 添加指标（现在是异步的，会调用后端 API）
    await strategicStore.addIndicator({
      id: Date.now().toString(),
      taskContent: newRow.value.taskContent || '未命名任务',
      name: newRow.value.name,
      isQualitative: newRow.value.type1 === '定性',
      type1: newRow.value.type1,
      type2: newRow.value.type2,
      progress: 0,
      createTime: new Date().toLocaleDateString('zh-CN'),
      weight: Number(newRow.value.weight) || 0,
      remark: newRow.value.remark || '无备注',
      canWithdraw: true,
      milestones: [...newRow.value.milestones],
      targetValue: 100,
      unit: '%',
      responsibleDept: selectedDepartment.value || '战略发展部', // 责任部门是选中的部门
      ownerDept: '战略发展部', // 创建者始终是战略发展部
      responsiblePerson: authStore.userName || '未分配',
      status: 'active',
      isStrategic: true,
      year: timeContext.currentYear,
      statusAudit: []
    })

    // 🔧 修复：强制从后端重新加载指标数据，确保前端显示的是包含正式ID的数据
    logger.info(
      `[StrategicTaskView] Reloading indicators after successful save to sync backend IDs...`
    )
    await strategicStore.loadIndicatorsByYear(timeContext.currentYear)
    logger.info(`[StrategicTaskView] Indicators reloaded successfully`)

    // 成功：关闭表单并更新 UI
    cancelAdd()
    updateEditTime()
  } catch (error) {
    // 错误已在 Store 中处理并显示消息
    logger.error('[StrategicTaskView] Failed to save indicator:', error)
  } finally {
    loading.close()
  }
}

// 删除指标
const _deleteIndicator = (indicator: StrategicIndicator) => {
  ElMessageBox.confirm(`确定要删除指标 "${indicator.name}" 吗？删除后无法恢复。`, '删除确认', {
    confirmButtonText: '确定删除',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => {
      strategicStore.deleteIndicator(indicator.id.toString())
      ElMessage.success('指标已删除')
      updateEditTime()
    })
    .catch(() => {
      // 用户取消操作
    })
}

// 最后编辑时间
const lastEditTime = ref(new Date().toLocaleString())

// 更新最后编辑时间的函数
const updateEditTime = () => {
  lastEditTime.value = new Date().toLocaleString()
}

// 里程碑状态计算
const _calculateMilestoneStatus = (
  indicator: StrategicIndicator
): 'success' | 'warning' | 'exception' => {
  if (!indicator.milestones || indicator.milestones.length === 0) {
    return getProgressStatus(indicator.progress)
  }

  const _currentDate = new Date()
  const _currentYear = currentDate.getFullYear()

  // 检查是否有逾期未完成的里程碑
  const hasOverdueMilestone = indicator.milestones.some(milestone => {
    const deadlineDate = new Date(milestone.deadline)
    return milestone.status === 'pending' && deadlineDate < currentDate
  })

  // 检查是否有即将到期的里程碑（30天内）
  const hasUpcomingMilestone = indicator.milestones.some(milestone => {
    if (milestone.status === 'completed') {
      return false
    }
    const deadlineDate = new Date(milestone.deadline)
    const daysUntilDeadline = Math.ceil(
      (deadlineDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
    )
    return daysUntilDeadline > 0 && daysUntilDeadline <= 30
  })

  // 判断状态逻辑
  if (hasOverdueMilestone) {
    return 'exception' // 红色：逾期未完成
  } else if (hasUpcomingMilestone) {
    return 'warning' // 黄色：即将到期
  } else {
    return 'success' // 绿色：按计划进行
  }
}

// 获取里程碑进度文本
const _getMilestoneProgressText = (indicator: StrategicIndicator): string => {
  if (!indicator.milestones || indicator.milestones.length === 0) {
    return `当前进度: ${indicator.progress}%`
  }

  const _totalMilestones = indicator.milestones.length
  const _completedMilestones = indicator.milestones.filter(m => m.status === 'completed').length
  const _overdueMilestones = indicator.milestones.filter(m => m.status === 'overdue').length
  const pendingMilestones = indicator.milestones.filter(m => m.status === 'pending').length

  const _currentDate = new Date()
  const overdueMilestonesCount = indicator.milestones.filter(m => {
    if (m.status !== 'pending') {
      return false
    }
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

// 获取里程碑列表用于tooltip显示
interface MilestoneTooltipItem {
  id: string | number
  name: string
  expectedDate: string
  progress: number
}

const getMilestonesTooltip = (indicator: StrategicIndicator): MilestoneTooltipItem[] => {
  return (indicator.milestones || []).map(m => ({
    id: m.id || '',
    name: m.name,
    expectedDate: m.deadline || '',
    progress: m.targetProgress || 0
  }))
}

const selectDepartment = (dept: string) => {
  selectedDepartment.value = dept
}

const _selectTask = (index: number) => {
  currentTaskIndex.value = index
}

// 表格选择变化处理
const handleSelectionChange = (selection: StrategicIndicator[]) => {
  selectedIndicators.value = selection
}

// 任务下发相关方法
const handleCancelAssignment = () => {
  showAssignmentDialog.value = false
  assignmentTarget.value = ''
  assignmentMethod.value = 'self'
}

const confirmAssignment = () => {
  if (!assignmentTarget.value) {
    ElMessage.warning('请选择下发目标')
    return
  }

  const indicatorNames = selectedIndicators.value.map(ind => ind.name).join('、')
  const targetName =
    assignmentMethod.value === 'self' ? '自己完成' : `下发给${assignmentTarget.value}`

  ElMessageBox.confirm(`确认将以下指标${targetName}？\n\n${indicatorNames}`, '确认下发', {
    confirmButtonText: '确定下发',
    cancelButtonText: '取消',
    type: 'info'
  })
    .then(() => {
      // 这里应该调用API进行任务下发
      ElMessage.success(
        `成功下发${selectedIndicators.value.length}项指标到${assignmentTarget.value}`
      )
      showAssignmentDialog.value = false
      assignmentTarget.value = ''
      assignmentMethod.value = 'self'
    })
    .catch(() => {
      // 用户取消操作
    })
}

// ================== 详情抽屉 & 单个下发/撤回 ==================

// 详情抽屉状态
const detailDrawerVisible = ref(false)
const currentDetail = ref<StrategicIndicator | null>(null)

// 审计日志抽屉状态
const auditLogVisible = ref(false)
const currentAuditIndicator = ref<StrategicIndicator | null>(null)

// 任务审批抽屉状态
const taskApprovalVisible = ref(false)

// 专门用于审批抽屉的指标列表（显示当前选中部门的所有指标，一个部门的所有指标状态应该统一）
const approvalIndicators = computed(() => {
  if (!selectedDepartment.value) {
    return []
  }
  return normalizedIndicators.value
    .filter(i => !i.year || i.year === timeContext.currentYear)
    .filter(i => i.responsibleDept === selectedDepartment.value) // 只显示当前选中部门的指标
    .filter(i => i.isStrategic === true) // 只显示战略指标（一级指标）
})

// 判断当前选中部门是否有待审批的指标（用于按钮显示和状态判断）
const _hasPendingApprovalForDept = computed(() => {
  if (!selectedDepartment.value) {
    return false
  }
  return approvalIndicators.value.some(i => i.progressApprovalStatus === 'PENDING')
})

// 查看审计日志
const _handleViewAuditLog = (row: StrategicIndicator) => {
  currentAuditIndicator.value = row
  auditLogVisible.value = true
}

// 打开任务审批抽屉
const handleOpenApproval = () => {
  taskApprovalVisible.value = true
}

// 审批后刷新
const handleApprovalRefresh = async () => {
  // 刷新待审批计划数量
  await loadPendingPlanApprovalCount()
  // 强制关闭并重新打开抽屉以刷新数据
  taskApprovalVisible.value = false
  nextTick(() => {
    updateEditTime()
  })
}

// 下发弹窗状态
const distributeDialogVisible = ref(false)
const currentDistributeItem = ref<StrategicIndicator | null>(null)
const currentDistributeGroup = ref<{ taskContent: string; rows: StrategicIndicator[] } | null>(null)
const distributeTarget = ref<string[]>([])

// ================== 进度审批相关 ==================

// 审批弹窗状态
const approvalDialogVisible = ref(false)
const currentApprovalIndicator = ref<StrategicIndicator | null>(null)

// 审批表单数据
const approvalForm = ref({
  action: 'approve' as 'approve' | 'reject',
  comment: '',
  rejectReason: ''
})

// 打开审批弹窗
const _handleOpenApprovalDialog = (row: StrategicIndicator) => {
  currentApprovalIndicator.value = row
  approvalForm.value = {
    action: 'approve',
    comment: '',
    rejectReason: ''
  }
  approvalDialogVisible.value = true
}

// 关闭审批弹窗
const closeApprovalDialog = () => {
  approvalDialogVisible.value = false
  currentApprovalIndicator.value = null
  approvalForm.value = {
    action: 'approve',
    comment: '',
    rejectReason: ''
  }
}

// 提交审批
const submitApproval = () => {
  if (!currentApprovalIndicator.value) {
    return
  }

  const indicator = currentApprovalIndicator.value
  const isApprove = approvalForm.value.action === 'approve'

  // 驳回时必须填写原因
  if (!isApprove && !approvalForm.value.rejectReason.trim()) {
    ElMessage.warning('请填写驳回原因')
    return
  }

  const actionText = isApprove ? '通过' : '驳回'
  const pendingProgress = indicator.pendingProgress || 0
  const currentProgress = indicator.progress || 0

  ElMessageBox.confirm(
    isApprove
      ? `确认审批通过？\n\n指标：${indicator.name}\n进度将从 ${currentProgress}% 更新为 ${pendingProgress}%`
      : `确认驳回该进度填报？\n\n指标：${indicator.name}\n驳回原因：${approvalForm.value.rejectReason}`,
    `审批${actionText}确认`,
    {
      confirmButtonText: `确认${actionText}`,
      cancelButtonText: '取消',
      type: isApprove ? 'success' : 'warning'
    }
  )
    .then(async () => {
      try {
        if (isApprove) {
          // 审批通过：只需要更新审批状态，后端会自动处理进度复制和清空逻辑
          await strategicStore.updateIndicator(indicator.id.toString(), {
            progressApprovalStatus: 'APPROVED'
          })

          // 添加审计日志
          strategicStore.addStatusAuditEntry(indicator.id.toString(), {
            operator: authStore.userName || 'unknown',
            operatorName: authStore.userName || '未知用户',
            operatorDept: authStore.userDepartment || '战略发展部',
            action: 'approve',
            comment: approvalForm.value.comment || '审批通过',
            previousProgress: currentProgress,
            newProgress: pendingProgress,
            previousStatus: 'pending',
            newStatus: 'distributed'
          })

          ElMessage.success('审批通过，进度已更新')

          // 刷新指标数据以显示最新进度
          const timeContext = useTimeContextStore()
          await strategicStore.loadIndicatorsByYear(timeContext.currentYear)
        } else {
          // 审批驳回：设置驳回状态，保留待审批数据供查看
          await strategicStore.updateIndicator(indicator.id.toString(), {
            progressApprovalStatus: 'REJECTED'
          })

          // 添加审计日志
          strategicStore.addStatusAuditEntry(indicator.id.toString(), {
            operator: authStore.userName || 'unknown',
            operatorName: authStore.userName || '未知用户',
            operatorDept: authStore.userDepartment || '战略发展部',
            action: 'reject',
            comment: approvalForm.value.rejectReason,
            previousProgress: currentProgress,
            newProgress: pendingProgress,
            previousStatus: 'pending',
            newStatus: 'distributed'
          })

          ElMessage.info('已驳回该进度填报')
        }

        closeApprovalDialog()
        updateEditTime()
      } catch (error) {
        logger.error('审批操作失败:', error)
        ElMessage.error('审批操作失败，请重试')
      }
    })
    .catch(() => {
      // 用户取消操作
    })
}

// 查看详情
const handleViewDetail = (row: StrategicIndicator) => {
  currentDetail.value = row
  detailDrawerVisible.value = true
}

// ================== 指标审核工作流方法 ==================

// 判断是否为战略发展部
const isStrategicDept = computed(() => {
  return authStore.userRole === 'strategic_dept' || props.selectedRole === 'strategic_dept'
})

// 审核通过指标定义
const approveIndicatorReview = async (indicatorId: string) => {
  try {
    const indicator = indicators.value.find(i => i.id.toString() === indicatorId)
    if (!indicator) {
      ElMessage.error('找不到指标')
      return
    }

    ElMessageBox.confirm(
      `确认审核通过指标 "${indicator.name}"？\n\n审核通过后，指标将变为已下发状态。`,
      '审核通过',
      {
        confirmButtonText: '确认通过',
        cancelButtonText: '取消',
        type: 'success'
      }
    )
      .then(async () => {
        const loading = ElLoading.service({
          lock: true,
          text: '正在审核...',
          background: 'rgba(0, 0, 0, 0.7)'
        })

        try {
          await indicatorApi.approveIndicatorReview(indicatorId)
          ElMessage.success('审核通过')

          // 重新加载指标数据
          await strategicStore.loadIndicatorsByYear(timeContext.currentYear)
          updateEditTime()
        } catch (error) {
          logger.error('审核通过失败:', error)
          ElMessage.error('审核通过失败，请重试')
        } finally {
          loading.close()
        }
      })
      .catch(() => {
        // 用户取消操作
      })
  } catch (error) {
    logger.error('审核通过失败:', error)
    ElMessage.error('审核通过失败')
  }
}

// 驳回指标定义审核
const rejectIndicatorReview = async (indicatorId: string) => {
  try {
    const indicator = indicators.value.find(i => i.id.toString() === indicatorId)
    if (!indicator) {
      ElMessage.error('找不到指标')
      return
    }

    // 使用 ElMessageBox.prompt 收集驳回原因
    ElMessageBox.prompt(`请输入驳回指标 "${indicator.name}" 的原因：`, '审核驳回', {
      confirmButtonText: '确认驳回',
      cancelButtonText: '取消',
      inputType: 'textarea',
      inputPlaceholder: '请输入驳回原因（必填）',
      inputValidator: value => {
        if (!value || !value.trim()) {
          return '驳回原因不能为空'
        }
        return true
      }
    })
      .then(async ({ value: reason }) => {
        const loading = ElLoading.service({
          lock: true,
          text: '正在驳回...',
          background: 'rgba(0, 0, 0, 0.7)'
        })

        try {
          await indicatorApi.rejectIndicatorReview(indicatorId, reason)
          ElMessage.info('已驳回审核')

          // 重新加载指标数据
          await strategicStore.loadIndicatorsByYear(timeContext.currentYear)
          updateEditTime()
        } catch (error) {
          logger.error('驳回审核失败:', error)
          ElMessage.error('驳回审核失败，请重试')
        } finally {
          loading.close()
        }
      })
      .catch(() => {
        // 用户取消操作
      })
  } catch (error) {
    logger.error('驳回审核失败:', error)
    ElMessage.error('驳回审核失败')
  }
}

// 打开下发弹窗
const _openDistributeDialog = (row: StrategicIndicator) => {
  currentDistributeItem.value = row
  // 默认选中左侧当前选择的部门
  distributeTarget.value = selectedDepartment.value ? [selectedDepartment.value] : []
  distributeDialogVisible.value = true
}

// 确认下发（支持单个和整体下发）
const confirmDistribute = () => {
  if (distributeTarget.value.length === 0) {
    ElMessage.warning('请选择下发目标部门')
    return
  }

  const targetDepts = distributeTarget.value.join('、')

  // 整体下发模式
  if (currentDistributeGroup.value) {
    const pendingRows = currentDistributeGroup.value.rows.filter(r => r.canWithdraw)
    ElMessageBox.confirm(
      `确认将任务 "${currentDistributeGroup.value.taskContent}" 下的 ${pendingRows.length} 个指标下发到以下部门？\n\n${targetDepts}`,
      '整体下发确认',
      {
        confirmButtonText: '确认下发',
        cancelButtonText: '取消',
        type: 'info'
      }
    )
      .then(async () => {
        try {
          // 为每个目标部门创建指标副本
          for (const row of pendingRows) {
            // 构建审计记录
            const newAuditEntry = {
              id: `audit-${row.id}-${Date.now()}`,
              operator: authStore.user?.id || 'admin',
              operatorName: authStore.user?.name || '管理员',
              operatorDept:
                authStore.effectiveDepartment || authStore.userDepartment || '战略发展部',
              action: 'distribute' as const,
              comment: `下发到 ${distributeTarget.value.join('、')}`,
              timestamp: new Date()
            }

            // 将新的审计记录添加到现有记录中
            const updatedStatusAudit = [...(row.statusAudit || []), newAuditEntry]

            // 更新原指标状态
            await strategicStore.updateIndicator(row.id.toString(), {
              canWithdraw: false,
              status: 'distributed',
              statusAudit: updatedStatusAudit
            })

            // 为每个额外的目标部门创建副本（第一个部门使用原指标）
            for (const [index, dept] of distributeTarget.value.entries()) {
              if (index === 0) {
                // 第一个部门更新原指标的责任部门（ownerDept 保持为战略发展部）
                await strategicStore.updateIndicator(row.id.toString(), {
                  responsibleDept: dept
                })
              } else {
                // 其他部门创建新的指标副本（ownerDept 保持为战略发展部）
                strategicStore.addIndicator({
                  ...row,
                  id: `${Date.now()}-${index}-${row.id}`,
                  responsibleDept: dept,
                  ownerDept: '战略发展部',
                  canWithdraw: false,
                  status: 'distributed',
                  progress: 0,
                  statusAudit: [newAuditEntry]
                })
              }
            }
          }
          ElMessage.success(
            `已成功下发 ${pendingRows.length} 个指标到 ${distributeTarget.value.length} 个部门`
          )
          closeDistributeDialog()
          // 重新加载数据以确保前端状态与后端一致
          await strategicStore.loadIndicatorsByYear(timeContext.currentYear)
          updateEditTime()
        } catch (error) {
          logger.error('Failed to distribute indicators:', error)
          ElMessage.error('下发失败，请稍后重试')
        }
      })
      .catch(() => {
        // 用户取消操作
      })
    return
  }

  // 单个下发模式
  if (!currentDistributeItem.value) {
    return
  }

  ElMessageBox.confirm(
    `确认将指标 "${currentDistributeItem.value.name}" 下发到以下部门？\n\n${targetDepts}`,
    '下发确认',
    {
      confirmButtonText: '确认下发',
      cancelButtonText: '取消',
      type: 'info'
    }
  )
    .then(async () => {
      try {
        const row = currentDistributeItem.value
        if (!row) {
          return
        }

        // 构建审计记录
        const newAuditEntry = {
          id: `audit-${row.id}-${Date.now()}`,
          operator: authStore.user?.id || 'admin',
          operatorName: authStore.user?.name || '管理员',
          operatorDept: authStore.effectiveDepartment || authStore.userDepartment || '战略发展部',
          action: 'distribute' as const,
          comment: `下发到 ${distributeTarget.value.join('、')}`,
          timestamp: new Date()
        }

        // 将新的审计记录添加到现有记录中
        const updatedStatusAudit = [...(row.statusAudit || []), newAuditEntry]

        // 更新原指标状态
        await strategicStore.updateIndicator(row.id.toString(), {
          canWithdraw: false,
          status: 'distributed',
          statusAudit: updatedStatusAudit
        })

        // 为每个目标部门处理
        for (const [index, dept] of distributeTarget.value.entries()) {
          if (index === 0) {
            // 第一个部门更新原指标的责任部门（ownerDept 保持为战略发展部）
            await strategicStore.updateIndicator(row.id.toString(), {
              responsibleDept: dept
            })
          } else {
            // 其他部门创建新的指标副本（ownerDept 保持为战略发展部）
            strategicStore.addIndicator({
              ...row,
              id: `${Date.now()}-${index}-${row.id}`,
              responsibleDept: dept,
              ownerDept: '战略发展部',
              canWithdraw: false,
              status: 'distributed',
              progress: 0,
              statusAudit: [newAuditEntry]
            })
          }
        }
        ElMessage.success(`指标已成功下发到 ${distributeTarget.value.length} 个部门`)
        closeDistributeDialog()
        // 重新加载数据以确保前端状态与后端一致
        await strategicStore.loadIndicatorsByYear(timeContext.currentYear)
        updateEditTime()
      } catch (error) {
        logger.error('Failed to distribute indicator:', error)
        ElMessage.error('下发失败，请稍后重试')
      }
    })
    .catch(() => {
      // 用户取消操作
    })
}

// 关闭下发弹窗
const closeDistributeDialog = () => {
  distributeDialogVisible.value = false
  currentDistributeItem.value = null
  currentDistributeGroup.value = null
  distributeTarget.value = []
}

// 单个撤回
const _handleWithdraw = async (row: StrategicIndicator) => {
  ElMessageBox.confirm(`撤回后，该指标将重新变为可下发状态。确认撤回 "${row.name}"？`, '撤回操作', {
    confirmButtonText: '确认撤回',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(async () => {
      try {
        await strategicStore.updateIndicator(row.id.toString(), { canWithdraw: true })
        // 重新从后端加载数据，确保前端状态与后端一致
        await strategicStore.loadIndicatorsByYear(timeContext.currentYear)
        ElMessage.info('指标已撤回')
        updateEditTime()
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '未知错误'
        ElMessage.error({
          message: `撤回失败: ${errorMsg}`,
          duration: 5000,
          showClose: true
        })
        logger.error('Withdraw failed:', err)
        // 重新加载数据以回滚本地状态
        await strategicStore.loadIndicatorsByYear(timeContext.currentYear)
      }
    })
    .catch(() => {
      // 用户取消操作
    })
}

// 全部下发（下发当前界面所有未下发的指标）
const handleDistributeAll = async () => {
  // 检查是否有待审批的进度
  if (pendingApprovalCount.value > 0) {
    ElMessage.warning(`有 ${pendingApprovalCount.value} 个指标有待审批的进度，请先完成审批后再下发`)
    return
  }

  // 验证权重总和是否为100%
  if (departmentTotalWeight.value !== 100) {
    ElMessage.warning(`权重总和必须为100%，当前为${departmentTotalWeight.value}`)
    return
  }

  // 基于生命周期状态判断可下发的指标
  const pendingRows = indicators.value.filter(r => {
    if (!r.name) {
      return false
    } // 只下发有核心指标的记录
    // 草稿或待审核状态的指标可以下发（使用大写枚举值）
    return !r.status || r.status === IndicatorStatus.DRAFT || r.status === IndicatorStatus.PENDING
  })

  if (pendingRows.length === 0) {
    ElMessage.warning('当前没有待下发的指标')
    return
  }

  ElMessageBox.confirm(
    `确认下发当前部门的全部 ${pendingRows.length} 个待下发指标？`,
    '全部下发确认',
    {
      confirmButtonText: '确认下发',
      cancelButtonText: '取消',
      type: 'info'
    }
  )
    .then(async () => {
      // 显示加载状态
      const loading = ElMessage({
        message: '正在下发指标...',
        type: 'info',
        duration: 0
      })

      try {
        // 更新所有指标状态为已下发
        await Promise.all(
          pendingRows.map(row => {
            // 构建审计记录
            const newAuditEntry = {
              id: `audit-${row.id}-${Date.now()}`,
              operator: authStore.user?.id || 'admin',
              operatorName: authStore.user?.name || '管理员',
              operatorDept:
                authStore.effectiveDepartment || authStore.userDepartment || '战略发展部',
              action: 'distribute' as const,
              comment: '批量下发',
              timestamp: new Date()
            }

            // 将新的审计记录添加到现有记录中
            const updatedStatusAudit = [...(row.statusAudit || []), newAuditEntry]

            return strategicStore.updateIndicator(row.id.toString(), {
              status: 'distributed',
              statusAudit: updatedStatusAudit
            })
          })
        )

        // 重新从后端加载数据，确保前端状态与后端一致
        await strategicStore.loadIndicatorsByYear(timeContext.currentYear)

        loading.close()
        ElMessage.success({
          message: `已成功下发 ${pendingRows.length} 个指标`,
          duration: 5000,
          showClose: true
        })
        updateEditTime()
      } catch (err) {
        loading.close()
        const errorMsg = err instanceof Error ? err.message : '未知错误'
        ElMessage.error({
          message: `下发失败: ${errorMsg}`,
          duration: 5000,
          showClose: true
        })
        logger.error('Distribute all failed:', err)
        // 重新加载数据以回滚本地状态
        await strategicStore.loadIndicatorsByYear(timeContext.currentYear)
      }
    })
    .catch(() => {
      // 用户取消操作
    })
}

// 全部撤回（撤回当前界面所有已下发的指标）
const handleWithdrawAll = async () => {
  // 基于 statusAudit 判断已下发状态
  const distributedRows = indicators.value.filter(r => {
    const audit = r.statusAudit || []
    if (audit.length === 0) {
      return false
    } // 无审计记录 = 草稿状态 = 未下发
    const lastAudit = audit[audit.length - 1]
    const lastAction = lastAudit?.action
    // 已下发状态：最后一次操作是 distribute（下发）或 reject（打回）或 approve（审批通过）
    return (
      lastAction === 'distribute' ||
      lastAction === 'reject' ||
      lastAction === 'approve' ||
      lastAction === 'submit'
    )
  })

  if (distributedRows.length === 0) {
    ElMessage.warning('当前没有已下发的指标')
    return
  }

  ElMessageBox.confirm(
    `确认撤回当前部门的全部 ${distributedRows.length} 个已下发指标？`,
    '全部撤回确认',
    {
      confirmButtonText: '确认撤回',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )
    .then(async () => {
      // 显示加载状态
      const loading = ElMessage({
        message: '正在撤回指标...',
        type: 'info',
        duration: 0
      })

      try {
        // 1. 先调用后端 API 更新所有指标（添加审计记录）
        await Promise.all(
          distributedRows.map(row => {
            // 构建审计记录
            const newAuditEntry = {
              id: `audit-${row.id}-${Date.now()}`,
              operator: authStore.user?.id || 'admin',
              operatorName: authStore.user?.name || '管理员',
              operatorDept:
                authStore.effectiveDepartment || authStore.userDepartment || '战略发展部',
              action: 'withdraw' as const,
              comment: '批量撤回',
              timestamp: new Date()
            }

            // 将新的审计记录添加到现有记录中
            const updatedStatusAudit = [...(row.statusAudit || []), newAuditEntry]

            return strategicStore.updateIndicator(row.id.toString(), {
              canWithdraw: true,
              status: 'draft',
              statusAudit: updatedStatusAudit
            })
          })
        )

        // 2. 重新从后端加载数据，确保前端状态与后端一致
        await strategicStore.loadIndicatorsByYear(timeContext.currentYear)

        loading.close()
        ElMessage.success(`已成功撤回 ${distributedRows.length} 个指标`)
        updateEditTime()
      } catch (err) {
        loading.close()
        const errorMsg = err instanceof Error ? err.message : '未知错误'
        ElMessage.error({
          message: `撤回失败: ${errorMsg}`,
          duration: 5000,
          showClose: true
        })
        logger.error('Withdraw failed:', err)
        // 重新加载数据以回滚本地状态
        await strategicStore.loadIndicatorsByYear(timeContext.currentYear)
      }
    })
    .catch(() => {
      // 用户取消操作
    })
}

// 按任务整体下发（复用下发弹窗）
const _handleBatchDistributeByTask = (group: {
  taskContent: string
  rows: StrategicIndicator[]
}) => {
  const pendingRows = group.rows.filter(r => r.canWithdraw)
  if (pendingRows.length === 0) {
    ElMessage.warning('该任务下所有指标已下发')
    return
  }

  currentDistributeGroup.value = group
  currentDistributeItem.value = null
  distributeTarget.value = selectedDepartment.value ? [selectedDepartment.value] : []
  distributeDialogVisible.value = true
}

// 按任务整体撤回
const _handleBatchWithdrawByTask = async (group: {
  taskContent: string
  rows: StrategicIndicator[]
}) => {
  const distributedRows = group.rows.filter(r => !r.canWithdraw)
  if (distributedRows.length === 0) {
    ElMessage.warning('该任务下没有已下发的指标')
    return
  }

  ElMessageBox.confirm(
    `确认撤回任务 "${group.taskContent}" 下的 ${distributedRows.length} 个已下发指标？`,
    '批量撤回确认',
    {
      confirmButtonText: '确认撤回',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )
    .then(async () => {
      // 显示加载状态
      const loading = ElMessage({
        message: '正在撤回指标...',
        type: 'info',
        duration: 0
      })

      try {
        // 1. 先调用后端 API 更新所有指标
        await Promise.all(
          distributedRows.map(row =>
            strategicStore.updateIndicator(row.id.toString(), { canWithdraw: false })
          )
        )

        // 2. 重新从后端加载数据，确保前端状态与后端一致
        await strategicStore.loadIndicatorsByYear(timeContext.currentYear)

        loading.close()
        ElMessage.success(`已成功撤回 ${distributedRows.length} 个指标`)
        updateEditTime()
      } catch (err) {
        loading.close()
        const errorMsg = err instanceof Error ? err.message : '未知错误'
        ElMessage.error({
          message: `撤回失败: ${errorMsg}`,
          duration: 5000,
          showClose: true
        })
        logger.error('Batch withdraw failed:', err)
        // 重新加载数据以回滚本地状态
        await strategicStore.loadIndicatorsByYear(timeContext.currentYear)
      }
    })
    .catch(() => {
      // 用户取消操作
    })
}

// 按任务整体删除
const _handleBatchDeleteByTask = (group: { taskContent: string; rows: StrategicIndicator[] }) => {
  if (group.rows.length === 0) {
    ElMessage.warning('该任务下没有指标')
    return
  }

  ElMessageBox.confirm(
    `确定要删除任务 "${group.taskContent}" 下的全部 ${group.rows.length} 个指标吗？删除后无法恢复。`,
    '批量删除确认',
    {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )
    .then(() => {
      group.rows.forEach(row => {
        strategicStore.deleteIndicator(row.id.toString())
      })
      ElMessage.success(`已成功删除 ${group.rows.length} 个指标`)
      updateEditTime()
    })
    .catch(() => {
      // 用户取消操作
    })
}

// 删除单个指标
const handleDeleteIndicator = (row: StrategicIndicator) => {
  ElMessageBox.confirm(`确定要删除指标 "${row.name}" 吗？删除后无法恢复。`, '删除确认', {
    confirmButtonText: '确定删除',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => {
      strategicStore.deleteIndicator(row.id.toString())
      ElMessage.success('指标已删除')
      updateEditTime()
    })
    .catch(() => {
      // 用户取消操作
    })
}

// ================== 审批流程相关 ==================

/**
 * 获取待审批计划数量
 */
const pendingPlanApprovalCount = ref(0)

/**
 * 加载待审批计划数量
 */
const loadPendingPlanApprovalCount = async () => {
  try {
    const userId = authStore.user?.id || 1
    const response = await approvalApi.countPendingApprovals(userId)
    if (response.success && response.data !== undefined) {
      pendingPlanApprovalCount.value = response.data
    }
  } catch (error) {
    logger.error('[StrategicTaskView] 加载待审批计划数量失败:', error)
  }
}

/**
 * 打开计划审批抽屉（新功能）
 */
const planApprovalVisible = ref(false)

const _handleOpenPlanApproval = () => {
  planApprovalVisible.value = true
}

// 组件挂载时加载待审批计划数量
onMounted(() => {
  loadPendingPlanApprovalCount()
})

// 任务类别颜色映射
const getCategoryColor = (type2: string) => {
  return type2 === '发展性' ? '#409EFF' : '#67C23A'
}

// 表格滚动状态
const _tableScrollRef = ref<HTMLElement | null>(null)
const isTableScrolling = ref(false)

// 监听表格滚动，判断是否需要显示操作列的固定效果
const _handleTableScroll = (e: Event) => {
  const target = e.target as HTMLElement
  const scrollLeft = target.scrollLeft
  const scrollWidth = target.scrollWidth
  const clientWidth = target.clientWidth
  // 当滚动到最右侧时（允许2px误差），隐藏固定效果
  isTableScrolling.value = scrollLeft < scrollWidth - clientWidth - 2
}

// 进度条颜色计算
// 未下发：灰色 | 任务周期内未达标：黄色 | 超过任务周期未达标：红色 | 任务周期内已达标：绿色
// 使用统一的进度条颜色规则 (Requirements: 10.2)
const getProgressColor = (row: StrategicIndicator): string => {
  // 未下发的进度条为灰色
  if (row.canWithdraw) {
    return 'var(--text-placeholder)' // 使用CSS变量 #C0C4CC
  }

  const progress = row.progress || 0
  const targetValue = row.targetValue || 100
  const isAchieved = progress >= targetValue

  // 检查是否有里程碑及其截止日期
  const _currentDate = new Date()
  let isOverdue = false

  if (row.milestones && row.milestones.length > 0) {
    // 检查最后一个里程碑的截止日期
    const lastMilestone = row.milestones[row.milestones.length - 1]
    if (lastMilestone.deadline) {
      const deadlineDate = new Date(lastMilestone.deadline)
      isOverdue = currentDate > deadlineDate
    }
  }

  if (isAchieved) {
    return 'var(--color-success)' // 绿色：已达标
  } else if (isOverdue) {
    return 'var(--color-danger)' // 红色：超过任务周期未达标
  } else {
    return 'var(--color-warning)' // 黄色：任务周期内未达标
  }
}

// 获取进度状态 - 使用统一的进度条颜色规则 (Requirements: 10.2)
// 规则: progress >= 80: success, 50 <= progress < 80: warning, progress < 50: exception
const getProgressStatus = (progress: number): 'success' | 'warning' | 'exception' => {
  if (progress >= 80) {
    return 'success'
  }
  if (progress >= 50) {
    return 'warning'
  }
  return 'exception'
}
</script>

<template>
  <div class="strategic-task-container page-fade-enter">
    <!-- 侧边栏遮罩层 -->
    <div class="sidebar-backdrop"></div>

    <!-- 左侧任务列表 - 动态隐藏 -->
    <aside class="task-sidebar">
      <div class="sidebar-header">
        <div class="task-list-title">部门列表</div>
      </div>

      <ul class="task-list">
        <li
          v-for="dept in functionalDepartments"
          :key="dept"
          :class="['task-item', { active: selectedDepartment === dept }]"
          @click="selectDepartment(dept)"
        >
          {{ dept }}
        </li>
      </ul>
    </aside>
    <!-- 展开箭头独立于侧边栏 - 使用SVG图标 -->
    <div class="sidebar-toggle">
      <svg class="toggle-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M9 6L15 12L9 18"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          fill="none"
        />
      </svg>
      <span class="toggle-hint">{{ selectedDepartment || '全部' }}</span>
    </div>

    <!-- 右侧详情区域 - Excel风格 -->
    <section class="task-detail excel-style card-animate" style="animation-delay: 0.1s">
      <!-- Excel标题头 -->
      <div class="excel-header">
        <h2 class="excel-title">战略任务指标总表</h2>
      </div>

      <!-- Excel工具栏 -->
      <div class="excel-toolbar">
        <div class="toolbar-left">
          <el-button
            type="primary"
            size="small"
            :disabled="isReadOnly || hasDistributedIndicators"
            @click.stop="addNewRow"
          >
            <el-icon><Plus /></el-icon>
            新增行
          </el-button>
          <!-- 下发/撤回合并按钮 -->
          <el-button
            :type="hasDistributedIndicators ? 'warning' : 'success'"
            size="small"
            :disabled="isReadOnly"
            @click.stop="hasDistributedIndicators ? handleWithdrawAll() : handleDistributeAll()"
          >
            <el-icon
              ><component :is="hasDistributedIndicators ? RefreshLeft : Promotion"
            /></el-icon>
            {{ hasDistributedIndicators ? '撤回' : '下发' }}
          </el-button>
          <!-- 审批进度按钮（带徽章） -->
          <el-badge
            v-if="pendingApprovalCount > 0"
            :value="pendingApprovalCount"
            class="approval-badge"
          >
            <el-button size="small" type="warning" @click="handleOpenApproval">
              <el-icon><Check /></el-icon>
              审批进度
            </el-button>
          </el-badge>
          <el-button v-else size="small" @click="handleOpenApproval">
            <el-icon><Check /></el-icon>
            审批进度
          </el-button>
          <el-button size="small">
            <el-icon><Download /></el-icon>
            导出
          </el-button>
          <!-- 视图切换按钮 -->
          <el-button-group style="margin-left: 16px">
            <el-button
              :type="viewMode === 'table' ? 'primary' : ''"
              size="small"
              @click="viewMode = 'table'"
            >
              <el-icon><View /></el-icon>
              表格视图
            </el-button>
            <el-button
              :type="viewMode === 'card' ? 'primary' : ''"
              size="small"
              @click="viewMode = 'card'"
            >
              <el-icon><View /></el-icon>
              卡片视图
            </el-button>
          </el-button-group>
        </div>
        <div class="toolbar-right">
          <el-tag :type="overallStatus.type" size="small" style="margin-right: 12px">
            状态: {{ overallStatus.label }}
          </el-tag>
          <el-tag
            :type="departmentTotalWeight === 100 ? 'success' : 'danger'"
            size="small"
            style="margin-right: 12px"
          >
            权重合计: {{ departmentTotalWeight }} / 100
          </el-tag>
          <el-tag v-if="isReadOnly" type="warning" size="small" style="margin-right: 12px">
            历史快照 (只读)
          </el-tag>
          <span class="update-time">更新时间: {{ new Date().toLocaleString() }}</span>
        </div>
      </div>

      <!-- 待审批进度警告提示 -->
      <el-alert
        v-if="pendingApprovalCount > 0 && !hasDistributedIndicators"
        type="warning"
        :closable="false"
        style="margin: 12px 16px"
      >
        <template #title>
          有 {{ pendingApprovalCount }} 个指标有待审批的进度，请先完成审批后再下发
        </template>
      </el-alert>

      <!-- Excel表格 -->
      <div class="excel-table-wrapper">
        <!-- 表格视图 -->
        <div v-if="viewMode === 'table'" class="table-container">
          <el-table
            ref="tableRef"
            :data="indicators"
            :span-method="getSpanMethod"
            border
            highlight-current-row
            class="unified-table"
            @selection-change="handleSelectionChange"
          >
            <el-table-column prop="taskContent" label="战略任务" width="180">
              <template #default="{ row }">
                <div class="task-cell-wrapper">
                  <div
                    class="indicator-name-cell"
                    @dblclick="handleIndicatorDblClick(row, 'taskContent')"
                  >
                    <el-input
                      v-if="
                        editingIndicatorId === row.id && editingIndicatorField === 'taskContent'
                      "
                      v-model="editingIndicatorValue"
                      v-focus
                      type="textarea"
                      :autosize="{ minRows: 2, maxRows: 6 }"
                      @blur="saveIndicatorEdit(row, 'taskContent')"
                      @keyup.esc="cancelIndicatorEdit"
                    />
                    <el-tooltip
                      v-else
                      :content="row.type2 === '发展性' ? '发展性任务' : '基础性任务'"
                      placement="top"
                    >
                      <span
                        class="indicator-name-text task-content-colored"
                        :style="{ color: row.type2 === '发展性' ? '#409EFF' : '#67C23A' }"
                        >{{ row.taskContent || '未关联任务' }}</span
                      >
                    </el-tooltip>
                  </div>

                  <!-- 右下角新增指标三角形按钮 -->
                  <div
                    v-if="!isReadOnly && getTaskStatus(row).canWithdraw"
                    class="add-indicator-trigger"
                    @click="handleAddIndicatorToTask(row)"
                  >
                    <span class="trigger-icon">+</span>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="name" label="核心指标" min-width="150">
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
                  <template v-else>
                    <template v-if="row.name">
                      <el-tooltip
                        :content="
                          row.type1 === '定性'
                            ? '定性指标'
                            : row.type1 === '定量'
                              ? '定量指标'
                              : '未设置类型'
                        "
                        placement="top"
                      >
                        <span
                          class="indicator-name-text"
                          :class="
                            row.type1 === '定性'
                              ? 'indicator-qualitative'
                              : row.type1 === '定量'
                                ? 'indicator-quantitative'
                                : ''
                          "
                          >{{ row.name }}</span
                        >
                      </el-tooltip>
                    </template>
                    <span v-else class="indicator-name-text placeholder-text">双击编辑指标</span>
                  </template>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="remark" label="备注" width="130">
              <template #default="{ row }">
                <div class="indicator-name-cell" @dblclick="handleIndicatorDblClick(row, 'remark')">
                  <el-input
                    v-if="editingIndicatorId === row.id && editingIndicatorField === 'remark'"
                    v-model="editingIndicatorValue"
                    v-focus
                    type="textarea"
                    :autosize="{ minRows: 2, maxRows: 6 }"
                    @blur="saveIndicatorEdit(row, 'remark')"
                    @keyup.esc="cancelIndicatorEdit"
                  />
                  <span v-else class="indicator-name-text remark-text-wrap">{{
                    row.remark || '样例：双击编辑说明'
                  }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="weight" label="权重" width="100" align="center">
              <template #default="{ row }">
                <div class="weight-cell" @dblclick="handleIndicatorDblClick(row, 'weight')">
                  <el-input
                    v-if="editingIndicatorId === row.id && editingIndicatorField === 'weight'"
                    v-model="editingIndicatorValue"
                    v-focus
                    size="small"
                    style="width: 50px"
                    @blur="saveIndicatorEdit(row, 'weight')"
                    @keyup.enter="saveIndicatorEdit(row, 'weight')"
                  />
                  <span v-else class="weight-text">{{ row.weight }}</span>
                </div>
              </template>
            </el-table-column>
            <!-- 目标进度列 -->
            <el-table-column label="里程碑" width="120" align="center">
              <template #default="{ row, $index }">
                <el-popover
                  placement="left"
                  :width="320"
                  trigger="hover"
                  :disabled="isMilestoneLoading(row.id) || !row.milestones?.length"
                >
                  <template #reference>
                    <div
                      class="milestone-cell"
                      :class="{ editable: canEditIndicators }"
                      @dblclick="handleEditMilestonesByIndex($index)"
                    >
                      <span class="milestone-count">
                        {{
                          isMilestoneLoading(row.id)
                            ? '加载中...'
                            : row.milestones?.length
                              ? `${row.milestones.length} 个里程碑`
                              : '未设置'
                        }}
                      </span>
                    </div>
                  </template>
                  <div class="milestone-popover">
                    <div class="milestone-popover-title">里程碑列表</div>
                    <div
                      v-for="(ms, idx) in getMilestonesTooltip(row)"
                      :key="ms.id"
                      class="milestone-item"
                      :class="{ 'milestone-completed': (row.progress || 0) >= ms.progress }"
                    >
                      <div class="milestone-item-header">
                        <span class="milestone-index">{{ idx + 1 }}.</span>
                        <span class="milestone-name">{{ ms.name || '未命名' }}</span>
                        <el-icon
                          v-if="(row.progress || 0) >= ms.progress"
                          class="milestone-check-icon"
                        >
                          <Check />
                        </el-icon>
                      </div>
                      <div class="milestone-item-info">
                        <span>预期: {{ ms.expectedDate || '未设置' }}</span>
                        <span>进度: {{ ms.progress }}%</span>
                      </div>
                    </div>
                    <div v-if="!row.milestones?.length" class="milestone-empty">暂无里程碑</div>
                  </div>
                </el-popover>
              </template>
            </el-table-column>
            <el-table-column prop="progress" label="进度" width="120" align="center">
              <template #default="{ row }">
                <div class="progress-cell" @dblclick="handleIndicatorDblClick(row, 'progress')">
                  <el-input
                    v-if="editingIndicatorId === row.id && editingIndicatorField === 'progress'"
                    v-model="editingIndicatorValue"
                    v-focus
                    size="small"
                    style="width: 50px"
                    @blur="saveIndicatorEdit(row, 'progress')"
                    @keyup.enter="saveIndicatorEdit(row, 'progress')"
                  />
                  <!-- 始终显示已审批通过的进度（progress），不显示待审批进度 -->
                  <span v-else class="progress-number">{{ row.progress || 0 }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="180" align="center">
              <template #default="{ row }">
                <div class="action-buttons-inline">
                  <!-- 审核通过按钮 - 待审核状态且是战略发展部 -->
                  <el-button
                    v-if="row.status === IndicatorStatus.PENDING_REVIEW && isStrategicDept"
                    link
                    type="success"
                    size="small"
                    @click="approveIndicatorReview(row.id.toString())"
                  >
                    审核通过
                  </el-button>

                  <!-- 审核驳回按钮 - 待审核状态且是战略发展部 -->
                  <el-button
                    v-if="row.status === IndicatorStatus.PENDING_REVIEW && isStrategicDept"
                    link
                    type="warning"
                    size="small"
                    @click="rejectIndicatorReview(row.id.toString())"
                  >
                    审核驳回
                  </el-button>

                  <!-- 查看按钮 - 始终显示 -->
                  <el-button link type="primary" size="small" @click="handleViewDetail(row)"
                    >查看</el-button
                  >

                  <!-- 删除按钮 - 仅草稿状态可删除 -->
                  <el-button
                    v-if="canDeleteIndicator(row)"
                    link
                    type="danger"
                    size="small"
                    @click="handleDeleteIndicator(row)"
                    >删除</el-button
                  >
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- 卡片视图 -->
        <div v-else-if="viewMode === 'card'" class="card-container">
          <!-- 卡片导航栏 -->
          <div v-if="indicators.length > 0" class="card-navigation">
            <div class="nav-left">
              <el-button
                :disabled="currentIndicatorIndex === 0"
                size="small"
                @click="goToPrevIndicator"
              >
                <el-icon><ArrowDown style="transform: rotate(90deg)" /></el-icon>
                上一个
              </el-button>
              <span class="nav-info">
                {{ currentIndicatorIndex + 1 }} / {{ indicators.length }}
              </span>
              <el-button
                :disabled="currentIndicatorIndex === indicators.length - 1"
                size="small"
                @click="goToNextIndicator"
              >
                下一个
                <el-icon><ArrowDown style="transform: rotate(-90deg)" /></el-icon>
              </el-button>
            </div>
            <div class="nav-right">
              <el-select
                v-model="currentIndicatorIndex"
                placeholder="快速跳转"
                size="small"
                style="width: 200px"
              >
                <el-option
                  v-for="(indicator, index) in indicators"
                  :key="indicator.id"
                  :label="`${index + 1}. ${indicator.name || '未命名指标'}`"
                  :value="index"
                />
              </el-select>
            </div>
          </div>

          <!-- 指标卡片 -->
          <div v-if="currentIndicator" class="indicator-card">
            <!-- 卡片头部 -->
            <div class="card-header">
              <div class="card-title-section">
                <h3 class="card-title">{{ currentIndicator.name || '未命名指标' }}</h3>
                <div class="card-tags">
                  <el-tag
                    size="small"
                    :class="
                      currentIndicator.type1 === '定性' ? 'tag-qualitative' : 'tag-quantitative'
                    "
                  >
                    {{ currentIndicator.type1 }}
                  </el-tag>
                  <el-tag
                    size="small"
                    :style="{
                      backgroundColor: getCategoryColor(currentIndicator.type2),
                      color: '#fff',
                      border: 'none'
                    }"
                  >
                    {{ currentIndicator.type2 }}任务
                  </el-tag>
                  <!-- 进度审批状态标签 -->
                  <el-tag
                    v-if="currentIndicator.progressApprovalStatus === 'PENDING'"
                    type="warning"
                    size="small"
                  >
                    待审批
                  </el-tag>
                  <el-tag
                    v-else-if="currentIndicator.progressApprovalStatus === 'REJECTED'"
                    type="danger"
                    size="small"
                  >
                    已驳回
                  </el-tag>
                </div>
              </div>
              <div class="card-actions">
                <el-button type="primary" size="small" @click="handleViewDetail(currentIndicator)">
                  <el-icon><View /></el-icon>
                  详情
                </el-button>
                <el-button
                  v-if="currentIndicator.canWithdraw && !isReadOnly"
                  type="danger"
                  size="small"
                  @click="handleDeleteIndicator(currentIndicator)"
                >
                  <el-icon><Delete /></el-icon>
                  删除
                </el-button>
              </div>
            </div>

            <!-- 卡片内容 -->
            <div class="card-content">
              <!-- 基础信息 -->
              <div class="info-section">
                <h4 class="section-title">基础信息</h4>
                <div class="info-grid">
                  <div class="info-item">
                    <span class="info-label">战略任务：</span>
                    <span class="info-value">{{
                      currentIndicator.taskContent || '未关联任务'
                    }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">权重：</span>
                    <span class="info-value">{{ currentIndicator.weight }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">责任部门：</span>
                    <span class="info-value">{{ currentIndicator.responsibleDept }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">责任人：</span>
                    <span class="info-value">{{ currentIndicator.responsiblePerson }}</span>
                  </div>
                  <div class="info-item full-width">
                    <span class="info-label">备注：</span>
                    <span class="info-value">{{ currentIndicator.remark || '无备注' }}</span>
                  </div>
                </div>
              </div>

              <!-- 进度信息 -->
              <div class="progress-section">
                <h4 class="section-title">进度信息</h4>
                <div class="progress-display">
                  <div class="progress-main">
                    <div class="progress-text">
                      <span class="current-progress">{{ currentIndicator.progress || 0 }}%</span>
                      <span class="progress-label">当前进度</span>
                    </div>
                    <el-progress
                      :percentage="currentIndicator.progress || 0"
                      :stroke-width="12"
                      :color="getProgressColor(currentIndicator)"
                      class="progress-bar"
                    />
                  </div>
                  <!-- 待审批进度显示 -->
                  <div
                    v-if="currentIndicator.pendingProgress !== undefined"
                    class="pending-progress"
                  >
                    <div class="pending-info">
                      <span class="pending-label">申请进度：</span>
                      <span class="pending-value">{{ currentIndicator.pendingProgress }}%</span>
                      <span class="progress-change">
                        ({{
                          currentIndicator.pendingProgress - (currentIndicator.progress || 0) > 0
                            ? '+'
                            : ''
                        }}{{
                          currentIndicator.pendingProgress - (currentIndicator.progress || 0)
                        }}%)
                      </span>
                    </div>
                    <div v-if="currentIndicator.pendingRemark" class="pending-remark">
                      <span class="remark-label">填报备注：</span>
                      <span class="remark-text">{{ currentIndicator.pendingRemark }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 里程碑信息 -->
              <div
                v-if="currentIndicator.milestones && currentIndicator.milestones.length > 0"
                class="milestone-section"
              >
                <h4 class="section-title">里程碑节点</h4>
                <div class="milestone-list">
                  <div
                    v-for="(milestone, index) in currentIndicator.milestones"
                    :key="milestone.id"
                    class="milestone-item-card"
                  >
                    <div class="milestone-header">
                      <span class="milestone-index">{{ index + 1 }}.</span>
                      <span class="milestone-name">{{ milestone.name }}</span>
                      <el-tag
                        size="small"
                        :type="
                          milestone.status === 'completed'
                            ? 'success'
                            : milestone.status === 'overdue'
                              ? 'danger'
                              : 'warning'
                        "
                      >
                        {{
                          milestone.status === 'completed'
                            ? '已完成'
                            : milestone.status === 'overdue'
                              ? '已逾期'
                              : '进行中'
                        }}
                      </el-tag>
                    </div>
                    <div class="milestone-details">
                      <span class="milestone-progress"
                        >目标进度: {{ milestone.targetProgress }}%</span
                      >
                      <span class="milestone-deadline">截止日期: {{ milestone.deadline }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-else class="empty-state">
            <el-empty description="当前部门暂无指标数据" :image-size="120">
              <el-button v-if="!isReadOnly" type="primary" @click="addNewRow">
                <el-icon><Plus /></el-icon>
                新增指标
              </el-button>
            </el-empty>
          </div>
        </div>

        <!-- 新增行表单 -->
        <div v-if="isAddingOrEditing" class="add-row-form">
          <h3 class="form-title">新增任务指标</h3>
          <el-form label-width="80px">
            <el-row :gutter="16">
              <el-col :span="4">
                <el-form-item label="任务类型">
                  <el-select
                    v-model="newRow.type2"
                    style="width: 100%"
                    :disabled="!!taskTypeMap[newRow.taskContent]"
                  >
                    <el-option label="发展性" value="发展性" />
                    <el-option label="基础性" value="基础性" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="战略任务">
                  <el-select
                    ref="taskSelectRef"
                    v-model="newRow.taskContent"
                    filterable
                    allow-create
                    default-first-option
                    placeholder="选择或输入战略任务名称"
                    style="width: 100%"
                    :teleported="false"
                    @change="handleTaskSelect"
                    @visible-change="handleTaskVisibleChange"
                  >
                    <el-option
                      v-for="task in existingTaskNames"
                      :key="task"
                      :label="task"
                      :value="task"
                    />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="4">
                <el-form-item label="指标类型">
                  <el-select
                    v-model="newRow.type1"
                    style="width: 100%"
                    @change="
                      (val: string) => {
                        if (val === '定量') generateMonthlyMilestones()
                      }
                    "
                  >
                    <el-option label="定性" value="定性" />
                    <el-option label="定量" value="定量" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="4">
                <el-form-item label="权重">
                  <el-input-number
                    v-model="newRow.weight"
                    :min="0"
                    placeholder="权重"
                    :controls="false"
                    style="width: 100%"
                  />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="16">
              <el-col :span="24">
                <el-form-item label="核心指标">
                  <el-input
                    v-model="newRow.name"
                    type="textarea"
                    :autosize="{ minRows: 2, maxRows: 10 }"
                    placeholder="设置核心指标内容"
                  />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="16">
              <el-col :span="24">
                <el-form-item label="备注">
                  <el-input
                    v-model="newRow.remark"
                    type="textarea"
                    :autosize="{ minRows: 3, maxRows: 15 }"
                    placeholder="输入指标备注"
                  />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="16">
              <el-col :span="24">
                <el-form-item label="里程碑">
                  <div class="milestone-form-area">
                    <el-button
                      v-if="newRow.type1 === '定性'"
                      size="small"
                      type="primary"
                      plain
                      @click="addMilestone"
                    >
                      <el-icon><Plus /></el-icon> 添加里程碑
                    </el-button>
                    <div v-if="newRow.milestones.length > 0" class="milestone-list">
                      <div
                        v-for="(ms, idx) in newRow.milestones"
                        :key="ms.id"
                        class="milestone-form-item"
                      >
                        <span class="milestone-index">{{ idx + 1 }}.</span>
                        <el-input
                          v-model="ms.name"
                          placeholder="里程碑名称"
                          style="width: 160px"
                          size="small"
                        />
                        <el-input-number
                          v-model="ms.targetProgress"
                          :min="0"
                          :max="100"
                          placeholder="目标进度%"
                          size="small"
                          style="width: 110px"
                        />
                        <el-date-picker
                          v-model="ms.deadline"
                          type="date"
                          placeholder="截止日期"
                          size="small"
                          style="width: 130px"
                          value-format="YYYY-MM-DD"
                        />
                        <el-button type="danger" size="small" text @click="removeMilestone(idx)">
                          <el-icon><Delete /></el-icon>
                        </el-button>
                      </div>
                    </div>
                    <span v-else class="milestone-hint">{{
                      newRow.type1 === '定量'
                        ? '选择定量后自动生成12月里程碑'
                        : '暂无里程碑，点击添加'
                    }}</span>
                  </div>
                </el-form-item>
              </el-col>
            </el-row>
            <el-row>
              <el-col :span="24" style="text-align: right">
                <el-button type="primary" @click="saveNewRow">保存</el-button>
                <el-button @click="cancelAdd">取消</el-button>
              </el-col>
            </el-row>
          </el-form>
        </div>
      </div>

      <!-- Excel状态栏 -->
      <div class="excel-status-bar">
        <div class="status-left">共 {{ indicators.length }} 条记录</div>
        <div class="status-right">最后编辑: {{ lastEditTime }}</div>
      </div>
    </section>

    <!-- 任务下发对话框 -->
    <el-dialog
      v-model="showAssignmentDialog"
      title="任务下发"
      width="600px"
      :before-close="
        () => {
          showAssignmentDialog = false
          assignmentTarget = ''
          assignmentMethod = 'self'
        }
      "
    >
      <div class="assignment-dialog">
        <div class="selected-indicators">
          <h4>选中的指标 ({{ selectedIndicators.length }}项)</h4>
          <ul>
            <li v-for="indicator in selectedIndicators" :key="indicator.id">
              {{ indicator.name }}
            </li>
          </ul>
        </div>

        <el-form :model="{ assignmentMethod, assignmentTarget }" label-width="120px">
          <el-form-item :label="props.selectedRole === '战略发展部' ? '下发方式' : '下发方式'">
            <el-radio-group v-model="assignmentMethod">
              <el-radio v-if="props.selectedRole === '战略发展部'" value="self"
                >职能部门完成</el-radio
              >
              <el-radio v-if="props.selectedRole === '战略发展部'" value="college">
                分解到职能部门
              </el-radio>
              <el-radio
                v-else-if="props.selectedRole === '教务处' || props.selectedRole === '科研处'"
                value="self"
              >
                自己完成
              </el-radio>
              <el-radio
                v-if="props.selectedRole === '教务处' || props.selectedRole === '科研处'"
                value="college"
              >
                下发给学院
              </el-radio>
            </el-radio-group>
          </el-form-item>

          <el-form-item v-if="assignmentMethod === 'college'" label="目标部门">
            <el-select v-model="assignmentTarget" placeholder="选择学院" style="width: 100%">
              <el-option label="计算机学院" value="计算机学院" />
              <el-option label="艺术与科技学院" value="艺术与科技学院" />
            </el-select>
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <el-button @click="handleCancelAssignment"> 取消 </el-button>
        <el-button
          type="primary"
          :disabled="assignmentMethod === 'college' && !assignmentTarget"
          @click="confirmAssignment"
        >
          确认下发
        </el-button>
      </template>
    </el-dialog>

    <!-- 指标详情抽屉 -->
    <el-drawer v-model="detailDrawerVisible" title="指标详情" size="45%">
      <div v-if="currentDetail" class="detail-container">
        <!-- 基础信息 -->
        <div class="detail-header">
          <h3>{{ currentDetail.name }}</h3>
          <div class="detail-tags">
            <el-tag
              size="small"
              :class="currentDetail.type1 === '定性' ? 'tag-qualitative' : 'tag-quantitative'"
              >{{ currentDetail.type1 }}</el-tag
            >
            <el-tag
              size="small"
              :style="{
                backgroundColor: getCategoryColor(currentDetail.type2),
                color: '#fff',
                border: 'none'
              }"
            >
              {{ currentDetail.type2 }}任务
            </el-tag>
          </div>
        </div>

        <el-descriptions :column="2" border class="detail-desc">
          <el-descriptions-item label="战略任务" :span="2">{{
            currentDetail.taskContent
          }}</el-descriptions-item>
          <el-descriptions-item label="任务类别"
            >{{ currentDetail.type2 }}任务</el-descriptions-item
          >
          <el-descriptions-item label="指标类型">{{ currentDetail.type1 }}</el-descriptions-item>
          <el-descriptions-item label="权重">{{ currentDetail.weight }}</el-descriptions-item>
          <el-descriptions-item label="当前进度"
            >{{ currentDetail.progress }}%</el-descriptions-item
          >
          <el-descriptions-item label="责任部门">{{
            currentDetail.responsibleDept
          }}</el-descriptions-item>
          <el-descriptions-item label="责任人">{{
            currentDetail.responsiblePerson
          }}</el-descriptions-item>
          <el-descriptions-item label="创建时间" :span="2">{{
            currentDetail.createTime
          }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{
            currentDetail.remark
          }}</el-descriptions-item>
        </el-descriptions>

        <!-- 里程碑信息 -->
        <div
          v-if="currentDetail.milestones && currentDetail.milestones.length > 0"
          class="milestone-section"
        >
          <div class="divider"></div>
          <h4>里程碑节点</h4>
          <el-timeline style="margin-top: 20px; padding-left: 5px">
            <el-timeline-item
              v-for="(milestone, index) in currentDetail.milestones"
              :key="index"
              :timestamp="milestone.deadline"
              :type="
                milestone.status === 'completed'
                  ? 'success'
                  : milestone.status === 'overdue'
                    ? 'danger'
                    : 'primary'
              "
              placement="top"
            >
              <div class="timeline-card">
                <div class="timeline-header">
                  <span class="action-text">{{ milestone.name }}</span>
                  <el-tag
                    size="small"
                    :type="
                      milestone.status === 'completed'
                        ? 'success'
                        : milestone.status === 'overdue'
                          ? 'danger'
                          : 'warning'
                    "
                  >
                    {{
                      milestone.status === 'completed'
                        ? '已完成'
                        : milestone.status === 'overdue'
                          ? '已逾期'
                          : '进行中'
                    }}
                  </el-tag>
                </div>
                <div class="timeline-comment">目标进度: {{ milestone.targetProgress }}%</div>
              </div>
            </el-timeline-item>
          </el-timeline>
        </div>

        <!-- 审计日志 - 直接显示完整日志 -->
        <div class="audit-log-section">
          <div class="divider"></div>
          <div class="audit-log-header">
            <div class="audit-log-title">
              <el-icon><ChatDotRound /></el-icon>
              <h4>审计日志</h4>
            </div>
            <span
              v-if="currentDetail.statusAudit && currentDetail.statusAudit.length > 0"
              class="log-count"
            >
              共 {{ currentDetail.statusAudit.length }} 条记录
            </span>
          </div>

          <!-- 审计日志时间线 -->
          <div
            v-if="currentDetail.statusAudit && currentDetail.statusAudit.length > 0"
            class="audit-log-timeline"
          >
            <el-timeline>
              <el-timeline-item
                v-for="(log, index) in [...currentDetail.statusAudit].sort(
                  (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                )"
                :key="log.id"
                :timestamp="formatRelativeTime(log.timestamp)"
                :type="getActionConfig(log.action).type"
                :hollow="index !== 0"
                placement="top"
              >
                <div class="log-card">
                  <div class="log-header">
                    <el-tag :type="getActionConfig(log.action).type" size="small" effect="dark">
                      <div style="display: flex; align-items: center; gap: 4px">
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
                  <div
                    v-if="log.previousProgress !== undefined && log.newProgress !== undefined"
                    class="log-progress"
                  >
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

    <!-- 下发弹窗（支持单个和整体下发） -->
    <el-dialog
      v-model="distributeDialogVisible"
      :title="currentDistributeGroup ? '整体下发' : '指标下发'"
      width="500px"
      :close-on-click-modal="false"
    >
      <div class="distribute-dialog">
        <!-- 单个指标下发 -->
        <div v-if="currentDistributeItem" class="indicator-info">
          <p><strong>指标名称：</strong>{{ currentDistributeItem.name }}</p>
          <p><strong>任务类别：</strong>{{ currentDistributeItem.type2 }}任务</p>
          <p><strong>权重：</strong>{{ currentDistributeItem.weight }}</p>
        </div>
        <!-- 整体下发 -->
        <div v-else-if="currentDistributeGroup" class="indicator-info">
          <p><strong>任务名称：</strong>{{ currentDistributeGroup.taskContent }}</p>
          <p>
            <strong>待下发指标数：</strong
            >{{ currentDistributeGroup.rows.filter(r => r.canWithdraw).length }} 个
          </p>
          <div class="indicator-list">
            <p><strong>包含指标：</strong></p>
            <ul>
              <li
                v-for="row in currentDistributeGroup.rows.filter(r => r.canWithdraw)"
                :key="row.id"
              >
                {{ row.name }}
              </li>
            </ul>
          </div>
        </div>
        <el-form label-width="100px" style="margin-top: 20px">
          <el-form-item label="下发目标">
            <el-select
              v-model="distributeTarget"
              multiple
              placeholder="选择下发目标部门（可多选）"
              style="width: 100%"
            >
              <el-option
                v-for="dept in functionalDepartments"
                :key="dept"
                :label="dept"
                :value="dept"
              />
            </el-select>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="closeDistributeDialog">取消</el-button>
        <el-button type="primary" @click="confirmDistribute">确认下发</el-button>
      </template>
    </el-dialog>

    <!-- 进度审批弹窗 -->
    <el-dialog
      v-model="approvalDialogVisible"
      title="进度审批"
      width="520px"
      :close-on-click-modal="false"
      @close="closeApprovalDialog"
    >
      <div v-if="currentApprovalIndicator" class="approval-dialog">
        <!-- 指标信息 -->
        <div class="approval-indicator-info">
          <div class="info-row">
            <span class="info-label">指标名称：</span>
            <span class="info-value">{{ currentApprovalIndicator.name }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">责任部门：</span>
            <span class="info-value">{{ currentApprovalIndicator.responsibleDept }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">当前进度：</span>
            <span class="info-value">{{ currentApprovalIndicator.progress || 0 }}%</span>
          </div>
          <div class="info-row highlight-row">
            <span class="info-label">申请进度：</span>
            <span class="info-value highlight"
              >{{ currentApprovalIndicator.pendingProgress || 0 }}%</span
            >
            <span class="progress-change">
              ({{
                (currentApprovalIndicator.pendingProgress || 0) -
                  (currentApprovalIndicator.progress || 0) >
                0
                  ? '+'
                  : ''
              }}{{
                (currentApprovalIndicator.pendingProgress || 0) -
                (currentApprovalIndicator.progress || 0)
              }}%)
            </span>
          </div>
        </div>

        <!-- 填报说明 -->
        <div v-if="currentApprovalIndicator.pendingRemark" class="approval-remark">
          <div class="remark-label">填报说明：</div>
          <div class="remark-content">{{ currentApprovalIndicator.pendingRemark }}</div>
        </div>

        <el-divider />

        <!-- 审批表单 -->
        <el-form label-width="100px" class="approval-form">
          <el-form-item label="审批结果" required>
            <el-radio-group v-model="approvalForm.action">
              <el-radio value="approve">
                <span class="radio-label approve">通过</span>
              </el-radio>
              <el-radio value="reject">
                <span class="radio-label reject">驳回</span>
              </el-radio>
            </el-radio-group>
          </el-form-item>

          <el-form-item v-if="approvalForm.action === 'approve'" label="审批意见">
            <el-input
              v-model="approvalForm.comment"
              type="textarea"
              :rows="3"
              placeholder="可选，填写审批意见..."
              maxlength="200"
              show-word-limit
            />
          </el-form-item>

          <el-form-item v-if="approvalForm.action === 'reject'" label="驳回原因" required>
            <el-input
              v-model="approvalForm.rejectReason"
              type="textarea"
              :rows="3"
              placeholder="请填写驳回原因，以便填报人了解问题并重新填报..."
              maxlength="500"
              show-word-limit
            />
          </el-form-item>
        </el-form>

        <!-- 提示信息 -->
        <div class="approval-tips">
          <el-alert
            v-if="approvalForm.action === 'approve'"
            title="审批通过后，指标进度将更新为申请的进度值"
            type="success"
            :closable="false"
            show-icon
          />
          <el-alert
            v-else
            title="驳回后，填报人可以重新填报进度"
            type="warning"
            :closable="false"
            show-icon
          />
        </div>
      </div>

      <template #footer>
        <el-button @click="closeApprovalDialog">取消</el-button>
        <el-button
          :type="approvalForm.action === 'approve' ? 'success' : 'warning'"
          @click="submitApproval"
        >
          {{ approvalForm.action === 'approve' ? '确认通过' : '确认驳回' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 审计日志抽屉 -->
    <AuditLogDrawer
      v-model="auditLogVisible"
      :indicator-id="currentAuditIndicator?.id"
      @close="auditLogVisible = false"
    />

    <!-- 任务审批抽屉 -->
    <TaskApprovalDrawer
      v-model="taskApprovalVisible"
      :indicator-id="approvalIndicators[0]?.id"
      :show-approval-section="true"
      @close="taskApprovalVisible = false"
      @refresh="handleApprovalRefresh"
    />

    <!-- 计划审批抽屉 -->
    <PlanApprovalDrawer
      v-model:visible="planApprovalVisible"
      @close="planApprovalVisible = false"
      @refresh="handleApprovalRefresh"
    />

    <!-- 里程碑编辑弹窗 -->
    <el-dialog
      v-model="milestoneEditDialogVisible"
      title="编辑里程碑"
      width="700px"
      :close-on-click-modal="false"
      @close="cancelMilestoneEdit"
    >
      <div v-if="editingMilestoneIndicator" class="milestone-edit-dialog">
        <!-- 指标信息 -->
        <div class="indicator-info-header">
          <div class="info-item">
            <span class="label">指标名称：</span>
            <span class="value">{{ editingMilestoneIndicator.name }}</span>
          </div>
          <div class="info-item">
            <span class="label">指标类型：</span>
            <el-tag
              size="small"
              :type="editingMilestoneIndicator.type1 === '定量' ? 'primary' : 'warning'"
            >
              {{ editingMilestoneIndicator.type1 }}
            </el-tag>
          </div>
        </div>

        <el-divider />

        <!-- 操作按钮 -->
        <div class="milestone-actions">
          <el-button size="small" type="primary" :icon="Plus" @click="addMilestoneInDialog">
            添加里程碑
          </el-button>
          <el-button
            v-if="editingMilestoneIndicator.type1 === '定量'"
            size="small"
            type="success"
            :icon="Timer"
            @click="generateMonthlyMilestonesInDialog"
          >
            生成12个月里程碑
          </el-button>
          <span class="milestone-count-hint"> 当前共 {{ editingMilestones.length }} 个里程碑 </span>
        </div>

        <!-- 里程碑列表 -->
        <div class="milestone-edit-list">
          <el-empty
            v-if="editingMilestones.length === 0"
            description="暂无里程碑，点击上方按钮添加"
            :image-size="80"
          />

          <!-- 里程碑编辑表单 -->
          <div v-for="(ms, idx) in editingMilestones" :key="ms.id" class="milestone-edit-item">
            <div class="milestone-index">{{ idx + 1 }}.</div>
            <div class="milestone-fields">
              <el-input
                v-model="ms.name"
                placeholder="里程碑名称"
                size="small"
                class="field-name"
              />
              <el-input-number
                v-model="ms.targetProgress"
                :min="0"
                :max="100"
                placeholder="目标进度%"
                size="small"
                class="field-progress"
              />
              <el-date-picker
                v-model="ms.deadline"
                type="date"
                placeholder="截止日期"
                size="small"
                value-format="YYYY-MM-DD"
                class="field-date"
              />
              <el-button
                type="danger"
                size="small"
                :icon="Delete"
                circle
                @click="removeMilestoneInDialog(idx)"
              />
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="cancelMilestoneEdit">取消</el-button>
        <el-button type="primary" @click="saveMilestoneEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
/* ========================================
     StrategicTaskView 统一样式
     使用 colors.css 中定义的 CSS 变量
     Requirements: 2.1, 4.1, 5.1, 10.2
     ======================================== */

/* 定性/定量指标标签样式 */
.tag-quantitative {
  background: rgba(64, 158, 255, 0.15) !important;
  color: #409eff !important;
  border: 1px solid rgba(64, 158, 255, 0.3) !important;
}

.tag-qualitative {
  background: rgba(147, 51, 234, 0.15) !important;
  color: #9333ea !important;
  border: 1px solid rgba(147, 51, 234, 0.3) !important;
}

/* 页面主容器 */
.strategic-task-container {
  display: flex;
  gap: 0;
  height: calc(100vh - 200px);
  min-height: 500px;
  position: relative;
  overflow: hidden;
}

/* ========================================
     侧边栏样式 - 精致动态隐藏效果
     Editorial Elegance 设计风格
     ======================================== */

/* 背景遮罩层 - 侧边栏展开时的半透明背景 */
.sidebar-backdrop {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(26, 54, 93, 0.08) 0%, transparent 50%);
  opacity: 0;
  z-index: 5;
  pointer-events: none;
  transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 侧边栏展开时显示遮罩 */
.strategic-task-container:has(.task-sidebar:hover) .sidebar-backdrop,
.strategic-task-container:has(.sidebar-arrow:hover) .sidebar-backdrop {
  opacity: 1;
}

/* 展开按钮 - 现代胶囊设计 */
.sidebar-toggle {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 28px;
  min-height: 72px;
  height: auto;
  padding: 8px 4px;
  background: linear-gradient(135deg, var(--color-primary, #409eff) 0%, #2c5282 100%);
  color: #fff;
  border-radius: 0 14px 14px 0;
  cursor: pointer;
  box-shadow:
    2px 4px 12px rgba(64, 158, 255, 0.3),
    0 2px 4px rgba(0, 0, 0, 0.1);
  z-index: 30;
  transition:
    transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
    background 0.3s ease,
    box-shadow 0.3s ease,
    width 0.3s ease;
  overflow: hidden;
}

.sidebar-toggle:hover {
  background: linear-gradient(135deg, #2c5282 0%, #1a365d 100%);
  box-shadow:
    3px 6px 16px rgba(44, 82, 130, 0.4),
    0 2px 6px rgba(0, 0, 0, 0.15);
  width: 32px;
}

.toggle-icon {
  width: 18px;
  height: 18px;
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  flex-shrink: 0;
  color: #fff;
}

.toggle-hint {
  font-size: 10px;
  font-weight: 500;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  letter-spacing: 1px;
  margin-top: 4px;
  opacity: 0.95;
  line-height: 1.2;
  white-space: nowrap;
}

/* 侧边栏主体 - 默认完全隐藏 */
.task-sidebar {
  position: absolute;
  left: 0;
  top: 0;
  width: 280px;
  height: 100%;
  background: var(--bg-white, #fff);
  border-radius: 0 16px 16px 0;
  padding: 0;
  border: 1px solid var(--border-color, #e2e8f0);
  border-left: none;
  box-shadow:
    4px 0 20px rgba(0, 0, 0, 0.08),
    8px 0 40px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 200px);
  z-index: 25;
  transform: translateX(-100%);
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  overflow: hidden;
}

/* 侧边栏展开状态 */
.task-sidebar:hover,
.strategic-task-container:has(.sidebar-toggle:hover) .task-sidebar {
  transform: translateX(0);
}

/* 按钮跟随侧边栏展开 */
.strategic-task-container:has(.task-sidebar:hover) .sidebar-toggle,
.strategic-task-container:has(.sidebar-toggle:hover) .sidebar-toggle {
  transform: translateY(-50%) translateX(280px);
}

/* 图标旋转 */
.strategic-task-container:has(.task-sidebar:hover) .toggle-icon,
.strategic-task-container:has(.sidebar-toggle:hover) .toggle-icon {
  transform: rotate(180deg);
}

/* 侧边栏头部 */
.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 16px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.6);
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.8) 0%, transparent 100%);
}

.task-list-title {
  font-weight: 700;
  font-size: 15px;
  color: var(--text-main);
  letter-spacing: 0.02em;
  margin: 0;
  padding: 0;
  border: none;
}

/* 部门列表 */
.task-list {
  list-style: none;
  padding: 12px 16px 16px;
  margin: 0;
  overflow-y: auto;
  flex: 1;
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.3) transparent;
}

.task-list::-webkit-scrollbar {
  width: 5px;
}

.task-list::-webkit-scrollbar-track {
  background: transparent;
}

.task-list::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.3);
  border-radius: 3px;
}

.task-list::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.5);
}

/* 部门列表项 - 精致卡片风格 */
.task-item {
  padding: 12px 14px;
  font-size: 13px;
  color: var(--text-regular);
  cursor: pointer;
  border-radius: 10px;
  margin-bottom: 6px;
  white-space: normal;
  line-height: 1.5;
  position: relative;
  transition:
    background 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    color 0.25s ease;
  border: 1px solid transparent;
}

.task-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%) scaleY(0);
  width: 3px;
  height: 60%;
  background: var(--color-primary);
  border-radius: 0 2px 2px 0;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.task-item:hover {
  background: rgba(241, 245, 249, 0.8);
  transform: translateX(4px);
  color: var(--color-primary);
  border-color: rgba(226, 232, 240, 0.6);
}

.task-item:hover::before {
  transform: translateY(-50%) scaleY(1);
}

.task-item.active {
  background: linear-gradient(
    135deg,
    var(--color-primary) 0%,
    var(--color-primary-dark, #1a365d) 100%
  );
  color: white;
  border-color: transparent;
  box-shadow:
    0 4px 12px rgba(44, 82, 130, 0.25),
    0 2px 4px rgba(44, 82, 130, 0.15);
  transform: translateX(4px);
}

.task-item.active::before {
  display: none;
}

/* ========================================
     右侧详情区域 - 统一卡片规范
     Requirements: 2.1, 2.2
     ======================================== */
.task-detail {
  flex: 1;
  background: var(--bg-white);
  border-radius: var(--radius-lg);
  padding: var(--spacing-2xl);
  margin-left: 24px; /* 为侧边栏箭头留出空间 */
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: box-shadow var(--transition-normal);
}

/* 表格行 hover 效果 - 使用实色背景 */
:deep(.el-table__body tr) {
  transition: background var(--transition-fast);
}

:deep(.el-table__body tr:hover > td.el-table__cell) {
  background: #f0f7ff !important;
}

/* ========================================
     详情头部样式 - 统一页面头部规范
     Requirements: 5.1, 5.2, 5.3, 5.4
     ======================================== */
.detail-header {
  margin-bottom: var(--spacing-2xl);
}

.task-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-main);
  margin: 0 0 var(--spacing-lg) 0;
}

.task-meta {
  background: var(--bg-page);
  padding: var(--spacing-lg);
  border-radius: var(--radius-md);
}

.meta-row {
  font-size: 13px;
  margin-bottom: var(--spacing-sm);
  color: var(--text-regular);
}

.meta-row:last-child {
  margin-bottom: 0;
}

.meta-label {
  color: var(--text-secondary);
}

.meta-value {
  color: var(--text-main);
}

/* ========================================
     可编辑字段样式 - 增强双击编辑提示
     ======================================== */
.editable {
  cursor: text;
  transition: all var(--transition-fast);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  display: inline-block;
  border: 1px dashed transparent;
}

.editable:hover {
  background: var(--bg-page);
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
}

.task-title.editable {
  padding: var(--spacing-sm) var(--spacing-md);
}

.editable-cell {
  cursor: text;
  border-radius: var(--radius-sm);
  padding: 2px var(--spacing-xs);
  transition: all var(--transition-fast);
  border: 1px dashed transparent;
  min-height: 24px;
  position: relative;
}

.editable-cell:hover {
  background: var(--bg-page);
  border-color: var(--border-light);
  box-shadow: inset 0 0 0 1px var(--border-color);
}

/* 双击编辑提示 tooltip */
.editable-cell::after,
.editable::after {
  content: '双击编辑';
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: var(--text-main);
  color: var(--bg-white);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: 11px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--transition-fast);
  z-index: 10;
}

.editable-cell:hover::after,
.editable:hover::after {
  opacity: 0.9;
}

/* ========================================
     工具栏样式
     ======================================== */
.indicator-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
}

.section-title {
  font-weight: 600;
  font-size: 16px;
  color: var(--text-main);
}

/* 表格区域 */
.table-container {
  flex: 1;
  overflow: auto;
}

/* 文字颜色类 */
.text-orange {
  color: var(--color-warning);
  font-weight: 500;
}

.text-blue {
  color: var(--color-primary);
  font-weight: 500;
}

/* ========================================
     标签样式 - 统一标签间距
     Requirements: 9.1, 9.3
     ======================================== */
.tags-wrapper {
  display: flex;
  gap: var(--spacing-sm);
}

/* 备注单元格样式 */
.remark-cell {
  min-height: 24px;
  display: flex;
  align-items: center;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

.remark-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-word;
  line-height: 1.4;
  max-height: 2.8em;
  width: 100%;
}

/* 新增行 */
.add-row {
  margin-top: var(--spacing-lg);
  padding: var(--spacing-lg);
  background: var(--bg-page);
  border-radius: var(--radius-md);
  border: 1px dashed var(--border-color);
}

.add-form {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  align-items: center;
}

/* 里程碑输入行样式 */
.milestone-input-row {
  display: flex;
  align-items: center;
  margin-bottom: var(--spacing-sm);
  gap: var(--spacing-sm);
}

/* ========================================
     任务下发相关样式
     ======================================== */
.task-assignment-panel {
  background: rgba(103, 194, 58, 0.1);
  border: 1px solid var(--color-primary-light);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
}

.assignment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.assignment-header h4 {
  margin: 0;
  color: var(--color-primary-dark);
  font-size: 14px;
  font-weight: 600;
}

.assignment-actions {
  display: flex;
  gap: var(--spacing-md);
}

.assignment-dialog .selected-indicators {
  background: var(--bg-page);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
}

.assignment-dialog .selected-indicators h4 {
  margin: 0 0 var(--spacing-md) 0;
  font-size: 14px;
  color: var(--text-regular);
}

.assignment-dialog .selected-indicators ul {
  margin: 0;
  padding-left: var(--spacing-xl);
  color: var(--text-secondary);
}

.assignment-dialog .selected-indicators li {
  margin-bottom: var(--spacing-xs);
  line-height: 1.4;
}

/* ========================================
     Excel风格样式 - 统一表格规范
     Requirements: 4.1, 4.2, 4.3, 4.4
     ======================================== */
.excel-style {
  padding: 0 !important;
}

/* Excel标题头 - 统一页面头部规范 */
.excel-header {
  background: linear-gradient(135deg, var(--bg-blue-light) 0%, rgba(64, 158, 255, 0.2) 100%);
  padding: var(--spacing-lg) var(--spacing-xl);
  border-bottom: 2px solid var(--color-primary);
}

.excel-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-primary-dark);
  text-align: center;
  margin: 0;
}

/* Excel工具栏 */
.excel-toolbar {
  background: var(--bg-light);
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.excel-toolbar .toolbar-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.excel-toolbar .toolbar-right {
  display: flex;
  align-items: center;
}

.update-time {
  font-size: 12px;
  color: var(--text-secondary);
}

/* Excel表格容器 */
.excel-table-wrapper {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.table-container {
  flex: 1;
  overflow: auto;
}

/* 确保表格有最小宽度，防止列被压缩 */
.excel-table-wrapper .unified-table {
  min-width: 1200px;
}

/* 确保表头不换行 */
.excel-table-wrapper .unified-table :deep(.el-table__header) th .cell {
  white-space: nowrap;
}

/* 说明列文字换行 */
.remark-text-wrap {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

/* 操作按钮容器 */
.action-buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 2px;
}

/* 操作按钮竖直排列 */
.action-buttons-inline {
  display: flex !important;
  flex-direction: column !important;
  justify-content: center;
  align-items: center;
  gap: 4px;
}

.action-buttons-inline .el-button {
  padding: 4px 8px;
  font-size: 12px;
  margin: 0 !important;
  white-space: nowrap;
}

.action-buttons .el-button {
  padding: 4px 6px;
  font-size: 12px;
}

/* 批量操作列样式 */
.unified-table :deep(.batch-column) {
  background-color: var(--bg-page) !important;
}

.unified-table :deep(.batch-column) .el-button {
  font-size: 12px;
}

/* 批量按钮容器 */
.batch-buttons {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}

.batch-buttons .el-button {
  margin: 0;
  padding: 4px 8px;
  font-size: 11px;
  min-width: 50px;
}

/* ========================================
     统一表格样式 (el-table)
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

.task-content-text {
  color: var(--text-main);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Excel表格 - 统一表格样式 */
.excel-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  background: var(--bg-white);
  font-size: 13px;
}

.excel-table thead {
  position: sticky;
  top: 0;
  z-index: 10;
}

/* 表头样式 - 使用统一背景色 */
.excel-table th {
  background: var(--bg-light);
  color: var(--text-regular);
  font-weight: 600;
  padding: var(--spacing-md) var(--spacing-sm);
  border: 1px solid var(--border-color);
  text-align: center;
  white-space: nowrap;
}

.excel-table td {
  padding: var(--spacing-sm) var(--spacing-sm);
  border: 1px solid var(--border-color);
  vertical-align: top;
  line-height: 1.5;
  color: var(--text-regular);
}

/* 单元格对齐 */
.cell-center {
  text-align: center;
  vertical-align: middle;
}

/* ========================================
     表格行样式 - 斑马纹和悬停效果
     Requirements: 4.2, 4.3
     ======================================== */
.hover-row {
  transition: background-color var(--transition-fast);
}

/* 使用实色背景替代透明效果 */
.hover-row:hover {
  background: #f0f7ff !important;
}

/* 斑马纹 - 偶数行 */
.excel-table tbody tr:nth-child(even) {
  background-color: var(--bg-page);
}

/* 背景色类 */
.bg-blue-light {
  background: var(--bg-blue-light) !important;
}

.bg-gray-light {
  background: var(--bg-light) !important;
}

.bg-red-light {
  background: rgba(245, 108, 108, 0.1) !important;
}

/* 文字样式 */
.text-red {
  color: var(--color-danger);
}

.font-medium {
  font-weight: 500;
}

/* 列表样式 */
.list-decimal {
  list-style: decimal;
  margin-left: var(--spacing-lg);
  padding: 0;
}

.list-decimal li {
  margin-bottom: var(--spacing-xs);
}

/* 新增行表单 */
.add-row-form {
  background: rgba(64, 158, 255, 0.08);
  padding: var(--spacing-lg);
  border-top: 1px solid var(--color-primary-light);
  max-height: 600px;
  overflow-y: auto;
  overflow-x: hidden;
}

.add-row-form::-webkit-scrollbar {
  width: 8px;
}

.add-row-form::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
}

.add-row-form::-webkit-scrollbar-thumb {
  background: var(--color-primary-light, #93c5fd);
  border-radius: 4px;
}

.add-row-form::-webkit-scrollbar-thumb:hover {
  background: var(--color-primary, #2c5282);
}

.form-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-primary-dark);
  margin: 0 0 var(--spacing-lg) 0;
}

/* 多指标输入区域 */
.indicators-input-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.indicator-input-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-white);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
}

.indicator-input-item:hover {
  border-color: var(--color-primary-light);
}

.indicator-index {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 20px;
  padding-top: 8px;
}

.indicator-input-item :deep(.el-textarea__inner) {
  resize: none;
  line-height: 1.5;
}

/* 里程碑表单区域 */
.milestone-form-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.milestone-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
  max-height: 300px;
  overflow-y: auto;
  padding-right: 4px;
}

.milestone-list::-webkit-scrollbar {
  width: 4px;
}

.milestone-list::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 2px;
}

.milestone-index {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 20px;
}

.milestone-form-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-white);
  border-radius: var(--radius-sm);
  border-bottom: 1px dashed var(--border-light, #e2e8f0);
}

.milestone-form-item:last-child {
  border-bottom: none;
}

.milestone-hint {
  font-size: 12px;
  color: var(--text-placeholder);
}

/* 新增行内联表单 */
.add-row-inline {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  flex-wrap: wrap;
}

.form-field {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.form-field label {
  font-size: 13px;
  color: var(--text-regular);
  white-space: nowrap;
}

.form-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-left: auto;
}

/* Excel状态栏 */
.excel-status-bar {
  background: var(--bg-light);
  padding: var(--spacing-sm) var(--spacing-lg);
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--text-secondary);
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
}

/* ========================================
     详情抽屉样式
     ======================================== */
.detail-container {
  padding: 0 var(--spacing-xl);
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

.detail-desc {
  margin-bottom: var(--spacing-2xl);
}

.divider {
  height: 1px;
  background: var(--border-color);
  margin: var(--spacing-2xl) 0;
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
  content: '·';
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

.detail-actions {
  margin-top: var(--spacing-2xl);
  padding-top: var(--spacing-xl);
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
}

/* ========================================
     下发弹窗样式
     ======================================== */
.distribute-dialog .indicator-info {
  background: var(--bg-page);
  padding: var(--spacing-lg);
  border-radius: var(--radius-md);
}

.distribute-dialog .indicator-info p {
  margin: 0 0 var(--spacing-sm) 0;
  font-size: 14px;
  color: var(--text-regular);
}

.distribute-dialog .indicator-info p:last-child {
  margin-bottom: 0;
}

.distribute-dialog .indicator-list {
  margin-top: var(--spacing-md);
}

.distribute-dialog .indicator-list ul {
  margin: var(--spacing-sm) 0 0 0;
  padding-left: var(--spacing-xl);
  max-height: 150px;
  overflow-y: auto;
}

.distribute-dialog .indicator-list li {
  font-size: 13px;
  color: var(--text-regular);
  line-height: 1.8;
}

/* ========================================
     进度条样式 - 统一进度条规范
     Requirements: 10.1, 10.2
     ======================================== */

/* 进度编辑单元格容器 */
.progress-edit-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 4px 0;
}

/* 进度条样式 - 深色背景 */
.progress-bar-dark {
  width: 80px;
  cursor: pointer;
}

/* 进度条未完成部分背景色改深 */
.progress-bar-dark :deep(.el-progress-bar__outer) {
  background-color: #c8c4c4ff !important;
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

/* 进度单元格样式 */
.progress-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.progress-number {
  font-weight: 500;
  color: var(--text-main);
  font-size: 14px;
}

.progress-bar-inline {
  width: 100%;
}

.progress-text {
  font-size: 12px;
  color: var(--text-regular);
  min-width: 32px;
  text-align: right;
}

/* ========================================
     Sticky 列样式 - 与审批中心保持一致
     ======================================== */
.excel-table .sticky-col {
  position: sticky;
  background: var(--bg-white);
  z-index: 2;
}

.excel-table .sticky-col-first {
  right: 100px;
  min-width: 150px;
}

.excel-table .sticky-col-last {
  right: 0;
  min-width: 100px;
}

.excel-table thead .sticky-col {
  background: var(--bg-light);
  z-index: 11;
}

/* 滚动时显示阴影和边框 */
.table-scroll.is-scrolling .sticky-col-first {
  box-shadow: -4px 0 8px rgba(0, 0, 0, 0.1);
  border-left: 1px solid var(--border-color);
}

/* hover 时固定列背景 - 使用实色背景 */
.hover-row:hover .sticky-col {
  background: #f0f7ff;
}

/* 确保表格容器支持sticky */
.table-scroll {
  overflow-x: auto;
  overflow-y: auto;
}

/* 操作列按钮容器 */
.excel-table .sticky-col-first,
.excel-table .sticky-col-last {
  white-space: nowrap;
}

/* 整体下发按钮样式 */
.excel-table .sticky-col-last .el-button {
  font-weight: 500;
}

/* 合并单元格样式优化 */
.excel-table td[rowspan] {
  vertical-align: middle;
  background-color: var(--bg-white);
  font-weight: 500;
}

/* ========================================
     页面加载动画 - 统一动画效果
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
     核心指标单元格样式 - 完整显示内容
     ======================================== */
.indicator-name-cell {
  vertical-align: top;
}

.indicator-name-text {
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  display: block;
}

.placeholder-text {
  color: var(--text-placeholder);
  font-style: italic;
}

/* 战略任务带颜色样式 */
.task-content-colored {
  font-weight: 500;
  cursor: default;
}

/* 核心指标名称带颜色样式（区分定性/定量） */
.indicator-qualitative {
  color: var(--color-qualitative);
  font-weight: 500;
}

.indicator-quantitative {
  color: var(--color-quantitative);
  font-weight: 500;
}

/* ========================================
     任务单元格新增指标三角形按钮
     ======================================== */
/* 让战略任务列的td支持绝对定位 */
:deep(.unified-table .el-table__body td:nth-child(2)) {
  position: relative;
}

.task-cell-wrapper {
  position: static;
}

.add-indicator-trigger {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 0 0 20px 20px;
  border-color: transparent transparent rgba(64, 158, 255, 0.15) transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 5;
}

.add-indicator-trigger .trigger-icon {
  position: absolute;
  right: 2px;
  bottom: -18px;
  font-size: 11px;
  font-weight: 700;
  color: transparent;
  transition: color 0.2s ease;
  line-height: 1;
  user-select: none;
}

.add-indicator-trigger:hover {
  border-color: transparent transparent var(--color-primary) transparent;
  border-width: 0 0 24px 24px;
}

.add-indicator-trigger:hover .trigger-icon {
  color: #fff;
  right: 3px;
  bottom: -21px;
  font-size: 12px;
}

.add-indicator-trigger:active {
  border-color: transparent transparent var(--color-primary-dark) transparent;
}

/* ========================================
     进度审批弹窗样式
     ======================================== */
.approval-dialog {
  padding: 0 var(--spacing-md);
}

.approval-indicator-info {
  background: var(--bg-page);
  padding: var(--spacing-lg);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-md);
}

.approval-indicator-info .info-row {
  display: flex;
  align-items: center;
  margin-bottom: var(--spacing-sm);
}

.approval-indicator-info .info-row:last-child {
  margin-bottom: 0;
}

.approval-indicator-info .info-label {
  color: var(--text-secondary);
  min-width: 80px;
  font-size: 14px;
}

.approval-indicator-info .info-value {
  color: var(--text-main);
  font-size: 14px;
  flex: 1;
}

.approval-indicator-info .info-value.highlight {
  color: var(--color-primary);
  font-weight: 600;
  font-size: 16px;
}

.approval-indicator-info .highlight-row {
  background: rgba(64, 158, 255, 0.08);
  margin: var(--spacing-sm) calc(-1 * var(--spacing-lg));
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--radius-sm);
}

.approval-indicator-info .progress-change {
  color: var(--color-success);
  font-size: 13px;
  margin-left: var(--spacing-sm);
}

.approval-remark {
  background: var(--bg-light);
  padding: var(--spacing-md);
  border-radius: var(--radius-sm);
  margin-bottom: var(--spacing-md);
  border-left: 3px solid var(--color-primary);
}

.approval-remark .remark-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: var(--spacing-xs);
}

.approval-remark .remark-content {
  font-size: 14px;
  color: var(--text-regular);
  line-height: 1.6;
  white-space: pre-wrap;
}

.approval-form {
  margin-top: var(--spacing-lg);
}

.approval-form .radio-label {
  font-size: 14px;
}

.approval-form .radio-label.approve {
  color: var(--color-success);
  font-weight: 500;
}

.approval-form .radio-label.reject {
  color: var(--color-warning);
  font-weight: 500;
}

.approval-tips {
  margin-top: var(--spacing-lg);
}

.approval-tips :deep(.el-alert) {
  border-radius: var(--radius-sm);
}

/* 状态单元格样式 */
.status-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

/* ========================================
     目标进度列 - 里程碑样式
     ======================================== */
.milestone-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s ease;
}

.milestone-cell:hover {
  background: rgba(44, 82, 130, 0.05);
}

.milestone-count {
  font-size: 12px;
  color: var(--color-qualitative, #9333ea);
  font-weight: 500;
  white-space: nowrap;
}

/* 里程碑弹出层 */
.milestone-popover {
  padding: 4px 0;
}

.milestone-popover-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main, #1e293b);
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-light, #f1f5f9);
}

.milestone-item {
  padding: 8px 10px;
  border-radius: 6px;
  margin-bottom: 6px;
  background: var(--bg-white, #fff);
  border: 1px solid transparent;
  transition: all 0.2s;
}

.milestone-item:last-child {
  margin-bottom: 0;
}

/* 里程碑完成状态样式 */
.milestone-item.milestone-completed {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(34, 197, 94, 0.15) 100%);
  border-color: rgba(34, 197, 94, 0.2);
}

.milestone-item.milestone-completed .milestone-index {
  color: var(--el-color-success, #67c23a);
}

.milestone-item.milestone-completed .milestone-name {
  color: var(--el-color-success-dark-2, #529b2e);
}

.milestone-check-icon {
  color: var(--el-color-success, #67c23a);
  font-size: 16px;
  margin-left: auto;
}

.milestone-item-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.milestone-index {
  font-size: 12px;
  color: var(--text-placeholder, #94a3b8);
  font-weight: 500;
}

.milestone-name {
  font-size: 13px;
  color: var(--text-main, #1e293b);
  font-weight: 500;
}

.milestone-item-info {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-secondary, #64748b);
  padding-left: 18px;
}

.milestone-empty {
  font-size: 12px;
  color: var(--text-placeholder, #94a3b8);
  text-align: center;
  padding: 12px 0;
}

/* ========================================
     卡片视图样式
     ======================================== */
.card-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 卡片导航栏 */
.card-navigation {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-light);
}

.nav-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.nav-info {
  font-size: 14px;
  color: var(--text-regular);
  font-weight: 500;
  padding: 0 var(--spacing-md);
}

.nav-right {
  display: flex;
  align-items: center;
}

/* 指标卡片 */
.indicator-card {
  flex: 1;
  margin: var(--spacing-lg);
  background: var(--bg-white);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 卡片头部 */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: var(--spacing-xl);
  background: linear-gradient(135deg, var(--bg-blue-light) 0%, rgba(64, 158, 255, 0.1) 100%);
  border-bottom: 1px solid var(--border-color);
}

.card-title-section {
  flex: 1;
}

.card-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-main);
  margin: 0 0 var(--spacing-md) 0;
  line-height: 1.4;
}

.card-tags {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.card-actions {
  display: flex;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}

/* 卡片内容 */
.card-content {
  flex: 1;
  padding: var(--spacing-xl);
  overflow-y: auto;
}

/* 信息区块 */
.info-section,
.progress-section,
.milestone-section {
  margin-bottom: var(--spacing-2xl);
}

.info-section:last-child,
.progress-section:last-child,
.milestone-section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-main);
  margin: 0 0 var(--spacing-lg) 0;
  padding-bottom: var(--spacing-sm);
  border-bottom: 2px solid var(--color-primary);
  display: inline-block;
}

/* 信息网格 */
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-lg);
}

.info-item {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
}

.info-item.full-width {
  grid-column: 1 / -1;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.info-label {
  font-size: 14px;
  color: var(--text-secondary);
  min-width: 80px;
  flex-shrink: 0;
}

.info-value {
  font-size: 14px;
  color: var(--text-main);
  line-height: 1.5;
  word-break: break-word;
}

/* 进度显示 */
.progress-display {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.progress-main {
  display: flex;
  align-items: center;
  gap: var(--spacing-xl);
  padding: var(--spacing-lg);
  background: var(--bg-page);
  border-radius: var(--radius-md);
}

.progress-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 100px;
}

.current-progress {
  font-size: 32px;
  font-weight: 700;
  color: var(--color-primary);
  line-height: 1;
}

.progress-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: var(--spacing-xs);
}

.progress-bar {
  flex: 1;
}

/* 待审批进度 */
.pending-progress {
  padding: var(--spacing-lg);
  background: rgba(255, 193, 7, 0.1);
  border-radius: var(--radius-md);
  border-left: 4px solid var(--color-warning);
}

.pending-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.pending-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.pending-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-warning);
}

.progress-change {
  font-size: 13px;
  color: var(--color-success);
}

.pending-remark {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.remark-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.remark-text {
  font-size: 14px;
  color: var(--text-regular);
  line-height: 1.5;
  white-space: pre-wrap;
}

/* 里程碑列表 */
.milestone-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.milestone-item-card {
  padding: var(--spacing-lg);
  background: var(--bg-page);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  transition: box-shadow var(--transition-fast);
}

.milestone-item-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.milestone-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.milestone-index {
  font-size: 14px;
  color: var(--text-placeholder);
  font-weight: 600;
  min-width: 24px;
}

.milestone-name {
  font-size: 15px;
  color: var(--text-main);
  font-weight: 500;
  flex: 1;
}

.milestone-details {
  display: flex;
  gap: var(--spacing-xl);
  font-size: 13px;
  color: var(--text-secondary);
  padding-left: 32px;
}

.milestone-progress,
.milestone-deadline {
  display: flex;
  align-items: center;
}

/* 空状态 */
.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-2xl);
}

/* ========================================
     里程碑编辑弹窗样式
     ======================================== */
.milestone-edit-dialog {
  padding: 0;
}

.indicator-info-header {
  display: flex;
  gap: 24px;
  padding: 16px;
  background: var(--bg-page, #f8fafc);
  border-radius: 8px;
  margin-bottom: 16px;
}

.indicator-info-header .info-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.indicator-info-header .label {
  font-size: 13px;
  color: var(--text-secondary, #64748b);
}

.indicator-info-header .value {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-main, #1e293b);
}

.milestone-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.milestone-count-hint {
  margin-left: auto;
  font-size: 13px;
  color: var(--text-secondary, #64748b);
}

.milestone-edit-list {
  max-height: 500px;
  overflow-y: auto;
  padding: 4px;
}

.milestone-edit-item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 12px;
  background: var(--bg-white, #fff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 8px;
  margin-bottom: 12px;
  transition: all 0.3s;
}

.milestone-edit-item:hover {
  border-color: var(--color-primary, #2c5282);
  box-shadow: 0 2px 8px rgba(44, 82, 130, 0.1);
}

.milestone-index {
  width: 24px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary, #64748b);
  flex-shrink: 0;
  margin-top: 4px;
}

.milestone-fields {
  flex: 1;
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.field-name {
  flex: 1;
  min-width: 160px;
}

.field-progress {
  width: 120px;
}

.field-date {
  width: 150px;
}

.milestone-edit-list::-webkit-scrollbar {
  width: 6px;
}

.milestone-edit-list::-webkit-scrollbar-track {
  background: transparent;
}

.milestone-edit-list::-webkit-scrollbar-thumb {
  background: var(--border-color, #e2e8f0);
  border-radius: 3px;
}

.milestone-edit-list::-webkit-scrollbar-thumb:hover {
  background: var(--border-light, #cbd5e1);
}

/* 里程碑单元格可编辑提示 */
.milestone-cell.editable {
  cursor: pointer;
  transition: all 0.2s;
}

.milestone-cell.editable:hover {
  background: var(--bg-page, #f8fafc);
  border-radius: 4px;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .card-navigation {
    flex-direction: column;
    gap: var(--spacing-md);
    align-items: stretch;
  }

  .nav-left {
    justify-content: center;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }

  .progress-main {
    flex-direction: column;
    text-align: center;
  }

  .milestone-details {
    flex-direction: column;
    gap: var(--spacing-sm);
  }
}
</style>
