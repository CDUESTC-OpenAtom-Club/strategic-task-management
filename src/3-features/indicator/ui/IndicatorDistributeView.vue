<script setup lang="ts">
/**
 * 指标下发与审批页面（职能部门专用）
 * 功能：接收战略任务 → 查看战略指标 → 拆分子指标 → 下发给学院 → 审批学院提交
 */
import { ref, computed, reactive, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import {
  Plus,
  Promotion,
  Check,
  Close,
  View,
  Search,
  RefreshLeft,
  Timer,
  Delete
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { StrategicIndicator } from '@/shared/types'
import { useStrategicStore } from '@/features/task/model/strategic'
import { useAuthStore } from '@/features/auth/model/store'
import { useTimeContextStore } from '@/shared/lib/timeContext'
import { useOrgStore } from '@/features/organization/model/store'
import { usePlanStore } from '@/features/plan/model/store'
import { ApprovalProgressDrawer } from '@/features/approval'
import { indicatorApi } from '@/features/indicator/api'
import { milestoneApi } from '@/entities/milestone/api/milestoneApi'
import { logger } from '@/shared/lib/utils/logger'
import type { Plan } from '@/shared/types'
import { canUseAsFunctionalParentIndicator } from '@/features/indicator/lib/scope'
import { sortMilestonesByProgress } from '@/shared/lib/utils/milestoneSort'

// 接收父组件传递的视角角色和部门
const props = defineProps<{
  viewingRole?: string // 角色类型
  viewingDept?: string // 部门名称
}>()

// Stores
const strategicStore = useStrategicStore()
const authStore = useAuthStore()
const timeContext = useTimeContextStore()
const orgStore = useOrgStore()
const planStore = usePlanStore()

// 当前用户部门（优先使用视角切换的部门）
const currentDept = computed(
  () => props.viewingDept || authStore.effectiveDepartment || authStore.userDepartment || ''
)

const currentDepartmentOrgId = computed(() => {
  const authOrgId = Number(authStore.user?.orgId ?? NaN)
  const matchedOrgId = getOrgIdByDeptName(currentDept.value)
  if (matchedOrgId != null) {
    return matchedOrgId
  }
  return Number.isFinite(authOrgId) && authOrgId > 0 ? authOrgId : null
})

const getIndicatorTaskId = (indicator: StrategicIndicator): string => {
  const raw = indicator as StrategicIndicator & { taskId?: string | number }
  return String(raw.taskId ?? '').trim()
}

const getOrgIdByDeptName = (deptName: string): number | undefined => {
  const normalized = String(deptName || '').trim()
  if (!normalized) {
    return undefined
  }
  const match = orgStore.departments.find(dept => String(dept.name || '').trim() === normalized)
  if (!match) {
    return undefined
  }
  const id = Number(match.id)
  return Number.isFinite(id) && id > 0 ? id : undefined
}

const matchesDepartment = (value: string | string[] | undefined, deptName: string): boolean => {
  const normalizedDeptName = String(deptName || '').trim()
  if (!normalizedDeptName || !value) {
    return false
  }

  if (Array.isArray(value)) {
    return value.some(dept => String(dept || '').trim() === normalizedDeptName)
  }

  return String(value).trim() === normalizedDeptName
}

const resolvePlanYear = (plan: Partial<Plan> & { year?: number | string; cycleId?: number | string }) => {
  const planRecord = plan as Partial<Plan> & {
    year?: number | string
    cycleId?: number | string
    cycle?: { year?: number | string }
  }
  const explicitYear = planRecord.year ?? planRecord.cycle?.year
  if (explicitYear != null && explicitYear !== '') {
    const numericYear = Number(explicitYear)
    return Number.isFinite(numericYear) ? numericYear : null
  }

  return timeContext.resolveCycleYear(planRecord.cycleId)
}

function getPlanIndicatorText(indicator: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = indicator[key]
    if (value !== undefined && value !== null) {
      const text = String(value).trim()
      if (text) {
        return text
      }
    }
  }
  return ''
}

function getPlanIndicatorNumber(indicator: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = indicator[key]
    const numericValue = Number(value)
    if (Number.isFinite(numericValue)) {
      return numericValue
    }
  }
  return 0
}

// 判断是否为战略发展部（只能查看，不能编辑）
const isStrategicDept = computed(() => {
  // 使用视角角色判断
  return props.viewingRole === 'strategic_dept'
})

// 判断是否为职能部门（可以编辑子指标）
const isFunctionalDept = computed(() => {
  return props.viewingRole === 'functional_dept'
})

const currentDispatchWorkflowCode = computed(() => {
  if (isStrategicDept.value) {
    return 'PLAN_DISPATCH_STRATEGY'
  }

  return 'PLAN_DISPATCH_FUNCDEPT'
})

// 只读模式：战略发展部或者历史快照模式
const _isReadOnly = computed(() => timeContext.isReadOnly || isStrategicDept.value)

// 是否可以编辑子指标（只有职能部门可以）
const canEditChild = computed(() => isFunctionalDept.value && !timeContext.isReadOnly)

// 获取所有学院（从数据库动态获取）
const colleges = computed(() => orgStore.getAllCollegeNames())

// ================== 学院模式 ==================
// 当前选中的学院
const selectedCollege = ref<string | null>(null)

// 搜索关键词
const searchKeyword = ref('')

// 指标详情侧边栏
const detailDrawerVisible = ref(false)
const currentDetailIndicator = ref<StrategicIndicator | null>(null)
const addRowFormRef = ref<HTMLElement | null>(null)

// 任务审批抽屉状态
const taskApprovalVisible = ref(false)

// 专门用于审批抽屉的指标列表（当前选中学院的所有子指标，只显示当前部门下发的）
const approvalIndicators = computed(() => {
  if (!selectedCollege.value) {
    return []
  }
  // 只返回当前部门下发给该学院的指标
  return strategicStore.indicators.filter(i => {
    if (i.isStrategic) {
      return false
    }
    if (i.ownerDept !== currentDept.value) {
      return false
    }
    if (Array.isArray(i.responsibleDept)) {
      return i.responsibleDept.includes(selectedCollege.value!)
    }
    return i.responsibleDept === selectedCollege.value
  }) as StrategicIndicator[]
})

// 待审批数量（用于按钮显示）- 基于 progressApprovalStatus === 'PENDING'
// 注意：这是进度审批状态（progress approval），不是指标定义审核状态（lifecycle status）
const pendingApprovalCount = computed(() => {
  if (!selectedCollege.value) {
    return 0
  }
  // 统计当前部门下发给该学院的、进度待审批的指标数量
  return approvalIndicators.value.filter(i => i.progressApprovalStatus === 'PENDING').length
})

const currentDepartmentPlan = computed<Plan | null>(() => {
  const departmentName = String(currentDept.value || '').trim()
  if (!departmentName) {
    return null
  }

  const departmentId = getOrgIdByDeptName(departmentName)

  return (
    planStore.plans.find(plan => {
      const planAny = plan as Plan & {
        targetOrgId?: number | string
        targetOrgName?: string
        orgId?: number | string
        orgName?: string
        year?: number | string
        cycleId?: number | string
      }
      const planYear = resolvePlanYear(planAny)
      const targetOrgId = Number(planAny.targetOrgId ?? planAny.org_id ?? planAny.orgId ?? NaN)
      const targetOrgName = String(planAny.targetOrgName || planAny.orgName || '').trim()
      const matchesOrgId =
        departmentId != null && Number.isFinite(targetOrgId) && targetOrgId === departmentId
      const matchesOrgName = targetOrgName === departmentName

      return planYear === timeContext.currentYear && (matchesOrgId || matchesOrgName)
    }) || null
  )
})

const currentDepartmentPlanDetails = ref<Plan | null>(null)

const loadCurrentDepartmentPlanDetails = async (force = false) => {
  const plan = currentDepartmentPlan.value
  if (!plan?.id) {
    currentDepartmentPlanDetails.value = null
    return null
  }

  const currentDetail = currentDepartmentPlanDetails.value
  if (!force && currentDetail?.id === plan.id) {
    return currentDetail
  }

  try {
    const latestPlan = await planStore.loadPlanDetails(plan.id, { force, background: true })
    currentDepartmentPlanDetails.value = latestPlan ?? plan
    return currentDepartmentPlanDetails.value
  } catch (error) {
    currentDepartmentPlanDetails.value = plan
    logger.warn('[IndicatorDistributeView] 加载当前部门计划详情失败:', error)
    return currentDepartmentPlanDetails.value
  }
}

const refreshDistributionData = async () => {
  await Promise.all([
    strategicStore.loadIndicatorsByYear(timeContext.currentYear),
    planStore.loadPlans({ force: true, background: true })
  ])
  await loadCurrentDepartmentPlanDetails(true)
}

// 打开任务审批抽屉
const handleOpenApproval = () => {
  taskApprovalVisible.value = true
}

// 审批后刷新
const handleApprovalRefresh = async () => {
  await refreshDistributionData()
}

// ================== 数据获取 ==================

// 筛选后的学院列表（用于侧边栏搜索）
const filteredColleges = computed(() => {
  if (!searchKeyword.value) {
    return colleges.value
  }
  const keyword = searchKeyword.value.toLowerCase()
  return colleges.value.filter(c => c.toLowerCase().includes(keyword))
})

const isCollegeSidebarLoading = computed(
  () => orgStore.loading && !orgStore.loaded && colleges.value.length === 0
)

// 获取学院的子指标数量（只统计当前部门下发的）
const getCollegeChildCount = (college: string) => {
  return strategicStore.indicators.filter(i => {
    if (i.isStrategic) {
      return false
    }
    // 只统计当前部门下发的指标
    if (i.ownerDept !== currentDept.value) {
      return false
    }
    // 支持字符串或数组格式的 responsibleDept
    if (Array.isArray(i.responsibleDept)) {
      return i.responsibleDept.includes(college)
    }
    return i.responsibleDept === college
  }).length
}

// 获取选中学院的所有子指标（按父指标分组，只显示当前部门下发的）
const currentDepartmentPlanIndicators = computed<StrategicIndicator[]>(() => {
  const plan = currentDepartmentPlanDetails.value as (Plan & { indicators?: unknown[] }) | null
  if (!plan || !Array.isArray(plan.indicators)) {
    return []
  }

  const storeIndicatorMap = new Map(
    strategicStore.indicators.map(indicator => [String(indicator.id), indicator] as const)
  )

  return plan.indicators.map(rawIndicator => {
    const source =
      rawIndicator && typeof rawIndicator === 'object'
        ? (rawIndicator as Record<string, unknown>)
        : {}
    const indicatorId = String(source.id ?? source.indicatorId ?? '')
    const storeIndicator = indicatorId ? storeIndicatorMap.get(indicatorId) : undefined

    const normalizedIndicator = {
      ...(storeIndicator || {}),
      id: indicatorId || storeIndicator?.id || String(Date.now()),
      name: getPlanIndicatorText(source, 'indicatorName', 'name') || storeIndicator?.name || '',
      taskContent:
        getPlanIndicatorText(source, 'taskName', 'taskContent') || storeIndicator?.taskContent || '',
      type1:
        (getPlanIndicatorText(
          source,
          'type1',
          'indicatorType',
          'indicatorType1'
        ) as StrategicIndicator['type1']) ||
        storeIndicator?.type1 ||
        '定量',
      type2: storeIndicator?.type2 || '其他',
      status: (getPlanIndicatorText(source, 'status').toUpperCase() ||
        storeIndicator?.status ||
        'DISTRIBUTED') as StrategicIndicator['status'],
      isStrategic: storeIndicator?.isStrategic ?? true,
      responsibleDept:
        getPlanIndicatorText(source, 'targetOrgName', 'responsibleDept') ||
        storeIndicator?.responsibleDept ||
        currentDept.value,
      ownerDept:
        getPlanIndicatorText(source, 'ownerOrgName', 'ownerDept') ||
        storeIndicator?.ownerDept ||
        '',
      progress: getPlanIndicatorNumber(source, 'progress') || storeIndicator?.progress || 0,
      weight:
        getPlanIndicatorNumber(source, 'weightPercent', 'weight') || storeIndicator?.weight || 0,
      year: Number(source.year) || storeIndicator?.year || timeContext.currentYear,
      milestones: storeIndicator?.milestones || [],
      statusAudit: storeIndicator?.statusAudit || [],
      parentIndicatorId:
        getPlanIndicatorText(source, 'parentIndicatorId', 'parent_indicator_id', 'parentId') ||
        storeIndicator?.parentIndicatorId
    } as StrategicIndicator & {
      targetOrgId?: number
      ownerOrgId?: number
    }

    const targetOrgId =
      getPlanIndicatorNumber(source, 'targetOrgId', 'target_org_id') ||
      Number((storeIndicator as StrategicIndicator & { targetOrgId?: number | string })?.targetOrgId ?? 0)
    if (Number.isFinite(targetOrgId) && targetOrgId > 0) {
      normalizedIndicator.targetOrgId = targetOrgId
    }

    const ownerOrgId =
      getPlanIndicatorNumber(source, 'ownerOrgId', 'owner_org_id') ||
      Number((storeIndicator as StrategicIndicator & { ownerOrgId?: number | string })?.ownerOrgId ?? 0)
    if (Number.isFinite(ownerOrgId) && ownerOrgId > 0) {
      normalizedIndicator.ownerOrgId = ownerOrgId
    }

    return normalizedIndicator
  })
})

const receivedParentIndicators = computed<StrategicIndicator[]>(() => {
  const mergedIndicators = new Map<string, StrategicIndicator>()

  currentDepartmentPlanIndicators.value.forEach(indicator => {
    mergedIndicators.set(String(indicator.id), indicator)
  })

  strategicStore.indicators.forEach(indicator => {
    const indicatorId = String(indicator.id)
    if (!mergedIndicators.has(indicatorId)) {
      mergedIndicators.set(indicatorId, indicator)
    }
  })

  return Array.from(mergedIndicators.values()).filter(indicator =>
    canUseAsFunctionalParentIndicator(indicator, currentDepartmentOrgId.value, true)
  )
})

const collegeIndicators = computed(() => {
  if (!selectedCollege.value) {
    return []
  }

  return receivedParentIndicators.value
})

// 获取指标的子指标（只显示当前部门下发的）
const _getChildIndicators = (parentId: string) => {
  return strategicStore.indicators.filter(
    i => i.parentIndicatorId === parentId && !i.isStrategic && i.ownerDept === currentDept.value
  )
}

// ================== 添加指标弹框相关 ==================

// 添加指标表单是否可见（改为底部表单）
const isAddingIndicator = ref(false)

// 新增指标保存中状态
const isSavingIndicator = ref(false)

// 新增指标数据（单个）
const newIndicatorForm = ref<NewIndicatorItem>({
  id: '',
  parentIndicatorId: '',
  parentIndicatorName: '',
  taskContent: '',
  type1: '定性',
  name: '',
  remark: '',
  weight: 10,
  targetProgress: 100,
  milestones: []
})

// 选择关联指标弹框是否可见（保留用于内联选择）
const selectParentDialogVisible = ref(false)

// 新增指标列表（支持一次添加多个）
interface NewIndicatorItem {
  id: string
  parentIndicatorId: string // 关联的父指标ID
  parentIndicatorName: string // 关联的父指标名称（用于显示）
  taskContent: string // 父指标所属的战略任务
  type1: '定量' | '定性' // 指标类型
  name: string // 指标内容
  remark: string // 备注
  weight: number // 权重
  targetProgress: number // 定量指标目标进度
  milestones: { id: string; name: string; targetProgress: number; deadline: string }[] // 里程碑
}

type FormMilestone = NewIndicatorItem['milestones'][number]

// 弹框中的新增指标列表
const _newIndicatorList = ref<NewIndicatorItem[]>([])

// 当前正在选择关联指标的新增指标索引
const _selectingParentForIndex = ref<number>(-1)

// 计划和指标数据（用于选择关联指标弹框）
const plansWithIndicators = computed(() => {
  const indicators = isFunctionalDept.value
    ? receivedParentIndicators.value
    : strategicStore.indicators.filter(i => i.isStrategic)

  const taskMap = new Map<string, StrategicIndicator[]>()

  indicators.forEach(indicator => {
    const taskContent = indicator.taskContent || '未分类'
    if (!taskMap.has(taskContent)) {
      taskMap.set(taskContent, [])
    }
    taskMap.get(taskContent)!.push(indicator)
  })

  return Array.from(taskMap.entries()).map(([taskContent, indicators]) => ({
    taskContent,
    type2: indicators[0]?.type2 || '发展性',
    indicators
  }))
})

// 选择关联指标弹框 - 展平的表格数据（用于合并单元格显示）
interface SelectParentTableRow {
  taskContent: string
  type2: '发展性' | '基础性'
  indicator: StrategicIndicator
  isFirstOfTask: boolean // 是否是该任务的第一行
  taskRowSpan: number // 任务单元格需要合并的行数
}

const selectParentTableData = computed((): SelectParentTableRow[] => {
  const data: SelectParentTableRow[] = []

  plansWithIndicators.value.forEach(task => {
    const taskIndicators = task.indicators
    taskIndicators.forEach((indicator, index) => {
      data.push({
        taskContent: task.taskContent,
        type2: task.type2 as '发展性' | '基础性',
        indicator,
        isFirstOfTask: index === 0,
        taskRowSpan: index === 0 ? taskIndicators.length : 0
      })
    })
  })

  return data
})

// 选择关联指标弹框 - 单元格合并方法
const _selectParentSpanMethod = ({
  row,
  columnIndex
}: {
  row: SelectParentTableRow
  columnIndex: number
}) => {
  // 第一列（战略任务）需要合并
  if (columnIndex === 0) {
    if (row.isFirstOfTask) {
      return { rowspan: row.taskRowSpan, colspan: 1 }
    } else {
      return { rowspan: 0, colspan: 0 }
    }
  }
  return { rowspan: 1, colspan: 1 }
}

// 打开添加指标表单
const openAddIndicatorForm = () => {
  // 检查是否有已下发的指标（下发后不能再添加）
  if (selectedCollege.value) {
    const collegeStatus = getCollegeStatus(selectedCollege.value)
    if (collegeStatus.distributed > 0 || collegeStatus.pending > 0 || collegeStatus.approved > 0) {
      ElMessage.warning('存在已下发的指标，请先撤回后再添加新指标')
      return
    }
  }

  // 重置表单
  newIndicatorForm.value = {
    id: `new-${Date.now()}`,
    parentIndicatorId: '',
    parentIndicatorName: '',
    taskContent: '',
    type1: '定性',
    name: '',
    remark: '',
    weight: 10,
    targetProgress: 100,
    milestones: []
  }
  isAddingIndicator.value = true

  nextTick(() => {
    addRowFormRef.value?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    })
  })
}

// 取消添加指标
const cancelAddIndicator = () => {
  isAddingIndicator.value = false
  newIndicatorForm.value = {
    id: '',
    parentIndicatorId: '',
    parentIndicatorName: '',
    taskContent: '',
    type1: '定性',
    name: '',
    remark: '',
    weight: 10,
    targetProgress: 100,
    milestones: []
  }
}

const cloneParentMilestonesForForm = (
  indicator: StrategicIndicator
): FormMilestone[] => {
  if (!Array.isArray(indicator.milestones) || indicator.milestones.length === 0) {
    return []
  }

  return indicator.milestones.map((milestone, index) => {
    const rawMilestone = milestone as {
      id?: string | number
      name?: string
      targetProgress?: number | string
      progress?: number | string
      deadline?: string
      expectedDate?: string
    }

    const rawProgress = Number(rawMilestone.targetProgress ?? rawMilestone.progress ?? 0)

    return {
      id: String(rawMilestone.id ?? `copied-ms-${Date.now()}-${index}`),
      name: String(rawMilestone.name || indicator.name || `里程碑 ${index + 1}`),
      targetProgress: Number.isFinite(rawProgress) ? rawProgress : 0,
      deadline: String(rawMilestone.deadline || rawMilestone.expectedDate || '')
    }
  })
}

const buildDraftMilestonesFromForm = (
  milestones: FormMilestone[]
): StrategicIndicator['milestones'] =>
  milestones.map(m => ({
    id: m.id,
    name: m.name,
    targetProgress: m.targetProgress,
    deadline: m.deadline,
    status: 'pending' as const
  }))

const buildLocalMilestonesFromForm = (milestones: FormMilestone[]): LocalMilestone[] =>
  milestones.map(m => ({
    id: m.id,
    name: m.name,
    expectedDate: m.deadline,
    progress: m.targetProgress
  }))

const resolveTargetValueFromMilestones = (
  milestones: Array<
    | FormMilestone
    | LocalMilestone
    | {
        targetProgress?: number | string
        progress?: number | string
      }
  >,
  fallback = 100
): number => {
  const lastMilestone = milestones[milestones.length - 1]
  if (!lastMilestone) {
    return fallback
  }

  const rawValue =
    'targetProgress' in lastMilestone
      ? lastMilestone.targetProgress
      : 'progress' in lastMilestone
        ? lastMilestone.progress
        : fallback
  const resolvedValue = Number(rawValue)
  return Number.isFinite(resolvedValue) ? resolvedValue : fallback
}

const resolveParentTargetProgress = (indicator: StrategicIndicator): number => {
  const targetValue = Number(indicator.targetValue ?? NaN)
  if (Number.isFinite(targetValue) && targetValue >= 0) {
    return targetValue
  }

  if (Array.isArray(indicator.milestones) && indicator.milestones.length > 0) {
    const lastMilestone = indicator.milestones[indicator.milestones.length - 1] as
      | { targetProgress?: number | string; progress?: number | string }
      | undefined
    const fallbackProgress = Number(lastMilestone?.targetProgress ?? lastMilestone?.progress ?? NaN)
    if (Number.isFinite(fallbackProgress) && fallbackProgress >= 0) {
      return fallbackProgress
    }
  }

  return 100
}

// 选择关联指标
const selectParentIndicator = (indicator: StrategicIndicator) => {
  const copiedMilestones = cloneParentMilestonesForForm(indicator)
  const resolvedType = indicator.type1 || (indicator.isQualitative ? '定性' : '定量')

  newIndicatorForm.value.parentIndicatorId = indicator.id.toString()
  newIndicatorForm.value.parentIndicatorName = indicator.name
  newIndicatorForm.value.taskContent = indicator.taskContent || ''
  // 继承父指标的名称和说明
  newIndicatorForm.value.name = indicator.name || ''
  newIndicatorForm.value.remark = indicator.remark || ''
  newIndicatorForm.value.weight = Number(indicator.weight ?? 10) || 10
  newIndicatorForm.value.targetProgress = resolveParentTargetProgress(indicator)
  // 继承父指标的类型（用户仍可修改）
  newIndicatorForm.value.type1 = resolvedType
  newIndicatorForm.value.milestones = copiedMilestones
  // 如果父指标没有里程碑，再按原有规则兜底生成
  if (newIndicatorForm.value.type1 === '定量' && newIndicatorForm.value.milestones.length === 0) {
    generateMonthlyMilestonesForForm()
  }
  selectParentDialogVisible.value = false
}

const handleParentIndicatorChange = (value: string) => {
  const indicator = plansWithIndicators.value
    .flatMap(task => task.indicators)
    .find(item => item.id.toString() === value)

  if (indicator) {
    selectParentIndicator(indicator)
  }
}

// 为表单生成12个月里程碑（定量指标）
const generateMonthlyMilestonesForForm = () => {
  const currentYear = timeContext.currentYear
  const indicatorName = newIndicatorForm.value.name || '指标完成'
  newIndicatorForm.value.milestones = []

  for (let month = 1; month <= 12; month++) {
    const lastDay = new Date(currentYear, month, 0).getDate()
    const deadline = `${currentYear}-${String(month).padStart(2, '0')}-${lastDay}`
    const progress = Math.round((month / 12) * 100)

    newIndicatorForm.value.milestones.push({
      id: `ms-${Date.now()}-${month}`,
      name: indicatorName,
      targetProgress: progress,
      deadline: deadline
    })
  }
}

// 指标类型变更时的处理
const handleFormIndicatorTypeChange = (newType: '定量' | '定性') => {
  if (newType === '定量') {
    // 定量指标：只有当没有里程碑时才自动生成12个月里程碑
    if (newIndicatorForm.value.milestones.length === 0) {
      generateMonthlyMilestonesForForm()
    }
    // 如果已有里程碑，保留它们不做任何操作
  }
  // 定性指标：保留已有里程碑，让用户手动管理
  // 不再清空里程碑
}

// 添加里程碑（表单）
const addFormMilestone = () => {
  newIndicatorForm.value.milestones.push({
    id: `ms-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: '',
    targetProgress: 0,
    deadline: ''
  })
}

// 删除里程碑（表单）
const removeFormMilestone = (index: number) => {
  newIndicatorForm.value.milestones.splice(index, 1)
}

// 保存新指标里程碑到数据库
const persistNewIndicatorMilestones = async (indicatorId: number, milestones: typeof newIndicatorForm.value.milestones) => {
  if (!Number.isFinite(indicatorId) || indicatorId <= 0 || milestones.length === 0) {
    return
  }

  logger.info(`[IndicatorDistributeView] Saving ${milestones.length} milestones for indicator ${indicatorId}`)

  for (const [index, milestone] of milestones.entries()) {
    try {
      await milestoneApi.createMilestone({
        indicatorId,
        milestoneName: String(milestone.name || '').trim() || `里程碑 ${index + 1}`,
        targetProgress: Number(milestone.targetProgress) || 0,
        dueDate: milestone.deadline || null,
        status: 'NOT_STARTED',
        sortOrder: index + 1
      })
      logger.info(`[IndicatorDistributeView] Saved milestone ${index + 1}: ${milestone.name}`)
    } catch (error) {
      logger.error(`[IndicatorDistributeView] Failed to save milestone ${index + 1}:`, error)
    }
  }
}

// 保存新增指标（状态为草稿）- 立即调用后端API创建
const saveNewIndicator = async () => {
  // 验证数据
  if (!newIndicatorForm.value.parentIndicatorId) {
    ElMessage.warning('请选择关联的核心指标')
    return
  }
  if (!newIndicatorForm.value.name) {
    ElMessage.warning('请填写指标内容')
    return
  }

  if (!selectedCollege.value) {
    ElMessage.warning('请先选择学院')
    return
  }

  // 开始保存
  isSavingIndicator.value = true

  try {
    // 获取父指标信息
    const parentIndicator = strategicStore.indicators.find(
      i => i.id.toString() === newIndicatorForm.value.parentIndicatorId
    )

    if (!parentIndicator) {
      throw new Error('找不到关联的核心指标')
    }

    const indicatorTaskId = Number(getIndicatorTaskId(parentIndicator as StrategicIndicator))
    const parentIndicatorId = Number(newIndicatorForm.value.parentIndicatorId)
    const ownerOrgId = getOrgIdByDeptName(currentDept.value)
    const targetOrgId = getOrgIdByDeptName(selectedCollege.value)

    // 验证必要参数
    if (!Number.isFinite(indicatorTaskId) || indicatorTaskId <= 0) {
      throw new Error('指标缺少有效 taskId')
    }
    if (!ownerOrgId) {
      throw new Error(`无法解析当前部门组织ID: ${currentDept.value}`)
    }
    if (!targetOrgId) {
      throw new Error(`无法解析目标学院组织ID: ${selectedCollege.value}`)
    }

    // 调用后端API创建指标
    const createResp = await indicatorApi.createIndicator({
      taskId: indicatorTaskId,
      indicatorDesc: newIndicatorForm.value.name,
      ownerOrgId,
      targetOrgId,
      weightPercent: newIndicatorForm.value.weight || 0,
      sortOrder: 0,
      remark: newIndicatorForm.value.remark || '',
      progress: 0,
      year: timeContext.currentYear,
      canWithdraw: false,
      parentIndicatorId,
      type: newIndicatorForm.value.type1
    } as never)

    if (!createResp.success || !createResp.data) {
      throw new Error(createResp.message || '创建指标失败')
    }

    // 后端返回的真实ID
    const backendId = createResp.data.id
    if (!backendId) {
      throw new Error('后端返回的数据缺少ID字段')
    }
    const newBackendId = String(backendId)

    // 创建本地指标对象用于前端显示
    const newIndicator: StrategicIndicator = {
      id: newBackendId,
      name: newIndicatorForm.value.name,
      isQualitative: newIndicatorForm.value.type1 === '定性',
      type1: newIndicatorForm.value.type1,
      type2: parentIndicator?.type2 || '发展性',
      progress: 0,
      createTime: new Date().toLocaleDateString('zh-CN'),
      weight: newIndicatorForm.value.weight,
      remark: newIndicatorForm.value.remark,
      canWithdraw: false,
      taskContent: newIndicatorForm.value.taskContent,
      milestones: buildDraftMilestonesFromForm(newIndicatorForm.value.milestones),
      targetValue:
        newIndicatorForm.value.type1 === '定量'
          ? resolveTargetValueFromMilestones(
              newIndicatorForm.value.milestones,
              newIndicatorForm.value.targetProgress
            )
          : newIndicatorForm.value.milestones.length,
      unit: newIndicatorForm.value.type1 === '定量' ? '%' : '个里程碑',
      responsibleDept: selectedCollege.value!,
      responsiblePerson: '',
      status: 'draft',
      isStrategic: false,
      ownerDept: currentDept.value,
      parentIndicatorId: newIndicatorForm.value.parentIndicatorId,
      year: timeContext.currentYear,
      statusAudit: []
    }
    ;(newIndicator as StrategicIndicator & { taskId?: string }).taskId = String(indicatorTaskId)

    // 添加到前端store
    strategicStore.addDraftIndicator(newIndicator)

    // 保存里程碑到数据库
    if (newIndicatorForm.value.milestones.length > 0) {
      await persistNewIndicatorMilestones(Number(newBackendId), newIndicatorForm.value.milestones)
    }

    ElMessage.success('已添加指标（草稿状态）')
    cancelAddIndicator()
  } catch (error: any) {
    logger.error('[IndicatorDistributeView] saveNewIndicator failed:', error)
    ElMessage.error(error?.message || '保存指标失败，请重试')
  } finally {
    isSavingIndicator.value = false
  }
}

// 判断当前学院是否可以新增指标（没有已下发状态的指标）
const _canAddIndicator = computed(() => {
  if (!selectedCollege.value) {
    return false
  }
  const status = getCollegeStatus(selectedCollege.value)
  return status.distributed === 0 && status.pending === 0 && status.approved === 0
})

// ================== 子指标新增相关 ==================

// 里程碑接口
// 本地里程碑接口（用于编辑）
interface LocalMilestone {
  id: string
  name: string
  expectedDate: string
  progress: number // 0-100
}

// 新增子指标的临时存储（按父指标ID分组）
interface NewChildIndicator {
  id: string
  name: string
  college: string[] // 改为数组支持多选
  targetValue: number
  unit: string
  weight: number
  remark: string
  type1: '定量' | '定性' // 指标类型
  targetProgress: number // 定量指标目标进度 0-100
  milestones: LocalMilestone[] // 定性指标里程碑列表
  isNew: boolean // 标记是否为新增的未保存行
}

// 导出供模板使用
type _NewChild = NewChildIndicator

const newChildIndicators = reactive<Record<string, NewChildIndicator[]>>({})

// 正在添加子指标的父指标ID
const addingParentId = ref<string | null>(null)

// 当前正在编辑的新增子指标ID（用于点击外部保存）
const editingNewChildId = ref<string | null>(null)

// 验证并保存新增子指标（点击外部时调用）
const validateAndSaveNewChild = (parentId: string, childId: string) => {
  const children = newChildIndicators[parentId]
  if (!children) {
    return
  }

  const childIndex = children.findIndex(c => c.id === childId)
  if (childIndex === -1) {
    return
  }

  const child = children[childIndex]
  if (!child) {
    return
  }

  // 如果名称和学院都为空，删除该行
  if (!child.name && (!child.college || child.college.length === 0)) {
    children.splice(childIndex, 1)
    if (children.length === 0) {
      delete newChildIndicators[parentId]
    }
    editingNewChildId.value = null
    return
  }

  // 数据有效，保持该行，退出编辑状态
  editingNewChildId.value = null
}

// 点击新增子指标行时进入编辑状态
const handleNewChildRowClick = (childId: string, parentId: string) => {
  editingNewChildId.value = childId
  addingParentId.value = parentId
}

// 添加新的子指标行
const _addNewChildRow = (parentIndicatorId: string) => {
  if (!canEditChild.value) {
    ElMessage.warning('您没有权限添加子指标')
    return
  }

  // 如果有正在编辑的新增子指标，先保存它
  if (editingNewChildId.value && addingParentId.value) {
    validateAndSaveNewChild(addingParentId.value, editingNewChildId.value)
  }

  // 获取父指标信息
  const parentIndicator = collegeIndicators.value.find(i => i.id.toString() === parentIndicatorId)
  const resolvedType =
    parentIndicator?.type1 || (parentIndicator?.isQualitative ? '定性' : '定量') || '定性'
  const copiedMilestones = parentIndicator ? cloneParentMilestonesForForm(parentIndicator) : []

  if (!newChildIndicators[parentIndicatorId]) {
    newChildIndicators[parentIndicatorId] = []
  }

  const newChildId = `new-${Date.now()}`

  // 自动设置当前选中的学院
  const defaultCollege = selectedCollege.value ? [selectedCollege.value] : []

  newChildIndicators[parentIndicatorId].push({
    id: newChildId,
    name: parentIndicator?.name || '', // 继承父指标名称
    college: defaultCollege,
    targetValue:
      resolvedType === '定量'
        ? resolveTargetValueFromMilestones(
            copiedMilestones,
            parentIndicator ? resolveParentTargetProgress(parentIndicator) : 100
          )
        : copiedMilestones.length,
    unit: resolvedType === '定量' ? '%' : '个里程碑',
    weight: Number(parentIndicator?.weight ?? 10) || 10,
    remark: parentIndicator?.remark || '', // 继承父指标备注
    type1: resolvedType,
    targetProgress:
      resolvedType === '定量'
        ? resolveTargetValueFromMilestones(
            copiedMilestones,
            parentIndicator ? resolveParentTargetProgress(parentIndicator) : 100
          )
        : 0,
    milestones: buildLocalMilestonesFromForm(copiedMilestones),
    isNew: true
  })

  addingParentId.value = parentIndicatorId
  editingNewChildId.value = newChildId // 设置当前编辑的新增子指标
}

// 删除临时子指标行
const removeNewChildRow = (parentId: string, index: number) => {
  if (newChildIndicators[parentId]) {
    newChildIndicators[parentId].splice(index, 1)
    if (newChildIndicators[parentId].length === 0) {
      delete newChildIndicators[parentId]
    }
  }
}

// 删除已有子指标
const removeChildIndicator = (child: StrategicIndicator) => {
  ElMessageBox.confirm(`确认删除子指标"${child.name}"？此操作不可恢复。`, '删除确认', {
    confirmButtonText: '确认删除',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => {
      strategicStore.deleteIndicator(child.id.toString())
      ElMessage.success('已删除子指标')
    })
    .catch(() => {
      // 取消删除
    })
}

// 获取所有待下发的子指标数量
const _getPendingChildCount = (parentId: string) => {
  return (newChildIndicators[parentId] || []).length
}

// 下发所有新增的子指标
const _distributeNewChildren = (parentIndicator: StrategicIndicator) => {
  const parentId = parentIndicator.id.toString()
  const parentTaskId = getIndicatorTaskId(parentIndicator)
  const children = newChildIndicators[parentId] || []

  if (children.length === 0) {
    ElMessage.warning('没有待下发的子指标')
    return
  }

  // 验证所有子指标数据
  for (const child of children) {
    if (!child.name) {
      ElMessage.warning('请填写子指标名称')
      return
    }
    if (!child.college || child.college.length === 0) {
      ElMessage.warning('请选择下发学院')
      return
    }
  }

  ElMessageBox.confirm(`确认下发 ${children.length} 个子指标到对应学院？`, '下发确认', {
    confirmButtonText: '确认下发',
    cancelButtonText: '取消',
    type: 'info'
  }).then(() => {
    // 创建子指标
    children.forEach(child => {
      const newIndicator: StrategicIndicator = {
        id: `${Date.now()}-${child.college}-${Math.random().toString(36).substr(2, 9)}`,
        name: child.name,
        isQualitative: child.type1 === '定性',
        type1: child.type1,
        type2: parentIndicator.type2,
        progress: 0,
        createTime: new Date().toLocaleDateString('zh-CN'),
        weight: child.weight,
        remark: child.remark,
        canWithdraw: false,
        taskContent: parentIndicator.taskContent,
        milestones: child.milestones.map(m => ({
          id: m.id,
          name: m.name,
          targetProgress: m.progress,
          deadline: m.expectedDate,
          status: 'pending' as const
        })),
        targetValue:
          child.type1 === '定量'
            ? resolveTargetValueFromMilestones(child.milestones, child.targetProgress)
            : child.milestones.length,
        unit: child.type1 === '定量' ? '%' : '个里程碑',
        responsibleDept: Array.isArray(child.college) ? child.college.join(',') : child.college,
        responsiblePerson: '',
        status: 'draft',
        isStrategic: false,
        ownerDept: currentDept.value,
        parentIndicatorId: parentId,
        year: timeContext.currentYear,
        statusAudit: [] // 默认为空，状态为草稿
      }
      ;(newIndicator as StrategicIndicator & { taskId?: string }).taskId = parentTaskId
      // Step1: 只保存到前端临时状态，不调用后端
      strategicStore.addDraftIndicator(newIndicator)
    })

    // 清空临时数据
    delete newChildIndicators[parentId]
    addingParentId.value = null

    ElMessage.success(`已成功添加 ${children.length} 个子指标，请点击"下发子指标"按钮进行下发`)
  })
}

// ================== 子指标编辑相关 ==================

// 当前编辑的子指标
const editingChildId = ref<string | null>(null)
const editingChildField = ref<string | null>(null)
const editingChildValue = ref<Record<string, unknown> | null>(null)
const savingChildId = ref<string | null>(null)
const savingChildField = ref<string | null>(null)

// 学院下拉菜单是否打开
const collegeDropdownVisible = ref(false)
// 是否正在与学院选择器交互（点击 select 或其 dropdown）
const isInteractingWithCollegeSelect = ref(false)

// 全局 mousedown 监听器
const handleGlobalMousedown = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  // 检查是否点击了编辑中的 select 或其 dropdown
  const isInSelect = !!target.closest('.college-select-editing')
  const isInDropdown = !!target.closest('.el-select-dropdown')
  isInteractingWithCollegeSelect.value = isInSelect || isInDropdown

  // 处理新增子指标行的点击外部保存
  if (editingNewChildId.value && addingParentId.value) {
    // 检查是否点击在新增子指标行内
    const isInNewChildRow = !!target.closest('.new-child-row')
    // 检查是否点击在下拉菜单内
    const isInPopper = !!target.closest('.el-popper') || !!target.closest('.el-select-dropdown')

    if (!isInNewChildRow && !isInPopper) {
      // 点击在新增行外部，保存并退出编辑
      validateAndSaveNewChild(addingParentId.value, editingNewChildId.value)
    }
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleGlobalMousedown, true)
  void orgStore.loadDepartments()
  void refreshDistributionData()
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleGlobalMousedown, true)
})

watch(
  () => [currentDept.value, timeContext.currentYear, currentDepartmentPlan.value?.id],
  () => {
    void loadCurrentDepartmentPlanDetails()
  },
  { immediate: true }
)

// 双击编辑子指标
const handleChildDblClick = (child: StrategicIndicator, field: string) => {
  if (!canEditChild.value) {
    return
  }

  if (savingChildId.value === child.id.toString()) {
    return
  }

  // 检查状态：只有草稿状态才能编辑
  const status = getChildStatus(child)
  if (status !== 'draft') {
    ElMessage.warning('只有草稿状态的指标才能编辑，请先撤销下发')
    return
  }

  editingChildId.value = child.id.toString()
  editingChildField.value = field

  // 如果编辑学院字段，需要将字符串解析为数组
  if (field === 'responsibleDept') {
    editingChildValue.value = parseColleges(child.responsibleDept)
  } else {
    editingChildValue.value = child[field as keyof StrategicIndicator]
  }

  // 自动聚焦到编辑元素
  nextTick(() => {
    const editingEl = document.querySelector('.editing-field') as HTMLElement
    if (editingEl) {
      // 处理不同类型的输入元素
      const input = editingEl.querySelector('input, textarea') as
        | HTMLInputElement
        | HTMLTextAreaElement
      if (input) {
        input.focus()
        // 如果是文本输入框，选中所有文本
        if (input.select) {
          input.select()
        }
      }
    }
  })
}

const isSavingChildCell = (child: StrategicIndicator | undefined, field: string) => {
  if (!child) {
    return false
  }

  return savingChildId.value === child.id.toString() && savingChildField.value === field
}

// 保存子指标编辑
const saveChildEdit = async (child: StrategicIndicator, field: string) => {
  if (editingChildId.value === null) {
    return
  }

  let valueToSave = editingChildValue.value

  // 如果是学院字段，需要验证至少有一个学院
  if (field === 'responsibleDept') {
    if (!Array.isArray(valueToSave) || valueToSave.length === 0) {
      ElMessage.warning('至少选择一个学院')
      return
    }
    // 将数组转换为逗号分隔的字符串
    valueToSave = valueToSave.join(',')
  }

  // 如果是进度字段，需要验证范围
  if (field === 'progress') {
    const progressValue = Number(valueToSave)
    if (isNaN(progressValue) || progressValue < 0 || progressValue > 100) {
      ElMessage.warning('进度必须在0-100之间')
      return
    }
    valueToSave = progressValue
  }

  const updates = {
    [field]: valueToSave
  } as Record<string, unknown>

  savingChildId.value = child.id.toString()
  savingChildField.value = field
  cancelChildEdit()

  try {
    await strategicStore.updateIndicator(child.id.toString(), updates)
    await refreshDistributionData()
  } catch (error) {
    logger.error('[IndicatorDistributeView] 保存子指标编辑失败:', {
      indicatorId: child.id,
      field,
      error
    })
    ElMessage.error(error instanceof Error ? error.message : '保存失败，请稍后重试')
  } finally {
    savingChildId.value = null
    savingChildField.value = null
  }
}

// 学院选择器下拉框可见性变化
const _handleCollegeSelectClose = (visible: boolean) => {
  collegeDropdownVisible.value = visible
}

// 学院选择器失焦处理
const _handleCollegeSelectBlur = (child: StrategicIndicator) => {
  // 延迟检查，确保 mousedown 事件先处理完成
  setTimeout(() => {
    // 如果正在与 select 或 dropdown 交互，不保存
    if (isInteractingWithCollegeSelect.value) {
      isInteractingWithCollegeSelect.value = false
      return
    }
    // 如果下拉菜单还开着，不保存
    if (collegeDropdownVisible.value) {
      return
    }
    // 确认当前仍在编辑学院字段
    if (
      editingChildId.value === child.id.toString() &&
      editingChildField.value === 'responsibleDept'
    ) {
      saveChildEdit(child, 'responsibleDept')
    }
  }, 100)
}

// 取消子指标编辑
const cancelChildEdit = () => {
  editingChildId.value = null
  editingChildField.value = null
  editingChildValue.value = null
}

// ================== 审批相关 ==================

// 辅助函数：获取当前部门下发给指定学院的子指标
const getMyCollegeIndicators = (college: string) => {
  return strategicStore.indicators.filter(i => {
    if (i.isStrategic) {
      return false
    }
    if (i.ownerDept !== currentDept.value) {
      return false
    }
    if (Array.isArray(i.responsibleDept)) {
      return i.responsibleDept.includes(college)
    }
    return i.responsibleDept === college
  })
}

// 进度审批已统一迁移到真实工作流待办抽屉，避免前端直接改写审批状态。

// 批量撤销：针对学院下所有已下发、待审批或已通过的子指标，撤销后可编辑删除
const handleBatchWithdraw = async (college: string) => {
  const childIndicators = getMyCollegeIndicators(college)
  const withdrawableIndicators = childIndicators.filter(i => {
    const status = getChildStatus(i as StrategicIndicator)
    // 进行中状态包含 distributed、active (legacy) 和 approved，都可以撤回
    return (
      status === 'distributed' ||
      status === 'active' ||
      status === 'pending' ||
      status === 'approved'
    )
  })

  // 分离出真实后端ID的指标和临时ID的指标
  const realBackendIndicators = withdrawableIndicators.filter(i => /^\d+$/.test(i.id.toString()))
  const tempIdIndicators = withdrawableIndicators.filter(i => !/^\d+$/.test(i.id.toString()))

  if (withdrawableIndicators.length === 0) {
    ElMessage.warning('没有可撤销的子指标')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确认撤销【${college}】的 ${withdrawableIndicators.length} 个子指标？撤销后可重新编辑或删除。`,
      '批量撤销确认',
      {
        confirmButtonText: '确认撤销',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
  } catch {
    return
  }

  const errors: string[] = []

  // 如果有真实后端ID的指标，使用批量撤回API
  if (realBackendIndicators.length > 0) {
    try {
      const ownerOrgId = getOrgIdByDeptName(currentDept.value)
      const targetOrgId = getOrgIdByDeptName(college)

      if (!ownerOrgId) {
        throw new Error(`无法解析当前部门组织ID: ${currentDept.value}`)
      }
      if (!targetOrgId) {
        throw new Error(`无法解析目标学院组织ID: ${college}`)
      }

      const result = await indicatorApi.batchWithdrawIndicators(ownerOrgId, targetOrgId, '批量撤销下发')

      if (result.success && result.data) {
        const { successCount, failedCount, withdrawnIndicatorIds, errors: batchErrors } = result.data

        // 更新前端状态
        for (const indicatorId of withdrawnIndicatorIds) {
          strategicStore.addStatusAuditEntry(indicatorId.toString(), {
            operator: authStore.user?.userId || 'admin',
            operatorName: authStore.user?.name || '管理员',
            operatorDept: currentDept.value,
            action: 'withdraw',
            comment: '批量撤销下发'
          })
          await strategicStore.updateIndicator(indicatorId.toString(), {
            status: 'draft',
            canWithdraw: true
          })
        }

        if (failedCount > 0 && batchErrors?.length > 0) {
          errors.push(...batchErrors)
        }

        if (failedCount === 0) {
          ElMessage.success(`已成功撤销 ${successCount} 个指标`)
        } else {
          ElMessage.warning(`成功撤销 ${successCount} 个指标，失败 ${failedCount} 个`)
        }
      } else {
        ElMessage.error(result.message || '批量撤回失败')
      }
    } catch (err: any) {
      ElMessage.error(`批量撤回失败: ${err.message || err}`)
    }
  }

  // 临时 ID 的草稿本来就没有下发，直接更新前端状态即可
  for (const indicator of tempIdIndicators) {
    try {
      strategicStore.addStatusAuditEntry(indicator.id.toString(), {
        operator: authStore.user?.userId || 'admin',
        operatorName: authStore.user?.name || '管理员',
        operatorDept: currentDept.value,
        action: 'withdraw',
        comment: '批量撤销下发'
      })
      await strategicStore.updateIndicator(indicator.id.toString(), {
        status: 'draft',
        canWithdraw: true
      })
    } catch (err) {
      errors.push(indicator.name)
    }
  }

  if (errors.length > 0 && realBackendIndicators.length === 0) {
    ElMessage.error(`以下指标撤销失败：${errors.join('、')}`)
  }
}

const canWithdrawChildIndicator = (indicator: StrategicIndicator) => {
  const status = getChildStatus(indicator)
  return status === 'distributed' || status === 'pending' || status === 'approved'
}

const handleSingleWithdraw = async (indicator: StrategicIndicator) => {
  if (!canWithdrawChildIndicator(indicator)) {
    ElMessage.warning('当前指标不可撤回')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确认撤回子指标“${indicator.name}”的下发吗？撤回后可重新编辑或删除。`,
      '单条撤回确认',
      {
        confirmButtonText: '确认撤回',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
  } catch {
    return
  }

  try {
    const result = await indicatorApi.withdrawIndicator(indicator.id.toString())
    if (!result.success) {
      ElMessage.error(result.message || '单条撤回失败')
      return
    }

    strategicStore.addStatusAuditEntry(indicator.id.toString(), {
      operator: authStore.user?.userId || 'admin',
      operatorName: authStore.user?.name || '管理员',
      operatorDept: currentDept.value,
      action: 'withdraw',
      comment: '单条撤销下发'
    })

    await strategicStore.updateIndicator(indicator.id.toString(), {
      status: 'draft',
      canWithdraw: true
    })

    ElMessage.success('已撤回 1 个指标')
  } catch (err: any) {
    ElMessage.error(`单条撤回失败: ${err.message || err}`)
  }
}

// 批量下发：针对学院下所有草稿状态的子指标
const handleBatchDistribute = async (college: string) => {
  const childIndicators = getMyCollegeIndicators(college)
  const draftIndicators = childIndicators.filter(
    i => getChildStatus(i as StrategicIndicator) === 'draft'
  )

  if (draftIndicators.length === 0) {
    ElMessage.warning('没有可下发的子指标')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确认下发【${college}】的 ${draftIndicators.length} 个子指标？`,
      '批量下发确认',
      {
        confirmButtonText: '确认下发',
        cancelButtonText: '取消',
        type: 'success'
      }
    )
  } catch {
    return
  }

  const errors: string[] = []

  for (const indicator of draftIndicators) {
    const indicatorId = indicator.id.toString()
    const isRealBackendId = /^\d+$/.test(indicatorId)

    try {
      if (isRealBackendId) {
        await indicatorApi.distributeIndicator({
          parentIndicatorId: indicatorId,
          targetOrgId: String(getOrgIdByDeptName(college) || ''),
          customDesc: indicator.name
        })
      } else {
        // 临时 ID（本地草稿）：先调用 createIndicator 创建，再下发
        const indicatorTaskId = Number(getIndicatorTaskId(indicator as StrategicIndicator))
        const parentIndicatorId = indicator.parentIndicatorId
          ? Number(indicator.parentIndicatorId)
          : undefined
        const ownerOrgId = getOrgIdByDeptName(currentDept.value)
        const targetOrgId = getOrgIdByDeptName(college)

        if (!Number.isFinite(indicatorTaskId) || indicatorTaskId <= 0) {
          throw new Error(`指标缺少有效 taskId，无法挂载到同一计划: ${indicator.name}`)
        }
        if (!ownerOrgId || !targetOrgId) {
          throw new Error(`无法解析组织ID，owner=${currentDept.value}, target=${college}`)
        }

        const createResp = await indicatorApi.createIndicator({
          taskId: indicatorTaskId,
          indicatorDesc: indicator.name,
          ownerOrgId,
          targetOrgId,
          weightPercent: indicator.weight || 0,
          sortOrder: 0,
          remark: indicator.remark || '',
          progress: indicator.progress || 0,
          year: indicator.year || new Date().getFullYear(),
          canWithdraw: false,
          parentIndicatorId
        } as never)
        if (!createResp.success || !createResp.data) {
          throw new Error(createResp.message || '创建指标失败')
        }
        // 后端返回的真实ID
        const backendId = createResp.data.id
        if (!backendId) {
          throw new Error('后端返回的数据缺少ID字段')
        }
        const newBackendId = String(backendId)
        // 用真实 ID 替换临时 ID（纯本地操作，不调用后端）
        strategicStore.replaceIndicatorId(indicatorId, newBackendId)
        await indicatorApi.distributeIndicator({
          parentIndicatorId: newBackendId,
          targetOrgId: String(targetOrgId),
          customDesc: indicator.name
        })
      }

      // 更新前端状态
      strategicStore.addStatusAuditEntry(indicator.id.toString(), {
        operator: authStore.user?.userId || 'admin',
        operatorName: authStore.user?.name || '管理员',
        operatorDept: currentDept.value,
        action: 'distribute',
        comment: '批量下发'
      })
      await strategicStore.updateIndicator(indicator.id.toString(), {
        status: 'distributed',
        canWithdraw: false
      })
    } catch (err) {
      errors.push(indicator.name)
    }
  }

  if (errors.length > 0) {
    ElMessage.error(`以下指标下发失败：${errors.join('、')}`)
  } else {
    ElMessage.success(`已成功下发 ${draftIndicators.length} 个指标`)
  }
}

// 获取学院下子指标的统一状态（用于判断显示哪些批量操作按钮，只统计当前部门下发的）
const getCollegeStatus = (college: string) => {
  // 只统计当前部门下发给该学院的指标
  const childIndicators = strategicStore.indicators.filter(i => {
    if (i.isStrategic) {
      return false
    }
    if (i.ownerDept !== currentDept.value) {
      return false
    }
    if (Array.isArray(i.responsibleDept)) {
      return i.responsibleDept.includes(college)
    }
    return i.responsibleDept === college
  })
  if (childIndicators.length === 0) {
    return { draft: 0, distributed: 0, pending: 0, approved: 0 }
  }

  // 统计各状态数量
  const statusCounts = {
    draft: 0,
    distributed: 0,
    pending: 0,
    approved: 0
  }

  childIndicators.forEach(i => {
    const status = getChildStatus(i as StrategicIndicator) as keyof typeof statusCounts
    if (status in statusCounts) {
      statusCounts[status]++
    }
  })

  return statusCounts
}

// 计算当前选中学院的整体状态（用于表头显示）
// 状态定义：暂无指标、待下发、进行中、待审批
const collegeOverallStatus = computed(() => {
  if (!selectedCollege.value) {
    return { label: '暂无指标', type: 'info' }
  }

  const status = getCollegeStatus(selectedCollege.value)
  const total = status.draft + status.distributed + status.pending + status.approved

  if (total === 0) {
    return { label: '暂无指标', type: 'info' }
  }

  // 优先级：待审批 > 待下发 > 进行中
  // 待审批：有学院提交的进度等待审批
  if (status.pending > 0) {
    return { label: '待审批', type: 'warning' }
  }
  // 待下发：有草稿状态的指标
  if (status.draft > 0) {
    return { label: '待下发', type: 'info' }
  }
  // 进行中：已下发、active (legacy) 或已通过的指标（正在执行中）
  if (status.distributed > 0 || status.approved > 0) {
    return { label: '进行中', type: 'success' }
  }

  return { label: '暂无指标', type: 'info' }
})

// 计算当前选中学院的总权重
const collegeTotalWeight = computed(() => {
  if (!selectedCollege.value) {
    return 0
  }

  const collegeIndicators = strategicStore.indicators.filter(
    i => i.targetOrgName === selectedCollege.value && !i.isStrategic
  )

  return collegeIndicators.reduce((sum, i) => sum + Number(i.weight || 0), 0)
})

// 下发/撤销统一处理函数
const _handleDistributeOrWithdraw = (command: string) => {
  if (!selectedCollege.value) {
    return
  }

  if (command === 'distribute') {
    handleBatchDistribute(selectedCollege.value)
  } else if (command === 'withdraw') {
    handleBatchWithdraw(selectedCollege.value)
  }
}

// 单条指标进度审批也统一由工作流待办处理。

const getSortedMilestones = (milestones?: StrategicIndicator['milestones']) =>
  sortMilestonesByProgress(milestones || [])

// 查看详情
const handleViewDetail = (indicator: StrategicIndicator) => {
  currentDetailIndicator.value = indicator
  detailDrawerVisible.value = true
}

// 获取子指标状态
// 状态流转：draft(草稿) → distributed(已下发) → pending(待审批，下级提交后) → approved(已通过)
// 打回后回到 distributed 状态，撤销后回到 draft 状态
// 注意：这里的 pending 状态是指进度审批待审批（progressApprovalStatus），不是指标定义审核（lifecycle status 的 PENDING_REVIEW）
// Legacy ACTIVE status is treated as equivalent to DISTRIBUTED
const getChildStatus = (child: StrategicIndicator) => {
  const normalizedStatus = String(child.status || '').toUpperCase()
  const statusMap: Record<string, string> = {
    DRAFT: 'draft',
    PENDING: 'pending',
    PENDING_REVIEW: 'pending',
    DISTRIBUTED: 'distributed',
    ACTIVE: 'distributed',
    APPROVED: 'approved',
    REJECTED: 'distributed'
  }
  if (normalizedStatus) {
    return statusMap[normalizedStatus] ?? 'draft'
  }

  // fallback：兼容本地 statusAudit 推导
  const audit = child.statusAudit || []
  if (audit.length === 0) {
    return 'draft'
  }
  const lastAudit = audit[audit.length - 1]
  if (!lastAudit) {
    return 'draft'
  }
  const lastAction = lastAudit.action
  if (lastAction === 'submit') {
    return 'pending'
  }
  if (lastAction === 'approve') {
    return 'approved'
  }
  if (lastAction === 'reject') {
    return 'distributed'
  }
  if (lastAction === 'distribute') {
    return 'distributed'
  }
  if (lastAction === 'withdraw') {
    return 'draft'
  }
  return 'draft'
}

// 获取状态标签类型
const _getStatusTagType = (status: string) => {
  switch (status) {
    case 'draft':
      return 'info' // 草稿 - 灰色 (Element Plus info 是灰色)
    case 'distributed':
      return 'primary' // 已下发 - 蓝色 (Element Plus primary 是蓝色)
    case 'active':
      return 'primary' // 已下发 (legacy) - 蓝色
    case 'pending':
      return 'warning' // 待审批 - 橙色
    case 'approved':
      return 'success' // 已通过 - 绿色
    default:
      return 'info'
  }
}

// 获取状态文本
const _getStatusText = (status: string) => {
  switch (status) {
    case 'draft':
      return '草稿'
    case 'distributed':
      return '已下发'
    case 'active':
      return '已下发' // Legacy ACTIVE status
    case 'pending':
      return '待审批'
    case 'approved':
      return '已通过'
    default:
      return '已下发'
  }
}

// 格式化学院显示（完整列表）
const _formatColleges = (depts: string | string[] | undefined): string => {
  if (!depts) {
    return '-'
  }
  if (Array.isArray(depts)) {
    return depts.join('、')
  }
  return depts.split(',').join('、')
}

// 格式化学院显示（简短版，超过2个显示+N）
const _formatCollegesShort = (depts: string | string[] | undefined): string => {
  if (!depts) {
    return '-'
  }
  const arr = Array.isArray(depts) ? depts : depts.split(',')
  if (arr.length <= 2) {
    return arr.join('、')
  }
  return `${arr.slice(0, 2).join('、')} +${arr.length - 2}`
}

// 解析学院字符串为数组（用于编辑时）
const parseColleges = (depts: string | string[] | undefined): string[] => {
  if (!depts) {
    return []
  }
  if (Array.isArray(depts)) {
    return depts
  }
  return depts.split(',')
}

// 获取任务类型对应的颜色（基于指标的type2：发展性/基础性）
const _getTaskTypeColor = (type2: string) => {
  return type2 === '发展性' ? '#409EFF' : '#67C23A'
}

// 获取指标类型颜色（定性/定量）
const _getIndicatorTypeColor = (type1: string) => {
  return type1 === '定性'
    ? 'var(--color-qualitative, #9333ea)'
    : 'var(--color-quantitative, #0891b2)'
}

// 为已有子指标生成12个月里程碑（Milestone类型）
const generateMonthlyMilestonesForExisting = (
  childName: string
): { id: string; name: string; targetProgress: number; deadline: string; status: 'pending' }[] => {
  const currentYear = timeContext.currentYear
  const indicatorName = childName || '指标完成'
  const milestones: {
    id: string
    name: string
    targetProgress: number
    deadline: string
    status: 'pending'
  }[] = []

  for (let month = 1; month <= 12; month++) {
    const lastDay = new Date(currentYear, month, 0).getDate()
    const deadline = `${currentYear}-${String(month).padStart(2, '0')}-${lastDay}`
    const progress = Math.round((month / 12) * 100)

    milestones.push({
      id: `ms-${Date.now()}-${month}`,
      name: `${indicatorName} - ${month}月`,
      targetProgress: progress,
      deadline: deadline,
      status: 'pending'
    })
  }
  return milestones
}

// 为新增子指标生成12个月里程碑（LocalMilestone类型）
const generateMonthlyMilestonesLocal = (childName: string): LocalMilestone[] => {
  const currentYear = timeContext.currentYear
  const indicatorName = childName || '指标完成'
  const milestones: LocalMilestone[] = []

  for (let month = 1; month <= 12; month++) {
    const lastDay = new Date(currentYear, month, 0).getDate()
    const expectedDate = `${currentYear}-${String(month).padStart(2, '0')}-${lastDay}`
    const progress = Math.round((month / 12) * 100)

    milestones.push({
      id: `ms-${Date.now()}-${month}`,
      name: `${indicatorName} - ${month}月`,
      expectedDate: expectedDate,
      progress: progress
    })
  }
  return milestones
}

// 计算定量指标当月的目标进度
const _getCurrentMonthTargetProgress = (child: StrategicIndicator | NewChildIndicator): number => {
  const milestones = child.milestones || []
  if (milestones.length === 0) {
    return 100
  }

  const currentMonth = new Date().getMonth() + 1 // 1-12
  const currentYear = timeContext.currentYear

  // 查找当月的里程碑
  for (const ms of milestones) {
    // 兼容两种里程碑类型：Milestone (deadline, targetProgress) 和 LocalMilestone (expectedDate, progress)
    const dateStr =
      'deadline' in ms && ms.deadline ? ms.deadline : 'expectedDate' in ms ? ms.expectedDate : ''
    const progressVal =
      'targetProgress' in ms && ms.targetProgress !== undefined
        ? ms.targetProgress
        : 'progress' in ms
          ? ms.progress
          : 0

    if (dateStr) {
      const deadline = new Date(dateStr)
      if (deadline.getFullYear() === currentYear && deadline.getMonth() + 1 === currentMonth) {
        return progressVal
      }
    }
  }

  // 如果没找到当月里程碑，返回最近的一个里程碑进度
  const now = new Date()
  let closestProgress = 100
  let minDiff = Infinity

  for (const ms of milestones) {
    const dateStr =
      'deadline' in ms && ms.deadline ? ms.deadline : 'expectedDate' in ms ? ms.expectedDate : ''
    const progressVal =
      'targetProgress' in ms && ms.targetProgress !== undefined
        ? ms.targetProgress
        : 'progress' in ms
          ? ms.progress
          : 0

    if (dateStr) {
      const deadline = new Date(dateStr)
      const diff = Math.abs(deadline.getTime() - now.getTime())
      if (diff < minDiff) {
        minDiff = diff
        closestProgress = progressVal
      }
    }
  }

  return closestProgress
}

// 处理子指标类型变更
const _handleChildTypeChange = (
  child: NewChildIndicator | StrategicIndicator,
  newType: '定量' | '定性'
) => {
  // 检查状态：只有草稿状态才能编辑
  if (!('isNew' in child && child.isNew)) {
    const status = getChildStatus(child as StrategicIndicator)
    if (status !== 'draft') {
      ElMessage.warning('只有草稿状态的指标才能编辑，请先撤销下发')
      return
    }
  }

  if ('isNew' in child && child.isNew) {
    // 新增的子指标 - 使用 LocalMilestone 类型
    child.type1 = newType
    if (newType === '定量') {
      child.targetProgress = 100
      // 自动生成12个月里程碑（LocalMilestone类型）
      child.milestones = generateMonthlyMilestonesLocal(child.name)
    } else {
      child.targetProgress = 0
      child.milestones = []
    }
  } else {
    // 已有的子指标 - 使用 Milestone 类型
    const indicator = child as StrategicIndicator
    const newMilestones =
      newType === '定量' ? generateMonthlyMilestonesForExisting(indicator.name) : []

    const updates: Partial<StrategicIndicator> = {
      type1: newType,
      isQualitative: newType === '定性',
      targetValue: newType === '定量' ? 100 : 0,
      milestones: newMilestones
    }
    strategicStore.updateIndicator(indicator.id.toString(), updates)
  }

  ElMessage.success(`已切换为${newType}指标`)
}

// 里程碑弹窗相关
const milestonesDialogVisible = ref(false)
const editingMilestonesChild = ref<NewChildIndicator | StrategicIndicator | null>(null)
const editingMilestones = ref<LocalMilestone[]>([])

// 打开里程碑编辑弹窗
const openMilestonesDialog = (child: NewChildIndicator | StrategicIndicator) => {
  editingMilestonesChild.value = child
  if ('isNew' in child && child.isNew) {
    editingMilestones.value = JSON.parse(JSON.stringify(child.milestones || []))
  } else {
    // 从已有子指标的milestones转换
    const existing = (child as StrategicIndicator).milestones || []
    editingMilestones.value = existing.map(m => ({
      id: m.id || `ms-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: m.name,
      expectedDate: m.deadline || '',
      progress: m.targetProgress || 0
    }))
  }
  milestonesDialogVisible.value = true
}

// 获取正在编辑的子指标名称
const getEditingChildName = (): string => {
  if (!editingMilestonesChild.value) {
    return ''
  }
  if ('isNew' in editingMilestonesChild.value && editingMilestonesChild.value.isNew) {
    return editingMilestonesChild.value.name || '新增指标'
  }
  return (editingMilestonesChild.value as StrategicIndicator).name || ''
}

// 获取正在编辑的子指标类型
const getEditingChildType = (): string => {
  if (!editingMilestonesChild.value) {
    return '定性'
  }
  if ('isNew' in editingMilestonesChild.value && editingMilestonesChild.value.isNew) {
    return editingMilestonesChild.value.type1 || '定性'
  }
  const indicator = editingMilestonesChild.value as StrategicIndicator
  return indicator.type1 || (indicator.isQualitative ? '定性' : '定量')
}

// 添加里程碑
const addMilestone = () => {
  const autoName = getEditingChildType() === '定量' ? getEditingChildName() : ''
  const lastProgress =
    editingMilestones.value.length > 0
      ? (editingMilestones.value[editingMilestones.value.length - 1]?.progress ?? 0)
      : 0
  editingMilestones.value.push({
    id: `ms-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: autoName,
    expectedDate: '',
    progress: lastProgress
  })
}

// 生成12个月里程碑
const generateMonthlyMilestones = () => {
  const currentYear = new Date().getFullYear()
  const indicatorName = getEditingChildName() || '指标完成'
  editingMilestones.value = []

  for (let month = 1; month <= 12; month++) {
    const lastDay = new Date(currentYear, month, 0).getDate()
    const deadline = `${currentYear}-${String(month).padStart(2, '0')}-${lastDay}`
    const progress = Math.round((month / 12) * 100)

    editingMilestones.value.push({
      id: `-${month}`, // 使用负数字符串作为临时 ID，后端会识别为新里程碑
      name: `${indicatorName} - ${month}月`,
      expectedDate: deadline,
      progress: progress
    })
  }
}

// 删除里程碑
const removeMilestone = (index: number) => {
  editingMilestones.value.splice(index, 1)
}

// 验证里程碑进度（后面的不能小于前面的）
const validateMilestoneProgress = (index: number) => {
  const current = editingMilestones.value[index]
  if (!current) {
    return
  }

  // 检查是否小于前一个里程碑的进度
  if (index > 0) {
    const prev = editingMilestones.value[index - 1]
    if (prev && current.progress < prev.progress) {
      ElMessage.warning(
        `第 ${index + 1} 个里程碑的进度不能小于第 ${index} 个里程碑的进度 (${prev.progress}%)`
      )
      current.progress = prev.progress
      return
    }
  }

  // 检查是否大于后一个里程碑的进度
  if (index < editingMilestones.value.length - 1) {
    const next = editingMilestones.value[index + 1]
    if (next && current.progress > next.progress) {
      ElMessage.warning(
        `第 ${index + 1} 个里程碑的进度不能大于第 ${index + 2} 个里程碑的进度 (${next.progress}%)`
      )
      current.progress = next.progress
      return
    }
  }
}

// 保存里程碑
const saveMilestones = async () => {
  if (!editingMilestonesChild.value) {
    return
  }

  const child = editingMilestonesChild.value
  if ('isNew' in child && child.isNew) {
    child.milestones = JSON.parse(JSON.stringify(editingMilestones.value))
    milestonesDialogVisible.value = false
    editingMilestonesChild.value = null
    editingMilestones.value = []
  } else {
    try {
      const indicator = child as StrategicIndicator
      const updates: Partial<StrategicIndicator> = {
        targetValue: editingMilestones.value.length,
        milestones: editingMilestones.value.map(m => ({
          id: m.id,
          name: m.name,
          targetProgress: m.progress,
          deadline: m.expectedDate,
          status: 'pending' as const
        }))
      }

      logger.info(
        `[IndicatorDistributionView] Saving ${editingMilestones.value.length} milestones for indicator ${indicator.id}`
      )

      await strategicStore.updateIndicator(indicator.id.toString(), updates)

      logger.info(`[IndicatorDistributionView] Reloading indicators after milestone update...`)

      // 重新加载指标数据以获取后端更新后的里程碑
      await refreshDistributionData()

      // 验证重新加载后的里程碑数量
      const reloadedIndicator = strategicStore.indicators.find(i => i.id === indicator.id)
      if (reloadedIndicator) {
        logger.info(
          `[IndicatorDistributionView] After reload, indicator ${reloadedIndicator.id} has ${reloadedIndicator.milestones?.length || 0} milestones`
        )
      }

      ElMessage.success('里程碑已更新')
      milestonesDialogVisible.value = false
      editingMilestonesChild.value = null
      editingMilestones.value = []
    } catch (error) {
      console.error('Failed to save milestones:', error)
      ElMessage.error('里程碑更新失败')
    }
  }
}

// 格式化里程碑显示
const _formatMilestones = (child: StrategicIndicator | NewChildIndicator): string => {
  if ('isNew' in child && child.isNew) {
    return `${child.milestones?.length || 0} 个里程碑`
  }
  const indicator = child as StrategicIndicator
  return `${indicator.milestones?.length || 0} 个里程碑`
}

// 获取里程碑列表用于tooltip显示
const getMilestonesTooltip = (child: StrategicIndicator | NewChildIndicator): LocalMilestone[] => {
  if ('isNew' in child && child.isNew) {
    return child.milestones || []
  }
  const indicator = child as StrategicIndicator
  return (indicator.milestones || []).map(m => ({
    id: m.id || '',
    name: m.name,
    expectedDate: m.deadline || '',
    progress: m.targetProgress || 0
  }))
}

// 判断里程碑是否已完成（指标当前进度 >= 里程碑目标进度）
const isMilestoneCompleted = (
  child: StrategicIndicator | NewChildIndicator,
  milestoneProgress: number
): boolean => {
  if ('isNew' in child && child.isNew) {
    return false // 新增的子指标还没有进度
  }
  const indicator = child as StrategicIndicator
  return (indicator.progress || 0) >= milestoneProgress
}

// ================== 表格数据类型 ==================

// 表格行数据类型
interface TableRowData {
  type: 'child' | 'new-child' | 'indicator-only' // indicator-only 表示没有子指标的父指标
  taskTitle: string
  indicator: StrategicIndicator // 父指标
  child?: StrategicIndicator | NewChildIndicator // 子指标
  parentIndicatorId: string
  rowIndex?: number // 新增子指标的索引
}

// ================== 学院视图数据 ==================

// 学院视图表格数据
const collegeTableData = computed(() => {
  if (!selectedCollege.value) {
    return []
  }

  const data: TableRowData[] = []
  const indicators = collegeIndicators.value

  indicators.forEach(indicator => {
    const indicatorId = indicator.id.toString()

    // 获取下发给该学院的子指标（支持字符串或数组格式）
    const children = strategicStore.indicators.filter(i => {
      if (i.parentIndicatorId !== indicatorId || i.isStrategic) {
        return false
      }
      // 支持字符串或数组格式的 responsibleDept
      if (Array.isArray(i.responsibleDept)) {
        return i.responsibleDept.includes(selectedCollege.value!)
      }
      return i.responsibleDept === selectedCollege.value
    })

    // 获取新增的子指标（只显示分配给当前学院的）
    const newChildren = (newChildIndicators[indicatorId] || []).filter(nc =>
      nc.college.includes(selectedCollege.value!)
    )

    // 仅显示真实存在的子指标和正在新增的子指标，不再为“尚未分解”的父指标补空占位行
    children.forEach(child => {
      data.push({
        type: 'child',
        taskTitle: indicator.taskContent || '',
        indicator,
        child,
        parentIndicatorId: indicatorId
      })
    })

    newChildren.forEach((newChild, newIdx) => {
      // 查找原始索引
      const originalIdx = (newChildIndicators[indicatorId] || []).findIndex(
        nc => nc.id === newChild.id
      )
      data.push({
        type: 'new-child',
        taskTitle: indicator.taskContent || '',
        indicator,
        child: newChild,
        parentIndicatorId: indicatorId,
        rowIndex: originalIdx >= 0 ? originalIdx : newIdx
      })
    })
  })

  return data
})

// 获取行的 class 名称（用于标识新增子指标行）
const getRowClassName = ({ row }: { row: TableRowData }) => {
  if (row.type === 'new-child') {
    return 'new-child-row'
  }
  return ''
}
</script>

<template>
  <div class="distribution-view page-fade-enter">
    <!-- 只读提示 -->
    <el-alert
      v-if="isStrategicDept"
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom: 16px"
    >
      当前以战略发展部身份查看，数据为只读状态
    </el-alert>
    <el-alert
      v-else-if="timeContext.isReadOnly"
      type="warning"
      :closable="false"
      show-icon
      style="margin-bottom: 16px"
    >
      当前处于历史快照模式（{{ timeContext.currentYear }}年），数据为只读状态
    </el-alert>

    <div class="distribution-layout">
      <!-- 左侧：学院侧边栏 -->
      <div class="strategic-panel card-animate">
        <div class="panel-header">
          <span class="panel-title">学院列表</span>
          <el-input
            v-model="searchKeyword"
            placeholder="搜索学院..."
            :prefix-icon="Search"
            clearable
            size="small"
            style="width: 120px"
          />
        </div>

        <!-- 学院列表 -->
        <div class="indicator-list">
          <div
            v-for="college in filteredColleges"
            :key="college"
            :class="['college-card', { selected: selectedCollege === college }]"
            @click="selectedCollege = college"
          >
            <span class="college-card-name">{{ college }}</span>
            <span class="college-card-count">{{ getCollegeChildCount(college) }} 个子指标</span>
          </div>

          <el-empty
            v-if="filteredColleges.length === 0"
            :description="isCollegeSidebarLoading ? '学院加载中...' : '暂无学院'"
          />
        </div>
      </div>

      <!-- 右侧：指标表格 -->
      <div class="distribution-panel">
        <!-- 学院模式：选中学院时显示 -->
        <div
          v-if="selectedCollege"
          class="table-card card-base card-animate"
          style="animation-delay: 0.1s"
        >
          <!-- 表头 -->
          <div class="card-header">
            <div class="header-left">
              <span class="card-title">{{ selectedCollege }}</span>
              <el-tag :type="collegeOverallStatus.type" size="default" style="margin-left: 12px">
                状态: {{ collegeOverallStatus.label }}
              </el-tag>
              <el-tag
                :type="collegeTotalWeight === 100 ? 'success' : 'danger'"
                size="default"
                style="margin-left: 12px"
              >
                权重合计: {{ collegeTotalWeight }} / 100
              </el-tag>
            </div>
            <div v-if="canEditChild" class="header-actions">
              <!-- 
                按钮显示逻辑：
                - 暂无指标 → 只显示"添加指标"按钮
                - 其他状态 → 审批按钮始终显示，其他按钮根据状态显示
              -->
              <!-- 暂无指标：只显示添加指标按钮 -->
              <template v-if="collegeOverallStatus.label === '暂无指标'">
                <el-button type="primary" @click="openAddIndicatorForm">
                  <el-icon><Plus /></el-icon>
                  新增指标
                </el-button>
              </template>
              <!-- 有指标时：审批按钮始终显示 -->
              <template v-else>
                <!-- 审批按钮 - 始终显示 -->
                <el-button
                  :type="pendingApprovalCount > 0 ? 'warning' : 'default'"
                  @click="handleOpenApproval"
                >
                  <el-icon><Check /></el-icon>
                  查看审批{{ pendingApprovalCount > 0 ? ` (${pendingApprovalCount})` : '' }}
                </el-button>
                <!-- 待下发状态：显示添加指标和下发按钮 -->
                <template v-if="collegeOverallStatus.label === '待下发'">
                  <el-button type="primary" @click="openAddIndicatorForm">
                    <el-icon><Plus /></el-icon>
                    新增指标
                  </el-button>
                  <el-button type="success" @click="handleBatchDistribute(selectedCollege)">
                    <el-icon><Promotion /></el-icon>
                    下发 ({{ getCollegeStatus(selectedCollege).draft }})
                  </el-button>
                </template>
                <!-- 进行中状态：显示撤回按钮 -->
                <template v-else-if="collegeOverallStatus.label === '进行中'">
                  <el-button type="warning" plain @click="handleBatchWithdraw(selectedCollege)">
                    <el-icon><RefreshLeft /></el-icon>
                    批量撤回
                  </el-button>
                </template>
                <!-- 待审批状态：显示撤回按钮 -->
                <template v-else-if="collegeOverallStatus.label === '待审批'">
                  <el-button type="warning" plain @click="handleBatchWithdraw(selectedCollege)">
                    <el-icon><RefreshLeft /></el-icon>
                    批量撤回
                  </el-button>
                </template>
              </template>
            </div>
          </div>

          <!-- 表格主体 -->
          <div class="card-body table-body">
            <div class="table-container">
              <el-table
                :data="collegeTableData"
                border
                :row-class-name="getRowClassName"
                class="unified-table distribution-table"
              >
                <!-- 子指标名称列 -->
                <el-table-column label="子指标名称" min-width="150">
                  <template #default="{ row }">
                    <!-- 没有子指标的父指标 -->
                    <template v-if="row.type === 'indicator-only'">
                      <div class="add-child-hint">
                        <span class="no-child-text">暂无子指标</span>
                      </div>
                    </template>
                    <!-- 已有子指标 -->
                    <template v-else-if="row.type === 'child'">
                      <div
                        class="child-name-cell"
                        @dblclick="handleChildDblClick(row.child, 'name')"
                      >
                        <el-input
                          v-if="
                            editingChildId === row.child?.id?.toString() &&
                            editingChildField === 'name'
                          "
                          v-model="editingChildValue"
                          type="textarea"
                          :rows="1"
                          autosize
                          class="editing-field textarea-cell"
                          @blur="saveChildEdit(row.child, 'name')"
                        />
                        <span v-else-if="isSavingChildCell(row.child, 'name')" class="cell-saving-text">
                          保存中...
                        </span>
                        <el-tooltip
                          v-else
                          :content="row.child?.type1 === '定性' ? '定性指标' : '定量指标'"
                          placement="top"
                        >
                          <span
                            class="child-text"
                            :class="
                              row.child?.type1 === '定性'
                                ? 'indicator-qualitative'
                                : 'indicator-quantitative'
                            "
                            >{{ row.child?.name || '未命名' }}</span
                          >
                        </el-tooltip>
                      </div>
                    </template>
                    <!-- 新增子指标行 -->
                    <template v-else-if="row.type === 'new-child'">
                      <div
                        class="new-child-cell"
                        @click="handleNewChildRowClick(row.child.id, row.parentIndicatorId)"
                      >
                        <el-input
                          v-if="editingNewChildId === row.child.id"
                          v-model="row.child.name"
                          type="textarea"
                          :rows="1"
                          autosize
                          placeholder="输入子指标名称"
                          class="new-child-editing textarea-cell"
                          @blur="validateAndSaveNewChild(row.parentIndicatorId, row.child.id)"
                        />
                        <el-tooltip
                          v-else
                          :content="row.child?.type1 === '定性' ? '定性指标' : '定量指标'"
                          placement="top"
                        >
                          <span
                            class="new-child-text"
                            :class="{ 'placeholder-text': !row.child.name }"
                            >{{ row.child.name || '点击输入名称' }}</span
                          >
                        </el-tooltip>
                      </div>
                    </template>
                  </template>
                </el-table-column>

                <!-- 备注列 -->
                <el-table-column label="备注" width="140">
                  <template #default="{ row }">
                    <template v-if="row.type === 'indicator-only'">
                      <span class="remark-text">-</span>
                    </template>
                    <template v-else-if="row.type === 'child'">
                      <div
                        class="child-remark-cell"
                        @dblclick="handleChildDblClick(row.child, 'remark')"
                      >
                        <el-input
                          v-if="
                            editingChildId === row.child?.id?.toString() &&
                            editingChildField === 'remark'
                          "
                          v-model="editingChildValue"
                          type="textarea"
                          :rows="1"
                          autosize
                          class="editing-field textarea-cell"
                          @blur="saveChildEdit(row.child, 'remark')"
                        />
                        <span v-else-if="isSavingChildCell(row.child, 'remark')" class="cell-saving-text">
                          保存中...
                        </span>
                        <span v-else class="remark-text">{{ row.child?.remark || '-' }}</span>
                      </div>
                    </template>
                    <template v-else-if="row.type === 'new-child'">
                      <div
                        class="new-child-cell"
                        @click="handleNewChildRowClick(row.child.id, row.parentIndicatorId)"
                      >
                        <el-input
                          v-if="editingNewChildId === row.child.id"
                          v-model="row.child.remark"
                          type="textarea"
                          :rows="1"
                          autosize
                          placeholder="输入备注（选填）"
                          class="new-child-editing textarea-cell"
                        />
                        <span
                          v-else
                          class="remark-text new-child-text"
                          :class="{ 'placeholder-text': !row.child.remark }"
                          >{{ row.child.remark || '-' }}</span
                        >
                      </div>
                    </template>
                  </template>
                </el-table-column>

                <!-- 权重列 -->
                <el-table-column label="权重" width="80" align="center">
                  <template #default="{ row }">
                    <template v-if="row.type === 'indicator-only'">
                      <span class="weight-text">-</span>
                    </template>
                    <template v-else-if="row.type === 'child'">
                      <div class="weight-cell" @dblclick="handleChildDblClick(row.child, 'weight')">
                        <el-input-number
                          v-if="
                            editingChildId === row.child?.id?.toString() &&
                            editingChildField === 'weight'
                          "
                          v-model="editingChildValue"
                          :min="0"
                          :max="100"
                          size="small"
                          :controls="false"
                          style="width: 60px"
                          class="editing-field"
                          @blur="saveChildEdit(row.child, 'weight')"
                        />
                        <span v-else-if="isSavingChildCell(row.child, 'weight')" class="cell-saving-text">
                          保存中...
                        </span>
                        <span v-else class="weight-text editable">{{
                          row.child?.weight ?? '-'
                        }}</span>
                      </div>
                    </template>
                    <template v-else-if="row.type === 'new-child'">
                      <span class="weight-text">{{ row.child?.weight ?? 10 }}</span>
                    </template>
                  </template>
                </el-table-column>

                <!-- 学院模式下不显示学院列 -->

                <!-- 里程碑列 -->
                <el-table-column label="里程碑" width="100" align="center">
                  <template #default="{ row }">
                    <template v-if="row.type === 'indicator-only'">
                      <span class="milestone-count">-</span>
                    </template>
                    <template v-else-if="row.type === 'child'">
                      <el-popover
                        placement="left"
                        :width="320"
                        trigger="hover"
                        :disabled="!row.child?.milestones?.length"
                      >
                        <template #reference>
                          <div
                            class="milestone-cell"
                            :class="{
                              editable: canEditChild && getChildStatus(row.child) === 'draft'
                            }"
                            @dblclick="
                              canEditChild &&
                              getChildStatus(row.child) === 'draft' &&
                              openMilestonesDialog(row.child)
                            "
                          >
                            <span class="milestone-count">
                              {{ row.child?.milestones?.length || 0 }} 个里程碑
                            </span>
                          </div>
                        </template>
                        <div class="milestone-popover">
                          <div class="milestone-popover-title">里程碑列表</div>
                          <div
                            v-for="(ms, idx) in getMilestonesTooltip(row.child)"
                            :key="ms.id"
                            class="milestone-item"
                            :class="{
                              'milestone-completed': isMilestoneCompleted(row.child, ms.progress)
                            }"
                          >
                            <div class="milestone-item-header">
                              <span class="milestone-index">{{ idx + 1 }}.</span>
                              <span class="milestone-name">{{ ms.name || '未命名' }}</span>
                              <el-icon
                                v-if="isMilestoneCompleted(row.child, ms.progress)"
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
                          <div v-if="!row.child?.milestones?.length" class="milestone-empty">
                            暂无里程碑
                          </div>
                        </div>
                      </el-popover>
                    </template>
                    <template v-else-if="row.type === 'new-child'">
                      <el-popover
                        placement="left"
                        :width="320"
                        trigger="hover"
                        :disabled="!row.child?.milestones?.length"
                      >
                        <template #reference>
                          <div
                            class="milestone-cell editable"
                            @dblclick.stop="openMilestonesDialog(row.child)"
                          >
                            <span class="milestone-count">
                              {{ row.child?.milestones?.length || 0 }} 个里程碑
                            </span>
                          </div>
                        </template>
                        <div class="milestone-popover">
                          <div class="milestone-popover-title">里程碑列表</div>
                          <div
                            v-for="(ms, idx) in getMilestonesTooltip(row.child)"
                            :key="ms.id"
                            class="milestone-item"
                          >
                            <div class="milestone-item-header">
                              <span class="milestone-index">{{ idx + 1 }}.</span>
                              <span class="milestone-name">{{ ms.name || '未命名' }}</span>
                            </div>
                            <div class="milestone-item-info">
                              <span>预期: {{ ms.expectedDate || '未设置' }}</span>
                              <span>进度: {{ ms.progress }}%</span>
                            </div>
                          </div>
                          <div v-if="!row.child?.milestones?.length" class="milestone-empty">
                            暂无里程碑
                          </div>
                        </div>
                      </el-popover>
                    </template>
                  </template>
                </el-table-column>

                <!-- 进度列 -->
                <el-table-column label="进度" width="100" align="center">
                  <template #default="{ row }">
                    <template v-if="row.type === 'indicator-only'">
                      <span class="progress-text">-</span>
                    </template>
                    <template v-else-if="row.type === 'child'">
                      <div
                        class="progress-cell"
                        @dblclick="handleChildDblClick(row.child, 'progress')"
                      >
                        <el-input-number
                          v-if="
                            editingChildId === row.child.id.toString() &&
                            editingChildField === 'progress'
                          "
                          v-model="editingChildValue"
                          :min="0"
                          :max="100"
                          :precision="0"
                          size="small"
                          class="editing-field"
                          @blur="saveChildEdit(row.child, 'progress')"
                          @keyup.enter="saveChildEdit(row.child, 'progress')"
                          @keyup.esc="cancelChildEdit"
                        />
                        <span
                          v-else-if="isSavingChildCell(row.child, 'progress')"
                          class="cell-saving-text"
                        >
                          保存中...
                        </span>
                        <span
                          v-else
                          class="progress-text"
                          :class="{
                            editable: canEditChild && getChildStatus(row.child) === 'draft'
                          }"
                        >
                          {{ row.child?.progress || 0 }}%
                        </span>
                      </div>
                    </template>
                    <template v-else-if="row.type === 'new-child'">
                      <span class="progress-text">-</span>
                    </template>
                  </template>
                </el-table-column>

                <!-- 操作列 - 学院模式：仅查看和删除（删除需先撤销） -->
                <el-table-column label="操作" width="180" align="center">
                  <template #default="{ row }">
                    <!-- 没有子指标的父指标 - 无操作 -->
                    <template v-if="row.type === 'indicator-only'">
                      <span class="action-placeholder">-</span>
                    </template>
                    <!-- 子指标操作：查看 + 删除（仅草稿状态） -->
                    <template v-else-if="row.type === 'child'">
                      <div class="action-cell">
                        <el-button
                          link
                          type="primary"
                          size="small"
                          @click="handleViewDetail(row.child)"
                        >
                          <el-icon><View /></el-icon>查看
                        </el-button>
                        <el-button
                          v-if="canEditChild && canWithdrawChildIndicator(row.child)"
                          link
                          type="warning"
                          size="small"
                          @click="handleSingleWithdraw(row.child)"
                        >
                          <el-icon><RefreshLeft /></el-icon>撤回
                        </el-button>
                        <!-- 只有草稿状态才能删除，已下发/待审批/已通过的不显示删除按钮 -->
                        <el-button
                          v-if="canEditChild && getChildStatus(row.child) === 'draft'"
                          link
                          type="danger"
                          size="small"
                          @click="removeChildIndicator(row.child)"
                        >
                          <el-icon><Close /></el-icon>删除
                        </el-button>
                      </div>
                    </template>
                    <!-- 新增子指标操作：删除 -->
                    <template v-else-if="row.type === 'new-child'">
                      <div class="action-cell">
                        <el-button
                          link
                          type="danger"
                          size="small"
                          @click="removeNewChildRow(row.parentIndicatorId, row.rowIndex)"
                        >
                          <el-icon><Close /></el-icon>删除
                        </el-button>
                      </div>
                    </template>
                  </template>
                </el-table-column>
              </el-table>
            </div>

            <!-- 新增指标表单 -->
            <div v-if="isAddingIndicator" ref="addRowFormRef" class="add-row-form">
              <h3 class="form-title">新增子指标</h3>
              <el-form label-width="180px" class="no-wrap-labels">
                <el-row :gutter="16">
                  <el-col :span="12">
                    <el-form-item label="关联指标" required class="no-wrap-label">
                      <el-select
                        v-model="newIndicatorForm.parentIndicatorId"
                        filterable
                        placeholder="选择关联的核心指标"
                        style="width: 100%"
                        @change="handleParentIndicatorChange"
                      >
                        <el-option-group
                          v-for="task in plansWithIndicators"
                          :key="task.taskContent"
                          :label="task.taskContent"
                        >
                          <el-option
                            v-for="indicator in task.indicators"
                            :key="indicator.id"
                            :label="indicator.name"
                            :value="indicator.id.toString()"
                          >
                            <span>{{ indicator.name }}</span>
                            <el-tag
                              size="small"
                              style="margin-left: 8px"
                              :type="indicator.type1 === '定量' ? 'primary' : 'warning'"
                            >
                              {{ indicator.type1 }}
                            </el-tag>
                          </el-option>
                        </el-option-group>
                      </el-select>
                    </el-form-item>
                  </el-col>
                  <el-col :span="8">
                    <el-form-item label="指标类型">
                      <el-select
                        v-model="newIndicatorForm.type1"
                        style="width: 100%"
                        @change="
                          (val: string) => handleFormIndicatorTypeChange(val as '定量' | '定性')
                        "
                      >
                        <el-option label="定性" value="定性" />
                        <el-option label="定量" value="定量" />
                      </el-select>
                    </el-form-item>
                  </el-col>
                  <el-col :span="8">
                    <el-form-item label="权重">
                      <el-input-number
                        v-model="newIndicatorForm.weight"
                        :min="0"
                        :max="100"
                        placeholder="权重"
                        :controls="false"
                        style="width: 100%"
                      />
                    </el-form-item>
                  </el-col>
                </el-row>
                <el-row :gutter="16">
                  <el-col :span="24">
                    <el-form-item label="指标内容" required>
                      <el-input
                        v-model="newIndicatorForm.name"
                        type="textarea"
                        :autosize="{ minRows: 2, maxRows: 10 }"
                        placeholder="输入指标内容"
                      />
                    </el-form-item>
                  </el-col>
                </el-row>
                <el-row :gutter="16">
                  <el-col :span="24">
                    <el-form-item label="备注">
                      <el-input
                        v-model="newIndicatorForm.remark"
                        type="textarea"
                        :autosize="{ minRows: 2, maxRows: 10 }"
                        placeholder="输入备注内容（选填）"
                      />
                    </el-form-item>
                  </el-col>
                </el-row>
                <el-row :gutter="16">
                  <el-col :span="24">
                    <el-form-item label="里程碑" required>
                      <div class="milestone-form-area">
                        <el-button
                          v-if="newIndicatorForm.type1 === '定性'"
                          size="small"
                          type="primary"
                          plain
                          @click="addFormMilestone"
                        >
                          <el-icon><Plus /></el-icon> 添加里程碑
                        </el-button>
                        <div v-if="newIndicatorForm.milestones.length > 0" class="milestone-list">
                          <div
                            v-for="(ms, idx) in newIndicatorForm.milestones"
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
                            <el-button
                              type="danger"
                              size="small"
                              text
                              @click="removeFormMilestone(idx)"
                            >
                              <el-icon><Delete /></el-icon>
                            </el-button>
                          </div>
                        </div>
                        <span v-else class="milestone-hint">
                          {{
                            newIndicatorForm.type1 === '定量'
                              ? '选择定量后自动生成12月里程碑'
                              : '暂无里程碑，点击添加'
                          }}
                        </span>
                      </div>
                    </el-form-item>
                  </el-col>
                </el-row>
                <el-row>
                  <el-col :span="24" style="text-align: right">
                    <el-button type="primary" :loading="isSavingIndicator" :disabled="isSavingIndicator" @click="saveNewIndicator">
                      {{ isSavingIndicator ? '保存中' : '保存' }}
                    </el-button>
                    <el-button :disabled="isSavingIndicator" @click="cancelAddIndicator">取消</el-button>
                  </el-col>
                </el-row>
              </el-form>
            </div>
          </div>
        </div>

        <!-- 空状态：未选择学院 -->
        <el-empty v-else description="请选择左侧学院" class="empty-placeholder" />
      </div>
    </div>

    <!-- 指标详情抽屉 -->
    <el-drawer v-model="detailDrawerVisible" title="指标详情" size="45%">
      <div v-if="currentDetailIndicator" class="detail-container">
        <div class="detail-header">
          <h3>{{ currentDetailIndicator.name }}</h3>
          <div class="detail-tags">
            <el-tag
              size="small"
              :type="currentDetailIndicator.type1 === '定量' ? 'primary' : 'warning'"
            >
              {{ currentDetailIndicator.type1 }}
            </el-tag>
            <el-tag
              size="small"
              :style="{
                backgroundColor: _getTaskTypeColor(currentDetailIndicator.type2),
                color: '#fff',
                border: 'none'
              }"
            >
              {{ currentDetailIndicator.type2 }}任务
            </el-tag>
            <el-tag size="small" :type="_getStatusTagType(getChildStatus(currentDetailIndicator))">
              {{
                getChildStatus(currentDetailIndicator) === 'draft'
                  ? '待下发'
                  : getChildStatus(currentDetailIndicator) === 'pending'
                    ? '待审批'
                    : getChildStatus(currentDetailIndicator) === 'approved'
                      ? '已通过'
                      : '已下发'
              }}
            </el-tag>
          </div>
        </div>

        <el-descriptions :column="2" border class="detail-desc">
          <el-descriptions-item label="战略任务" :span="2">
            {{ currentDetailIndicator.taskContent }}
          </el-descriptions-item>
          <el-descriptions-item label="任务类别">
            {{ currentDetailIndicator.type2 }}任务
          </el-descriptions-item>
          <el-descriptions-item label="指标类型">
            {{ currentDetailIndicator.type1 }}
          </el-descriptions-item>
          <el-descriptions-item label="权重">{{ currentDetailIndicator.weight }}</el-descriptions-item>
          <el-descriptions-item label="当前进度">
            {{ currentDetailIndicator.progress || 0 }}%
          </el-descriptions-item>
          <el-descriptions-item label="责任部门">
            {{ currentDetailIndicator.responsibleDept || '未分配' }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间" :span="2">
            {{ currentDetailIndicator.createTime }}
          </el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">
            {{ currentDetailIndicator.remark || '暂无备注' }}
          </el-descriptions-item>
        </el-descriptions>

        <div
          v-if="currentDetailIndicator.milestones && currentDetailIndicator.milestones.length > 0"
          class="milestone-section"
        >
          <div class="divider"></div>
          <h4>里程碑节点</h4>
          <el-timeline style="margin-top: 20px; padding-left: 5px">
            <el-timeline-item
              v-for="(milestone, index) in getSortedMilestones(currentDetailIndicator.milestones)"
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
      </div>
    </el-drawer>

    <!-- 任务审批进度抽屉 -->
    <ApprovalProgressDrawer
      v-model="taskApprovalVisible"
      :indicators="approvalIndicators"
      :plan="currentDepartmentPlanDetails"
      :department-name="selectedCollege || currentDept || '当前部门'"
      :plan-name="selectedCollege || currentDept || '当前部门'"
      :show-plan-approvals="true"
      :show-approval-section="true"
      :workflow-code="currentDispatchWorkflowCode"
      history-view-mode="card-only"
      approval-type="distribution"
      @close="taskApprovalVisible = false"
      @refresh="handleApprovalRefresh"
    />

    <!-- 里程碑编辑弹窗 -->
    <el-dialog
      v-model="milestonesDialogVisible"
      title="编辑里程碑"
      width="700px"
      :close-on-click-modal="false"
    >
      <div v-if="editingMilestonesChild" class="milestone-edit-dialog">
        <!-- 指标信息 -->
        <div class="indicator-info-header">
          <div class="info-item">
            <span class="label">指标名称：</span>
            <span class="value">{{ getEditingChildName() }}</span>
          </div>
          <div class="info-item">
            <span class="label">指标类型：</span>
            <el-tag size="small" :type="getEditingChildType() === '定量' ? 'primary' : 'warning'">
              {{ getEditingChildType() }}
            </el-tag>
          </div>
        </div>

        <el-divider />

        <!-- 操作按钮 -->
        <div class="milestone-actions">
          <el-button size="small" type="primary" :icon="Plus" @click="addMilestone">
            添加里程碑
          </el-button>
          <el-button
            v-if="getEditingChildType() === '定量'"
            size="small"
            type="success"
            :icon="Timer"
            @click="generateMonthlyMilestones"
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
                v-model="ms.progress"
                :min="0"
                :max="100"
                placeholder="目标进度%"
                size="small"
                class="field-progress"
                @change="validateMilestoneProgress(idx)"
              />
              <el-date-picker
                v-model="ms.expectedDate"
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
                @click="removeMilestone(idx)"
              />
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="milestonesDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveMilestones">保存</el-button>
      </template>
    </el-dialog>

    <!-- 选择关联核心指标弹框（已改为内联选择，此弹窗已不再使用，可删除） -->
    <!-- 选择关联核心指标弹框 -->
    <el-dialog
      v-model="selectParentDialogVisible"
      title="选择关联的核心指标"
      width="700px"
      :close-on-click-modal="false"
    >
      <div class="select-parent-content">
        <el-table
          :data="selectParentTableData"
          border
          max-height="400px"
          class="select-parent-table"
        >
          <!-- 核心指标列 - 可选择 -->
          <el-table-column label="核心指标" min-width="280">
            <template #default="{ row }">
              <div class="indicator-select-row">
                <div class="indicator-info">
                  <el-tag
                    size="small"
                    :type="row.indicator.type1 === '定量' ? 'primary' : 'warning'"
                  >
                    {{ row.indicator.type1 }}
                  </el-tag>
                  <span class="indicator-name">{{ row.indicator.name }}</span>
                </div>
              </div>
            </template>
          </el-table-column>
          <!-- 备注列 -->
          <el-table-column label="备注" width="150">
            <template #default="{ row }">
              <span class="indicator-remark">{{ row.indicator.remark || '-' }}</span>
            </template>
          </el-table-column>
          <!-- 操作列 -->
          <el-table-column label="操作" width="80" align="center">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="selectParentIndicator(row.indicator)">
                选择
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-empty v-if="selectParentTableData.length === 0" description="暂无核心指标数据" />
      </div>

      <template #footer>
        <el-button @click="selectParentDialogVisible = false">取消</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.distribution-view {
  height: calc(100vh - 180px);
  display: flex;
  flex-direction: column;
}

.distribution-layout {
  flex: 1;
  display: flex;
  gap: 20px;
  overflow: hidden;
}

/* ========================================
   左侧面板 - 任务卡片列表
   ======================================== */
.strategic-panel {
  width: 320px;
  flex-shrink: 0;
  background: var(--bg-white, #fff);
  border-radius: 8px;
  border: 1px solid var(--border-color, #e2e8f0);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-light, #f1f5f9);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.panel-header .panel-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-main, #1e293b);
}

.panel-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-main, #1e293b);
}

.indicator-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

/* 任务卡片样式 */
.task-card {
  padding: 14px;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 8px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--bg-white, #fff);
}

.task-card:hover {
  border-color: var(--color-primary, #2c5282);
  box-shadow: 0 2px 12px rgba(44, 82, 130, 0.12);
  transform: translateY(-1px);
}

.task-card.selected {
  border-color: var(--color-primary, #2c5282);
  background: linear-gradient(135deg, rgba(44, 82, 130, 0.03) 0%, rgba(44, 82, 130, 0.08) 100%);
  box-shadow: 0 2px 8px rgba(44, 82, 130, 0.15);
}

.task-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.indicator-count-badge {
  font-size: 12px;
  color: var(--text-placeholder, #94a3b8);
}

.task-card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main, #1e293b);
  line-height: 1.5;
  margin-bottom: 6px;
}

.task-card-desc {
  font-size: 12px;
  color: var(--text-secondary, #64748b);
  line-height: 1.4;
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.task-card-progress {
  display: flex;
  align-items: center;
  gap: 10px;
}

.task-card-progress :deep(.el-progress) {
  flex: 1;
}

.task-card-progress .progress-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-main, #1e293b);
  min-width: 36px;
}

/* 学院卡片样式 - 简化版 */
.college-card {
  padding: 12px 16px;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--bg-white, #fff);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.college-card:hover {
  border-color: var(--color-primary, #2c5282);
  box-shadow: 0 2px 8px rgba(44, 82, 130, 0.1);
  transform: translateY(-1px);
}

.college-card.selected {
  border-color: var(--color-primary, #2c5282);
  background: linear-gradient(135deg, rgba(44, 82, 130, 0.03) 0%, rgba(44, 82, 130, 0.08) 100%);
  box-shadow: 0 2px 6px rgba(44, 82, 130, 0.12);
}

.college-card-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-main, #1e293b);
}

.college-card-count {
  font-size: 12px;
  color: var(--text-placeholder, #94a3b8);
}

/* ========================================
   右侧面板 - 指标表格
   ======================================== */
.distribution-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.empty-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-white, #fff);
  border-radius: 8px;
  border: 1px solid var(--border-color, #e2e8f0);
}

/* 表格卡片 */
.table-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-white, #fff);
  border-radius: 8px;
  border: 1px solid var(--border-color, #e2e8f0);
  overflow: hidden;
}

.table-card .card-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-light, #f1f5f9);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.card-header .header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.card-header .card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-main, #1e293b);
}

.card-header .indicator-count {
  font-size: 13px;
  color: var(--text-secondary, #64748b);
}

.card-header .header-actions {
  display: flex;
  gap: 8px;
}

.table-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.table-container {
  flex: 1;
  overflow: auto;
  padding: 0;
}

/* ========================================
   表格样式
   ======================================== */
.unified-table {
  width: 100%;
}

.distribution-table :deep(.el-table__header th) {
  background: #f8fafc !important;
  color: var(--text-main, #1e293b);
  font-weight: 600;
  font-size: 13px;
  padding: 12px 8px;
}

.distribution-table :deep(.el-table__body td) {
  padding: 10px 8px;
  vertical-align: middle;
}

/* 战略指标列（第2列）单元格支持相对定位 */
.distribution-table :deep(.el-table__body td:nth-child(2)) {
  position: relative;
}

.distribution-table :deep(.el-table__row--striped td) {
  background: #fafbfc !important;
}

.distribution-table :deep(.el-table__body tr:hover > td) {
  background: #f1f5f9 !important;
}

/* 任务内容文本（带颜色） */
.task-content-text {
  font-weight: 500;
  color: var(--color-primary, #2c5282);
  font-size: 13px;
  line-height: 1.4;
}

/* 战略任务带颜色样式（发展性/基础性） */
.task-content-colored {
  font-weight: 500;
  cursor: default;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  display: block;
  font-size: 13px;
}

/* 指标名称包装器 */
.indicator-name-wrapper {
  position: static;
}

/* 指标名称单元格 */
.indicator-name-cell {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  flex: 1;
}

.indicator-name-text {
  font-size: 13px;
  line-height: 1.5;
  cursor: default;
}

/* 定性指标颜色（紫色） */
.indicator-qualitative {
  color: var(--color-qualitative, #9333ea);
  font-weight: 500;
}

/* 定量指标颜色（青色） */
.indicator-quantitative {
  color: var(--color-quantitative, #0891b2);
  font-weight: 500;
}

/* 类型列 Tag 样式 */
.type-tag-quantitative {
  background-color: rgba(8, 145, 178, 0.1) !important;
  border-color: rgba(8, 145, 178, 0.3) !important;
  color: #0891b2 !important;
}

.type-tag-qualitative {
  background-color: rgba(147, 51, 234, 0.1) !important;
  border-color: rgba(147, 51, 234, 0.3) !important;
  color: #9333ea !important;
}

/* 类型Tag可点击样式 */
.type-tag-clickable {
  cursor: pointer;
  transition: all 0.2s ease;
}

.type-tag-clickable:hover {
  transform: scale(1.05);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* 类型列单元格 - 禁止截断 */
.distribution-table :deep(.type-column-cell .cell) {
  overflow: visible !important;
  text-overflow: unset !important;
  white-space: nowrap !important;
}

/* 状态列单元格 - 禁止截断 */
.distribution-table :deep(.status-column-cell .cell) {
  overflow: visible !important;
  text-overflow: unset !important;
  white-space: nowrap !important;
}

/* 子指标名称 */
.child-name-cell,
.child-remark-cell {
  cursor: pointer;
}

.child-name-cell:hover,
.child-remark-cell:hover {
  background: rgba(44, 82, 130, 0.05);
  border-radius: 4px;
}

.child-text {
  font-size: 13px;
  line-height: 1.5;
  cursor: default;
}

/* 子指标继承定性/定量颜色 */
.child-text.indicator-qualitative {
  color: var(--color-qualitative, #9333ea);
  font-weight: 500;
}

.child-text.indicator-quantitative {
  color: var(--color-quantitative, #0891b2);
  font-weight: 500;
}

.new-child-cell {
  width: 100%;
}

.new-child-cell :deep(.el-input) {
  width: 100%;
}

/* 添加子指标提示 */
.add-child-hint {
  display: flex;
  align-items: center;
  justify-content: center;
}

.no-child-text {
  font-size: 12px;
  color: var(--text-placeholder, #94a3b8);
}

/* 状态文本 */
.status-text {
  font-size: 12px;
  color: var(--text-placeholder, #94a3b8);
}

/* 合并单元格垂直居中 */
.distribution-table :deep(td[rowspan]) {
  vertical-align: middle;
}

/* 添加按钮列样式 */
.distribution-table :deep(.add-btn-column) {
  padding: 0 !important;
}

.distribution-table :deep(.add-btn-column .cell) {
  padding: 0 !important;
  height: 100%;
}

.add-btn-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 40px;
  transition: all 0.2s ease;
  border-radius: 4px;
  margin: 2px;
}

.add-btn-cell.can-add {
  cursor: pointer;
}

.add-btn-cell.can-add:hover {
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.1) 0%, rgba(64, 158, 255, 0.2) 100%);
  box-shadow: inset 0 0 0 1px rgba(64, 158, 255, 0.3);
}

.add-btn-cell .add-icon {
  font-size: 18px;
  color: var(--color-primary, #409eff);
  opacity: 0.6;
  transition: all 0.2s ease;
}

.add-btn-cell.can-add:hover .add-icon {
  opacity: 1;
  transform: scale(1.2);
}

/* 学院单元格样式 */
.college-cell {
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: background 0.2s ease;
}

.college-cell:hover {
  background: rgba(44, 82, 130, 0.05);
}

.college-tags {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 备注文本 */
.remark-text {
  font-size: 12px;
  color: var(--text-secondary, #64748b);
}

/* 部门文本 */
.dept-text {
  font-size: 12px;
  color: var(--text-main, #1e293b);
}

/* 进度单元格 */
.progress-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
}

.progress-text {
  font-size: 12px;
  color: var(--text-main, #1e293b);
  font-weight: 500;
  min-width: 32px;
}

/* 目标进度文本 */
.target-progress-text {
  font-size: 12px;
  color: var(--color-primary, #409eff);
  font-weight: 500;
}

.target-progress-text.editable {
  cursor: pointer;
}

.target-progress-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px 4px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.target-progress-cell:hover {
  background: rgba(44, 82, 130, 0.05);
}

/* Textarea 样式 - 只允许垂直拖动 */
.textarea-cell {
  width: 100%;
}

.textarea-cell :deep(.el-textarea__inner) {
  min-height: 36px !important;
  resize: vertical !important;
  font-size: 13px;
  line-height: 1.5;
}

/* 操作单元格 */
.action-cell {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  white-space: nowrap;
}

.action-placeholder {
  color: var(--text-placeholder, #94a3b8);
}

/* 空状态 */
.empty-state {
  padding: 40px 20px;
  display: flex;
  justify-content: center;
  align-items: center;
}

/* 指标类型文本 */
.type-text {
  font-size: 12px;
  font-weight: 500;
}

/* 类型列自适应宽度 */
.distribution-table .type-column {
  width: fit-content;
  white-space: nowrap;
}

/* 里程碑单元格 */
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

/* 里程碑单元格可编辑提示 */
.milestone-cell.editable {
  cursor: pointer;
  transition: all 0.2s;
}

.milestone-cell.editable:hover {
  background: var(--bg-page, #f8fafc);
  border-radius: 4px;
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

.milestone-edit-item .milestone-index {
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

/* ========================================
   新增子指标行样式
   ======================================== */

/* 新增子指标行的单元格 */
.new-child-cell {
  cursor: pointer;
  min-height: 32px;
  display: flex;
  align-items: center;
}

/* 新增子指标行的文本显示 */
.new-child-text {
  padding: 6px 8px;
  border-radius: 4px;
  transition: background 0.2s ease;
  width: 100%;
}

.new-child-text:hover {
  background: rgba(64, 158, 255, 0.08);
}

/* 占位文本样式 */
.placeholder-text {
  color: var(--text-placeholder, #94a3b8) !important;
  font-style: italic;
}

/* 新增子指标行高亮 */
.distribution-table :deep(.new-child-row) {
  background-color: rgba(64, 158, 255, 0.04);
}

.distribution-table :deep(.new-child-row:hover) > td {
  background-color: rgba(64, 158, 255, 0.08) !important;
}

/* 编辑状态的输入框样式 */
.new-child-editing {
  border-color: var(--color-primary, #409eff);
}

/* 待下发状态标签样式（青色，区别于待审批的橙色） */
.status-tag-pending-distribute {
  background-color: rgba(6, 182, 212, 0.1);
  border-color: rgba(6, 182, 212, 0.3);
  color: #0891b2;
}

/* ========================================
   响应式适配
   ======================================== */
@media (max-width: 1200px) {
  .strategic-panel {
    width: 280px;
  }
}

@media (max-width: 992px) {
  .distribution-layout {
    flex-direction: column;
  }

  .strategic-panel {
    width: 100%;
    max-height: 300px;
  }

  .distribution-panel {
    flex: 1;
    min-height: 400px;
  }
}

/* ========================================
   动画效果 - 统一过渡动画
   ======================================== */
.page-fade-enter {
  animation: fadeIn var(--transition-slow, 0.6s) ease-out;
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
   添加指标弹框样式
   ======================================== */
.add-indicator-content {
  max-height: 75vh;
  overflow-y: auto;
}

.add-indicator-tip {
  margin-bottom: 16px;
}

.indicator-form-item {
  background: var(--bg-light, #f5f7fa);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.indicator-form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-light, #e4e7ed);
}

.indicator-form-index {
  font-weight: 600;
  color: var(--text-primary, #303133);
}

.indicator-form-body {
  padding: 8px 0;
}

.parent-select-wrapper {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.parent-select-input {
  cursor: pointer;
}

.parent-select-input :deep(.el-input__wrapper) {
  cursor: pointer;
}

.task-content-hint {
  font-size: 12px;
  color: var(--text-secondary, #909399);
}

.target-progress-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.target-progress-unit {
  color: var(--text-secondary, #909399);
}

.target-progress-hint {
  font-size: 12px;
  color: var(--text-tertiary, #c0c4cc);
}

.add-more-indicator {
  text-align: center;
  padding: 12px;
  background: var(--bg-light, #f5f7fa);
  border-radius: 8px;
  border: 1px dashed var(--border-color, #dcdfe6);
  cursor: pointer;
  transition: all 0.2s;
}

.add-more-indicator:hover {
  border-color: var(--primary-color, #409eff);
  background: rgba(64, 158, 255, 0.05);
}

/* 里程碑表单区域 */
.milestone-form-area {
  width: 100%;
}

.milestone-list {
  margin-top: 12px;
}

.milestone-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-light, #e4e7ed);
}

.milestone-item:last-child {
  border-bottom: none;
}

.milestone-index {
  font-weight: 500;
  color: var(--text-secondary, #909399);
  min-width: 24px;
}

.milestone-hint {
  font-size: 12px;
  color: var(--text-tertiary, #c0c4cc);
}

/* ========================================
   选择关联指标弹框样式
   ======================================== */
.select-parent-content {
  max-height: 75vh;
  overflow-y: auto;
}

.select-parent-table {
  width: 100%;
}

.task-cell {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 4px;
}

.task-content-text {
  font-weight: 500;
  color: var(--text-primary, #303133);
  line-height: 1.5;
}

.indicator-select-row {
  display: flex;
  align-items: center;
  padding: 4px 0;
}

.indicator-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.indicator-name {
  font-size: 14px;
  color: var(--text-primary, #303133);
  line-height: 1.4;
}

.indicator-remark {
  font-size: 13px;
  color: var(--text-secondary, #909399);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* ========================================
   权重列样式
   ======================================== */
.weight-cell {
  cursor: pointer;
}

.weight-text {
  font-size: 13px;
  color: var(--text-secondary, #606266);
}

.weight-text.editable {
  cursor: pointer;
}

.weight-text.editable:hover {
  color: var(--primary-color, #409eff);
}

.cell-saving-text {
  font-size: 13px;
  color: var(--primary-color, #409eff);
}

/* ========================================
   指标类型样式（与战略任务界面保持一致）
   ======================================== */
.indicator-qualitative {
  color: var(--color-qualitative);
  font-weight: 500;
}

.indicator-quantitative {
  color: var(--color-quantitative);
  font-weight: 500;
}

/* ========================================
   新增指标表单样式（复用战略任务界面样式）
   ======================================== */
.add-row-form {
  flex-shrink: 0;
  background: rgba(64, 158, 255, 0.08);
  padding: var(--spacing-lg);
  border-top: 1px solid var(--color-primary-light);
  max-height: 600px;
  overflow-y: auto;
  overflow-x: hidden;
  margin-top: 16px;
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

/* 强制表单标签不换行 */
.no-wrap-labels :deep(.el-form-item__label) {
  white-space: nowrap !important;
  overflow: visible !important;
}

.no-wrap-label :deep(.el-form-item__label) {
  white-space: nowrap !important;
  overflow: visible !important;
  min-width: 150px !important;
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

.detail-desc {
  margin-bottom: var(--spacing-2xl);
}

.divider {
  height: 1px;
  background: var(--border-color);
  margin: var(--spacing-xl) 0;
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

.detail-tags :deep(.el-tag) {
  margin-right: 0;
}
</style>

<style>
/* 全局样式：强制表单标签不换行 */
.add-row-form .el-form-item__label {
  white-space: nowrap !important;
  word-break: keep-all !important;
  overflow: visible !important;
}
</style>
