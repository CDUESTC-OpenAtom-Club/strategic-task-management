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
import { useOrgStore } from '@/stores/org'
import TaskApprovalDrawer from '@/components/task/TaskApprovalDrawer.vue'
import { useDataValidator } from '@/composables/useDataValidator'
import { milestoneDefaultValues, MILESTONE_STATUS_VALUES, PROGRESS_APPROVAL_STATUS_VALUES, type ProgressApprovalStatusValue } from '@/config/validationRules'

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

// 使用数据验证器 - 用于验证里程碑数据完整性
// @requirement 2.4 - Milestone data validation with complete fields
const { validateMilestone, safeGet, fillDefaults, validateEnum } = useDataValidator({ logErrors: true })

// ============================================================================
// 审批状态枚举值验证与容错处理
// @requirement 2.6 - progressApprovalStatus enum validation
// ============================================================================

/**
 * 默认审批状态值 - 当状态无效时使用
 */
const DEFAULT_APPROVAL_STATUS: ProgressApprovalStatusValue = 'none'

/**
 * 安全获取审批状态值
 * 
 * 检查 progressApprovalStatus 是否为有效枚举值，无效时返回默认值 'none'
 * 确保 UI 不会因为无效状态值而崩溃
 * 
 * @param status - 原始状态值
 * @returns 有效的审批状态值
 * 
 * @requirement 2.6 - progressApprovalStatus enum validation
 */
function getSafeApprovalStatus(status: unknown): ProgressApprovalStatusValue {
  // 如果状态为空或未定义，返回默认值
  if (status === null || status === undefined || status === '') {
    return DEFAULT_APPROVAL_STATUS
  }
  
  // 验证是否为有效枚举值
  if (validateEnum(status, PROGRESS_APPROVAL_STATUS_VALUES)) {
    return status as ProgressApprovalStatusValue
  }
  
  // 无效状态值，记录警告并返回默认值
  console.warn(`[IndicatorListView] 无效的审批状态值: "${status}"，使用默认值 "${DEFAULT_APPROVAL_STATUS}"`)
  return DEFAULT_APPROVAL_STATUS
}

/**
 * 检查指标是否处于指定的审批状态
 * 
 * 使用安全的状态获取方法，避免无效状态导致的错误
 * 
 * @param indicator - 指标对象
 * @param targetStatus - 目标状态或状态数组
 * @returns 是否匹配目标状态
 * 
 * @requirement 2.6 - progressApprovalStatus enum validation
 */
function isApprovalStatus(
  indicator: StrategicIndicator, 
  targetStatus: ProgressApprovalStatusValue | ProgressApprovalStatusValue[]
): boolean {
  const safeStatus = getSafeApprovalStatus(indicator.progressApprovalStatus)
  
  if (Array.isArray(targetStatus)) {
    return targetStatus.includes(safeStatus)
  }
  
  return safeStatus === targetStatus
}

// 接收父组件传递的选中角色和部门
const props = defineProps<{
  viewingRole?: string  // 角色类型: 'strategic_dept' | 'functional_dept' | 'secondary_college'
  viewingDept?: string  // 部门名称: 如 '党委宣传部 | 宣传策划部'
}>()

// 判断当前是否为战略发展部角色
const isStrategicDept = computed(() => {
  // 使用角色类型判断
  return props.viewingRole === 'strategic_dept'
})

// 判断当前是否为二级学院角色
const isSecondaryCollege = computed(() => {
  // 使用角色类型判断
  return props.viewingRole === 'secondary_college'
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
const filterOwnerDept = ref('')  // 来源部门筛选（仅学院使用）

// 获取学院接收到的来源部门列表（从指标数据中提取）
const availableOwnerDepts = computed(() => {
  if (!isSecondaryCollege.value || !props.viewingDept) return []
  
  const currentYear = timeContext.currentYear
  const realYear = timeContext.realCurrentYear
  
  // 获取当前学院作为责任部门的所有指标的来源部门
  const ownerDepts = new Set<string>()
  strategicStore.indicators.forEach(i => {
    const indicatorYear = i.year || realYear
    if (indicatorYear === currentYear && 
        i.responsibleDept === props.viewingDept && 
        i.ownerDept) {
      ownerDepts.add(i.ownerDept)
    }
  })
  
  return Array.from(ownerDepts).sort()
})

// 初始化来源部门筛选（默认选中第一个）
const initOwnerDeptFilter = () => {
  if (isSecondaryCollege.value && availableOwnerDepts.value.length > 0 && !filterOwnerDept.value) {
    filterOwnerDept.value = availableOwnerDepts.value[0]
  }
}

// 重置筛选条件
const resetFilters = () => {
  filterType2.value = ''
  filterType1.value = ''
  filterDept.value = ''
  // 学院重置时恢复默认来源部门
  if (isSecondaryCollege.value && availableOwnerDepts.value.length > 0) {
    filterOwnerDept.value = availableOwnerDepts.value[0]
  } else {
    filterOwnerDept.value = ''
  }
}

const orgStore = useOrgStore()

// 职能部门列表（从数据库动态获取）
const functionalDepartments = computed(() => orgStore.getAllFunctionalDepartmentNames())

// 表格引用和选中的指标
const tableRef = ref<InstanceType<typeof ElTable>>()
const selectedIndicators = ref<StrategicIndicator[]>([])
const approvalDrawerVisible = ref(false)

// 专门用于审批抽屉的指标列表
// - 审批人（战略发展部）：只显示待审批的指标
// - 填报人（职能部门/二级学院）：显示所有已提交的指标（待审批+已审批+已驳回）
const approvalIndicators = computed(() => {
  let list = strategicStore.indicators.map(i => ({
    ...i,
    id: String(i.id)
  }))

  // 按当前年份过滤
  const currentYear = timeContext.currentYear
  const realYear = timeContext.realCurrentYear
  list = list.filter(i => {
    const indicatorYear = i.year || realYear
    return indicatorYear === currentYear
  })

  // 根据当前角色过滤数据
  if (!isStrategicDept.value && props.viewingDept) {
    list = list.filter(i => {
      const isResponsible = i.responsibleDept === props.viewingDept
      const isOwner = i.ownerDept === props.viewingDept
      return isResponsible || isOwner
    })
  }

  // 审批人：返回待审批的指标 + 有历史记录的指标（确保历史记录能正常显示）
  // 填报人：返回所有有审批状态的指标（用于查看审批进度）
  // @requirement 2.6 - 使用安全的状态检查，处理无效枚举值
  if (isStrategicDept.value) {
    return list.filter(i => 
      isApprovalStatus(i, 'pending') || 
      (i.statusAudit && i.statusAudit.length > 0)
    )
  } else {
    // 使用安全的状态获取，过滤掉 draft 和 none 状态
    return list.filter(i => {
      const safeStatus = getSafeApprovalStatus(i.progressApprovalStatus)
      return safeStatus !== 'none' && safeStatus !== 'draft'
    })
  }
})

// 仅计算待审批的数量，用于按钮上的数字显示
const pendingApprovalCount = computed(() => {
  let list = strategicStore.indicators

  // 按当前年份过滤
  const currentYear = timeContext.currentYear
  const realYear = timeContext.realCurrentYear
  list = list.filter(i => {
    const indicatorYear = i.year || realYear
    return indicatorYear === currentYear
  })

  // 根据当前角色过滤数据
  if (!isStrategicDept.value && props.viewingDept) {
    list = list.filter(i => {
      const isResponsible = i.responsibleDept === props.viewingDept
      const isOwner = i.ownerDept === props.viewingDept
      return isResponsible || isOwner
    })
  }

  // 只统计待审批状态的指标数量
  // @requirement 2.6 - 使用安全的状态检查，处理无效枚举值
  return list.filter(i => isApprovalStatus(i, 'pending')).length
})

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
  // 初始化来源部门筛选
  initOwnerDeptFilter()
  
  let list = strategicStore.indicators.map(i => ({
    ...i,
    // 保持 id 为字符串类型，避免 "301-1" 这样的 id 转换成 NaN
    id: String(i.id)
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
  if (!isStrategicDept.value && props.viewingDept) {
    list = list.filter(i => {
      // 匹配责任部门（当前部门负责的指标）
      const isResponsible = i.responsibleDept === props.viewingDept
      // 匹配下发部门（当前部门下发的指标）
      const isOwner = i.ownerDept === props.viewingDept
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
  // 学院角色：按来源部门筛选
  if (isSecondaryCollege.value && filterOwnerDept.value) {
    list = list.filter(i => i.ownerDept === filterOwnerDept.value)
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

const overallStatus = computed(() => {
  const list = indicators.value
  if (list.length === 0) return 'draft'
  // @requirement 2.6 - 使用安全的状态检查，处理无效枚举值
  const hasPending = list.some(i => isApprovalStatus(i, 'pending'))
  if (hasPending) return 'pending'
  const hasRejected = list.some(i => isApprovalStatus(i, 'rejected'))
  if (hasRejected) return 'rejected'
  const allApproved = list.every(i => isApprovalStatus(i, 'approved'))
  if (allApproved) return 'approved'
  const hasActive = list.some(i => i.status === 'active')
  if (hasActive) return 'active'
  return 'draft'
})

// 计算单元格合并信息
const getSpanMethod = ({ row, column, rowIndex, columnIndex }: { row: any; column: any; rowIndex: number; columnIndex: number }) => {
  const dataList = indicators.value

  // 只有战略任务列（第0列）需要合并
  if (columnIndex === 0) {
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
  // 找出所有待提交（draft）或已驳回（rejected）的指标
  // @requirement 2.6 - 使用安全的状态检查，处理无效枚举值
  const pendingRows = group.rows.filter(r => isApprovalStatus(r, ['draft', 'rejected']))
  
  if (pendingRows.length === 0) {
    ElMessage.warning('当前没有待提交的进度')
    return
  }

  const indicatorNames = pendingRows.map(ind => ind.name).join('、')

  ElMessageBox.prompt(
    `确认对任务 "${group.taskContent}" 下的 ${pendingRows.length} 个指标进行批量提交？\n\n指标列表：${indicatorNames}\n\n请输入提交备注：`,
    '批量提交确认',
    {
      confirmButtonText: '确定提交',
      cancelButtonText: '取消',
      inputPlaceholder: '请输入提交备注',
      inputType: 'textarea',
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return '请输入提交备注'
        }
        return true
      }
    }
  ).then(async ({ value: submitComment }) => {
    try {
      for (const row of pendingRows) {
        // 更新指标状态为待审批
        await strategicStore.updateIndicator(row.id.toString(), {
          progressApprovalStatus: 'pending'
        })

        // 添加审计日志
        strategicStore.addStatusAuditEntry(row.id.toString(), {
          operator: authStore.userName || 'unknown',
          operatorName: authStore.userName || '未知用户',
          operatorDept: authStore.userDepartment || '未知部门',
          action: 'submit',
          comment: submitComment || '批量提交进度填报',
          previousProgress: row.progress,
          newProgress: row.pendingProgress,
          previousStatus: row.progressApprovalStatus,
          newStatus: 'pending'
        })
      }

      ElMessage.success(`成功提交${pendingRows.length}项指标进度`)
    } catch (error) {
      logger.error('Failed to submit indicators:', error)
      ElMessage.error('提交失败，请稍后重试')
    }
  })
}

// 按任务组批量撤回（职能部门/二级学院专用）
const handleBatchRevokeByTask = (group: { taskContent: string; rows: StrategicIndicator[] }) => {
  // 找出所有待审批（pending）的指标
  // @requirement 2.6 - 使用安全的状态检查，处理无效枚举值
  const pendingRows = group.rows.filter(r => isApprovalStatus(r, 'pending'))
  
  if (pendingRows.length === 0) {
    ElMessage.warning('该任务下没有待审批的指标')
    return
  }

  const indicatorNames = pendingRows.map(ind => ind.name).join('、')

  ElMessageBox.confirm(
    `确认撤回任务 "${group.taskContent}" 下的 ${pendingRows.length} 个待审批指标？\n\n${indicatorNames}`,
    '批量撤回确认',
    {
      confirmButtonText: '确认撤回',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    pendingRows.forEach(row => {
      // 撤回：将状态改回 none，并保留填报数据供修改
      // 或者改回 draft？用户说“撤回”，通常是回到可编辑状态。
      // 在这里我们改回 none，但保留 pendingProgress 等字段，这样“填报”按钮会显示这些值。
      // 实际上 updateIndicator 会合并对象。
      strategicStore.updateIndicator(row.id.toString(), {
        progressApprovalStatus: 'none'
      })

      // 添加审计日志
      strategicStore.addStatusAuditEntry(row.id.toString(), {
        operator: authStore.userName || 'unknown',
        operatorName: authStore.userName || '未知用户',
        operatorDept: authStore.userDepartment || '未知部门',
        action: 'revoke',
        comment: '批量撤回进度填报',
        previousStatus: 'pending',
        newStatus: 'none'
      })
    })

    ElMessage.info(`已撤回${pendingRows.length}项指标提交`)
  })
}

// 全局批量提交（职能部门/二级学院专用）
const handleBatchSubmitAll = () => {
  // 找出所有待提交（draft）或已驳回（rejected）的指标
  // @requirement 2.6 - 使用安全的状态检查，处理无效枚举值
  const pendingRows = indicators.value.filter(r => isApprovalStatus(r, ['draft', 'rejected']))
  
  if (pendingRows.length === 0) {
    ElMessage.warning('没有可提交的指标')
    return
  }

  const indicatorNames = pendingRows.map(ind => ind.name).join('、')

  ElMessageBox.prompt(
    `确认批量提交 ${pendingRows.length} 个指标的进度填报？\n\n指标列表：${indicatorNames}\n\n请输入提交备注：`,
    '批量提交确认',
    {
      confirmButtonText: '确定提交',
      cancelButtonText: '取消',
      inputPlaceholder: '请输入提交备注',
      inputType: 'textarea',
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return '请输入提交备注'
        }
        return true
      }
    }
  ).then(({ value: submitComment }) => {
    pendingRows.forEach(row => {
      // 提交：将状态改为 pending，并将 pendingProgress 等数据提交审批
      strategicStore.updateIndicator(row.id.toString(), {
        progressApprovalStatus: 'pending',
        progress: row.pendingProgress || row.progress || 0,
        progressComment: row.pendingProgressComment || row.progressComment || ''
      })

      // 添加审计日志
      strategicStore.addStatusAuditEntry(row.id.toString(), {
        operator: authStore.userName || 'unknown',
        operatorName: authStore.userName || '未知用户',
        operatorDept: authStore.userDepartment || '未知部门',
        action: 'submit',
        comment: submitComment || '批量提交进度填报',
        previousStatus: row.progressApprovalStatus,
        newStatus: 'pending',
        previousProgress: row.progress,
        newProgress: row.pendingProgress,
        progressComment: row.pendingProgressComment
      })
    })

    ElMessage.success(`成功提交${pendingRows.length}项指标进度`)
  })
}

// 全局批量撤回（职能部门/二级学院专用）
const handleBatchRevokeAll = () => {
  // 找出所有待审批（pending）的指标
  // @requirement 2.6 - 使用安全的状态检查，处理无效枚举值
  const pendingRows = indicators.value.filter(r => isApprovalStatus(r, 'pending'))
  
  if (pendingRows.length === 0) {
    ElMessage.warning('没有待审批的指标')
    return
  }

  const indicatorNames = pendingRows.map(ind => ind.name).join('、')

  ElMessageBox.confirm(
    `确认批量撤回 ${pendingRows.length} 个待审批指标？\n\n${indicatorNames}`,
    '批量撤回确认',
    {
      confirmButtonText: '确认撤回',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    pendingRows.forEach(row => {
      // 撤回：将状态改回 none
      strategicStore.updateIndicator(row.id.toString(), {
        progressApprovalStatus: 'none'
      })

      // 添加审计日志
      strategicStore.addStatusAuditEntry(row.id.toString(), {
        operator: authStore.userName || 'unknown',
        operatorName: authStore.userName || '未知用户',
        operatorDept: authStore.userDepartment || '未知部门',
        action: 'revoke',
        comment: '批量撤回进度填报',
        previousStatus: 'pending',
        newStatus: 'none'
      })
    })

    ElMessage.info(`已撤回${pendingRows.length}项指标提交`)
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
// @requirement 2.4 - Milestone data validation with complete fields
const calculateMilestoneStatus = (indicator: StrategicIndicator): 'success' | 'warning' | 'exception' => {
  if (!indicator.milestones || indicator.milestones.length === 0) {
    return getProgressStatus(indicator.progress)
  }

  const currentDate = new Date()

  const hasOverdueMilestone = indicator.milestones.some(milestone => {
    // 使用 safeGet 安全获取字段值，缺失时使用默认值
    const deadline = safeGet(milestone, 'deadline', '')
    const status = safeGet(milestone, 'status', 'pending')
    
    if (!deadline) return false // 没有截止日期的里程碑不算逾期
    
    const deadlineDate = new Date(deadline)
    if (isNaN(deadlineDate.getTime())) return false // 无效日期不算逾期
    
    return status === 'pending' && deadlineDate < currentDate
  })

  const hasUpcomingMilestone = indicator.milestones.some(milestone => {
    const status = safeGet(milestone, 'status', 'pending')
    const deadline = safeGet(milestone, 'deadline', '')
    
    if (status === 'completed') return false
    if (!deadline) return false // 没有截止日期的里程碑不算即将到期
    
    const deadlineDate = new Date(deadline)
    if (isNaN(deadlineDate.getTime())) return false // 无效日期不算即将到期
    
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
// @requirement 2.4 - Milestone data validation with complete fields
const getMilestoneProgressText = (indicator: StrategicIndicator): string => {
  if (!indicator.milestones || indicator.milestones.length === 0) {
    return `当前进度: ${indicator.progress}%`
  }

  // 使用 safeGet 安全获取状态字段
  const pendingMilestones = indicator.milestones.filter(m => {
    const status = safeGet(m, 'status', 'pending')
    return status === 'pending'
  }).length

  const currentDate = new Date()
  const overdueMilestonesCount = indicator.milestones.filter(m => {
    const status = safeGet(m, 'status', 'pending')
    const deadline = safeGet(m, 'deadline', '')
    
    if (status !== 'pending') return false
    if (!deadline) return false // 没有截止日期的里程碑不算逾期
    
    const deadlineDate = new Date(deadline)
    if (isNaN(deadlineDate.getTime())) return false // 无效日期不算逾期
    
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

// ============================================================
// 进度状态颜色计算函数
// 用于根据里程碑进度判断当前指标的完成状态
// 
// 【可配置项】预警天数阈值，可根据需求修改
// 位置：strategic-task-management/src/views/IndicatorListView.vue
// ============================================================
const PROGRESS_WARNING_DAYS = 5 // 预警天数阈值，距离里程碑截止日期多少天内显示预警

type ProgressStatusType = 'delayed' | 'warning' | 'ahead' | 'normal'

/**
 * 获取指标进度状态
 * @param indicator 指标对象
 * @returns 'delayed' | 'warning' | 'ahead' | 'normal'
 * 
 * 逻辑说明：
 * 1. delayed（红色）：当前进度未达到已过期里程碑的目标进度
 * 2. warning（黄色）：距离最近里程碑还有 PROGRESS_WARNING_DAYS 天内且未达标
 * 3. ahead（绿色）：当前进度已达到或超过最近里程碑的目标进度
 * 4. normal（默认）：其他正常情况
 * 
 * @requirement 2.4 - Milestone data validation with complete fields
 */
const getIndicatorProgressStatus = (indicator: StrategicIndicator): ProgressStatusType => {
  const milestones = indicator.milestones || []
  if (milestones.length === 0) {
    return 'normal'
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const currentProgress = indicator.progress || 0

  // 过滤掉没有有效截止日期的里程碑，并使用 safeGet 安全获取字段
  const validMilestones = milestones.filter(m => {
    const deadline = safeGet(m, 'deadline', '')
    if (!deadline) return false
    const date = new Date(deadline)
    return !isNaN(date.getTime())
  })

  if (validMilestones.length === 0) {
    return 'normal'
  }

  // 按deadline排序里程碑，使用 safeGet 安全获取截止日期
  const sortedMilestones = [...validMilestones].sort((a, b) => {
    const deadlineA = safeGet(a, 'deadline', '')
    const deadlineB = safeGet(b, 'deadline', '')
    return new Date(deadlineA).getTime() - new Date(deadlineB).getTime()
  })

  // 1. 检查是否有已过期但未达标的里程碑（延期/红色）
  for (const milestone of sortedMilestones) {
    const deadline = safeGet(milestone, 'deadline', '')
    const targetProgress = safeGet(milestone, 'targetProgress', 0)
    
    const deadlineDate = new Date(deadline)
    deadlineDate.setHours(23, 59, 59, 999)
    
    if (deadlineDate < today && currentProgress < targetProgress) {
      return 'delayed'
    }
  }

  // 2. 找到离今天最近的未来里程碑（deadline >= 今天）
  const nextMilestone = sortedMilestones.find(m => {
    const deadline = safeGet(m, 'deadline', '')
    const deadlineDate = new Date(deadline)
    deadlineDate.setHours(23, 59, 59, 999)
    return deadlineDate >= today
  })

  if (!nextMilestone) {
    // 没有未来的里程碑，检查最后一个里程碑是否完成
    const lastMilestone = sortedMilestones[sortedMilestones.length - 1]
    const lastTargetProgress = safeGet(lastMilestone, 'targetProgress', 0)
    if (lastMilestone && currentProgress >= lastTargetProgress) {
      return 'ahead' // 全部完成
    }
    return 'normal'
  }

  // 3. 检查是否超前完成（绿色）
  const nextTargetProgress = safeGet(nextMilestone, 'targetProgress', 0)
  if (currentProgress >= nextTargetProgress) {
    return 'ahead'
  }

  // 4. 检查是否预警（黄色）：距离deadline ≤ PROGRESS_WARNING_DAYS 天且未达标
  const nextDeadline = new Date(safeGet(nextMilestone, 'deadline', ''))
  nextDeadline.setHours(23, 59, 59, 999)
  const daysUntilDeadline = Math.ceil((nextDeadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (daysUntilDeadline <= PROGRESS_WARNING_DAYS && currentProgress < nextTargetProgress) {
    return 'warning'
  }

  return 'normal'
}

/**
 * 获取进度状态对应的CSS类名
 */
const getProgressStatusClass = (indicator: StrategicIndicator): string => {
  const status = getIndicatorProgressStatus(indicator)
  const classMap: Record<ProgressStatusType, string> = {
    delayed: 'progress-delayed',
    warning: 'progress-warning',
    ahead: 'progress-ahead',
    normal: ''
  }
  return classMap[status]
}

// 获取里程碑列表用于tooltip显示
// @requirement 2.4 - Milestone data validation with complete fields
interface MilestoneTooltipItem {
  id: string | number
  name: string
  expectedDate: string
  progress: number
  status: string
  isValid: boolean
}

/**
 * 验证并获取里程碑数据用于tooltip显示
 * 
 * 对每个里程碑进行数据完整性验证，缺失字段时显示默认值
 * 
 * @param indicator - 指标对象
 * @returns 验证后的里程碑列表，包含默认值填充
 * 
 * @requirement 2.4 - Milestone data validation with complete fields
 */
const getMilestonesTooltip = (indicator: StrategicIndicator): MilestoneTooltipItem[] => {
  const milestones = indicator.milestones || []
  
  return milestones.map((m, index) => {
    // 验证里程碑数据完整性
    const validationResult = validateMilestone(m)
    
    // 使用 safeGet 安全获取字段值，缺失时使用默认值
    const id = safeGet(m, 'id', `milestone-${index}`)
    const name = safeGet(m, 'name', '未命名里程碑')
    const deadline = safeGet(m, 'deadline', '')
    const targetProgress = safeGet(m, 'targetProgress', 0)
    const status = safeGet(m, 'status', 'pending')
    
    // 验证状态是否为有效枚举值
    const validStatus = MILESTONE_STATUS_VALUES.includes(status as typeof MILESTONE_STATUS_VALUES[number])
      ? status
      : 'pending'
    
    // 格式化日期显示
    let expectedDate = ''
    if (deadline) {
      try {
        const date = new Date(deadline)
        if (!isNaN(date.getTime())) {
          expectedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        }
      } catch {
        expectedDate = '日期格式错误'
      }
    } else {
      expectedDate = '未设置'
    }
    
    return {
      id,
      name,
      expectedDate,
      progress: typeof targetProgress === 'number' ? targetProgress : 0,
      status: validStatus,
      isValid: validationResult.isValid
    }
  })
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

// 计算离当前最近的里程碑（未完成且截止日期最近的）
// @requirement 2.4 - Milestone data validation with complete fields
const nearestMilestone = computed(() => {
  if (!currentReportIndicator.value?.milestones?.length) return null
  
  const now = new Date()
  const pendingMilestones = currentReportIndicator.value.milestones
    .filter(m => {
      const status = safeGet(m, 'status', 'pending')
      return status !== 'completed'
    })
    .map(m => {
      const deadline = safeGet(m, 'deadline', '')
      const name = safeGet(m, 'name', '未命名里程碑')
      const targetProgress = safeGet(m, 'targetProgress', 0)
      const id = safeGet(m, 'id', '')
      const status = safeGet(m, 'status', 'pending')
      
      return {
        id,
        name,
        targetProgress,
        deadline,
        status,
        deadlineDate: deadline ? new Date(deadline) : new Date(0)
      }
    })
    .filter(m => !isNaN(m.deadlineDate.getTime())) // 过滤掉无效日期
    .sort((a, b) => a.deadlineDate.getTime() - b.deadlineDate.getTime())
  
  // 返回最近的未完成里程碑
  return pendingMilestones[0] || null
})

// 格式化里程碑日期
// @requirement 2.4 - Milestone data validation with complete fields
const formatMilestoneDate = (deadline: string) => {
  if (!deadline) return '未设置'
  const date = new Date(deadline)
  if (isNaN(date.getTime())) return '日期格式错误'
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

// 打开填报弹窗
const handleOpenReportDialog = (row: StrategicIndicator) => {
  currentReportIndicator.value = row
  // 如果已有保存的填报数据，则加载之前的数据；否则使用当前进度
  const hasPendingData = row.pendingProgress !== undefined && row.pendingProgress !== null
  reportForm.value = {
    newProgress: hasPendingData ? row.pendingProgress : (row.progress || 0),
    remark: row.pendingRemark || '',
    attachments: row.pendingAttachments || []
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
    ElMessage.warning('请填写进度备注')
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


// 检查指标是否已填报（有待提交的进度数据或状态为draft/pending）
// @requirement 2.6 - 使用安全的状态检查，处理无效枚举值
const isIndicatorFilled = (row: StrategicIndicator): boolean => {
  // 状态为 draft 或 pending 表示已填报
  if (isApprovalStatus(row, ['draft', 'pending'])) {
    return true
  }
  // 有待提交的进度数据（包括0）也表示已填报
  if (row.pendingProgress !== undefined && row.pendingProgress !== null) {
    return true
  }
  // 有待提交的备注也表示已填报
  if (row.pendingRemark && row.pendingRemark.trim()) {
    return true
  }
  return false
}

// 检查所有指标是否都已填报
const allIndicatorsFilled = computed(() => {
  if (indicators.value.length === 0) return false
  return indicators.value.every(row => isIndicatorFilled(row))
})

// 检查是否所有指标都已提交（待审批状态）
// @requirement 2.6 - 使用安全的状态检查，处理无效枚举值
const allIndicatorsSubmitted = computed(() => {
  if (indicators.value.length === 0) return false
  return indicators.value.every(row => isApprovalStatus(row, 'pending'))
})

// 获取未填报的指标数量
const unfilledIndicatorsCount = computed(() => {
  return indicators.value.filter(row => !isIndicatorFilled(row)).length
})

// 一键提交所有指标（职能部门/二级学院专用）
const handleSubmitAll = () => {
  if (indicators.value.length === 0) {
    ElMessage.warning('没有可提交的指标')
    return
  }

  // 检查是否所有指标都已填报
  if (!allIndicatorsFilled.value) {
    const unfilled = unfilledIndicatorsCount.value
    ElMessage.warning(`还有 ${unfilled} 个指标未填报，请先完成所有指标的填报后再进行一键提交`)
    return
  }

  const indicatorNames = indicators.value.map(ind => ind.name).join('、')

  ElMessageBox.prompt(
    `确认一键提交所有 ${indicators.value.length} 个指标？\n\n指标列表：${indicatorNames}\n\n注意：提交后将无法修改，需等待上级部门审批。\n\n请输入提交备注：`,
    '一键提交确认',
    {
      confirmButtonText: '确定提交',
      cancelButtonText: '取消',
      inputPlaceholder: '请输入提交备注',
      inputType: 'textarea',
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return '请输入提交备注'
        }
        return true
      }
    }
  ).then(({ value: submitComment }) => {
    indicators.value.forEach(row => {
      // 提交：将状态改为 pending，使用当前进度数据
      strategicStore.updateIndicator(row.id.toString(), {
        progressApprovalStatus: 'pending',
        // 如果有待提交的进度数据就用待提交的，否则用当前进度
        progress: row.pendingProgress || row.progress || 0,
        progressComment: row.pendingProgressComment || row.progressComment || ''
      })

      // 添加审计日志
      strategicStore.addStatusAuditEntry(row.id.toString(), {
        operator: authStore.userName || 'unknown',
        operatorName: authStore.userName || '未知用户',
        operatorDept: authStore.userDepartment || '未知部门',
        action: 'submit',
        comment: submitComment || '一键提交所有指标进度',
        previousStatus: row.progressApprovalStatus,
        newStatus: 'pending',
        previousProgress: row.progress,
        newProgress: row.pendingProgress || row.progress,
        progressComment: row.pendingProgressComment || row.progressComment
      })
    })

    ElMessage.success(`成功提交所有${indicators.value.length}项指标进度`)
  })
}

// 一键撤回所有已提交的指标
// @requirement 2.6 - 使用安全的状态检查，处理无效枚举值
const handleWithdrawAll = () => {
  const pendingRows = indicators.value.filter(r => isApprovalStatus(r, 'pending'))
  
  if (pendingRows.length === 0) {
    ElMessage.warning('没有待审批的指标可撤回')
    return
  }

  const indicatorNames = pendingRows.map(ind => ind.name).join('、')

  ElMessageBox.confirm(
    `确认一键撤回所有 ${pendingRows.length} 个已提交的指标？\n\n${indicatorNames}\n\n撤回后可重新编辑填报内容。`,
    '一键撤回确认',
    {
      confirmButtonText: '确定撤回',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    pendingRows.forEach(row => {
      // 撤回：将状态改回 draft，保留填报数据供修改
      strategicStore.updateIndicator(row.id.toString(), {
        progressApprovalStatus: 'draft'
      })

      // 添加审计日志
      strategicStore.addStatusAuditEntry(row.id.toString(), {
        operator: authStore.userName || 'unknown',
        operatorName: authStore.userName || '未知用户',
        operatorDept: authStore.userDepartment || '未知部门',
        action: 'revoke',
        comment: '一键撤回所有指标进度',
        previousStatus: 'pending',
        newStatus: 'draft'
      })
    })

    ElMessage.success(`成功撤回${pendingRows.length}项指标提交`)
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
            <!-- 来源部门筛选（仅学院可见） -->
            <el-form-item label="来源部门" v-if="isSecondaryCollege && availableOwnerDepts.length > 0">
              <el-select v-model="filterOwnerDept" placeholder="选择来源部门" style="width: 200px;">
                <el-option 
                  v-for="dept in availableOwnerDepts" 
                  :key="dept" 
                  :label="dept" 
                  :value="dept" 
                />
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
            <div class="header-actions">
              <el-tag v-if="overallStatus === 'pending'" type="warning" size="small" class="overall-status-tag">待审批</el-tag>
              <el-tag v-else-if="overallStatus === 'rejected'" type="danger" size="small" class="overall-status-tag">已驳回</el-tag>
              <el-tag v-else-if="overallStatus === 'approved'" type="success" size="small" class="overall-status-tag">已通过</el-tag>
              <el-tag v-else type="info" size="small" class="overall-status-tag">{{ overallStatus === 'active' ? '进行中' : '草稿' }}</el-tag>
              <span class="indicator-count">共 {{ indicators.length }} 条记录</span>

            <!-- 职能部门/二级学院的批量操作按钮 -->
            <template v-if="!isStrategicDept">
              <!-- 一键提交按钮（所有指标都已填报且未全部提交时显示） -->
              <el-button 
                v-if="!allIndicatorsSubmitted"
                type="primary" 
                size="small" 
                :disabled="timeContext.isReadOnly || indicators.length === 0 || !allIndicatorsFilled"
                :title="!allIndicatorsFilled ? `还有 ${unfilledIndicatorsCount} 个指标未填报` : ''"
                @click="handleSubmitAll"
              >
                <el-icon><Upload /></el-icon>
                一键提交
              </el-button>
              <!-- 一键撤回按钮（所有指标都已提交时显示） -->
              <el-button 
                v-if="allIndicatorsSubmitted"
                type="warning" 
                size="small" 
                :disabled="timeContext.isReadOnly"
                @click="handleWithdrawAll"
              >
                <el-icon><RefreshLeft /></el-icon>
                一键撤回
              </el-button>
                        <!-- 审批进度按钮 -->
                        <el-button 
                          link
                          type="primary"
                          style="margin-left: 8px;"
                          @click="approvalDrawerVisible = true"
                        >
                          <el-icon style="margin-right: 4px;"><View /></el-icon>
                          审批进度
                        </el-button>
            </template>
          </div>
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
                    />
                    <span v-else class="remark-text">{{ row.remark || '' }}</span>
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
                    />
                    <span v-else class="weight-text">{{ row.weight }}</span>
                  </div>
                </template>
              </el-table-column>
              <!-- 进度 - 显示数字 -->
              <el-table-column label="里程碑" width="120" align="center">
                <template #default="{ row }">
                  <el-popover
                    placement="left"
                    :width="320"
                    trigger="hover"
                    :disabled="!row.milestones?.length"
                  >
                    <template #reference>
                      <div class="milestone-cell">
                        <span class="milestone-count">
                          {{ row.milestones?.length || 0 }} 个里程碑
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
                      <div v-if="!row.milestones?.length" class="milestone-empty">
                        暂无里程碑
                      </div>
                    </div>
                  </el-popover>
                </template>
              </el-table-column>
              <el-table-column prop="progress" label="进度" width="120" align="center">
                <template #default="{ row }">
                  <span class="progress-number" :class="getProgressStatusClass(row)">{{ row.progress || 0 }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="responsibleDept" label="责任部门" min-width="140" v-if="showResponsibleDeptColumn">
                <template #default="{ row }">
                  <span class="dept-text">{{ row.responsibleDept || '未分配' }}</span>
                </template>
              </el-table-column>

              <el-table-column label="操作" width="160" align="center">
                <template #default="{ row }">
                  <div class="action-cell">
                    <el-button link type="primary" size="small" @click="handleViewDetail(row)">查看</el-button>
                    <!-- 职能部门/二级学院显示填报/编辑按钮 -->
                    <!-- 待审批状态禁用编辑，已填报显示"编辑"（info颜色），未填报显示"填报"（success颜色） -->
                    <!-- @requirement 2.6 - 使用安全的状态检查，处理无效枚举值 -->
                    <el-button 
                      v-if="!isStrategicDept" 
                      link 
                      :type="isIndicatorFilled(row) ? 'info' : 'success'" 
                      size="small" 
                      :disabled="isApprovalStatus(row, 'pending') || timeContext.isReadOnly"
                      @click="handleOpenReportDialog(row)"
                    >{{ isApprovalStatus(row, 'rejected') ? '重新填报' : (isIndicatorFilled(row) ? '编辑' : '填报') }}</el-button>

                    <el-button link type="danger" size="small" @click="handleDeleteIndicator(row)" v-if="canEdit">删除</el-button>
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
          <el-descriptions-item label="备注" :span="2">{{ currentDetail.remark || '暂无备注' }}</el-descriptions-item>
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
            <el-tooltip v-if="nearestMilestone" :content="nearestMilestone.name || '里程碑'" placement="top">
              <span class="info-value milestone-target">
                {{ nearestMilestone.targetProgress }}%（{{ formatMilestoneDate(nearestMilestone.deadline) }}）
              </span>
            </el-tooltip>
            <span class="info-value" v-else>{{ currentReportIndicator.targetValue }}{{ currentReportIndicator.unit }}</span>
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
          <el-form-item label="进度备注" required>
            <el-input
              v-model="reportForm.remark"
              type="textarea"
              :rows="4"
              placeholder="请详细备注本次进度更新的工作内容和完成情况..."
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

    <!-- 任务审批进度抽屉 -->
    <TaskApprovalDrawer
      v-model:visible="approvalDrawerVisible"
      :indicators="approvalIndicators"
      :department-name="authStore.userDepartment || '当前部门'"
      :show-approval-section="isStrategicDept"
    />
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

.overall-status-tag {
  /* Let flex gap handle spacing */
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
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

/* ========================================
   进度条样式 - 统一进度条规范
   Requirements: 10.1, 10.2
   ======================================== */
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

/* ============================================================
   进度状态颜色样式
   用于根据里程碑进度判断显示不同颜色
   
   【可配置项】预警天数阈值在 script 部分的 PROGRESS_WARNING_DAYS 常量
   位置：strategic-task-management/src/views/IndicatorListView.vue
   ============================================================ */

/* 延期状态 - 红色：当前进度未达到已过期里程碑的目标 */
.progress-number.progress-delayed {
  color: #F56C6C;
  font-weight: 600;
}

/* 预警状态 - 黄色：距离最近里程碑还有5天内且未达标 */
.progress-number.progress-warning {
  color: #E6A23C;
  font-weight: 600;
}

/* 超前完成 - 绿色：当前进度已达到最近里程碑的目标 */
.progress-number.progress-ahead {
  color: #67C23A;
  font-weight: 600;
}

.progress-bar-inline {
  width: 100%;
}

/* 进度条颜色覆盖 - 确保颜色正确显示 */
.progress-bar-inline :deep(.el-progress-bar__inner) {
  transition: width 0.3s ease, background-color 0.3s ease;
}

/* 成功状态 - 绿色 */
.progress-bar-inline :deep(.el-progress--success .el-progress-bar__inner) {
  background-color: var(--color-success, #67c23a) !important;
}

/* 警告状态 - 黄色 */
.progress-bar-inline :deep(.el-progress--warning .el-progress-bar__inner) {
  background-color: var(--color-warning, #e6a23c) !important;
}

/* 异常状态 - 红色 */
.progress-bar-inline :deep(.el-progress--exception .el-progress-bar__inner) {
  background-color: var(--color-danger, #f56c6c) !important;
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

.report-indicator-info .info-value.milestone-target {
  cursor: help;
  border-bottom: 1px dashed var(--color-primary);
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

/* ========================================
   里程碑列样式
   ======================================== */
.milestone-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  cursor: default;
}

.milestone-count {
  font-size: 13px;
  color: var(--text-regular, #475569);
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
</style>
