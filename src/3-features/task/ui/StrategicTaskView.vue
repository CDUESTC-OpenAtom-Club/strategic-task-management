<script setup lang="ts">
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
  Loading,
  Timer
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, ElLoading } from 'element-plus'
import type { ElTable } from 'element-plus'
// eslint-disable-next-line no-restricted-syntax -- Backend-aligned types
import type { StrategicTask as _StrategicTask, StrategicIndicator } from '@/shared/types'
import { IndicatorStatus } from '@/shared/types/entities'
import { PermissionCode } from '@/shared/types'
import { useStrategicStore } from '@/features/task/model/strategic'
import { useAuthStore } from '@/features/auth/model/store'
import { useTimeContextStore } from '@/shared/lib/timeContext'
import { useOrgStore } from '@/features/organization/model/store'
import { usePermission } from '@/5-shared/lib/permissions'
import { logger } from '@/shared/lib/utils/logger'
import { resolveIndicatorYear } from '@/shared/lib/utils/indicatorYear'
import { sortMilestonesByProgress } from '@/shared/lib/utils/milestoneSort'
import { buildQueryKey, fetchWithCache, invalidateQueries } from '@/shared/lib/utils/cache'
import { resolveMilestoneDisplayState } from '@/shared/lib/utils/milestoneDisplay'
import strategicApi, { approvalApi as taskApprovalApi } from '@/features/task/api/strategicApi'
import {
  getWorkflowDefinitionPreviewByCode,
  startWorkflow,
  getWorkflowInstanceDetail,
  getWorkflowInstanceDetailByBusiness,
  approveTask,
  rejectTask
} from '@/features/workflow/api'
import { milestoneApi } from '@/entities/milestone/api/milestoneApi'
import {
  getStatusText as _getStatusText,
  getStatusType as _getStatusType,
  getStatusIcon as _getStatusIcon
} from '@/shared/lib/utils/indicatorStatus'
import { getPlanStatusDisplay, normalizePlanStatus } from '@/features/task/lib'
import { ApprovalProgressDrawer } from '@/features/approval'
import { useApprovalRouteAutopen } from '@/features/approval/lib'
import { useApprovalStore } from '@/features/approval/model/store'
import _MilestoneList from '@/features/milestone/ui/MilestoneList.vue'
import { indicatorApi } from '@/features/indicator/api'
import { usePlanStore } from '@/features/plan/model/store'
import { indicatorFillApi } from '@/features/plan/api/planApi'
import {
  canCurrentUserHandleIndicatorWorkflow,
  getIndicatorWorkflowStatusLabel,
  getIndicatorWorkflowTagType,
  resolveLatestIndicatorWorkflowSnapshot,
  type IndicatorWorkflowSnapshot
} from '@/features/plan/lib/indicatorWorkflow'
import type {
  WorkflowDefinitionPreviewResponse,
  WorkflowInstanceDetailResponse
} from '@/features/workflow/api/types'

// 使用共享 Store
const strategicStore = useStrategicStore()
const authStore = useAuthStore()
const timeContext = useTimeContextStore()
const orgStore = useOrgStore()
const planStore = usePlanStore()
const approvalStore = useApprovalStore()
const currentUserId = computed(() => Number(authStore.user?.userId ?? 0))
const currentUserPermissionCodes = computed(() => {
  const permissions = (authStore.user as { permissions?: unknown[] } | null)?.permissions
  if (!Array.isArray(permissions)) {
    return []
  }
  return permissions
    .map(permission => (typeof permission === 'string' ? permission.trim() : ''))
    .filter(Boolean)
})
const currentUserRoleCodes = computed(() => {
  const roles = (authStore.user as { roles?: unknown[] } | null)?.roles
  if (!Array.isArray(roles)) {
    return []
  }
  return roles.map(role => (typeof role === 'string' ? role.trim() : '')).filter(Boolean)
})

const isCurrentUserReporter = computed(() => {
  const roles = Array.isArray(authStore.user?.roles)
    ? authStore.user.roles
        .map(role => (typeof role === 'string' ? role.trim().toUpperCase() : ''))
        .filter(Boolean)
    : []

  return roles.includes('ROLE_REPORTER')
})

// 使用统一的权限管理工具
const permissionUtil = usePermission()

const currentUserOrgId = computed(() => {
  const rawOrgId = Number((authStore.user as { orgId?: string | number } | null)?.orgId ?? NaN)
  return Number.isFinite(rawOrgId) && rawOrgId > 0 ? rawOrgId : null
})

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

// 首屏加载态：接口未返回前展示骨架，避免先渲染"暂无数据"造成误判
const taskTypeMapLoading = ref(false)
const currentPlanScopeLoading = ref(false)
const pageTransitionLoading = ref(false)

const isInitialDataLoading = computed(() => {
  return isBootstrappingPage.value || pageTransitionLoading.value
})

// 当前选中任务索引
const currentTaskIndex = ref(0)
const isAddingOrEditing = ref(false)
const addRowFormRef = ref<HTMLElement | null>(null)

// 视图模式：table（表格视图）或 card（卡片视图）
const viewMode = ref<'table' | 'card'>('table')

// 卡片视图当前指标索引
const currentIndicatorIndex = ref(0)
const isBootstrappingPage = ref(true)

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

const departmentAliasNameMap = computed(() => {
  const map = new Map<string, string>()
  orgStore.departments.forEach(dept => {
    const canonical = String(dept.name || '').trim()
    const id = String(dept.id || '').trim()
    if (!canonical) {
      return
    }

    map.set(canonical, canonical)
    if (id) {
      map.set(id, canonical)
    }

    canonical
      .split('|')
      .map(part => part.trim())
      .filter(Boolean)
      .forEach(part => {
        map.set(part, canonical)
      })
  })
  return map
})

const departmentNameIdMap = computed(() => {
  const map = new Map<string, number>()
  orgStore.departments.forEach(dept => {
    map.set(dept.name, Number(dept.id))
  })
  return map
})

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

const findCurrentPlanByDepartment = () => {
  if (!selectedDepartment.value) {
    return null
  }

  const selectedDepartmentId = resolveDepartmentIdByName(selectedDepartment.value)
  const normalizedDepartmentName = normalizeDepartmentName(selectedDepartment.value)

  const sameDepartment = (planAny: Record<string, unknown>) => {
    const planTargetOrgId = Number(planAny.targetOrgId ?? planAny.org_id ?? planAny.orgId ?? NaN)
    const orgName = normalizeDepartmentName(String(planAny.targetOrgName || planAny.orgName || ''))
    return (
      (selectedDepartmentId != null &&
        Number.isFinite(planTargetOrgId) &&
        planTargetOrgId === selectedDepartmentId) ||
      orgName === normalizedDepartmentName
    )
  }

  const plans = planStore.plans.filter(p => {
    const planAny = p as Record<string, unknown>
    const planYear = resolvePlanYear(planAny)
    return sameDepartment(planAny) && planYear === timeContext.currentYear
  })

  const strictMatch =
    plans.find(p => {
      const planAny = p as Record<string, unknown>
      const candidateCreatedByOrgId = Number(
        planAny.createdByOrgId ?? planAny.created_by_org_id ?? NaN
      )
      const candidatePlanLevel = String(planAny.planLevel || planAny.plan_level || '')
        .trim()
        .toUpperCase()

      return candidateCreatedByOrgId === 35 && candidatePlanLevel === 'STRAT_TO_FUNC'
    }) || null

  return strictMatch || plans[0] || null
}

const findCurrentPlanByOrgId = (orgId?: number | null) => {
  if (!orgId || !Number.isFinite(orgId)) {
    return null
  }

  return (
    planStore.plans.find(p => {
      const planAny = p as Record<string, unknown>
      const planYear = resolvePlanYear(planAny)
      const planCreatedByOrgId = Number(planAny.createdByOrgId ?? planAny.created_by_org_id ?? NaN)

      return (
        planYear === timeContext.currentYear &&
        Number.isFinite(planCreatedByOrgId) &&
        planCreatedByOrgId === orgId
      )
    }) || null
  )
}

// 后端任务类型映射：taskId -> taskType（BASIC/DEVELOPMENT/...）
const backendTaskTypeMap = ref<Record<string, string>>({})
const currentPlanTaskTypeMap = ref<Record<string, string>>({})
const currentPlanTaskIdSet = ref<Set<string>>(new Set())

const milestoneCache = ref<Record<string, Record<string, Array<Record<string, unknown>>>>>({}) // key: "部门名_指标ID"

const normalizeTaskId = (value: unknown): string => {
  const normalized = String(value ?? '').trim()
  return normalized
}

const indicatorByIdMap = computed(() => {
  const map = new Map<string, StrategicIndicator>()
  strategicStore.indicators.forEach(item => {
    map.set(String(item.id), item)
  })
  return map
})

const getIndicatorTaskId = (indicator: StrategicIndicator): string => {
  const raw = indicator as StrategicIndicator & {
    taskId?: string | number
    task_id?: string | number
    planId?: string | number
    strategicTaskId?: string | number
    parentIndicatorId?: string | number
  }

  const directTaskId = normalizeTaskId(raw.taskId ?? raw.task_id ?? raw.strategicTaskId)
  if (directTaskId) {
    return directTaskId
  }

  const visited = new Set<string>()
  let currentParentId = normalizeTaskId(raw.parentIndicatorId)

  // 子指标 task_id 为空时，沿父指标链回溯 task_id
  while (currentParentId && !visited.has(currentParentId)) {
    visited.add(currentParentId)
    const parent = indicatorByIdMap.value.get(currentParentId)
    if (!parent) {
      break
    }
    const parentRaw = parent as StrategicIndicator & {
      taskId?: string | number
      task_id?: string | number
      planId?: string | number
      strategicTaskId?: string | number
      parentIndicatorId?: string | number
    }
    const parentTaskId = normalizeTaskId(
      parentRaw.taskId ?? parentRaw.task_id ?? parentRaw.strategicTaskId
    )
    if (parentTaskId) {
      return parentTaskId
    }
    currentParentId = normalizeTaskId(parentRaw.parentIndicatorId)
  }

  return ''
}

const isBasicTaskType = (taskType?: string): boolean => {
  const normalized = String(taskType || '')
    .trim()
    .toUpperCase()
  return normalized === 'BASIC'
}

const isDevelopmentTaskType = (taskType?: string): boolean => {
  const normalized = String(taskType || '')
    .trim()
    .toUpperCase()
  return normalized === 'DEVELOPMENT'
}

const getIndicatorMappedTaskType = (indicator: StrategicIndicator): string => {
  const indicatorTaskId = getIndicatorTaskId(indicator)
  if (!indicatorTaskId) {
    return ''
  }
  return (
    currentPlanTaskTypeMap.value[indicatorTaskId] || backendTaskTypeMap.value[indicatorTaskId] || ''
  )
}

const getTaskCategoryLabel = (taskType?: string): '基础性' | '发展性' => {
  if (isBasicTaskType(taskType)) {
    return '基础性'
  }
  return '发展性'
}

const getIndicatorCategoryLabel = (indicator: StrategicIndicator): '基础性' | '发展性' => {
  return getTaskCategoryLabel(getIndicatorMappedTaskType(indicator))
}

const isBasicIndicatorForCurrentRules = (indicator: StrategicIndicator): boolean => {
  const mappedTaskType = getIndicatorMappedTaskType(indicator)
  if (mappedTaskType) {
    return isBasicTaskType(mappedTaskType)
  }

  // 兜底：任务类型映射尚未返回时，回退到当前展示标签，避免页面临时显示 0 / 100。
  return String(indicator.type2 || '').trim() === '基础性'
}

const buildTaskTypeMap = (tasks: Array<Record<string, unknown>>): Record<string, string> => {
  const map: Record<string, string> = {}
  tasks.forEach(task => {
    const taskId = normalizeTaskId(
      (task as { taskId?: string | number; id?: string | number }).taskId
    )
    const fallbackTaskId = normalizeTaskId((task as { id?: string | number }).id)
    const taskType = String((task as { taskType?: string }).taskType || '').trim()
    const key = taskId || fallbackTaskId
    if (key && taskType) {
      map[key] = taskType
    }
  })
  return map
}

const buildTaskIdSet = (tasks: Array<Record<string, unknown>>): string[] => {
  return tasks
    .map(
      task =>
        normalizeTaskId((task as { taskId?: string | number; id?: string | number }).taskId) ||
        normalizeTaskId((task as { id?: string | number }).id)
    )
    .filter(Boolean)
}

const loadBackendTaskTypeMap = async (options: { force?: boolean } = {}) => {
  taskTypeMapLoading.value = true
  try {
    const byYearResponse = await strategicApi.getTasksByYear(timeContext.currentYear, {
      force: options.force
    })
    if (
      byYearResponse?.success &&
      Array.isArray(byYearResponse.data) &&
      byYearResponse.data.length > 0
    ) {
      backendTaskTypeMap.value = buildTaskTypeMap(
        byYearResponse.data as Array<Record<string, unknown>>
      )
      return
    }

    // 兼容回退：部分环境按年查询任务为空（周期口径不一致），改用全量任务建立映射
    const allTasksResponse = await strategicApi.getAllTasks({ force: options.force })
    if (allTasksResponse?.success && Array.isArray(allTasksResponse.data)) {
      backendTaskTypeMap.value = buildTaskTypeMap(
        allTasksResponse.data as Array<Record<string, unknown>>
      )
      return
    }

    backendTaskTypeMap.value = {}
  } catch (error) {
    backendTaskTypeMap.value = {}
    logger.error('[StrategicTaskView] 加载后端任务类型失败:', error)
  } finally {
    taskTypeMapLoading.value = false
  }
}

const loadCurrentPlanTaskScope = async (options: { force?: boolean } = {}) => {
  const dept = selectedDepartment.value
  if (!dept) {
    currentPlanScopeLoading.value = false
    return
  }

  currentPlanScopeLoading.value = true
  const currentPlan = findCurrentPlanByDepartment()
  const planId = currentPlan?.id

  if (!planId) {
    currentPlanTaskTypeMap.value = {}
    currentPlanTaskIdSet.value = new Set()
    currentPlanScopeLoading.value = false
    return
  }

  try {
    const scope = await fetchWithCache({
      key: buildQueryKey('task', 'scope', {
        department: dept,
        planId: String(planId),
        year: timeContext.currentYear
      }),
      policy: {
        ttlMs: 2 * 60 * 1000,
        scope: 'memory',
        dedupeWindowMs: 1000,
        tags: ['task.scope', `task.scope.${planId}`, 'plan.detail']
      },
      force: options.force === true,
      fetcher: async () => {
        const response = await strategicApi.getTasksByPlanId(planId)
        if (!response?.success || !Array.isArray(response.data)) {
          return {
            taskTypeMap: {} as Record<string, string>,
            taskIdSet: [] as string[]
          }
        }
        const planTaskMap = buildTaskTypeMap(response.data as Array<Record<string, unknown>>)
        const planTaskIds = buildTaskIdSet(response.data as Array<Record<string, unknown>>)
        return {
          taskTypeMap: planTaskMap,
          // 计划范围判断只依赖 task 主键，不应被 taskType 缺失误伤。
          taskIdSet: planTaskIds
        }
      }
    })

    currentPlanTaskTypeMap.value = scope.taskTypeMap
    currentPlanTaskIdSet.value = new Set(scope.taskIdSet)
  } catch (error) {
    currentPlanTaskTypeMap.value = {}
    currentPlanTaskIdSet.value = new Set()
    logger.error('[StrategicTaskView] 加载当前计划任务范围失败:', error)
  } finally {
    currentPlanScopeLoading.value = false
  }
}

const isIndicatorInCurrentPlanScope = (indicator: StrategicIndicator): boolean => {
  const indicatorTaskId = getIndicatorTaskId(indicator)
  if (!indicatorTaskId) {
    return false
  }
  if (currentPlanTaskIdSet.value.size === 0) {
    // 存在当前计划但任务列表为空时，按严格口径不计入当前计划范围。
    const hasCurrentPlan = Boolean(findCurrentPlanByDepartment()?.id)
    return !hasCurrentPlan
  }
  return currentPlanTaskIdSet.value.has(indicatorTaskId)
}

const normalizeDepartmentName = (value?: string | null): string => {
  if (!value) {
    return ''
  }

  const trimmed = String(value).trim()
  if (!trimmed) {
    return ''
  }

  return (
    departmentAliasNameMap.value.get(trimmed) || departmentIdNameMap.value.get(trimmed) || trimmed
  )
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

const toMilestoneRequestStatus = (status: unknown): string => {
  const normalized = String(status || '')
    .trim()
    .toUpperCase()
  if (normalized === 'COMPLETED' || normalized === 'IN_PROGRESS' || normalized === 'NOT_STARTED') {
    return normalized
  }
  if (normalized === 'OVERDUE' || normalized === 'DELAYED') {
    return 'DELAYED'
  }
  return 'NOT_STARTED'
}

const toMilestoneDueDate = (deadline: unknown): string | null => {
  const text = String(deadline || '').trim()
  if (!text) {
    return null
  }

  if (text.includes('T')) {
    return text
  }

  return `${text}T23:59:59`
}

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

const getCurrentScopeIndicatorsForMilestones = () => indicators.value

const loadMilestonesForCurrentScope = async () => {
  const dept = selectedDepartment.value
  const indicatorsToLoad = getCurrentScopeIndicatorsForMilestones()

  // 当前部门的里程碑缓存
  const deptMilestoneCache = milestoneCache.value[dept] || {}

  // 分离需要请求的指标和可以直接从缓存读取的指标
  const needRequestIds: string[] = []
  const cachedIds: string[] = []

  indicatorsToLoad.forEach(i => {
    const id = String(i.id)
    if (!id) return

    if (deptMilestoneCache[id]) {
      // 从缓存读取
      milestoneMap.value[id] = deptMilestoneCache[id]
      cachedIds.push(id)
      loadedMilestoneIds.value.add(id)
    } else if (!loadedMilestoneIds.value.has(id) && !loadingMilestoneIds.value.has(id)) {
      needRequestIds.push(id)
    }
  })

  // 处理需要请求的指标
  if (needRequestIds.length === 0) {
    return
  }

  await Promise.all(
    needRequestIds.map(async indicatorId => {
      loadingMilestoneIds.value.add(indicatorId)
      try {
        const response = await milestoneApi.getMilestonesByIndicator(indicatorId)
        if (response.success) {
          const rawMilestones = extractMilestones(response.data)
          const normalizedMilestones = rawMilestones.map((m, idx) => normalizeMilestone(m, idx))
          milestoneMap.value[indicatorId] = normalizedMilestones
          // 存入缓存
          milestoneCache.value[dept] = milestoneCache.value[dept] || {}
          milestoneCache.value[dept][indicatorId] = normalizedMilestones
        } else {
          milestoneMap.value[indicatorId] = []
          milestoneCache.value[dept] = milestoneCache.value[dept] || {}
          milestoneCache.value[dept][indicatorId] = []
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

const reloadMilestonesForIndicator = async (indicatorId: string, dept: string) => {
  const response = await milestoneApi.getMilestonesByIndicator(indicatorId)
  const rawMilestones = response.success ? extractMilestones(response.data) : []
  const normalizedMilestones = rawMilestones.map((m, idx) => normalizeMilestone(m, idx))

  milestoneMap.value[indicatorId] = normalizedMilestones
  milestoneCache.value[dept] = milestoneCache.value[dept] || {}
  milestoneCache.value[dept][indicatorId] = normalizedMilestones
  loadedMilestoneIds.value.add(indicatorId)

  return normalizedMilestones
}

const isMilestoneLoading = (indicatorId: string | number): boolean =>
  loadingMilestoneIds.value.has(String(indicatorId))

watch(
  [
    selectedDepartment,
    () => strategicStore.indicators.length,
    () => orgStore.departments.length,
    () => timeContext.currentYear,
    () => Array.from(currentPlanTaskIdSet.value).sort().join(',')
  ],
  () => {
    if (isBootstrappingPage.value) {
      return
    }
    void loadMilestonesForCurrentScope()
  }
  // 移除 immediate: true，因为初始执行时 selectedDepartment 为空会导致加载错误的指标范围
  // 里程碑加载改为在 onMounted 中显式调用，确保与主数据同时加载
)

watch(
  () => timeContext.currentYear,
  () => {
    milestoneMap.value = {}
    loadedMilestoneIds.value = new Set<string>()
    loadingMilestoneIds.value = new Set<string>()
    milestoneCache.value = {}
    invalidateQueries(['task.scope'])
    if (isBootstrappingPage.value) {
      return
    }
    void loadMilestonesForCurrentScope()
  }
)

// 计算当前选中部门的基础性任务指标权重总和（用于下发验证）
// 基础性判定以“后端真实 task_type=BASIC”为准
const departmentTotalWeight = computed(() => {
  if (!selectedDepartment.value) {
    return 0
  }

  const deptIndicators = indicators.value.filter(i => isBasicIndicatorForCurrentRules(i))

  // 计算权重之和
  return deptIndicators.reduce((sum, i) => sum + Number(i.weight || 0), 0)
})

const ensurePlanCanDistribute = (): boolean => {
  if (departmentTotalWeight.value !== 100) {
    ElMessage.warning(`基础性任务指标权重合计必须为100%，当前为${departmentTotalWeight.value}`)
    return false
  }
  return true
}

// 整体状态：直接使用 Plan 的状态，不再根据指标状态混合计算
// 兼容后端大写状态和 Plan 模块的小写状态
const overallStatus = computed(() => {
  const planStatus = currentPlanStatus.value
  if (!planStatus) {
    return { label: '暂无指标', type: 'info' }
  }

  return getPlanStatusDisplay(planStatus) || { label: String(planStatus), type: 'info' }
})

// 获取当前选中部门对应的 Plan（包含审批实例信息）
const currentPlan = computed(() => {
  return findCurrentPlanByDepartment()
})

const currentDepartmentOrgId = computed(() => resolveDepartmentIdByName(selectedDepartment.value))

const currentPlanReportSummary = ref<{
  id: number
  workflowInstanceId?: number | null
  currentTaskId?: number | null
  workflowStatus?: string | null
  currentStepName?: string | null
  canWithdraw?: boolean
  status?: string | null
} | null>(null)
const latestPlanReportSummary = ref<{ id: number } | null>(null)

const approvalWorkflowReportSummary = computed(() => {
  const currentWorkflowInstanceId = Number(
    currentPlanReportSummary.value?.workflowInstanceId ?? NaN
  )
  const currentStatus = String(
    currentPlanReportSummary.value?.workflowStatus || currentPlanReportSummary.value?.status || ''
  )
    .trim()
    .toUpperCase()

  if (
    currentPlanReportSummary.value?.id &&
    Number.isFinite(currentWorkflowInstanceId) &&
    currentWorkflowInstanceId > 0 &&
    currentStatus !== 'DRAFT'
  ) {
    return currentPlanReportSummary.value
  }

  return latestPlanReportSummary.value
})

// 获取当前选中部门对应的 Plan 状态
const currentPlanStatus = computed(() => {
  return normalizePlanStatus(currentPlan.value?.status)
})

const currentApprovalWorkflowStatus = computed(() => {
  return String(
    approvalWorkflowReportSummary.value?.workflowStatus ||
      approvalWorkflowReportSummary.value?.status ||
      currentPlan.value?.workflowStatus ||
      currentPlan.value?.status ||
      ''
  )
    .trim()
    .toUpperCase()
})

function resolveExpectedApproverRoleCodesForCurrentPlan(): string[] {
  const stepName = String(
    approvalWorkflowReportSummary.value?.currentStepName ||
      (currentPlan.value as { currentStepName?: string } | null)?.currentStepName ||
      ''
  ).trim()

  if (!stepName) {
    return []
  }

  if (
    stepName.includes('职能部门审批') ||
    stepName.includes('职能部门终审') ||
    stepName.includes('二级学院审批')
  ) {
    return ['ROLE_APPROVER']
  }

  if (stepName.includes('战略发展部')) {
    return ['ROLE_STRATEGY_DEPT_HEAD']
  }

  if (stepName.includes('分管校领导') || stepName.includes('学院院长')) {
    return ['ROLE_VICE_PRESIDENT']
  }

  return []
}

function resolveExpectedApproverOrgIdForCurrentPlan(): number | null {
  const plan = currentPlan.value as
    | ({
        currentStepName?: string
        createdByOrgId?: string | number
        targetOrgId?: string | number
      } & Record<string, unknown>)
    | null

  const stepName = String(
    approvalWorkflowReportSummary.value?.currentStepName || plan?.currentStepName || ''
  ).trim()
  if (!stepName) {
    return null
  }

  if (stepName.includes('战略发展部')) {
    const sourceOrgId = Number(plan?.createdByOrgId ?? NaN)
    return Number.isFinite(sourceOrgId) && sourceOrgId > 0 ? sourceOrgId : null
  }

  if (
    stepName.includes('职能部门审批') ||
    stepName.includes('职能部门终审') ||
    stepName.includes('二级学院审批')
  ) {
    const targetOrgId = Number(plan?.targetOrgId ?? NaN)
    return Number.isFinite(targetOrgId) && targetOrgId > 0 ? targetOrgId : null
  }

  return null
}

const hydratingPlanDetail = ref(false)
const departmentViewRequestId = ref(0)
let currentPlanReportSummaryPromise: Promise<{
  currentReport: Awaited<ReturnType<typeof indicatorFillApi.getCurrentMonthPlanReport>>
  latestReport: Awaited<ReturnType<typeof indicatorFillApi.getLatestCurrentMonthPlanReport>>
}> | null = null
let currentPlanReportSummaryKey = ''

async function syncCurrentPlanReportSummaries(options: { force?: boolean } = {}): Promise<void> {
  const planId = Number(currentPlan.value?.id ?? NaN)
  const reportOrgId = Number(currentDepartmentOrgId.value ?? NaN)
  if (!(Number.isFinite(planId) && planId > 0 && Number.isFinite(reportOrgId) && reportOrgId > 0)) {
    currentPlanReportSummary.value = null
    latestPlanReportSummary.value = null
    return
  }

  const cacheKey = `${planId}:${reportOrgId}:${timeContext.currentYear}`
  if (
    !options.force &&
    currentPlanReportSummaryPromise &&
    currentPlanReportSummaryKey === cacheKey
  ) {
    logger.debug('[StrategicTaskView] reuse plan report summaries request', { cacheKey })
    const summaries = await currentPlanReportSummaryPromise
    currentPlanReportSummary.value = summaries.currentReport
    latestPlanReportSummary.value = summaries.latestReport
    return
  }

  currentPlanReportSummaryKey = cacheKey
  logger.debug('[StrategicTaskView] load plan report summaries', {
    planId,
    reportOrgId,
    year: timeContext.currentYear,
    force: options.force === true
  })
  currentPlanReportSummaryPromise = indicatorFillApi.getCurrentMonthPlanReportSummaries(
    planId,
    reportOrgId
  )

  try {
    const summaries = await currentPlanReportSummaryPromise
    currentPlanReportSummary.value = summaries.currentReport
    latestPlanReportSummary.value = summaries.latestReport
  } finally {
    currentPlanReportSummaryPromise = null
  }
}

const hydrateCurrentPlanWorkflowState = async (options: { force?: boolean } = {}) => {
  const planId = Number(currentPlan.value?.id ?? NaN)
  if (!Number.isFinite(planId) || planId <= 0) {
    return
  }

  const status = currentPlanStatus.value
  if (status !== 'PENDING' && status !== 'DISTRIBUTED') {
    return
  }

  const plan = currentPlan.value as
    | (typeof currentPlan.value & {
        canWithdraw?: boolean
        workflowInstanceId?: number
        currentTaskId?: number
      })
    | null

  const needHydration =
    options.force ||
    (status === 'PENDING' && typeof plan?.canWithdraw !== 'boolean') ||
    plan?.workflowInstanceId == null ||
    plan?.currentTaskId == null

  if (!needHydration || hydratingPlanDetail.value) {
    return
  }

  hydratingPlanDetail.value = true
  try {
    await planStore.loadPlanDetails(planId, { force: true, background: true })
  } catch (error) {
    logger.warn('[StrategicTaskView] 预加载 Plan 工作流详情失败:', { planId, error })
  } finally {
    hydratingPlanDetail.value = false
  }
}

const refreshCurrentDepartmentView = async (
  options: { showLoading?: boolean; force?: boolean } = {}
) => {
  const requestId = departmentViewRequestId.value + 1
  departmentViewRequestId.value = requestId
  logger.debug('[StrategicTaskView] refresh department view', {
    requestId,
    department: selectedDepartment.value,
    planId: currentPlan.value?.id ?? null,
    year: timeContext.currentYear,
    force: options.force === true
  })

  if (options.showLoading) {
    pageTransitionLoading.value = true
  }

  try {
    await hydrateCurrentPlanWorkflowState()
    await strategicStore.loadIndicatorsByYear(timeContext.currentYear, { force: options.force })
    await loadCurrentPlanTaskScope({ force: options.force })
    await syncCurrentPlanReportSummaries({ force: options.force })
  } finally {
    if (options.showLoading && departmentViewRequestId.value === requestId) {
      pageTransitionLoading.value = false
    }
  }
}

const PLAN_APPROVAL_SUBMIT_WORKFLOW_CODE = 'PLAN_DISPATCH_STRATEGY'
const PLAN_APPROVAL_HISTORY_WORKFLOW_CODES = [
  'PLAN_DISPATCH_STRATEGY',
  'PLAN_APPROVAL_FUNCDEPT'
] as const

const approvalSetupDialogVisible = ref(false)
const approvalPreviewLoading = ref(false)
const approvalSubmitting = ref(false)
const approvalWorkflowPreview = ref<WorkflowDefinitionPreviewResponse | null>(null)

const hasApprovalPreview = computed(() => {
  return (approvalWorkflowPreview.value?.steps?.length || 0) > 0
})

const getCurrentCycleId = async (): Promise<number> => {
  const cycleResponse = await strategicApi.getCycleByYear(timeContext.currentYear)
  const cycleId =
    (cycleResponse.data as { cycleId?: number; id?: number } | null)?.cycleId ||
    (cycleResponse.data as { id?: number } | null)?.id

  if (!cycleResponse.success || !cycleId) {
    throw new Error(`未找到 ${timeContext.currentYear} 年对应的考核周期`)
  }

  return Number(cycleId)
}

const resolveDepartmentIdByName = (departmentName?: string | null): number | null => {
  const normalized = normalizeDepartmentName(departmentName)
  if (!normalized) {
    return null
  }
  return departmentNameIdMap.value.get(normalized) ?? null
}

const canCurrentUserSubmitCurrentPlan = computed(() => {
  const plan = currentPlan.value as
    | (typeof currentPlan.value & {
        createdByOrgId?: string | number
        createdByOrgName?: string
        targetOrgId?: string | number
        orgId?: string | number
        targetOrgName?: string
        orgName?: string
      })
    | null

  if (!plan || !currentUserOrgId.value || !isCurrentUserReporter.value) {
    return false
  }

  const planOrgId = Number(plan.createdByOrgId ?? NaN)
  if (Number.isFinite(planOrgId) && planOrgId > 0) {
    return currentUserOrgId.value === planOrgId
  }

  const planOrgName = normalizeDepartmentName(plan.createdByOrgName || '')
  const currentUserOrgName = normalizeDepartmentName(
    departmentIdNameMap.value.get(String(currentUserOrgId.value)) || ''
  )

  return Boolean(planOrgName) && planOrgName === currentUserOrgName
})

const getTaskTypeForPersistence = (taskCategory?: string): 'BASIC' | 'DEVELOPMENT' => {
  return String(taskCategory || '').trim() === '基础性' ? 'BASIC' : 'DEVELOPMENT'
}

const findExistingTaskIdByName = async (
  planId: number,
  taskName: string
): Promise<number | null> => {
  const existingTasksResponse = await strategicApi.getTasksByPlanId(planId)
  if (!existingTasksResponse.success || !Array.isArray(existingTasksResponse.data)) {
    return null
  }

  const matchedTask = existingTasksResponse.data.find(
    task => String(task.taskName || '').trim() === taskName
  )
  const matchedTaskId = Number(matchedTask?.taskId ?? matchedTask?.id ?? NaN)
  return Number.isFinite(matchedTaskId) ? matchedTaskId : null
}

const ensurePersistedTaskIdForIndicator = async (
  indicator: Pick<
    StrategicIndicator,
    'taskContent' | 'type2' | 'remark' | 'responsibleDept' | 'ownerDept'
  > & {
    taskId?: string | number | null
  }
): Promise<number> => {
  const trimmedTaskName = String(indicator.taskContent || '').trim()
  if (!trimmedTaskName) {
    throw new Error('请先填写战略任务')
  }

  const explicitTaskId = Number(indicator.taskId ?? NaN)
  if (Number.isFinite(explicitTaskId) && explicitTaskId > 0) {
    return explicitTaskId
  }

  const plan = currentPlan.value as Record<string, unknown> | null
  const planId = Number(plan?.id ?? plan?.taskId ?? NaN)
  if (!Number.isFinite(planId)) {
    throw new Error('未找到当前部门对应的计划，无法创建战略任务')
  }

  const existingTaskId = await findExistingTaskIdByName(planId, trimmedTaskName)
  if (existingTaskId) {
    return existingTaskId
  }

  const cycleId = await getCurrentCycleId()
  const targetOrgId =
    Number(plan?.targetOrgId ?? plan?.orgId ?? NaN) ||
    resolveDepartmentIdByName(indicator.responsibleDept || selectedDepartment.value) ||
    null
  const createdByOrgId =
    Number(plan?.createdByOrgId ?? NaN) ||
    resolveDepartmentIdByName(indicator.ownerDept || '战略发展部') ||
    null

  if (!targetOrgId || !createdByOrgId) {
    throw new Error('缺少任务归属部门信息，无法创建战略任务')
  }

  const createTaskResponse = await strategicApi.createBackendTask({
    taskName: trimmedTaskName,
    taskType: getTaskTypeForPersistence(indicator.type2),
    planId,
    cycleId,
    orgId: targetOrgId,
    createdByOrgId,
    sortOrder: 0,
    taskDesc: trimmedTaskName,
    remark: indicator.remark || null
  })

  const persistedTaskId = Number(
    createTaskResponse.data?.taskId ?? createTaskResponse.data?.id ?? NaN
  )
  if (!Number.isFinite(persistedTaskId)) {
    throw new Error('创建战略任务成功，但未返回任务ID')
  }

  return persistedTaskId
}

const registerTaskLocally = (taskId: string | number, taskType: 'BASIC' | 'DEVELOPMENT') => {
  const normalizedTaskId = String(taskId).trim()
  if (!normalizedTaskId) {
    return
  }

  backendTaskTypeMap.value = {
    ...backendTaskTypeMap.value,
    [normalizedTaskId]: taskType
  }

  currentPlanTaskTypeMap.value = {
    ...currentPlanTaskTypeMap.value,
    [normalizedTaskId]: taskType
  }

  const nextTaskIds = new Set(currentPlanTaskIdSet.value)
  nextTaskIds.add(normalizedTaskId)
  currentPlanTaskIdSet.value = nextTaskIds
}

const normalizeEditableText = (value: unknown): string => {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) {
    return ''
  }

  const normalized = trimmed.toLowerCase()
  if (normalized === 'null' || normalized === 'undefined') {
    return ''
  }

  return trimmed
}

const persistTaskContentEdit = async (row: StrategicIndicator, taskName: string) => {
  const trimmedTaskName = normalizeEditableText(taskName)
  if (!trimmedTaskName) {
    throw new Error('战略任务名称不能为空')
  }

  const existingTaskId = getIndicatorTaskId(row)
  if (existingTaskId) {
    await strategicApi.updateTaskName(existingTaskId, trimmedTaskName)
    strategicStore.patchIndicatorsByTaskId(existingTaskId, {
      taskContent: trimmedTaskName
    })
    return
  }

  const taskType = getTaskTypeForPersistence(row.type2)
  const persistedTaskId = await ensurePersistedTaskIdForIndicator({
    taskContent: trimmedTaskName,
    type2: row.type2,
    remark: row.remark,
    responsibleDept: row.responsibleDept,
    ownerDept: row.ownerDept
  })

  await strategicStore.updateIndicator(row.id.toString(), {
    taskId: persistedTaskId
  })
  strategicStore.patchIndicator(row.id.toString(), {
    taskId: String(persistedTaskId),
    taskContent: trimmedTaskName
  })
  registerTaskLocally(persistedTaskId, taskType)
}

// 判断 Plan 是否已下发（已审批通过，不能撤回）
const isPlanDistributed = computed(() => {
  const status = currentPlanStatus.value
  return status === 'DISTRIBUTED'
})

// 判断 Plan 是否可以撤回
// 统一以后端 workflow snapshot 的 canWithdraw 为准。
// 撤回权限只跟当前部门填报人走，不在前端额外放宽跨部门管理权限。
const canWithdrawPlan = computed(() => {
  const status = currentPlanStatus.value
  return (
    status === 'PENDING' && isCurrentUserReporter.value && Boolean(currentPlan.value?.canWithdraw)
  )
})

// 判断当前页面指标是否已进入“不可编辑”的流程阶段
// @requirement: Plan-centric status - 使用 Plan 状态判断指标是否在流程中
// 统一使用 Plan 状态作为口径，一个 Plan 下的所有指标共享同一个状态
const isIndicatorInFlowStage = (_indicator: StrategicIndicator): boolean => {
  // Plan 处于待审核或已下发状态时，指标都处于流程中
  return currentPlanStatus.value === 'DISTRIBUTED' || currentPlanStatus.value === 'PENDING'
}

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

// @requirement: Plan-centric status - 使用 Plan 状态判断是否可以删除指标
// 只有 Plan 处于草稿状态时才能删除指标
const canDeleteIndicator = (indicator: StrategicIndicator): boolean => {
  if (isReadOnly.value) {
    return false
  }
  if (!canEdit.value) {
    return false
  }

  // 必须是有真实ID的指标行（排除分组/汇总等无ID行）
  if (!indicator || indicator.id === null || indicator.id === undefined || indicator.id === '') {
    return false
  }

  // Plan 必须处于草稿状态才能删除指标
  const isPlanDraft = currentPlanStatus.value === 'DRAFT' || !currentPlanStatus.value
  return isPlanDraft
}

// @requirement: Plan-centric status - 使用 Plan 状态判断待审批数量
// Plan 处于 PENDING 状态时，表示有待审批的内容
const pendingApprovalCount = computed(() => {
  const expectedApproverRoleCodes = resolveExpectedApproverRoleCodesForCurrentPlan()
  const hasExpectedRole =
    expectedApproverRoleCodes.length === 0 ||
    expectedApproverRoleCodes.some(roleCode => currentUserRoleCodes.value.includes(roleCode))
  const expectedApproverOrgId = resolveExpectedApproverOrgIdForCurrentPlan()
  const hasExpectedOrg =
    !Number.isFinite(expectedApproverOrgId) ||
    (expectedApproverOrgId as number) <= 0 ||
    currentUserOrgId.value === expectedApproverOrgId

  return ['PENDING', 'IN_REVIEW', 'SUBMITTED'].includes(currentApprovalWorkflowStatus.value) &&
    permissionUtil.hasPermission(PermissionCode.BTN_STRATEGY_TASK_REPORT_APPROVE) &&
    hasExpectedRole &&
    hasExpectedOrg
    ? 1
    : 0
})

const planUiPhase = computed<'draft' | 'pending_withdrawable' | 'pending_locked' | 'distributed'>(
  () => {
    const status = currentPlanStatus.value
    const workflowStatus = currentApprovalWorkflowStatus.value

    if (status === 'PENDING' || ['PENDING', 'IN_REVIEW', 'SUBMITTED'].includes(workflowStatus)) {
      return canWithdrawPlan.value ? 'pending_withdrawable' : 'pending_locked'
    }

    if (status === 'DISTRIBUTED' || workflowStatus === 'APPROVED') {
      return 'distributed'
    }

    return 'draft'
  }
)

const approvalEntryButtonText = computed(() => {
  if (planUiPhase.value === 'pending_withdrawable' || planUiPhase.value === 'pending_locked') {
    return '审批中'
  }
  if (approvalWorkflowReportSummary.value?.id || planUiPhase.value === 'distributed') {
    return '查看审批'
  }
  return '审批进度'
})

const { routeApprovalEntityType, routeApprovalEntityId } = useApprovalRouteAutopen({
  supportedEntityTypes: ['PLAN', 'PLAN_REPORT'] as const,
  onAutoOpen: () => handleOpenApproval(),
  onClearFailure: error => {
    logger.warn('[StrategicTaskView] 清理审批自动打开参数失败:', error)
  }
})

const primaryApprovalWorkflowEntityType = computed<'PLAN' | 'PLAN_REPORT'>(() => {
  if (routeApprovalEntityType.value) {
    return routeApprovalEntityType.value
  }
  return approvalWorkflowReportSummary.value?.id ? 'PLAN_REPORT' : 'PLAN'
})

const primaryApprovalWorkflowEntityId = computed<number | string | undefined>(() => {
  return (
    routeApprovalEntityId.value ?? approvalWorkflowReportSummary.value?.id ?? currentPlan.value?.id
  )
})

const secondaryApprovalWorkflowEntityType = computed<'PLAN' | 'PLAN_REPORT' | undefined>(() => {
  // 战略任务页既要支持当前上报审批，也要保留原来的下发审批历史。
  if (approvalWorkflowReportSummary.value?.id) {
    return 'PLAN'
  }

  return latestPlanReportSummary.value?.id ? 'PLAN_REPORT' : undefined
})

const secondaryApprovalWorkflowEntityId = computed<number | string | undefined>(() => {
  if (approvalWorkflowReportSummary.value?.id) {
    return currentPlan.value?.id
  }

  return latestPlanReportSummary.value?.id
})

// ==================== 下发/撤回按钮逻辑 ====================
// 判断是否有已下发的指标
const hasDistributedIndicators = computed(() => {
  const list = indicators.value
  if (list.length === 0) {
    return false
  }

  return list.some(isIndicatorInFlowStage)
})

// 判断是否处于"可以下发"状态（Plan 是草稿状态）
const canDistribute = computed(() => {
  if (isReadOnly.value) {
    return false
  }
  if (!canEdit.value) {
    return false
  }

  // Plan 必须处于草稿状态才能下发
  const canSubmitPlan = currentPlanStatus.value === 'DRAFT' || !currentPlanStatus.value
  if (!canSubmitPlan) {
    return false
  }

  // 有指标且 Plan 处于草稿状态时可以下发
  return indicators.value.length > 0
})

// 下发/撤回按钮文本
// 基于 Plan 状态：
// - 草稿状态 → 下发
// - 待审批/已下发状态 → 撤回
const distributeButtonText = computed(() => {
  if (planUiPhase.value === 'draft') {
    return '发起审批'
  }
  return '撤回'
})

// 下发/撤回按钮类型
const distributeButtonType = computed(() => {
  if (planUiPhase.value === 'draft') {
    return 'success'
  }
  return planUiPhase.value === 'pending_withdrawable' ? 'warning' : 'info'
})

// 下发/撤回按钮图标
const distributeButtonIcon = computed(() => {
  if (planUiPhase.value === 'draft') {
    return Promotion
  }
  return RefreshLeft
})

const distributeButtonDisabledReason = computed(() => {
  if (isReadOnly.value) {
    return '历史快照为只读状态'
  }

  if (planUiPhase.value === 'draft' && !canCurrentUserSubmitCurrentPlan.value) {
    return '只有当前计划归属部门的填报人才可以发起审批'
  }

  if (planUiPhase.value === 'draft' && departmentTotalWeight.value !== 100) {
    return `基础性任务指标权重合计必须为100%，当前为${departmentTotalWeight.value}`
  }

  if (planUiPhase.value === 'pending_locked') {
    return isCurrentUserReporter.value
      ? '当前审批进度不支持撤回'
      : '当前登录身份不是填报人，不能撤回'
  }

  if (planUiPhase.value === 'distributed') {
    return '当前状态不可操作'
  }

  return ''
})

// 下发/撤回按钮是否禁用
// 基于 Plan 状态：
// - 只读状态：禁用
// - 草稿状态：启用（下发）
// - 待审批状态：检查是否在第一个节点
// - 已下发状态：禁用（不可撤回）
const distributeButtonDisabled = computed(() => {
  return Boolean(distributeButtonDisabledReason.value)
})

const resetApprovalSetupDialog = () => {
  approvalWorkflowPreview.value = null
}

const openApprovalSetupDialog = async () => {
  const planId = Number(currentPlan.value?.id ?? NaN)
  if (!Number.isFinite(planId) || planId <= 0) {
    ElMessage.warning('当前部门还没有可提交审批的计划')
    return
  }

  approvalPreviewLoading.value = true
  approvalSetupDialogVisible.value = true

  try {
    const response = await getWorkflowDefinitionPreviewByCode(PLAN_APPROVAL_SUBMIT_WORKFLOW_CODE)
    if (!response.success || !response.data) {
      throw new Error(response.message || '加载审批流程失败')
    }

    approvalWorkflowPreview.value = response.data
  } catch (error) {
    approvalSetupDialogVisible.value = false
    resetApprovalSetupDialog()
    logger.error('[StrategicTaskView] Failed to load workflow preview:', error)
    const message = error instanceof Error ? error.message : '加载审批流程失败'
    if (message.includes('Workflow definition not found')) {
      ElMessage.error('当前环境未配置审批流程定义，无法发起审批')
      return
    }
    if (message.includes('No available approver candidates')) {
      ElMessage.error('当前审批节点未匹配到可用审批人，无法发起审批')
      return
    }
    if (message.includes('missing role assignment')) {
      ElMessage.error('当前审批流程配置不完整，无法发起审批')
      return
    }
    ElMessage.error(message)
  } finally {
    approvalPreviewLoading.value = false
  }
}

const handleCloseApprovalSetupDialog = () => {
  approvalSetupDialogVisible.value = false
  resetApprovalSetupDialog()
}

const confirmPlanApprovalSubmission = async () => {
  if (!ensurePlanCanDistribute()) {
    return
  }

  const planId = Number(currentPlan.value?.id ?? NaN)
  if (!Number.isFinite(planId) || planId <= 0) {
    ElMessage.warning('当前计划不存在，无法发起审批')
    return
  }

  const preview = approvalWorkflowPreview.value
  if (!preview || !Array.isArray(preview.steps) || preview.steps.length === 0) {
    ElMessage.warning('审批流程尚未准备完成')
    return
  }

  approvalSubmitting.value = true
  try {
    await planStore.submitPlanForApproval(planId, {
      workflowCode: preview.workflowCode || PLAN_APPROVAL_SUBMIT_WORKFLOW_CODE
    })
    await refreshCurrentDepartmentView({ force: true })
    await preloadApprovalWorkflowDetail()
    await loadPendingPlanApprovalCount()
    handleCloseApprovalSetupDialog()
    ElMessage.success('已发起整体计划审批')
  } catch (error) {
    logger.error('[StrategicTaskView] Failed to submit plan approval:', error)
  } finally {
    approvalSubmitting.value = false
  }
}

// 下发/撤回按钮点击处理
const handleDistributeOrWithdraw = () => {
  if (distributeButtonDisabled.value) {
    if (distributeButtonDisabledReason.value) {
      ElMessage.warning(distributeButtonDisabledReason.value)
    }
    return
  }

  const status = currentPlanStatus.value

  if (status === 'DRAFT' || !status) {
    // 草稿状态：确认流程后发起整体计划审批
    void openApprovalSetupDialog()
  } else {
    // 待审批/已下发状态：撤回
    if (canWithdrawPlan.value) {
      handleWithdrawAll()
    }
  }
}

// 表格引用和选中的指标
const tableRef = ref<InstanceType<typeof ElTable>>()
const selectedIndicators = ref<StrategicIndicator[]>([])

// 当前指标（卡片视图用）
const currentIndicator = computed(() => {
  const list = indicators.value
  return list[currentIndicatorIndex.value] || null
})

const indicatorWorkflowCache = ref<Record<string, IndicatorWorkflowSnapshot | null>>({})
const currentIndicatorWorkflowLoading = ref(false)

const currentIndicatorWorkflow = computed(() => {
  const indicatorId = currentIndicator.value?.id
  if (indicatorId === undefined || indicatorId === null) {
    return null
  }
  return indicatorWorkflowCache.value[String(indicatorId)] ?? null
})

const canCurrentUserHandleCurrentIndicatorWorkflow = computed(() =>
  canCurrentUserHandleIndicatorWorkflow(
    currentIndicatorWorkflow.value,
    currentUserId.value,
    currentUserPermissionCodes.value
  )
)

const loadIndicatorWorkflowSnapshot = async (
  indicatorId: number | string,
  options: { force?: boolean } = {}
) => {
  const cacheKey = String(indicatorId)
  if (!options.force && cacheKey in indicatorWorkflowCache.value) {
    return indicatorWorkflowCache.value[cacheKey]
  }

  try {
    const response = await indicatorFillApi.getIndicatorFillHistory(indicatorId)
    const fills = Array.isArray(response.data) ? response.data : []
    const baseSnapshot = resolveLatestIndicatorWorkflowSnapshot(fills)
    let snapshot = baseSnapshot

    if (baseSnapshot?.workflowInstanceId) {
      try {
        const workflowResponse = await getWorkflowInstanceDetail(
          String(baseSnapshot.workflowInstanceId)
        )
        if (workflowResponse.success && workflowResponse.data) {
          snapshot = {
            ...baseSnapshot,
            workflowInstanceId: workflowResponse.data.instanceId || baseSnapshot.workflowInstanceId,
            currentTaskId: workflowResponse.data.currentTaskId || baseSnapshot.currentTaskId,
            workflowStatus: workflowResponse.data.status || baseSnapshot.workflowStatus,
            currentStepName: workflowResponse.data.currentStepName || baseSnapshot.currentStepName,
            currentApproverId:
              workflowResponse.data.currentApproverId ?? baseSnapshot.currentApproverId,
            currentApproverName:
              workflowResponse.data.currentApproverName || baseSnapshot.currentApproverName
          }
        }
      } catch (error) {
        logger.warn('[StrategicTaskView] 按实例刷新指标工作流快照失败:', {
          indicatorId,
          workflowInstanceId: baseSnapshot.workflowInstanceId,
          error
        })
      }
    } else if (baseSnapshot?.reportId) {
      try {
        const workflowResponse = await getWorkflowInstanceDetailByBusiness(
          'PLAN_REPORT',
          baseSnapshot.reportId
        )
        if (workflowResponse.success && workflowResponse.data) {
          snapshot = {
            ...baseSnapshot,
            workflowInstanceId: workflowResponse.data.instanceId || baseSnapshot.workflowInstanceId,
            currentTaskId: workflowResponse.data.currentTaskId || baseSnapshot.currentTaskId,
            workflowStatus: workflowResponse.data.status || baseSnapshot.workflowStatus,
            currentStepName: workflowResponse.data.currentStepName || baseSnapshot.currentStepName,
            currentApproverId:
              workflowResponse.data.currentApproverId ?? baseSnapshot.currentApproverId,
            currentApproverName:
              workflowResponse.data.currentApproverName || baseSnapshot.currentApproverName
          }
        }
      } catch (error) {
        logger.warn('[StrategicTaskView] 按业务实体刷新指标工作流快照失败:', {
          indicatorId,
          reportId: baseSnapshot.reportId,
          error
        })
      }
    }

    indicatorWorkflowCache.value = {
      ...indicatorWorkflowCache.value,
      [cacheKey]: snapshot
    }
    return snapshot
  } catch (error) {
    logger.warn('[StrategicTaskView] 加载指标工作流快照失败:', { indicatorId, error })
    indicatorWorkflowCache.value = {
      ...indicatorWorkflowCache.value,
      [cacheKey]: null
    }
    return null
  }
}

const refreshIndicatorWorkflowContext = async (indicatorId: number | string) => {
  const workflowSnapshot = await loadIndicatorWorkflowSnapshot(indicatorId, { force: true })
  if (workflowSnapshot?.workflowStatus) {
    const optimisticPlanStatus = ['APPROVED', 'COMPLETED'].includes(
      String(workflowSnapshot.workflowStatus).toUpperCase()
    )
      ? 'DISTRIBUTED'
      : ['REJECTED', 'RETURNED', 'WITHDRAWN', 'CANCELLED'].includes(
            String(workflowSnapshot.workflowStatus).toUpperCase()
          )
        ? 'DRAFT'
        : 'PENDING'

    if (currentPlan.value) {
      currentPlan.value = {
        ...currentPlan.value,
        status: optimisticPlanStatus,
        workflowStatus: workflowSnapshot.workflowStatus,
        currentTaskId: workflowSnapshot.currentTaskId ?? currentPlan.value.currentTaskId,
        currentStepName: workflowSnapshot.currentStepName ?? currentPlan.value.currentStepName,
        currentApproverId:
          workflowSnapshot.currentApproverId ?? currentPlan.value.currentApproverId,
        currentApproverName:
          workflowSnapshot.currentApproverName ?? currentPlan.value.currentApproverName,
        canWithdraw:
          optimisticPlanStatus === 'PENDING'
            ? false
            : optimisticPlanStatus === 'DRAFT'
              ? true
              : false
      }
    }
  }

  invalidateQueries([
    'indicator.list',
    'task.list',
    'plan.detail',
    'dashboard.overview',
    buildQueryKey('task', 'list', { year: timeContext.currentYear })
  ])
  const planId = currentPlan.value?.id
  await strategicStore.loadIndicatorsByYear(timeContext.currentYear)
  if (planId !== undefined && planId !== null && planId !== '') {
    await planStore.loadPlanDetails(planId, { force: true, background: true })
  }
  await loadPendingPlanApprovalCount()
  await approvalStore.loadPendingApprovals()
}

const refreshTaskPageAfterIndicatorMutation = async () => {
  const planId = currentPlan.value?.id
  const invalidateTargets: Array<string | ReturnType<typeof buildQueryKey>> = [
    'indicator.list',
    'task.list',
    'task.scope',
    'plan.detail',
    'dashboard.overview',
    buildQueryKey('task', 'list', { year: timeContext.currentYear })
  ]

  if (planId !== undefined && planId !== null && planId !== '') {
    invalidateTargets.push(
      buildQueryKey('task', 'scope', {
        department: selectedDepartment.value,
        planId: String(planId),
        year: timeContext.currentYear
      })
    )
  }

  invalidateQueries(invalidateTargets)

  // 开始全量并发刷新各维度数据
  await Promise.all([
    strategicStore.loadIndicatorsByYear(timeContext.currentYear, { force: true }),
    loadBackendTaskTypeMap(),
    loadCurrentPlanTaskScope({ force: true }),
    loadPendingPlanApprovalCount(),
    refreshCurrentDepartmentView({ force: true })
  ])
}

const handleApproveCurrentIndicatorWorkflow = async () => {
  const indicator = currentIndicator.value
  const snapshot = currentIndicatorWorkflow.value
  if (!indicator || !snapshot?.currentTaskId) {
    ElMessage.warning('当前指标没有可审批的工作流任务')
    return
  }
  if (!canCurrentUserHandleCurrentIndicatorWorkflow.value) {
    ElMessage.warning('当前审批节点不是你，或当前账号缺少报告审批权限')
    return
  }

  try {
    const { value } = await ElMessageBox.prompt('请输入审批意见（可选）', '审批通过', {
      confirmButtonText: '确认通过',
      cancelButtonText: '取消',
      inputType: 'textarea'
    })
    const loading = ElLoading.service({ lock: true, text: '正在审批...' })
    try {
      await approveTask(String(snapshot.currentTaskId), {
        comment: value || '审批通过'
      })
      ElMessage.success('审批通过成功')
      await refreshIndicatorWorkflowContext(indicator.id)
    } finally {
      loading.close()
    }
  } catch {
    // user cancelled
  }
}

const handleRejectCurrentIndicatorWorkflow = async () => {
  const indicator = currentIndicator.value
  const snapshot = currentIndicatorWorkflow.value
  if (!indicator || !snapshot?.currentTaskId) {
    ElMessage.warning('当前指标没有可审批的工作流任务')
    return
  }
  if (!canCurrentUserHandleCurrentIndicatorWorkflow.value) {
    ElMessage.warning('当前审批节点不是你，或当前账号缺少报告审批权限')
    return
  }

  try {
    const { value } = await ElMessageBox.prompt('请输入驳回原因', '审批驳回', {
      confirmButtonText: '确认驳回',
      cancelButtonText: '取消',
      inputType: 'textarea',
      inputValidator: input => (String(input || '').trim() ? true : '请填写驳回原因')
    })
    const loading = ElLoading.service({ lock: true, text: '正在驳回...' })
    try {
      await rejectTask(String(snapshot.currentTaskId), {
        reason: String(value).trim()
      })
      ElMessage.success('审批驳回成功')
      await refreshIndicatorWorkflowContext(indicator.id)
    } finally {
      loading.close()
    }
  } catch {
    // user cancelled
  }
}

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
  let list = normalizedIndicators.value.filter(
    i => resolveIndicatorYear(i, timeContext.currentYear) === timeContext.currentYear
  )

  // 根据选中的部门筛选指标
  if (selectedDepartment.value) {
    list = list.filter(
      i =>
        i.ownerDept === '战略发展部' && // 由战略发展部创建的指标
        i.responsibleDept === selectedDepartment.value && // 下发给选中部门的指标
        i.isStrategic === true && // 只显示战略指标，不显示子指标
        isIndicatorInCurrentPlanScope(i) // 严格限定当前计划任务范围
    )
  } else {
    // 没有选择部门：显示所有战略发展部创建的战略指标
    list = list.filter(
      i =>
        i.ownerDept === '战略发展部' && i.isStrategic === true && isIndicatorInCurrentPlanScope(i)
    )
  }

  const mappedList = list.map(i => ({
    ...i,
    // type2 仅用于展示标签；业务判断统一走 task_type 映射。
    type2: getIndicatorCategoryLabel(i)
  }))

  // 先按任务类型（后端 task_type）排序，再按任务名称排序
  return mappedList.sort((a, b) => {
    const taskTypeA = getIndicatorMappedTaskType(a)
    const taskTypeB = getIndicatorMappedTaskType(b)
    if (taskTypeA !== taskTypeB) {
      // 发展性优先，其次基础性，最后其他类型
      const rank = (taskType: string) => {
        if (isDevelopmentTaskType(taskType)) {
          return 0
        }
        if (isBasicTaskType(taskType)) {
          return 1
        }
        return 2
      }
      return rank(taskTypeA) - rank(taskTypeB)
    }
    const taskA = a.taskContent || ''
    const taskB = b.taskContent || ''
    return taskA.localeCompare(taskB)
  })
})

watch(
  () => currentIndicator.value?.id,
  async indicatorId => {
    if (indicatorId === undefined || indicatorId === null) {
      return
    }
    currentIndicatorWorkflowLoading.value = true
    try {
      await loadIndicatorWorkflowSnapshot(indicatorId)
    } finally {
      currentIndicatorWorkflowLoading.value = false
    }
  },
  { immediate: true }
)

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

// 获取任务级别状态（基于 Plan 的状态）
// Plan-centric: 状态由 Plan 控制，不是指标自己的 canWithdraw 字段
const getTaskStatus = (_row: StrategicIndicator) => {
  const planStatus = currentPlanStatus.value

  // 根据 Plan 状态返回对应的显示
  if (planStatus === 'DRAFT' || !planStatus) {
    return { label: '待下发', type: 'info', canWithdraw: true }
  }
  if (planStatus === 'DISTRIBUTED') {
    return { label: '已下发', type: 'success', canWithdraw: false }
  }
  if (planStatus === 'PENDING') {
    return { label: '待审批', type: 'warning', canWithdraw: false }
  }
  // 默认返回待下发
  return { label: '待下发', type: 'info', canWithdraw: true }
}

const getPersistedWithdrawableRows = (rows: StrategicIndicator[]): StrategicIndicator[] => {
  return rows.filter(row => {
    const normalizedId = String(row.id ?? '').trim()
    return Boolean(normalizedId) && /^\d+$/.test(normalizedId)
  })
}

// 撤回整个任务（撤回同一战略任务下的所有指标）
const _handleWithdrawTask = async (row: StrategicIndicator) => {
  const group = getTaskGroup(row)
  const distributedRows = getPersistedWithdrawableRows(group.rows)

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
          distributedRows.map(r => strategicStore.withdrawIndicator(r.id.toString()))
        )

        await refreshTaskPageAfterIndicatorMutation()
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
const isSavingMilestoneEdit = ref(false)
const createTempMilestoneId = () => -Date.now() - Math.floor(Math.random() * 1000)

const sortDialogMilestonesByDate = (milestones: Milestone[]): Milestone[] => {
  const toTime = (value?: string | null) => {
    if (!value) {
      return Number.POSITIVE_INFINITY
    }

    const time = new Date(value).getTime()
    return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY
  }

  return [...milestones].sort((a, b) => {
    const dateDiff = toTime(a.deadline) - toTime(b.deadline)
    if (dateDiff !== 0) {
      return dateDiff
    }

    return Number(a.targetProgress ?? 0) - Number(b.targetProgress ?? 0)
  })
}

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
  editingMilestones.value = sortDialogMilestonesByDate(
    JSON.parse(JSON.stringify(row.milestones || []))
  )
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
    id: createTempMilestoneId(),
    name: autoName,
    targetProgress: 0,
    deadline: '',
    status: 'pending'
  })
  editingMilestones.value = sortDialogMilestonesByDate(editingMilestones.value)
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
  editingMilestones.value = sortDialogMilestonesByDate(editingMilestones.value)
  logger.info(
    `[generateMonthlyMilestonesInDialog] Generated ${editingMilestones.value.length} milestones`
  )
}

// 删除里程碑（编辑弹窗内）
const removeMilestoneInDialog = (index: number) => {
  editingMilestones.value.splice(index, 1)
}

const handleMilestoneDeadlineChange = () => {
  editingMilestones.value = sortDialogMilestonesByDate(editingMilestones.value)
}

// 保存里程碑编辑
const saveMilestoneEdit = async () => {
  if (!editingMilestoneIndicator.value || isSavingMilestoneEdit.value) {
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

  isSavingMilestoneEdit.value = true

  try {
    // 从当前指标列表中查找最新的指标对象（使用 id 匹配）
    const currentIndicator = indicators.value.find(
      i => i.id === editingMilestoneIndicator.value?.id
    )

    if (!currentIndicator) {
      ElMessage.error('找不到对应的指标，请刷新页面后重试')
      return
    }

    const indicatorId = currentIndicator.id.toString()
    const deptKey = selectedDepartment.value || ''
    const sortedMilestones = sortDialogMilestonesByDate(editingMilestones.value)

    logger.info(
      `[StrategicTaskView] Saving ${sortedMilestones.length} milestones for indicator ${indicatorId}`
    )

    await milestoneApi.saveMilestonesForIndicator(
      indicatorId,
      sortedMilestones.map((milestone, index) => {
        const milestoneId = Number(milestone.id)
        return {
          id: Number.isFinite(milestoneId) && milestoneId > 0 ? milestoneId : undefined,
          milestoneName: String(milestone.name || '').trim(),
          description: '',
          dueDate: toMilestoneDueDate(milestone.deadline),
          targetProgress: Number(milestone.targetProgress || 0),
          status: toMilestoneRequestStatus(milestone.status),
          sortOrder: Number(milestone.sortOrder ?? index + 1),
          isPaired: Boolean((milestone as { isPaired?: boolean }).isPaired ?? false),
          inheritedFrom: null as number | null
        }
      })
    )

    const refreshedMilestones = await reloadMilestonesForIndicator(indicatorId, deptKey)
    logger.info(
      `[StrategicTaskView] Milestones synced for indicator ${indicatorId}, count=${refreshedMilestones.length}`
    )

    ElMessage.success('里程碑已更新')
    milestoneEditDialogVisible.value = false
    editingMilestoneIndicator.value = null
    editingMilestones.value = []
    updateEditTime()
  } catch (error) {
    logger.error('Failed to save milestones:', error)
    ElMessage.error('里程碑更新失败')
  } finally {
    isSavingMilestoneEdit.value = false
  }
}

// 取消里程碑编辑
const cancelMilestoneEdit = () => {
  if (isSavingMilestoneEdit.value) {
    return
  }
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

const formatDetailDate = (time: string | Date | undefined) => {
  if (!time) {
    return '-'
  }

  const date = new Date(time)
  if (Number.isNaN(date.getTime())) {
    return String(time).slice(0, 10) || '-'
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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

// 按类别筛选指标（基于后端 task_type）
const developmentIndicators = computed(() =>
  indicators.value.filter(i => isDevelopmentTaskType(getIndicatorMappedTaskType(i)))
)
const basicIndicators = computed(() =>
  indicators.value.filter(i => isBasicTaskType(getIndicatorMappedTaskType(i)))
)

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
    if (i.taskContent && i.taskContent !== '未命名任务') {
      const category = getTaskCategoryLabel(getIndicatorMappedTaskType(i))
      if (category === '发展性' || category === '基础性') {
        map[i.taskContent] = category
      }
    }
  })
  return map
})

const preservePrefilledTaskBindingOnce = ref(false)

// 选择战略任务时自动更新任务类型
const handleTaskSelect = (taskName: string) => {
  if (preservePrefilledTaskBindingOnce.value && String(newRow.value.taskId || '').trim()) {
    preservePrefilledTaskBindingOnce.value = false
    return
  }

  newRow.value.taskId = ''

  if (taskTypeMap.value[taskName]) {
    newRow.value.type2 = taskTypeMap.value[taskName]
  }

  void (async () => {
    const plan = currentPlan.value as Record<string, unknown> | null
    const planId = Number(plan?.id ?? plan?.taskId ?? NaN)
    if (!Number.isFinite(planId) || planId <= 0) {
      return
    }

    const existingTaskId = await findExistingTaskIdByName(planId, taskName)
    if (existingTaskId) {
      newRow.value.taskId = String(existingTaskId)
    }
  })()
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
      newRow.value.taskId = ''
    }
  }
}

// 新增行数据
const newRow = ref({
  taskId: '',
  taskContent: '',
  name: '',
  type1: '定量' as '定性' | '定量',
  type2: '基础性' as '发展性' | '基础性',
  weight: 0,
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
const isSavingIndicatorEdit = ref(false)
const savingIndicatorId = ref<number | null>(null)
const savingIndicatorField = ref<string | null>(null)

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
  if (savingIndicatorId.value === row.id) {
    return
  }
  editingIndicatorId.value = row.id
  editingIndicatorField.value = field
  editingIndicatorValue.value = row[field as keyof StrategicIndicator]
}

const isSavingIndicatorCell = (row: StrategicIndicator, field: string) =>
  savingIndicatorId.value === row.id && savingIndicatorField.value === field

// 保存指标编辑
const saveIndicatorEdit = async (row: StrategicIndicator, field: string) => {
  if (isSavingIndicatorEdit.value) {
    return
  }

  // 如果已经在取消过程中或值无效，直接退出
  if (editingIndicatorId.value === null) {
    return
  }

  if (editingIndicatorValue.value === null || editingIndicatorValue.value === undefined) {
    cancelIndicatorEdit()
    return
  }

  // 前端字段名到后端字段名的映射
  const fieldMapping: Record<string, string> = {
    name: 'indicatorDesc',
    weight: 'weightPercent',
    progress: 'progress',
    remark: 'remark',
    sortOrder: 'sortOrder'
  }

  try {
    isSavingIndicatorEdit.value = true
    savingIndicatorId.value = row.id
    savingIndicatorField.value = field
    // 使用 Store 更新指标
    const updates: Record<string, unknown> = {}
    const mappedField = fieldMapping[field] || field

    console.log(
      '[saveIndicatorEdit] row.id:',
      row.id,
      'field:',
      field,
      'mappedField:',
      mappedField,
      'value:',
      editingIndicatorValue.value
    )

    if (field === 'taskContent') {
      const normalizedTaskName = normalizeEditableText(editingIndicatorValue.value)
      if (!normalizedTaskName) {
        cancelIndicatorEdit()
        ElMessage.warning('战略任务名称不能为空')
        return
      }
      if (normalizedTaskName === normalizeEditableText(row.taskContent)) {
        cancelIndicatorEdit()
        return
      }
      cancelIndicatorEdit()
      await persistTaskContentEdit(row, normalizedTaskName)
      updateEditTime()
      return
    }

    if (field === 'weight' || field === 'progress') {
      // 权重和进度字段强制转换为数字
      updates[mappedField] = Number(editingIndicatorValue.value)
    } else if (field === 'type1' || field === 'type2') {
      updates[field] = editingIndicatorValue.value
      // 更新 isQualitative 状态如果修改的是 type1
      if (field === 'type1') {
        updates.isQualitative = editingIndicatorValue.value === '定性'
      }
    } else {
      updates[mappedField] = editingIndicatorValue.value
    }

    // 如果编辑的是核心指标名称，且当前没有指标类型，则设置默认类型为"定性"
    if (field === 'name' && !row.type1) {
      updates.type1 = '定性'
      updates.isQualitative = true
    }

    console.log('[saveIndicatorEdit] updates:', updates)
    cancelIndicatorEdit()
    await strategicStore.updateIndicator(row.id.toString(), updates)
    updateEditTime()
  } catch (error) {
    console.error('[saveIndicatorEdit] Error details:', error)
    logger.error('[StrategicTaskView] Failed to save indicator:', error)
    const message = error instanceof Error && error.message ? error.message : '保存失败，请稍后重试'
    ElMessage.error(message)
  } finally {
    isSavingIndicatorEdit.value = false
    savingIndicatorId.value = null
    savingIndicatorField.value = null
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
  const target = event.target as HTMLElement

  if (isAddingOrEditing.value) {
    const clickedInsideAddForm = !!addRowFormRef.value && addRowFormRef.value.contains(target)
    const clickedInsidePopup =
      !!target.closest('.el-popper') ||
      !!target.closest('.el-select-dropdown') ||
      !!target.closest('.el-picker__popper')

    if (!clickedInsideAddForm && !clickedInsidePopup) {
      cancelAdd()
      return
    }
  }

  // 如果没有正在编辑的字段，直接返回
  if (
    editingIndicatorId.value === null ||
    editingIndicatorField.value === null ||
    isSavingIndicatorEdit.value
  ) {
    return
  }

  // 检查点击是否在 el-select 或其下拉菜单内
  const isInSelect = target.closest('.el-select') || target.closest('.el-select-dropdown')
  // 检查点击是否在 el-input 内
  const isInInput = target.closest('.el-input') || target.closest('.el-textarea')

  const blurManagedFields = new Set(['taskContent', 'name', 'remark', 'weight', 'progress'])

  // 这些字段已经在组件自身的 blur 事件里保存，避免点击捕获阶段再触发一次。
  if (blurManagedFields.has(editingIndicatorField.value)) {
    return
  }

  // 仅对非 blur 驱动的编辑控件兜底
  if (!isInSelect && !isInInput) {
    const currentRow = indicators.value.find(
      item => String(item.id) === String(editingIndicatorId.value)
    )
    const currentField = editingIndicatorField.value

    if (currentRow && currentField) {
      void saveIndicatorEdit(currentRow, currentField)
      return
    }

    cancelIndicatorEdit()
  }
}

// 挂载和卸载全局点击监听
onMounted(async () => {
  await Promise.all([
    (async () => {
      if (orgStore.departments.length === 0) {
        try {
          await orgStore.loadDepartments()
        } catch (error) {
          logger.error('[StrategicTaskView] 初始加载部门失败:', error)
        }
      }
    })(),
    (async () => {
      try {
        await planStore.loadPlans({ force: true, background: true })
      } catch (error) {
        logger.error('[StrategicTaskView] 初始加载 Plan 失败:', error)
      }
    })(),
    loadBackendTaskTypeMap({ force: true })
  ])

  await refreshCurrentDepartmentView({ force: true })
  isBootstrappingPage.value = false

  void loadMilestonesForCurrentScope()

  document.addEventListener('click', handleGlobalClick, true)
})

onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick, true)
})

watch(
  () => timeContext.currentYear,
  async () => {
    if (isBootstrappingPage.value) {
      return
    }
    await loadBackendTaskTypeMap({ force: true })
    await refreshCurrentDepartmentView({ showLoading: true, force: true })
  }
)

watch([selectedDepartment, () => planStore.plans.length], async () => {
  if (isBootstrappingPage.value) {
    return
  }
  await refreshCurrentDepartmentView({ showLoading: true, force: true })
  void loadMilestonesForCurrentScope()
})

watch(
  [() => currentPlan.value?.id, currentPlanStatus],
  async ([planId, status], [prevPlanId, prevStatus]) => {
    if (isBootstrappingPage.value) {
      return
    }

    if (planId === prevPlanId && status === prevStatus) {
      return
    }

    await hydrateCurrentPlanWorkflowState()
  }
)

// 方法
const resetNewRow = (
  overrides: Partial<{
    taskId: string
    taskContent: string
    type1: '定性' | '定量'
    type2: '发展性' | '基础性'
  }> = {}
) => {
  preservePrefilledTaskBindingOnce.value = false
  newRow.value = {
    taskId: overrides.taskId ?? '',
    taskContent: overrides.taskContent ?? '',
    name: '',
    type1: overrides.type1 ?? '定量',
    type2: overrides.type2 ?? '基础性',
    weight: 0,
    remark: '',
    milestones: []
  }
}

const openNewRowDialog = (
  overrides: Partial<{
    taskId: string
    taskContent: string
    type1: '定性' | '定量'
    type2: '发展性' | '基础性'
  }> = {}
) => {
  resetNewRow(overrides)
  if (overrides.taskId !== undefined) {
    newRow.value.taskId = overrides.taskId
  }
  isAddingOrEditing.value = true

  if (newRow.value.type1 === '定量') {
    generateMonthlyMilestones()
  }
}

const addNewRow = () => {
  openNewRowDialog()
}

// 在指定类别中添加新指标
const _addIndicatorToCategory = (category: '发展性' | '基础性') => {
  logger.info(`[StrategicTaskView] addIndicatorToCategory called with category: ${category}`)
  openNewRowDialog({ type2: category })
}

// 为指定任务新增指标（点击单元格右下角加号）
const handleAddIndicatorToTask = (row: StrategicIndicator) => {
  preservePrefilledTaskBindingOnce.value = true
  openNewRowDialog({
    taskId: getIndicatorTaskId(row),
    taskContent: row.taskContent || '',
    type2: row.type2 === '基础性' ? '基础性' : '发展性'
  })
}

const cancelAdd = () => {
  isAddingOrEditing.value = false
  resetNewRow()
  updateEditTime()
}

const getCurrentActorUserId = () => {
  const userRecord = authStore.user as { id?: string | number; userId?: string | number } | null
  const candidateId = Number(userRecord?.userId ?? userRecord?.id ?? NaN)
  return Number.isFinite(candidateId) && candidateId > 0 ? candidateId : null
}

const persistNewIndicatorMilestones = async (indicatorId: number, milestones: Milestone[]) => {
  if (!Number.isFinite(indicatorId) || indicatorId <= 0 || milestones.length === 0) {
    return
  }

  await milestoneApi.saveMilestonesForIndicator(
    String(indicatorId),
    milestones.map((milestone, index) => ({
      milestoneName: String(milestone.name || '').trim() || `里程碑 ${index + 1}`,
      targetProgress: Number(milestone.targetProgress) || 0,
      dueDate: milestone.deadline || null,
      status: milestone.status === 'completed' ? 'COMPLETED' : 'NOT_STARTED',
      sortOrder: index + 1
    }))
  )

  await reloadMilestonesForIndicator(String(indicatorId), selectedDepartment.value || '战略发展部')
}

// 保存新行
const saveNewRow = async () => {
  if (!String(newRow.value.taskContent || '').trim()) {
    ElMessage.warning('请填写战略任务')
    return
  }

  if (!String(newRow.value.name || '').trim()) {
    ElMessage.warning('请填写核心指标内容')
    return
  }

  const weight = Number(newRow.value.weight)
  if (!Number.isFinite(weight) || weight <= 0) {
    ElMessage.warning('请填写大于 0 的权重')
    return
  }

  // 显示加载状态
  const loading = ElLoading.service({
    lock: true,
    text: '正在保存指标...',
    background: 'rgba(0, 0, 0, 0.7)'
  })

  try {
    const persistedTaskId = await ensurePersistedTaskIdForIndicator({
      taskId: newRow.value.taskId || null,
      taskContent: newRow.value.taskContent,
      type2: newRow.value.type2,
      remark: newRow.value.remark,
      responsibleDept: selectedDepartment.value || '战略发展部',
      ownerDept: '战略发展部'
    })

    // 添加日志记录 taskContent
    logger.info(
      `[StrategicTaskView] Saving indicator with taskContent: "${newRow.value.taskContent}"`
    )

    // 调用 Store 添加指标（现在是异步的，会调用后端 API）
    const createdIndicatorResponse = await strategicStore.addIndicator({
      id: Date.now().toString(),
      taskId: persistedTaskId,
      taskContent: String(newRow.value.taskContent || '').trim(),
      name: String(newRow.value.name || '').trim(),
      isQualitative: newRow.value.type1 === '定性',
      type1: newRow.value.type1,
      type2: newRow.value.type2,
      progress: 0,
      createTime: new Date().toLocaleDateString('zh-CN'),
      weight,
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

    const createdIndicatorId = Number(
      createdIndicatorResponse?.data?.indicatorId ?? createdIndicatorResponse?.data?.id ?? NaN
    )
    if (Number.isFinite(createdIndicatorId) && newRow.value.milestones.length > 0) {
      await persistNewIndicatorMilestones(createdIndicatorId, newRow.value.milestones)
    }

    // 统一走“变更后刷新”链路，避免新增后被旧缓存覆盖，导致主页仍显示上一版状态。
    logger.info('[StrategicTaskView] Refreshing task page after successful indicator creation...')
    await refreshTaskPageAfterIndicatorMutation()
    logger.info('[StrategicTaskView] Task page refreshed successfully after indicator creation')

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
  const indicatorId = indicator?.id
  if (indicatorId === null || indicatorId === undefined || indicatorId === '') {
    ElMessage.warning('当前行不是可删除的指标数据')
    return
  }

  ElMessageBox.confirm(`确定要删除指标 "${indicator.name}" 吗？删除后无法恢复。`, '删除确认', {
    confirmButtonText: '确定删除',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(async () => {
      const loading = ElLoading.service({
        lock: true,
        text: '正在删除指标并刷新数据...',
        background: 'rgba(0, 0, 0, 0.5)'
      })

      try {
        await strategicStore.deleteIndicator(indicatorId.toString())
        await refreshTaskPageAfterIndicatorMutation()
        ElMessage.success('指标已删除')
        updateEditTime()
      } catch (error) {
        logger.error('[StrategicTaskView] 删除指标失败:', error)
        ElMessage.error('删除失败，请稍后重试')
      } finally {
        loading.close()
      }
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
  const _currentYear = _currentDate.getFullYear()

  // 检查是否有逾期未完成的里程碑
  const hasOverdueMilestone = indicator.milestones.some(milestone => {
    const deadlineDate = new Date(milestone.deadline)
    return milestone.status === 'pending' && deadlineDate < _currentDate
  })

  // 检查是否有即将到期的里程碑（30天内）
  const hasUpcomingMilestone = indicator.milestones.some(milestone => {
    if (milestone.status === 'completed') {
      return false
    }
    const deadlineDate = new Date(milestone.deadline)
    const daysUntilDeadline = Math.ceil(
      (deadlineDate.getTime() - _currentDate.getTime()) / (1000 * 60 * 60 * 24)
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
    return deadlineDate < _currentDate
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
  return sortMilestonesByProgress(indicator.milestones || []).map(m => ({
    id: m.id || '',
    name: m.name,
    expectedDate: m.deadline || '',
    progress: m.targetProgress || 0
  }))
}

const getSortedMilestones = (milestones?: StrategicIndicator['milestones']) =>
  sortMilestonesByProgress(milestones || [])

const selectDepartment = (dept: string) => {
  if (selectedDepartment.value === dept) {
    return
  }
  pageTransitionLoading.value = true
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

// 任务审批抽屉状态
const taskApprovalVisible = ref(false)
const preloadedPlanWorkflowDetail = ref<WorkflowInstanceDetailResponse | null>(null)

// 专门用于审批抽屉的指标列表（显示当前选中部门的所有指标，一个部门的所有指标状态应该统一）
const approvalIndicators = computed(() => {
  if (!selectedDepartment.value) {
    return []
  }
  return normalizedIndicators.value
    .filter(i => resolveIndicatorYear(i, timeContext.currentYear) === timeContext.currentYear)
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

async function refreshApprovalWorkflowSummaries(): Promise<void> {
  await syncCurrentPlanReportSummaries({ force: true })
}

async function preloadApprovalWorkflowDetail(): Promise<void> {
  preloadedPlanWorkflowDetail.value = null

  const reportId = Number(approvalWorkflowReportSummary.value?.id ?? NaN)
  if (Number.isFinite(reportId) && reportId > 0) {
    try {
      const response = await getWorkflowInstanceDetailByBusiness('PLAN_REPORT', reportId)
      if (response.success && response.data) {
        preloadedPlanWorkflowDetail.value = response.data
      }
    } catch (error) {
      logger.warn('[StrategicTaskView] 预加载 PlanReport 审批抽屉工作流详情失败:', {
        reportId,
        error
      })
    }
    return
  }

  const planId = currentPlan.value?.id
  if (planId === undefined || planId === null || planId === '') {
    return
  }

  await planStore.loadPlanDetails(planId, { force: true, background: true })

  const latestPlan = currentPlan.value
  if (!latestPlan) {
    return
  }

  try {
    const businessEntityId = Number(latestPlan.id ?? 0)
    if (Number.isFinite(businessEntityId) && businessEntityId > 0) {
      const response = await getWorkflowInstanceDetailByBusiness('PLAN', businessEntityId)
      if (response.success && response.data) {
        preloadedPlanWorkflowDetail.value = response.data
      }
      return
    }

    const workflowInstanceId = Number(latestPlan.workflowInstanceId ?? 0)
    if (Number.isFinite(workflowInstanceId) && workflowInstanceId > 0) {
      const response = await getWorkflowInstanceDetail(String(workflowInstanceId))
      if (response.success && response.data) {
        preloadedPlanWorkflowDetail.value = response.data
      }
    }
  } catch (error) {
    logger.warn('[StrategicTaskView] 预加载审批抽屉工作流详情失败:', {
      planId,
      error
    })
  }
}

// 打开任务审批抽屉
const handleOpenApproval = async () => {
  await refreshApprovalWorkflowSummaries()
  await preloadApprovalWorkflowDetail()
  taskApprovalVisible.value = true
}

// 审批后刷新
const handleApprovalRefresh = async () => {
  // 使用统一的变更后刷新逻辑，确保指标列表、计划详情、上报摘要、待办数量全部同步
  await refreshTaskPageAfterIndicatorMutation()

  // 额外刷新 planStore 的详情（与 strategicStore 不同步）
  const planId = currentPlan.value?.id
  if (planId !== undefined && planId !== null && planId !== '') {
    await planStore.loadPlanDetails(planId, { force: true, background: true })
  }

  // 强制关闭抽屉以避免旧数据残留
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
// 旧的本地审批弹窗已停用，统一改为从真实工作流待办入口处理。

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

          await refreshTaskPageAfterIndicatorMutation()
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

          await refreshTaskPageAfterIndicatorMutation()
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

const triggerApprovalForDistribution = async (indicator: StrategicIndicator) => {
  const indicatorId = Number(indicator.id)
  if (!Number.isFinite(indicatorId) || indicatorId <= 0) {
    return { skipped: true as const, reason: 'temporary_indicator' }
  }

  const requesterId = Number(getCurrentActorUserId() || 0)
  const rawOrgId = Number((authStore.user as { orgId?: number | string } | null)?.orgId || 0)
  const fallbackOrgId =
    departmentNameIdMap.value.get(
      authStore.effectiveDepartment || authStore.userDepartment || ''
    ) || 0
  const requesterOrgId = rawOrgId > 0 ? rawOrgId : Number(fallbackOrgId)
  const traceId = `dist-${indicatorId}-${Date.now()}`

  if (
    !Number.isFinite(requesterId) ||
    requesterId <= 0 ||
    !Number.isFinite(requesterOrgId) ||
    requesterOrgId <= 0
  ) {
    return { skipped: true as const, reason: 'missing_requester_context', traceId }
  }

  // Use new workflow API
  await startWorkflow({
    workflowCode: 'TASK_DISTRIBUTION',
    businessEntityId: indicatorId,
    businessEntityType: 'TASK'
  })
  const requestId = traceId

  logger.info('[StrategicTaskView] Distribution approval triggered', {
    traceId,
    requestId,
    indicatorId,
    requesterId,
    requesterOrgId
  })

  return { skipped: false as const, traceId, requestId, instanceId: undefined }
}

// 确认下发（支持单个和整体下发）
const confirmDistribute = () => {
  if (!ensurePlanCanDistribute()) {
    return
  }

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
            const persistedIndicatorId = String(row.id)
            if (!/^\d+$/.test(persistedIndicatorId)) {
              throw new Error(`指标 ${persistedIndicatorId} 尚未持久化，无法执行下发`)
            }

            // 构建审计记录
            const newAuditEntry = {
              id: `audit-${row.id}-${Date.now()}`,
              operator: String(getCurrentActorUserId() || 'admin'),
              operatorName: authStore.user?.name || '管理员',
              operatorDept:
                authStore.effectiveDepartment || authStore.userDepartment || '战略发展部',
              action: 'distribute' as const,
              comment: `下发到 ${distributeTarget.value.join('、')}`,
              timestamp: new Date()
            }

            for (const [index, dept] of distributeTarget.value.entries()) {
              const targetOrgId = departmentNameIdMap.value.get(dept)
              if (!Number.isFinite(targetOrgId)) {
                throw new Error(`未找到部门 ${dept} 对应的组织ID`)
              }

              if (index === 0) {
                await indicatorApi.distributeIndicator({
                  parentIndicatorId: persistedIndicatorId,
                  targetOrgId: String(targetOrgId),
                  actorUserId: String(getCurrentActorUserId() || '')
                })
              } else {
                await strategicStore.addIndicator({
                  ...(row as StrategicIndicator & { taskId?: string | number }),
                  id: `${Date.now()}-${index}-${row.id}`,
                  parentIndicatorId: persistedIndicatorId,
                  taskId: getIndicatorTaskId(row) ?? undefined,
                  responsibleDept: dept,
                  ownerDept: '战略发展部',
                  canWithdraw: false,
                  progress: 0,
                  statusAudit: [newAuditEntry]
                })
              }
            }

            const approvalTriggerResult = await triggerApprovalForDistribution(row)
            if (!approvalTriggerResult.skipped) {
              ElMessage.info(
                `审批流已触发（实例ID: ${approvalTriggerResult.instanceId || '待回填'}，requestId: ${approvalTriggerResult.requestId || approvalTriggerResult.traceId}）`
              )
            } else {
              ElMessage.warning(
                `指标 ${row.id} 下发成功，但审批未触发（${approvalTriggerResult.reason}）`
              )
            }
          }
          ElMessage.success(
            `已成功下发 ${pendingRows.length} 个指标到 ${distributeTarget.value.length} 个部门`
          )
          closeDistributeDialog()
          await refreshTaskPageAfterIndicatorMutation()
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

        const persistedIndicatorId = String(row.id)
        if (!/^\d+$/.test(persistedIndicatorId)) {
          throw new Error(`指标 ${persistedIndicatorId} 尚未持久化，无法执行下发`)
        }

        // 构建审计记录
        const newAuditEntry = {
          id: `audit-${row.id}-${Date.now()}`,
          operator: String(getCurrentActorUserId() || 'admin'),
          operatorName: authStore.user?.name || '管理员',
          operatorDept: authStore.effectiveDepartment || authStore.userDepartment || '战略发展部',
          action: 'distribute' as const,
          comment: `下发到 ${distributeTarget.value.join('、')}`,
          timestamp: new Date()
        }

        // 为每个目标部门处理
        for (const [index, dept] of distributeTarget.value.entries()) {
          const targetOrgId = departmentNameIdMap.value.get(dept)
          if (!Number.isFinite(targetOrgId)) {
            throw new Error(`未找到部门 ${dept} 对应的组织ID`)
          }

          if (index === 0) {
            await indicatorApi.distributeIndicator({
              parentIndicatorId: persistedIndicatorId,
              targetOrgId: String(targetOrgId),
              actorUserId: String(getCurrentActorUserId() || '')
            })
          } else {
            await strategicStore.addIndicator({
              ...(row as StrategicIndicator & { taskId?: string | number }),
              id: `${Date.now()}-${index}-${row.id}`,
              parentIndicatorId: persistedIndicatorId,
              taskId: getIndicatorTaskId(row) ?? undefined,
              responsibleDept: dept,
              ownerDept: '战略发展部',
              canWithdraw: false,
              progress: 0,
              statusAudit: [newAuditEntry]
            })
          }
        }
        const approvalTriggerResult = await triggerApprovalForDistribution(row)
        ElMessage.success(`指标已成功下发到 ${distributeTarget.value.length} 个部门`)
        if (!approvalTriggerResult.skipped) {
          ElMessage.info(
            `审批流已触发（实例ID: ${approvalTriggerResult.instanceId || '待回填'}，requestId: ${approvalTriggerResult.requestId || approvalTriggerResult.traceId}）`
          )
        } else {
          ElMessage.warning(`下发成功，但审批未触发（${approvalTriggerResult.reason}）`)
        }
        closeDistributeDialog()
        await refreshTaskPageAfterIndicatorMutation()
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
  // 检查 Plan 状态：是否可以撤回
  if (!canWithdrawPlan.value) {
    if (currentPlanStatus.value === 'DISTRIBUTED') {
      ElMessage.warning('当前 Plan 已下发，无法撤回')
    } else if (currentPlanStatus.value === 'PENDING') {
      ElMessage.warning('当前审批进度不支持撤回')
    } else {
      ElMessage.warning('当前状态无法撤回')
    }
    return
  }

  ElMessageBox.confirm(`撤回后，该指标将重新变为可下发状态。确认撤回 "${row.name}"？`, '撤回操作', {
    confirmButtonText: '确认撤回',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(async () => {
      try {
        await strategicStore.withdrawIndicator(row.id.toString())
        await refreshTaskPageAfterIndicatorMutation()
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
        await refreshTaskPageAfterIndicatorMutation()
      }
    })
    .catch(() => {
      // 用户取消操作
    })
}

// 全部下发（下发当前界面所有未下发的指标）
const handleDistributeAll = async () => {
  if (!ensurePlanCanDistribute()) {
    return
  }

  // 检查是否有待审批的进度
  if (pendingApprovalCount.value > 0) {
    ElMessage.warning(`有 ${pendingApprovalCount.value} 个指标有待审批的进度，请先完成审批后再下发`)
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
        const approvalResults: Array<{
          skipped: boolean
          traceId?: string
          requestId?: string
          instanceId?: number
          reason?: string
        }> = []

        // 更新所有指标状态为已下发，并逐条触发审批流
        for (const row of pendingRows) {
          const indicatorId = String(row.id)
          const targetOrgId = departmentNameIdMap.value.get(row.responsibleDept)

          if (/^\d+$/.test(indicatorId) && Number.isFinite(targetOrgId)) {
            await indicatorApi.distributeIndicator({
              parentIndicatorId: indicatorId,
              targetOrgId: String(targetOrgId),
              actorUserId: String(getCurrentActorUserId() || '')
            })
          } else {
            throw new Error(`指标 ${indicatorId} 缺少持久化 ID 或目标部门映射，无法执行批量下发`)
          }

          const approvalTriggerResult = await triggerApprovalForDistribution(row)
          approvalResults.push(approvalTriggerResult)
        }

        // 重新从后端加载数据，确保前端状态与后端一致
        await refreshTaskPageAfterIndicatorMutation()

        loading.close()
        ElMessage.success({
          message: `已成功下发 ${pendingRows.length} 个指标`,
          duration: 5000,
          showClose: true
        })
        const triggered = approvalResults.filter(r => !r.skipped)
        if (triggered.length > 0) {
          const sample = triggered[0]
          ElMessage.info(
            `审批流已触发 ${triggered.length} 条（示例 实例ID: ${sample.instanceId || '待回填'}，requestId: ${sample.requestId || sample.traceId || 'N/A'}）`
          )
        } else {
          const firstSkipped = approvalResults[0]
          if (firstSkipped) {
            ElMessage.warning(
              `下发成功，但审批未触发（${firstSkipped.reason || 'unknown_reason'}）`
            )
          }
        }
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
        await refreshTaskPageAfterIndicatorMutation()
      }
    })
    .catch(() => {
      // 用户取消操作
    })
}

// 全部撤回（撤回当前界面所有已下发的指标）
const handleWithdrawAll = async () => {
  // 检查 Plan 状态：是否可以撤回
  if (!canWithdrawPlan.value) {
    if (isPlanDistributed.value) {
      ElMessage.warning('当前 Plan 已下发，无法撤回')
    } else if (currentPlanStatus.value === 'PENDING') {
      ElMessage.warning('当前审批进度不支持撤回')
    } else {
      ElMessage.warning('当前状态无法撤回')
    }
    return
  }

  const planId = Number(currentPlan.value?.id ?? NaN)
  if (!Number.isFinite(planId) || planId <= 0) {
    ElMessage.warning('当前没有可撤回的计划')
    return
  }

  ElMessageBox.confirm(
    '确认撤回当前部门的下发申请？撤回后，当前 Plan 将恢复为草稿状态。',
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
        message: '正在撤回 Plan...',
        type: 'info',
        duration: 0
      })

      try {
        await planStore.withdrawPlan(planId)
        if (currentPlan.value) {
          currentPlan.value = {
            ...currentPlan.value,
            status: 'DRAFT',
            workflowStatus: 'WITHDRAWN',
            canWithdraw: false,
            currentTaskId: undefined,
            currentStepName: undefined,
            currentApproverId: undefined,
            currentApproverName: undefined
          }
        }
        await planStore.loadPlans({ force: true, background: true })
        loading.close()
        ElMessage.success('已成功撤回当前 Plan')

        try {
          await refreshTaskPageAfterIndicatorMutation()
        } catch (refreshError) {
          logger.warn('[StrategicTaskView] Plan 撤回成功，但刷新指标列表失败:', refreshError)
          ElMessage.warning('Plan 已撤回成功，但指标列表刷新失败，请手动刷新页面确认最新状态')
        }

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
        await refreshTaskPageAfterIndicatorMutation()
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
  if (!ensurePlanCanDistribute()) {
    return
  }

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
  const distributedRows = getPersistedWithdrawableRows(group.rows)
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
          distributedRows.map(row => strategicStore.withdrawIndicator(row.id.toString()))
        )

        await refreshTaskPageAfterIndicatorMutation()

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
        await refreshTaskPageAfterIndicatorMutation()
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
    .then(async () => {
      const loading = ElLoading.service({
        lock: true,
        text: '正在批量删除并刷新数据...',
        background: 'rgba(0, 0, 0, 0.5)'
      })

      try {
        await Promise.all(group.rows.map(row => strategicStore.deleteIndicator(row.id.toString())))
        await refreshTaskPageAfterIndicatorMutation()
        ElMessage.success(`已成功删除 ${group.rows.length} 个指标`)
        updateEditTime()
      } catch (error) {
        logger.error('[StrategicTaskView] 批量删除指标失败:', error)
        ElMessage.error('批量删除失败，请稍后重试')
      } finally {
        loading.close()
      }
    })
    .catch(() => {
      // 用户取消操作
    })
}

// 删除单个指标
const handleDeleteIndicator = (row: StrategicIndicator) => {
  const indicatorId = row?.id
  if (indicatorId === null || indicatorId === undefined || indicatorId === '') {
    ElMessage.warning('当前行不是可删除的指标数据')
    return
  }

  ElMessageBox.confirm(`确定要删除指标 "${row.name}" 吗？删除后无法恢复。`, '删除确认', {
    confirmButtonText: '确定删除',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(async () => {
      const loading = ElLoading.service({
        lock: true,
        text: '正在删除指标并刷新数据...',
        background: 'rgba(0, 0, 0, 0.5)'
      })

      try {
        await strategicStore.deleteIndicator(indicatorId.toString())
        await refreshTaskPageAfterIndicatorMutation()
        ElMessage.success('指标已删除')
        updateEditTime()
      } catch (error) {
        logger.error('[StrategicTaskView] 删除指标失败:', error)
        ElMessage.error('删除失败，请稍后重试')
      } finally {
        loading.close()
      }
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
    const userId = getCurrentActorUserId() || 1
    const response = await taskApprovalApi.countPendingApprovals(userId)
    if (response.success && response.data !== undefined) {
      pendingPlanApprovalCount.value = response.data
    }
  } catch (error) {
    const msg =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : '未知错误'
    logger.error('[StrategicTaskView] 加载待审批计划数量失败:', msg)
  }
}

// 组件挂载时加载待审批计划数量
onMounted(() => {
  loadPendingPlanApprovalCount()
})

// 任务类别颜色映射
const getCategoryColor = (type2: string) => {
  if (type2 === '发展性') {
    return '#409EFF'
  }
  if (type2 === '基础性') {
    return '#67C23A'
  }
  return '#909399'
}

const getCategoryText = (type2?: string): string => {
  if (type2 === '发展性' || type2 === '基础性') {
    return type2
  }
  return '其他'
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
      isOverdue = _currentDate > deadlineDate
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
            :type="distributeButtonType"
            size="small"
            :disabled="distributeButtonDisabled"
            :title="distributeButtonDisabledReason"
            @click.stop="handleDistributeOrWithdraw"
          >
            <el-icon><component :is="distributeButtonIcon" /></el-icon>
            {{ distributeButtonText }}
          </el-button>
          <!-- 审批进度按钮（带徽章） -->
          <el-badge v-if="pendingApprovalCount > 0" is-dot class="approval-badge">
            <el-button size="small" type="warning" @click="handleOpenApproval">
              <el-icon><Check /></el-icon>
              {{ approvalEntryButtonText }}
            </el-button>
          </el-badge>
          <el-button v-else size="small" @click="handleOpenApproval">
            <el-icon><Check /></el-icon>
            {{ approvalEntryButtonText }}
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
            状态: {{ isInitialDataLoading ? '加载中...' : overallStatus.label }}
          </el-tag>
          <el-tag
            :type="departmentTotalWeight === 100 ? 'success' : 'danger'"
            size="small"
            style="margin-right: 12px"
          >
            基础性权重合计: {{ departmentTotalWeight }} / 100
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
        <template #title> 当前计划已进入审批流程，请先完成整体计划审批后再继续下发或编辑 </template>
      </el-alert>

      <!-- Excel表格 -->
      <div class="excel-table-wrapper">
        <div v-if="isInitialDataLoading" class="page-loading-state">
          <div class="loading-header">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span>正在加载指标数据，请稍候...</span>
          </div>
          <el-skeleton :rows="8" animated />
        </div>

        <template v-else>
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
                      <span
                        v-else-if="isSavingIndicatorCell(row, 'taskContent')"
                        class="cell-saving-text"
                      >
                        保存中...
                      </span>
                      <el-tooltip
                        v-else
                        :content="`${getCategoryText(row.type2)}任务`"
                        placement="top"
                      >
                        <span
                          class="indicator-name-text task-content-colored"
                          :style="{ color: getCategoryColor(row.type2) }"
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
                    <span v-else-if="isSavingIndicatorCell(row, 'name')" class="cell-saving-text">
                      保存中...
                    </span>
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
                  <div
                    class="indicator-name-cell"
                    @dblclick="handleIndicatorDblClick(row, 'remark')"
                  >
                    <el-input
                      v-if="editingIndicatorId === row.id && editingIndicatorField === 'remark'"
                      v-model="editingIndicatorValue"
                      v-focus
                      type="textarea"
                      :autosize="{ minRows: 2, maxRows: 6 }"
                      @blur="saveIndicatorEdit(row, 'remark')"
                      @keyup.esc="cancelIndicatorEdit"
                    />
                    <span v-else-if="isSavingIndicatorCell(row, 'remark')" class="cell-saving-text">
                      保存中...
                    </span>
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
                    <span v-else-if="isSavingIndicatorCell(row, 'weight')" class="cell-saving-text">
                      保存中...
                    </span>
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
                    <span
                      v-else-if="isSavingIndicatorCell(row, 'progress')"
                      class="cell-saving-text"
                    >
                      保存中...
                    </span>
                    <!-- 始终显示已审批通过的进度（progress），不显示待审批进度 -->
                    <span v-else class="progress-number">{{ row.progress || 0 }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="180" align="center">
                <template #default="{ row }">
                  <div class="action-buttons-inline">
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
                      {{ getCategoryText(currentIndicator.type2) }}任务
                    </el-tag>
                    <el-tag v-if="currentPlanStatus === 'PENDING'" type="warning" size="small">
                      计划审批中
                    </el-tag>
                  </div>
                </div>
                <div class="card-actions">
                  <el-button
                    type="primary"
                    size="small"
                    @click="handleViewDetail(currentIndicator)"
                  >
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

                    <div
                      v-if="currentIndicatorWorkflowLoading"
                      class="workflow-progress-card is-loading"
                    >
                      <span class="workflow-progress-hint">正在加载该指标的审批流信息...</span>
                    </div>

                    <div v-else-if="currentIndicatorWorkflow" class="workflow-progress-card">
                      <div class="workflow-progress-header">
                        <span class="workflow-progress-title">报告审批流</span>
                        <el-tag
                          size="small"
                          :type="getIndicatorWorkflowTagType(currentIndicatorWorkflow)"
                        >
                          {{ getIndicatorWorkflowStatusLabel(currentIndicatorWorkflow) }}
                        </el-tag>
                      </div>
                      <div class="workflow-progress-grid">
                        <div class="workflow-progress-item">
                          <span class="workflow-progress-label">当前节点</span>
                          <span class="workflow-progress-value">{{
                            currentIndicatorWorkflow.currentStepName || '审批中'
                          }}</span>
                        </div>
                        <div class="workflow-progress-item">
                          <span class="workflow-progress-label">当前审批人</span>
                          <span class="workflow-progress-value">{{
                            currentIndicatorWorkflow.currentApproverName || '待分配'
                          }}</span>
                        </div>
                      </div>
                      <div
                        v-if="canCurrentUserHandleCurrentIndicatorWorkflow"
                        class="workflow-progress-actions"
                      >
                        <el-button
                          size="small"
                          type="success"
                          @click="handleApproveCurrentIndicatorWorkflow"
                        >
                          审批通过
                        </el-button>
                        <el-button
                          size="small"
                          type="danger"
                          plain
                          @click="handleRejectCurrentIndicatorWorkflow"
                        >
                          审批驳回
                        </el-button>
                      </div>
                      <div
                        v-else-if="currentIndicatorWorkflow.currentApproverName"
                        class="workflow-progress-hint"
                      >
                        当前节点审批人为
                        {{ currentIndicatorWorkflow.currentApproverName }}，你当前仅可查看。
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
                            resolveMilestoneDisplayState(milestone, currentIndicator.progress)
                              .tagType
                          "
                        >
                          {{
                            resolveMilestoneDisplayState(milestone, currentIndicator.progress).label
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
        </template>

        <!-- 新增行表单 -->
        <div v-if="isAddingOrEditing" ref="addRowFormRef" class="add-row-form">
          <h3 class="form-title">新增任务指标</h3>
          <div class="add-form-content">
            <el-form label-width="80px">
              <el-row :gutter="16">
                <el-col :span="4">
                  <el-form-item class="required-form-item">
                    <template #label><span class="required-asterisk">*</span>任务类型</template>
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
                  <el-form-item class="required-form-item">
                    <template #label><span class="required-asterisk">*</span>战略任务</template>
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
                  <el-form-item class="required-form-item">
                    <template #label><span class="required-asterisk">*</span>指标类型</template>
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
                  <el-form-item class="required-form-item">
                    <template #label><span class="required-asterisk">*</span>权重</template>
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
                  <el-form-item class="required-form-item">
                    <template #label><span class="required-asterisk">*</span>核心指标</template>
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
                  <el-form-item class="required-form-item">
                    <template #label><span class="required-asterisk">*</span>里程碑</template>
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
            </el-form>
          </div>
          <div class="add-form-actions">
            <el-button type="primary" @click="saveNewRow">保存</el-button>
            <el-button @click="cancelAdd">取消</el-button>
          </div>
        </div>
      </div>

      <!-- Excel状态栏 -->
      <div class="excel-status-bar">
        <div class="status-left">
          {{ isInitialDataLoading ? '正在加载数据...' : `共 ${indicators.length} 条记录` }}
        </div>
        <div class="status-right">
          {{ isInitialDataLoading ? '最后编辑: --' : `最后编辑: ${lastEditTime}` }}
        </div>
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
              {{ getCategoryText(currentDetail.type2) }}任务
            </el-tag>
          </div>
        </div>

        <el-descriptions :column="2" border class="detail-desc">
          <el-descriptions-item label="战略任务" :span="2">{{
            currentDetail.taskContent
          }}</el-descriptions-item>
          <el-descriptions-item label="任务类别"
            >{{ getCategoryText(currentDetail.type2) }}任务</el-descriptions-item
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
            formatDetailDate(currentDetail.createTime)
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
              v-for="(milestone, index) in getSortedMilestones(currentDetail.milestones)"
              :key="index"
              :timestamp="milestone.deadline"
              :type="resolveMilestoneDisplayState(milestone, currentDetail.progress).timelineType"
              placement="top"
            >
              <div class="timeline-card">
                <div class="timeline-header">
                  <span class="action-text">{{ milestone.name }}</span>
                  <el-tag
                    size="small"
                    :type="resolveMilestoneDisplayState(milestone, currentDetail.progress).tagType"
                  >
                    {{ resolveMilestoneDisplayState(milestone, currentDetail.progress).label }}
                  </el-tag>
                </div>
                <div class="timeline-comment">目标进度: {{ milestone.targetProgress }}%</div>
              </div>
            </el-timeline-item>
          </el-timeline>
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
          <p><strong>任务类别：</strong>{{ getCategoryText(currentDistributeItem.type2) }}任务</p>
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

    <el-dialog
      v-model="approvalSetupDialogVisible"
      title="确认审批流程"
      width="640px"
      :close-on-click-modal="false"
      @close="handleCloseApprovalSetupDialog"
    >
      <div v-loading="approvalPreviewLoading" class="approval-setup-dialog">
        <div v-if="currentPlan" class="approval-setup-summary">
          <div class="summary-row">
            <span class="summary-label">当前计划：</span>
            <span class="summary-value">{{
              currentPlan.name || currentPlan.taskName || selectedDepartment || '当前计划'
            }}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">审批流程：</span>
            <span class="summary-value">
              {{ approvalWorkflowPreview?.workflowName || PLAN_APPROVAL_SUBMIT_WORKFLOW_CODE }}
            </span>
          </div>
        </div>

        <el-empty
          v-if="!approvalPreviewLoading && !hasApprovalPreview"
          description="暂未加载到审批流程定义"
          :image-size="88"
        />

        <div v-else class="approval-step-list">
          <div
            v-for="step in approvalWorkflowPreview?.steps || []"
            :key="step.stepDefId"
            class="approval-step-item"
          >
            <div class="approval-step-header">
              <div class="approval-step-name">{{ step.stepOrder }}. {{ step.stepName }}</div>
              <el-tag type="info" size="small"> 系统自动分配 </el-tag>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="handleCloseApprovalSetupDialog">取消</el-button>
        <el-button
          type="primary"
          :loading="approvalSubmitting"
          :disabled="approvalPreviewLoading || !hasApprovalPreview || departmentTotalWeight !== 100"
          @click="confirmPlanApprovalSubmission"
        >
          确认发起审批
        </el-button>
      </template>
    </el-dialog>

    <!-- 任务审批抽屉 -->
    <ApprovalProgressDrawer
      v-model="taskApprovalVisible"
      :indicators="approvalIndicators"
      :plan="currentPlan"
      :initial-plan-workflow-detail="preloadedPlanWorkflowDetail"
      :department-name="selectedDepartment"
      :plan-name="currentPlan?.taskName || currentPlan?.name || selectedDepartment"
      :show-plan-approvals="true"
      :show-approval-section="true"
      :workflow-code="PLAN_APPROVAL_HISTORY_WORKFLOW_CODES"
      :workflow-entity-type="primaryApprovalWorkflowEntityType"
      :workflow-entity-id="primaryApprovalWorkflowEntityId"
      :secondary-workflow-entity-type="secondaryApprovalWorkflowEntityType"
      :secondary-workflow-entity-id="secondaryApprovalWorkflowEntityId"
      approval-type="submission"
      @close="taskApprovalVisible = false"
      @refresh="handleApprovalRefresh"
    />

    <!-- 里程碑编辑弹窗 -->
    <el-dialog
      v-model="milestoneEditDialogVisible"
      title="编辑里程碑"
      width="700px"
      :close-on-click-modal="false"
      :close-on-press-escape="!isSavingMilestoneEdit"
      :show-close="!isSavingMilestoneEdit"
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
                @change="handleMilestoneDeadlineChange"
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
        <el-button :disabled="isSavingMilestoneEdit" @click="cancelMilestoneEdit">取消</el-button>
        <el-button type="primary" :loading="isSavingMilestoneEdit" @click="saveMilestoneEdit">
          保存
        </el-button>
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

.page-loading-state {
  margin: var(--spacing-md);
  padding: var(--spacing-lg);
  border: 1px solid var(--border-color-light);
  border-radius: 10px;
  background: #fff;
}

.loading-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: var(--spacing-md);
  color: var(--text-regular);
  font-size: 14px;
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
  position: relative;
  display: flex;
  flex-direction: column;
  background: rgba(64, 158, 255, 0.08);
  padding: var(--spacing-lg);
  padding-bottom: 72px;
  border-top: 1px solid var(--color-primary-light);
  overflow-x: hidden;
}

.add-form-content {
  flex: 1 1 auto;
  padding-right: 4px;
}

.add-form-actions {
  position: sticky;
  bottom: calc(var(--spacing-lg) * -1);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin: auto calc(var(--spacing-lg) * -1) calc(var(--spacing-lg) * -1);
  padding: 12px var(--spacing-lg);
  background: transparent;
  border-top: none;
  box-shadow: none;
  z-index: 10;
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

.required-form-item :deep(.el-form-item__label) {
  color: var(--text-primary, #303133);
}

.required-asterisk {
  color: var(--color-danger, #f56c6c);
  margin-right: 4px;
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

.cell-saving-text {
  font-size: 13px;
  color: var(--primary-color, #409eff);
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

.workflow-progress-card {
  padding: var(--spacing-lg);
  background: rgba(24, 144, 255, 0.08);
  border-radius: var(--radius-md);
  border-left: 4px solid var(--color-primary);
}

.workflow-progress-card.is-loading {
  border-left-color: var(--color-info);
}

.workflow-progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.workflow-progress-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
}

.workflow-progress-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-md);
}

.workflow-progress-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.workflow-progress-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.workflow-progress-value {
  font-size: 14px;
  color: var(--text-main);
  font-weight: 500;
}

.workflow-progress-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
}

.workflow-progress-hint {
  margin-top: var(--spacing-md);
  font-size: 13px;
  color: var(--text-secondary);
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

.approval-badge {
  display: inline-flex;
}

.approval-badge :deep(.el-badge__content.is-fixed.is-dot) {
  background-color: #f56c6c;
  box-shadow: 0 0 0 rgba(245, 108, 108, 0.45);
  animation: approval-badge-pulse 1.35s ease-in-out infinite;
  transform-origin: center;
}

@keyframes approval-badge-pulse {
  0% {
    opacity: 0.9;
    transform: scale(0.92);
    box-shadow: 0 0 0 0 rgba(245, 108, 108, 0.5);
  }

  45% {
    opacity: 1;
    transform: scale(1.18);
    box-shadow: 0 0 0 6px rgba(245, 108, 108, 0.08);
  }

  100% {
    opacity: 0.95;
    transform: scale(0.92);
    box-shadow: 0 0 0 0 rgba(245, 108, 108, 0);
  }
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

.approval-setup-dialog {
  min-height: 220px;
}

.approval-setup-summary {
  margin-bottom: 16px;
  padding: 12px 14px;
  background: var(--el-fill-color-light);
  border-radius: 10px;
}

.summary-row + .summary-row {
  margin-top: 8px;
}

.summary-label {
  color: var(--el-text-color-secondary);
}

.summary-value {
  color: var(--el-text-color-primary);
  font-weight: 500;
}

.approval-step-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.approval-step-item {
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  padding: 14px;
  background: #fff;
}

.approval-step-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.approval-step-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.approval-step-readonly {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.approval-user-option {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.approval-user-org {
  color: var(--el-text-color-secondary);
  font-size: 12px;
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
