<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Plus, View, Download, Delete as _Delete, ArrowDown as _ArrowDown, Promotion, RefreshLeft, Check, Close, Upload, Edit, Refresh, User, ChatDotRound, Right } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { ElTable } from 'element-plus'
/* eslint-disable no-restricted-syntax -- Backend-aligned types */
import type { StrategicTask as _StrategicTask, StrategicIndicator, Milestone } from '@/5-shared/types'
import { IndicatorStatus } from '@/5-shared/types/entities'
/* eslint-enable no-restricted-syntax */
import { useStrategicStore } from '@/3-features/task/model/strategic'
import { useAuthStore } from '@/3-features/auth/model/store'
import { useTimeContextStore } from '@/5-shared/lib/timeContext'
import {
  getProgressStatus,
  getProgressColor as _getProgressColor,
  getStatusTagType as _getStatusTagType
} from '@/5-shared/lib/utils'
import type { StatusAuditEntry as _StatusAuditEntry } from '@/5-shared/types'
import { useOrgStore } from '@/3-features/organization/model/store'
import { usePlanStore } from '@/3-features/plan/model/store'
import { ApprovalProgressDrawer } from '@/3-features/approval'
import { useDataValidator } from '@/5-shared/lib/validation/dataValidator'
import { normalizePlanStatus } from '@/3-features/task/lib/planStatus'
import {
  milestoneDefaultValues as _milestoneDefaultValues,
  MILESTONE_STATUS_VALUES,
  PROGRESS_APPROVAL_STATUS_VALUES,
  type ProgressApprovalStatusValue
} from '@/5-shared/config/validationRules'

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

  if (diffMins < 1) {return '刚刚'}
  if (diffMins < 60) {return `${diffMins}分钟前`}
  if (diffHours < 24) {return `${diffHours}小时前`}
  if (diffDays < 30) {return `${diffDays}天前`}
  return formatAuditTime(timestamp)
}

// 使用共享 Store
const strategicStore = useStrategicStore()
const authStore = useAuthStore()
const timeContext = useTimeContextStore()
const planStore = usePlanStore()
const orgStore = useOrgStore()

onMounted(async () => {
  try {
    await orgStore.loadDepartments()
  } catch {
    // ignore org load failure, indicator query still proceeds
  }

  try {
    await strategicStore.loadIndicatorsByYear(timeContext.currentYear)
  } catch {
    // errors are already handled in store
  }
})

// 使用数据验证器 - 用于验证里程碑数据完整性
// @requirement 2.4 - Milestone data validation with complete fields
const { validateMilestone, safeGet, validateEnum } = useDataValidator({ logErrors: true })

// ============================================================================
// 审批状态枚举值验证与容错处理
// @requirement 2.6 - progressApprovalStatus enum validation
// ============================================================================

/**
 * 默认审批状态值 - 当状态无效时使用
 */
const DEFAULT_APPROVAL_STATUS: ProgressApprovalStatusValue = 'NONE'

/**
 * 安全获取审批状态值
 * 
 * 检查 progressApprovalStatus 是否为有效枚举值，无效时返回默认值 'NONE'
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
 * @requirement: Plan-centric status - 改为检查 Plan 的状态，而不是单个指标的状态
 * 一个 Plan 下的所有指标共享同一个 Plan 的状态
 *
 * @param _indicator - 指标对象（保留参数以保持兼容性，但不再使用）
 * @param targetStatus - 目标状态或状态数组
 * @returns 是否匹配目标状态
 */
function isApprovalStatus(
  _indicator: StrategicIndicator,
  targetStatus: ProgressApprovalStatusValue | ProgressApprovalStatusValue[]
): boolean {
  // @requirement: Plan-centric - 使用 Plan 的状态作为所有指标的状态
  const planStatus = currentPlanStatus.value?.toLowerCase() || 'draft'

  // Plan 状态映射: DRAFT -> draft, PENDING -> pending, ACTIVE -> approved/active, REJECTED -> rejected
  let effectiveStatus: ProgressApprovalStatusValue = 'draft'
  switch (planStatus) {
    case 'active':
      effectiveStatus = 'approved'
      break
    case 'pending':
      effectiveStatus = 'pending'
      break
    case 'rejected':
      effectiveStatus = 'rejected'
      break
    case 'completed':
    case 'archived':
      effectiveStatus = 'approved'
      break
    case 'draft':
    default:
      effectiveStatus = 'draft'
  }

  if (Array.isArray(targetStatus)) {
    return targetStatus.includes(effectiveStatus)
  }

  return effectiveStatus === targetStatus
}

// 接收父组件传递的选中角色和部门
const props = defineProps<{
  viewingRole?: string  // 角色类型: 'strategic_dept' | 'functional_dept' | 'secondary_college'
  viewingDept?: string  // 部门名称: 如 '党委宣传部 | 宣传策划部'
}>()

// 当前有效角色与部门（支持独立页面直接访问，不依赖外层传参）
const effectiveViewingRole = computed(() => props.viewingRole || authStore.userRole || '')
const effectiveViewingDept = computed(() => {
  return props.viewingDept || authStore.effectiveDepartment || authStore.userDepartment || ''
})

// 判断当前是否为战略发展部角色
const isStrategicDept = computed(() => {
  return effectiveViewingRole.value === 'strategic_dept'
})

// 判断当前是否为二级学院角色
const isSecondaryCollege = computed(() => {
  return effectiveViewingRole.value === 'secondary_college'
})

// 当前计划的状态
const currentPlanStatus = computed(() => {
  return currentPlanDetails.value?.status || null
})

const normalizedCurrentPlanStatus = computed(() => {
  return normalizePlanStatus(currentPlanStatus.value)
})

// 判断计划是否处于草稿状态
const isPlanDraft = computed(() => {
  return normalizedCurrentPlanStatus.value === 'DRAFT' || normalizedCurrentPlanStatus.value === null
})

// 判断计划是否已下发
const isPlanDistributed = computed(() => {
  return normalizedCurrentPlanStatus.value === 'DISTRIBUTED'
})

// 判断是否可以编辑（只有战略发展部可以编辑，且计划处于草稿状态，历史年份只读）
const canEdit = computed(() => {
  return authStore.userRole === 'strategic_dept' &&
         isStrategicDept.value &&
         !timeContext.isReadOnly &&
         isPlanDraft.value
})

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
  if (!isSecondaryCollege.value || !effectiveViewingDept.value) {return []}
  
  const currentYear = timeContext.currentYear
  const realYear = timeContext.realCurrentYear
  
  // 获取当前学院作为责任部门的所有指标的来源部门
  const ownerDepts = new Set<string>()
  strategicStore.indicators.forEach(i => {
    const indicatorYear = i.year || realYear
    if (indicatorYear === currentYear && 
        i.responsibleDept === effectiveViewingDept.value && 
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

// 职能部门列表（从数据库动态获取）
const functionalDepartments = computed(() => orgStore.getAllFunctionalDepartmentNames())

const resolvePlanYear = (plan: any): number | null => {
  const explicitYear = plan?.cycle?.year ?? plan?.year
  if (explicitYear != null && explicitYear !== '') {
    return Number(explicitYear)
  }

  const cycleId = Number(plan?.cycleId)
  if (cycleId === 4 || cycleId === 90) {
    return 2026
  }
  if (cycleId === 7) {
    return 2025
  }

  return null
}

// 获取当前用户对应的 Plan（包含指标数据）
const currentUserPlan = computed(() => {
  // 获取当前用户所在的部门
  const userDept = effectiveViewingDept.value || authStore.userDepartment || ''
  if (!userDept) {
    return null
  }

  // 从 Plan Store 中查找目标部门为当前用户部门的 Plan
  return planStore.plans.find((p: any) => {
    const targetOrgName = p.targetOrgName || ''
    const cycleYear = resolvePlanYear(p)
    return targetOrgName === userDept && cycleYear === timeContext.currentYear
  }) || null
})

// 当前用户 Plan ID
const currentUserPlanId = computed(() => {
  return currentUserPlan.value?.id
})

// 存储当前 Plan 的详情（包含指标数据）
const currentPlanDetails = ref<any>(null)

// Plan 详情加载状态
const isLoadingPlanDetails = ref(false)

// 监听 Plan ID 变化，自动加载 Plan 详情
watch(
  currentUserPlanId,
  async (newPlanId) => {
    if (newPlanId && (!currentPlanDetails.value || currentPlanDetails.value?.id !== newPlanId)) {
      // 加载 Plan 详情
      isLoadingPlanDetails.value = true
      const plan = await planStore.loadPlanDetails(newPlanId)
      if (plan) {
        currentPlanDetails.value = plan
      }
      isLoadingPlanDetails.value = false
    } else if (!newPlanId) {
      currentPlanDetails.value = null
      isLoadingPlanDetails.value = false
    }
  },
  { immediate: true }
)

// 从当前 Plan 中提取指标列表（使用后端返回的指标数据）
const currentPlanIndicators = computed(() => {
  const plan = currentPlanDetails.value
  if (!plan || !plan.indicators) {
    return []
  }

  // 后端返回的 PlanDetailsResponse 包含 indicators 数组
  // 将后端指标格式转换为前端 StrategicIndicator 格式
  return plan.indicators.map((ind: any) => ({
    id: String(ind.id),
    name: ind.indicatorName || ind.name || '',
    indicator_desc: ind.indicatorDesc || ind.description || '',
    description: ind.indicatorDesc || ind.description || '',
    progress: ind.progress || 0,
    weight: ind.weightPercent || 0,
    type: '定量',
    type1: '定量',
    type2: '发展性',
    status: ind.status?.toLowerCase() || 'active',
    isStrategic: true,
    year: timeContext.currentYear,
    ownerDept: '战略发展部',
    responsibleDept: authStore.userDepartment || '',
    milestones: [],
    createdAt: ind.createdAt || '',
    updatedAt: ind.updatedAt || ''
  } as StrategicIndicator))
})

// 判断当前是否存在可供当前页面展示的 Plan 数据
// 只有“Plan 有指标”且“Plan 已下发”时，职能部门/学院界面才允许展示
const hasCurrentUserPlanData = computed(() => {
  const plan = currentPlanDetails.value
  return plan && plan.indicators && plan.indicators.length > 0
})

const hasCurrentUserPlan = computed(() => {
  return hasCurrentUserPlanData.value && (isStrategicDept.value || isPlanDistributed.value)
})

// 判断是否正在加载初始数据
const isInitialLoading = computed(() => {
  // Plan Store 正在加载
  if (planStore.loading) {
    return true
  }
  // Plan 详情正在加载
  if (isLoadingPlanDetails.value) {
    return true
  }
  // 如果有 currentUserPlanId，但还没有加载 currentPlanDetails
  if (currentUserPlanId.value && !currentPlanDetails.value) {
    return true
  }
  return false
})

// 判断是否应该显示"未找到 Plan"的警告
// 只有在非加载状态、非战略发展部、且确实没有 Plan 时才显示
const shouldShowPlanWarning = computed(() => {
  // 加载中不显示警告
  if (isInitialLoading.value) {
    return false
  }
  // 战略发展部不显示警告
  if (isStrategicDept.value) {
    return false
  }
  // 有可展示的 Plan 不显示警告
  if (hasCurrentUserPlan.value) {
    return false
  }
  // 没有已下发 Plan，或 Plan 未下发时显示警告
  return true
})

const planWarningMessage = computed(() => {
  const departmentName = effectiveViewingDept.value || authStore.userDepartment || '当前部门'

  if (hasCurrentUserPlanData.value && !isPlanDistributed.value) {
    return `当前部门（${departmentName}）已存在 ${timeContext.currentYear} 年度计划，但上级 Plan 仍未处于“已下发”状态，因此本界面不应展示指标。请先完成下发后再查看。`
  }

  if (isSecondaryCollege.value) {
    return `当前部门（${departmentName}）暂未接收到 ${timeContext.currentYear} 年度的指标计划。请联系上级职能部门下发计划后再查看指标。`
  }

  return `当前部门（${departmentName}）暂未创建 ${timeContext.currentYear} 年度的战略计划。请联系战略发展部创建计划后再查看指标。`
})

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
  // 非战略部门只有在计划已下发（已下发状态）时才能看到指标
  if (!isStrategicDept.value && effectiveViewingDept.value) {
    list = list.filter(i => {
      // 非战略角色仅查看“接收部门=当前部门”的指标，避免与下发来源部门混淆
      // 且仅在计划已下发后才可见
      return isPlanDistributed.value && i.responsibleDept === effectiveViewingDept.value
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
const _pendingApprovalCount = computed(() => {
  let list = strategicStore.indicators

  // 按当前年份过滤
  const currentYear = timeContext.currentYear
  const realYear = timeContext.realCurrentYear
  list = list.filter(i => {
    const indicatorYear = i.year || realYear
    return indicatorYear === currentYear
  })

  // 根据当前角色过滤数据
  // 非战略部门只有在计划已下发时才能看到指标
  if (!isStrategicDept.value && effectiveViewingDept.value) {
    list = list.filter(i => {
      // 非战略角色仅统计“接收部门=当前部门”的待审批数据
      // 且仅在计划已下发后才可见
      return isPlanDistributed.value && i.responsibleDept === effectiveViewingDept.value
    })
  }

  // 只统计待审批状态的指标数量
  // @requirement 2.6 - 使用安全的状态检查，处理无效枚举值
  return list.filter(i => isApprovalStatus(i, 'PENDING')).length
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
const _currentTask = computed(() => taskList.value[currentTaskIndex.value] || {
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

  // 优先使用当前 Plan 中的指标数据，但非战略角色必须满足“Plan 已下发”
  if (hasCurrentUserPlan.value && currentPlanIndicators.value.length > 0) {
    let list = currentPlanIndicators.value

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

    // 排序
    return list.sort((a, b) => {
      const type2A = a.type2 || ''
      const type2B = b.type2 || ''
      if (type2A !== type2B) {
        return type2A === '发展性' ? -1 : 1
      }
      const taskA = a.taskContent || ''
      const taskB = b.taskContent || ''
      return taskA.localeCompare(taskB)
    })
  }

  // 回退到使用 strategicStore.indicators（向后兼容）
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

  // 根据 Plan 筛选指标（优先级高于角色过滤）
  // 如果存在当前用户的 Plan，只显示该 Plan 包含的指标
  const plan = currentUserPlan.value
  if (plan && plan.indicatorIds && plan.indicatorIds.length > 0) {
    list = list.filter(i => plan.indicatorIds.includes(Number(i.id)))
  }

  // 根据当前角色过滤数据
  // 如果不是战略发展部，只显示下发到当前部门（责任部门）的指标
  // 且仅在计划已下发后才可见
  if (!isStrategicDept.value && effectiveViewingDept.value) {
    list = list.filter(i => {
      return isPlanDistributed.value && i.responsibleDept === effectiveViewingDept.value
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

// @requirement: Plan-centric status - 整体状态直接使用 Plan 的状态，而不是从单个指标计算
// 一个 Plan 下的所有指标共享同一个状态
const overallStatus = computed(() => {
  const planStatus = currentPlanStatus.value
  if (!planStatus) { return 'draft' }
  // 将 Plan 状态转换为小写以统一处理
  const status = planStatus.toLowerCase()
  // Plan 状态: DRAFT -> draft, PENDING -> pending, ACTIVE -> active, REJECTED -> rejected, COMPLETED -> completed
  switch (status) {
    case 'active':
      return 'active'
    case 'pending':
      return 'pending'
    case 'rejected':
      return 'rejected'
    case 'completed':
    case 'archived':
      return 'completed'
    case 'draft':
    default:
      return 'draft'
  }
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
const _getTaskGroup = (row: StrategicIndicator) => {
  const taskContent = row.taskContent || '未命名任务'
  const rows = indicators.value.filter(i => (i.taskContent || '未命名任务') === taskContent)
  return { taskContent, rows }
}

// 按任务组批量分解（战略发展部专用）
const _handleBatchDistributeByTask = (group: { taskContent: string; rows: StrategicIndicator[] }) => {
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
const _handleBatchFillByTask = (group: { taskContent: string; rows: StrategicIndicator[] }) => {
  // 找出所有待提交（draft）或已驳回（rejected）的指标
  // @requirement 2.6 - 使用安全的状态检查，处理无效枚举值
  const pendingRows = group.rows.filter(r => isApprovalStatus(r, ['DRAFT', 'REJECTED']))
  
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
          progressApprovalStatus: 'PENDING'
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
          newStatus: 'PENDING'
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
const _handleBatchRevokeByTask = (group: { taskContent: string; rows: StrategicIndicator[] }) => {
  // 找出所有待审批（pending）的指标
  // @requirement 2.6 - 使用安全的状态检查，处理无效枚举值
  const pendingRows = group.rows.filter(r => isApprovalStatus(r, 'PENDING'))
  
  if (pendingRows.length === 0) {
    ElMessage.warning('该任务下没有待审批的指标')
    return
  }

  const indicatorNames = pendingRows.map(ind => ind.name).join('、')

  ElMessageBox.confirm(
    `确认撤回任务 "${group.taskContent}" 下的 ${pendingRows.length} 个待审批指标的进度审批？\n\n${indicatorNames}`,
    '批量撤回进度审批',
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
        progressApprovalStatus: 'DRAFT'
      })

      // 添加审计日志
      strategicStore.addStatusAuditEntry(row.id.toString(), {
        operator: authStore.userName || 'unknown',
        operatorName: authStore.userName || '未知用户',
        operatorDept: authStore.userDepartment || '未知部门',
        action: 'revoke',
        comment: '批量撤回进度审批',
        previousStatus: 'pending',
        newStatus: 'draft'
      })
    })

    ElMessage.info(`已撤回${pendingRows.length}项指标提交`)
  })
}

// 全局批量提交（职能部门/二级学院专用）
const _handleBatchSubmitAll = () => {
  // 找出所有待提交（draft）或已驳回（rejected）的指标
  // @requirement 2.6 - 使用安全的状态检查，处理无效枚举值
  const pendingRows = indicators.value.filter(r => isApprovalStatus(r, ['DRAFT', 'REJECTED']))
  
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
        progressApprovalStatus: 'PENDING',
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
        newStatus: 'PENDING',
        previousProgress: row.progress,
        newProgress: row.pendingProgress,
        progressComment: row.pendingProgressComment
      })
    })

    ElMessage.success(`成功提交${pendingRows.length}项指标进度`)
  })
}

// 全局批量撤回（职能部门/二级学院专用）
// 获取任务类型对应的颜色
const getTaskTypeColor = (type2: string) => {
  return type2 === '发展性' ? '#409EFF' : '#67C23A'
}

// 按类别筛选指标
const _developmentIndicators = computed(() => indicators.value.filter(i => i.type2 === '发展性'))
const _basicIndicators = computed(() => indicators.value.filter(i => i.type2 === '基础性'))

// 新增行数据
const newRow = ref({
  taskContent: '',
  name: '',
  type1: '定性' as '定性' | '定量',
  type2: '基础性' as '发展性' | '基础性',
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
const _showMilestoneInput = ref(false)

// 任务下发相关状态
const showAssignmentDialog = ref(false)
const assignmentTarget = ref('')
const assignmentMethod = ref<'self' | 'college'>('self')

// 添加新里程碑
const _addMilestone = () => {
  newRow.value.milestones.push({
    id: Date.now(),
    name: '',
    targetProgress: 0,
    deadline: '',
    status: 'pending'
  })
}

// 删除里程碑
const _removeMilestone = (index: number) => {
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
const _handleDoubleClick = (field: 'title' | 'desc' | 'cycle' | 'createTime', value: string) => {
  if (!canEdit.value) {return}
  editingField.value = field
  editingValue.value = value
}

// 任务详情保存编辑
const _saveEdit = (field: 'title' | 'desc' | 'cycle' | 'createTime') => {
  if (editingValue.value === undefined || editingValue.value === null) {
    cancelEdit()
    return
  }

  const task = taskList.value[currentTaskIndex.value]
  if (field === 'title') {task.title = editingValue.value}
  else if (field === 'desc') {task.desc = editingValue.value}
  else if (field === 'cycle') {task.cycle = editingValue.value}
  else if (field === 'createTime') {task.createTime = editingValue.value}

  cancelEdit()
}

// 任务详情取消编辑
const cancelEdit = () => {
  editingField.value = null
  editingValue.value = ''
}

// 指标双击编辑
const handleIndicatorDblClick = (row: StrategicIndicator, field: string) => {
  if (!canEdit.value) {return}
  editingIndicatorId.value = row.id
  editingIndicatorField.value = field
  editingIndicatorValue.value = row[field as keyof StrategicIndicator]
}

// 保存指标编辑
const saveIndicatorEdit = (row: StrategicIndicator, field: string) => {
  if (editingIndicatorId.value === null) {return}

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
const _addIndicatorToCategory = (category: '发展性' | '基础性') => {
  newRow.value.type2 = category
  isAddingOrEditing.value = true
}

const cancelAdd = () => {
  isAddingOrEditing.value = false
  newRow.value = { taskContent: '', name: '', type1: '定性', type2: '基础性', weight: '', remark: '', milestones: [] }
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
    responsiblePerson: '',
    status: 'active',
    isStrategic: true,
    taskContent: newRow.value.taskContent
  })
  ElMessage.success('指标添加成功')
  cancelAdd()
}

// 里程碑状态计算
// @requirement 2.4 - Milestone data validation with complete fields
const _calculateMilestoneStatus = (indicator: StrategicIndicator): 'success' | 'warning' | 'exception' => {
  if (!indicator.milestones || indicator.milestones.length === 0) {
    return getProgressStatus(indicator.progress)
  }

  const currentDate = new Date()

  const hasOverdueMilestone = indicator.milestones.some(milestone => {
    // 使用 safeGet 安全获取字段值，缺失时使用默认值
    const deadline = safeGet(milestone, 'deadline', '')
    const status = safeGet(milestone, 'status', 'pending')
    
    if (!deadline) {return false} // 没有截止日期的里程碑不算逾期
    
    const deadlineDate = new Date(deadline)
    if (isNaN(deadlineDate.getTime())) {return false} // 无效日期不算逾期
    
    return status === 'pending' && deadlineDate < currentDate
  })

  const hasUpcomingMilestone = indicator.milestones.some(milestone => {
    const status = safeGet(milestone, 'status', 'pending')
    const deadline = safeGet(milestone, 'deadline', '')
    
    if (status === 'completed') {return false}
    if (!deadline) {return false} // 没有截止日期的里程碑不算即将到期
    
    const deadlineDate = new Date(deadline)
    if (isNaN(deadlineDate.getTime())) {return false} // 无效日期不算即将到期
    
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
const _getMilestoneProgressText = (indicator: StrategicIndicator): string => {
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
    
    if (status !== 'pending') {return false}
    if (!deadline) {return false} // 没有截止日期的里程碑不算逾期
    
    const deadlineDate = new Date(deadline)
    if (isNaN(deadlineDate.getTime())) {return false} // 无效日期不算逾期
    
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
    if (!deadline) {return false}
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

const _selectDepartment = (dept: string) => {
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
const _confirmAssignment = () => {
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
const _batchDistributeToDepartments = () => {
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

// ============================================================================
// 指标生命周期撤回操作 (Indicator Lifecycle Withdrawal)
// 操作字段: status (DISTRIBUTED -> DRAFT via approval workflow)
// 用途: 撤回已下发的指标，使其回到草稿状态可重新编辑
// @requirement 2.1, 2.2, 3.3, 3.4 - 分离审批操作和生命周期操作
// ============================================================================

/**
 * 撤回已下发的指标 (生命周期操作)
 * 操作指标的生命周期状态字段 (status)，不影响进度审批状态
 * 这是一个需要审批的操作：DISTRIBUTED -> PENDING_WITHDRAW_REVIEW -> DRAFT
 */
const handleWithdrawIndicator = (row: StrategicIndicator) => {
  ElMessageBox.confirm(
    `确定要撤回指标 "${row.name}" 的下发吗？撤回后可以重新编辑。`,
    '撤回指标下发',
    {
      confirmButtonText: '确定撤回',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      // 调用后端服务撤回指标生命周期状态
      await strategicStore.withdrawIndicator(row.id.toString())
      ElMessage.success('指标下发撤回成功')
    } catch (err) {
      ElMessage.error('指标下发撤回失败，请稍后重试')
    }
  })
}

// 表格滚动状态
const _tableScrollRef = ref<HTMLElement | null>(null)
const isTableScrolling = ref(false)

const _handleTableScroll = (e: Event) => {
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
  if (!currentReportIndicator.value?.milestones?.length) {return null}
  
  const _now = new Date()
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
  if (!deadline) {return '未设置'}
  const date = new Date(deadline)
  if (isNaN(date.getTime())) {return '日期格式错误'}
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
  if (!currentReportIndicator.value) {return}

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
    progressApprovalStatus: 'DRAFT',  // 待提交状态
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
  if (isApprovalStatus(row, ['DRAFT', 'PENDING'])) {
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
  if (indicators.value.length === 0) {return false}
  return indicators.value.every(row => isIndicatorFilled(row))
})

// 检查是否所有指标都已提交（待审批状态）
// @requirement 2.6 - 使用安全的状态检查，处理无效枚举值
const allIndicatorsSubmitted = computed(() => {
  if (indicators.value.length === 0) {return false}
  return indicators.value.every(row => isApprovalStatus(row, 'PENDING'))
})

/**
 * 计算属性：判断是否存在任何可供撤回的指标。
 * 只有当至少有一个指标的状态是 'PENDING' (待审批) 时，才允许撤回。
 * 
 * @requirement 2.6 - 使用安全的状态检查，处理无效枚举值
 */
const canWithdrawAny = computed(() => {
  if (indicators.value.length === 0) {return false}
  return indicators.value.some(row => isApprovalStatus(row, 'PENDING'))
})

/**
 * 计算属性：为撤回按钮提供动态的提示信息。
 */
const withdrawTooltip = computed(() => {
  if (timeContext.isReadOnly) {
    return '当前时间窗口为只读，无法操作。'
  }
  if (canWithdrawAny.value) {
    return '' // 如果可以撤回，则没有提示
  }
  return '没有待审批的指标可供撤回' // 如果不可撤回，提供原因
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
        progressApprovalStatus: 'PENDING',
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
        newStatus: 'PENDING',
        previousProgress: row.progress,
        newProgress: row.pendingProgress || row.progress,
        progressComment: row.pendingProgressComment || row.progressComment
      })
    })

    ElMessage.success(`成功提交所有${indicators.value.length}项指标进度`)
  })
}

// ============================================================================
// 进度审批撤回操作 (Progress Approval Withdrawal)
// 操作字段: progressApprovalStatus (PENDING -> DRAFT)
// 用途: 撤回已提交的进度审批，允许重新编辑填报内容
// @requirement 2.1, 2.2, 3.3, 3.4 - 分离审批操作和生命周期操作
// ============================================================================

/**
 * 撤回单个指标的进度审批
 * 仅操作 progressApprovalStatus 字段，不影响指标生命周期状态
 */
const handleWithdrawProgressApproval = (row: StrategicIndicator) => {
  // 检查是否为待审批状态
  if (!isApprovalStatus(row, 'PENDING')) {
    ElMessage.warning('只能撤回待审批状态的进度')
    return
  }

  ElMessageBox.confirm(
    `确定要撤回指标 "${row.name}" 的进度审批吗？撤回后可以重新编辑填报内容。`,
    '撤回进度审批',
    {
      confirmButtonText: '确定撤回',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    // 撤回进度审批：将 progressApprovalStatus 改回 DRAFT
    strategicStore.updateIndicator(row.id.toString(), {
      progressApprovalStatus: 'DRAFT'
    })

    // 添加审计日志
    strategicStore.addStatusAuditEntry(row.id.toString(), {
      operator: authStore.userName || 'unknown',
      operatorName: authStore.userName || '未知用户',
      operatorDept: authStore.userDepartment || '未知部门',
      action: 'revoke',
      comment: '撤回进度审批',
      previousStatus: 'pending',
      newStatus: 'draft'
    })

    ElMessage.success('进度审批撤回成功')
  })
}

/**
 * 一键撤回所有已提交的指标进度审批
 * 仅操作 progressApprovalStatus 字段，不影响指标生命周期状态
 * @requirement 2.6 - 使用安全的状态检查，处理无效枚举值
 */
const handleWithdrawAllProgressApprovals = () => {
  // 二次校验：确保有可撤回的指标
  if (!canWithdrawAny.value) {
    ElMessage.warning(withdrawTooltip.value)
    return
  }

  const pendingRows = indicators.value.filter(r => isApprovalStatus(r, 'PENDING'))
  
  if (pendingRows.length === 0) {
    ElMessage.warning('没有待审批的指标可撤回')
    return
  }

  const indicatorNames = pendingRows.map(ind => ind.name).join('、')

  ElMessageBox.confirm(
    `确认一键撤回所有 ${pendingRows.length} 个已提交的指标进度审批？\n\n${indicatorNames}\n\n撤回后可重新编辑填报内容。`,
    '一键撤回进度审批',
    {
      confirmButtonText: '确定撤回',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    pendingRows.forEach(row => {
      // 撤回进度审批：将 progressApprovalStatus 改回 DRAFT，保留填报数据供修改
      strategicStore.updateIndicator(row.id.toString(), {
        progressApprovalStatus: 'DRAFT'
      })

      // 添加审计日志
      strategicStore.addStatusAuditEntry(row.id.toString(), {
        operator: authStore.userName || 'unknown',
        operatorName: authStore.userName || '未知用户',
        operatorDept: authStore.userDepartment || '未知部门',
        action: 'revoke',
        comment: '一键撤回所有指标进度审批',
        previousStatus: 'pending',
        newStatus: 'draft'
      })
    })

    ElMessage.success(`成功撤回${pendingRows.length}项指标进度审批`)
  })
}

// ============================================================================
// 状态显示辅助函数
// @requirement 2.9, 3.1, 3.2 - 清晰分离生命周期状态和审批状态
// ============================================================================

/**
 * 获取生命周期状态的显示文本
 * @param status - 指标生命周期状态
 * @returns 中文显示文本
 */
const getLifecycleStatusText = (status: IndicatorStatus | string): string => {
  const statusMap: Record<string, string> = {
    DRAFT: '草稿',
    PENDING: '草稿', // 兼容历史状态值，按草稿展示
    PENDING_REVIEW: '待审核',
    DISTRIBUTED: '已下发',
    ACTIVE: '已下发',  // Legacy ACTIVE status treated as DISTRIBUTED
    ARCHIVED: '已归档'
  }
  return statusMap[String(status || '').toUpperCase()] || '未知状态'
}

/**
 * 获取生命周期状态的标签类型
 * @param status - 指标生命周期状态
 * @returns Element Plus tag type
 */
const getLifecycleStatusType = (
  status: IndicatorStatus | string
): 'success' | 'info' | 'warning' | 'danger' => {
  const typeMap: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
    DRAFT: 'info',
    PENDING: 'info', // 兼容历史状态值，按草稿样式展示
    PENDING_REVIEW: 'warning',
    DISTRIBUTED: 'success',
    ACTIVE: 'success',  // Legacy ACTIVE status treated as DISTRIBUTED
    ARCHIVED: 'info'
  }
  return typeMap[String(status || '').toUpperCase()] || 'info'
}

/**
 * 获取审批状态的显示文本
 * @param status - 进度审批状态
 * @returns 中文显示文本
 */
const getApprovalStatusText = (status: ProgressApprovalStatusValue): string => {
  const statusMap: Record<ProgressApprovalStatusValue, string> = {
    NONE: '无',
    DRAFT: '草稿',
    PENDING: '待审批',
    APPROVED: '已通过',
    REJECTED: '已驳回'
  }
  return statusMap[status] || '未知'
}

/**
 * 获取审批状态的标签类型
 * @param status - 进度审批状态
 * @returns Element Plus badge type
 */
const getApprovalStatusType = (status: ProgressApprovalStatusValue): 'success' | 'info' | 'warning' | 'danger' => {
  const typeMap: Record<ProgressApprovalStatusValue, 'success' | 'info' | 'warning' | 'danger'> = {
    NONE: 'info',
    DRAFT: 'info',
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger'
  }
  return typeMap[status] || 'info'
}

/**
 * 判断是否显示审批状态徽章
 * @requirement: Plan-centric status - 使用 Plan 状态判断
 * @param _indicator - 指标对象（保留参数兼容性）
 * @returns 是否显示徽章
 */
const showApprovalBadge = (_indicator: StrategicIndicator): boolean => {
  // @requirement: Plan-centric - 只有 Plan 已下发时才显示徽章
  if (!isPlanDistributed.value) {
    return false
  }

  // 获取基于 Plan 状态的审批状态
  const effectiveStatus = isApprovalStatus(_indicator, ['pending', 'approved', 'rejected'])

  // 有审批状态时显示徽章
  return effectiveStatus
}

/**
 * 战略部"撤回下发"按钮展示条件
 * @requirement: Plan-centric status - 使用 Plan 状态判断
 * 仅在 Plan 处于已下发态时显示，避免草稿/待填报数据出现错误操作
 */
const canWithdrawDistribution = (_row: StrategicIndicator): boolean => {
  // @requirement: Plan-centric - 检查 Plan 是否为已下发状态
  return isPlanDistributed.value
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
        <el-button v-if="canEdit" type="primary" @click="addNewRow">
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
            <el-form-item v-if="isSecondaryCollege && availableOwnerDepts.length > 0" label="来源部门">
              <el-select v-model="filterOwnerDept" placeholder="选择来源部门" style="width: 200px;">
                <el-option 
                  v-for="dept in availableOwnerDepts" 
                  :key="dept" 
                  :label="dept" 
                  :value="dept" 
                />
              </el-select>
            </el-form-item>
            <el-form-item v-if="showResponsibleDeptColumn" label="责任部门">
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
              <!-- 一键撤回按钮（有任何待审批指标时显示） -->
              <el-tooltip
                :content="withdrawTooltip"
                :disabled="!timeContext.isReadOnly && canWithdrawAny"
                effect="dark"
                placement="top"
              >
                <span style="display: inline-block;"> <!-- Tooltip 需要一个包裹元素来处理 disabled 状态 -->
                  <el-button 
                    v-if="canWithdrawAny || timeContext.isReadOnly"
                    type="warning" 
                    size="small" 
                    :disabled="timeContext.isReadOnly || !canWithdrawAny"
                    @click="handleWithdrawAllProgressApprovals"
                  >
                    <el-icon><RefreshLeft /></el-icon>
                    一键撤回
                  </el-button>
                </span>
              </el-tooltip>
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
              v-loading="isLoadingPlanDetails"
              :data="indicators"
              :span-method="getSpanMethod"
              border
              highlight-current-row
              class="unified-table"
              @selection-change="handleSelectionChange"
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
              <el-table-column v-if="showResponsibleDeptColumn" prop="responsibleDept" label="责任部门" min-width="140">
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
                      :disabled="isApprovalStatus(row, 'PENDING') || timeContext.isReadOnly"
                      @click="handleOpenReportDialog(row)"
                    >{{ isApprovalStatus(row, 'REJECTED') ? '重新填报' : (isIndicatorFilled(row) ? '编辑' : '填报') }}</el-button>

                    <!-- 职能部门/二级学院显示进度审批撤回按钮 -->
                    <!-- 只有待审批状态的指标才显示撤回按钮 -->
                    <!-- @requirement 2.1, 2.2, 3.3, 3.4 - 分离审批操作和生命周期操作 -->
                    <el-button 
                      v-if="!isStrategicDept && isApprovalStatus(row, 'PENDING')" 
                      link 
                      type="warning" 
                      size="small" 
                      :disabled="timeContext.isReadOnly"
                      @click="handleWithdrawProgressApproval(row)"
                    >
                      <el-icon><RefreshLeft /></el-icon>
                      撤回
                    </el-button>

                    <!-- 战略发展部显示撤回下发按钮 -->
                    <el-button 
                      v-if="isStrategicDept && canWithdrawDistribution(row)"
                      link 
                      type="warning" 
                      size="small" 
                      :disabled="timeContext.isReadOnly"
                      @click="handleWithdrawIndicator(row)"
                    >
                      <el-icon><RefreshLeft /></el-icon>
                      撤回下发
                    </el-button>

                    <el-button v-if="canEdit" link type="danger" size="small" @click="handleDeleteIndicator(row)">删除</el-button>
                  </div>
                </template>
              </el-table-column>

            </el-table>
          </div>

          <!-- 空状态 - 统一空状态样式 (Requirements: 7.1, 7.2, 7.3) -->
          <div v-if="indicators.length === 0" class="empty-state">
            <!-- 加载中状态 -->
            <div v-if="isInitialLoading" class="loading-state">
              <el-skeleton :rows="5" animated />
            </div>

            <!-- 未找到 Plan 的警告（仅在加载完成后且确实没有数据时显示） -->
            <template v-else>
              <el-alert
                v-if="shouldShowPlanWarning"
                title="未找到对应的计划"
                type="warning"
                :closable="false"
                style="margin-bottom: 20px"
              >
                <template #default>
                  {{ planWarningMessage }}
                </template>
              </el-alert>

              <el-empty :description="shouldShowPlanWarning ? '' : '暂无指标数据'">
                <el-button v-if="canEdit && !shouldShowPlanWarning" type="primary" @click="addNewRow">
                  <el-icon><Plus /></el-icon>
                  新增指标
                </el-button>
              </el-empty>
            </template>
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
            <!-- Plan-centric: 状态由 Plan 控制，不是指标自己的 canWithdraw 字段 -->
            <el-tag v-if="isPlanDraft" size="small" type="info">待下发</el-tag>
            <el-tag v-else-if="isPlanDistributed" size="small" type="success">已下发</el-tag>
            <el-tag v-else size="small" type="info">待下发</el-tag>
          </div>
        </div>

        <el-descriptions :column="2" border class="detail-desc">
          <el-descriptions-item label="战略任务" :span="2">{{ currentDetail.taskContent }}</el-descriptions-item>
          <el-descriptions-item label="任务类别">{{ currentDetail.type2 }}任务</el-descriptions-item>
          <el-descriptions-item label="指标类型">{{ currentDetail.type1 }}</el-descriptions-item>
          <el-descriptions-item label="权重">{{ currentDetail.weight }}</el-descriptions-item>
          <el-descriptions-item label="当前进度">{{ currentDetail.progress || 0 }}%</el-descriptions-item>
          <el-descriptions-item label="责任部门">{{ currentDetail.responsibleDept || '未分配' }}</el-descriptions-item>
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
            <span v-else class="info-value">{{ currentReportIndicator.targetValue }}{{ currentReportIndicator.unit }}</span>
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
    <ApprovalProgressDrawer
      v-model="approvalDrawerVisible"
      :indicators="approvalIndicators"
      :department-name="effectiveViewingDept || '当前部门'"
      :show-approval-section="isStrategicDept"
      approval-type="submission"
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

/* ========================================
   状态列样式
   Requirements: 2.9, 3.1, 3.2 - 清晰分离生命周期状态和审批状态
   ======================================== */
.status-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
}

.lifecycle-status-tag {
  font-weight: 500;
  min-width: 60px;
}

.approval-status-badge {
  font-size: 11px;
  font-weight: 500;
  min-width: 60px;
  opacity: 0.9;
}
</style>
