<script setup lang="ts">
/**
 * 指标下发与审批页面（职能部门专用）
 * 功能：接收战略任务 → 查看战略指标 → 拆分子指标 → 下发给学院 → 审批学院提交
 */
import { ref, computed, reactive, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { Plus, Promotion, Check, Close, View, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { StrategicIndicator, StrategicTask } from '@/types'
import { useStrategicStore } from '@/stores/strategic'
import { useAuthStore } from '@/stores/auth'
import { useTimeContextStore } from '@/stores/timeContext'
import { getAllColleges } from '@/config/departments'
import AuditLogDrawer from '@/components/task/AuditLogDrawer.vue'

// Stores
const strategicStore = useStrategicStore()
const authStore = useAuthStore()
const timeContext = useTimeContextStore()

// 当前用户部门
const currentDept = computed(() => authStore.userDepartment || '')

// 判断是否为战略发展部（只能查看，不能编辑）
const isStrategicDept = computed(() => {
  return authStore.userRole === 'strategic_dept' || currentDept.value === '战略发展部'
})

// 判断是否为职能部门（可以编辑子指标）
const isFunctionalDept = computed(() => {
  return authStore.userRole === 'functional_dept' || 
         (!isStrategicDept.value && currentDept.value !== '')
})

// 只读模式：战略发展部或者历史快照模式
const isReadOnly = computed(() => timeContext.isReadOnly || isStrategicDept.value)

// 是否可以编辑子指标（只有职能部门可以）
const canEditChild = computed(() => isFunctionalDept.value && !timeContext.isReadOnly)

// 获取所有学院
const colleges = getAllColleges()

// ================== 侧边栏模式切换 ==================
// 侧边栏模式：'task' = 按战略任务查看，'college' = 按学院查看
const sidebarMode = ref<'task' | 'college'>('task')

// 当前选中的战略任务
const selectedTask = ref<StrategicTask | null>(null)

// 当前选中的学院
const selectedCollege = ref<string | null>(null)

// 搜索关键词
const searchKeyword = ref('')

// 审计日志
const auditLogVisible = ref(false)
const currentAuditIndicator = ref<StrategicIndicator | null>(null)

// ================== 数据获取 ==================

// 获取战略任务列表（从战略发展部下发的）
const strategicTasks = computed(() => {
  return strategicStore.tasks.filter(t => t.status === 'active')
})

// 筛选后的战略任务
const filteredTasks = computed(() => {
  if (!searchKeyword.value) return strategicTasks.value
  const keyword = searchKeyword.value.toLowerCase()
  return strategicTasks.value.filter(t =>
    t.title.toLowerCase().includes(keyword) ||
    t.desc.toLowerCase().includes(keyword)
  )
})

// 计算任务进度（基于其下属指标的平均进度）
const getTaskProgress = (task: StrategicTask) => {
  const taskIndicators = strategicStore.indicators.filter(i => 
    i.taskContent === task.title && i.isStrategic
  )
  if (taskIndicators.length === 0) return 0
  const total = taskIndicators.reduce((sum, i) => sum + (i.progress || 0), 0)
  return Math.round(total / taskIndicators.length)
}

// 获取选中任务下的战略指标（一级指标）
const taskIndicators = computed(() => {
  if (!selectedTask.value) return []
  return strategicStore.indicators.filter(i =>
    i.isStrategic &&
    i.taskContent === selectedTask.value!.title
  )
})

// 筛选后的学院列表（用于侧边栏搜索）
const filteredColleges = computed(() => {
  if (!searchKeyword.value) return colleges
  const keyword = searchKeyword.value.toLowerCase()
  return colleges.filter(c => c.toLowerCase().includes(keyword))
})

// 获取学院的子指标数量
const getCollegeChildCount = (college: string) => {
  return strategicStore.indicators.filter(i => {
    if (i.isStrategic) return false
    // 支持字符串或数组格式的 responsibleDept
    if (Array.isArray(i.responsibleDept)) {
      return i.responsibleDept.includes(college)
    }
    return i.responsibleDept === college
  }).length
}

// 获取选中学院的所有子指标（按父指标分组）
const collegeIndicators = computed(() => {
  if (!selectedCollege.value) return []
  
  // 获取所有下发给该学院的子指标
  const childIndicators = strategicStore.indicators.filter(i => {
    if (i.isStrategic) return false
    // 支持字符串或数组格式的 responsibleDept
    if (Array.isArray(i.responsibleDept)) {
      return i.responsibleDept.includes(selectedCollege.value!)
    }
    return i.responsibleDept === selectedCollege.value
  })
  
  // 获取这些子指标的父指标
  const parentIds = new Set(childIndicators.map(c => c.parentIndicatorId).filter(Boolean))
  const parentIndicators = strategicStore.indicators.filter(i =>
    i.isStrategic && parentIds.has(i.id.toString())
  )
  
  return parentIndicators
})

// 获取指标的子指标
const getChildIndicators = (parentId: string) => {
  return strategicStore.indicators.filter(i => 
    i.parentIndicatorId === parentId && !i.isStrategic
  )
}

// ================== 子指标新增相关 ==================

// 里程碑接口
// 本地里程碑接口（用于编辑）
interface LocalMilestone {
  id: string
  name: string
  expectedDate: string
  progress: number  // 0-100
}

// 新增子指标的临时存储（按父指标ID分组）
interface NewChildIndicator {
  id: string
  name: string
  college: string[]  // 改为数组支持多选
  targetValue: number
  unit: string
  weight: number
  remark: string
  type1: '定量' | '定性'  // 指标类型
  targetProgress: number  // 定量指标目标进度 0-100
  milestones: LocalMilestone[]  // 定性指标里程碑列表
  isNew: boolean  // 标记是否为新增的未保存行
}

// 导出供模板使用
type NewChild = NewChildIndicator

const newChildIndicators = reactive<Record<string, NewChildIndicator[]>>({})

// 正在添加子指标的父指标ID
const addingParentId = ref<string | null>(null)

// 当前正在编辑的新增子指标ID（用于点击外部保存）
const editingNewChildId = ref<string | null>(null)

// 验证并保存新增子指标（点击外部时调用）
const validateAndSaveNewChild = (parentId: string, childId: string) => {
  const children = newChildIndicators[parentId]
  if (!children) return
  
  const childIndex = children.findIndex(c => c.id === childId)
  if (childIndex === -1) return
  
  const child = children[childIndex]
  
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
const addNewChildRow = (parentIndicatorId: string) => {
  if (!canEditChild.value) {
    ElMessage.warning('您没有权限添加子指标')
    return
  }
  
  // 如果有正在编辑的新增子指标，先保存它
  if (editingNewChildId.value && addingParentId.value) {
    validateAndSaveNewChild(addingParentId.value, editingNewChildId.value)
  }
  
  // 获取父指标信息（从任务模式或学院模式）
  const parentIndicator = sidebarMode.value === 'task'
    ? taskIndicators.value.find(i => i.id.toString() === parentIndicatorId)
    : collegeIndicators.value.find(i => i.id.toString() === parentIndicatorId)
  
  if (!newChildIndicators[parentIndicatorId]) {
    newChildIndicators[parentIndicatorId] = []
  }
  
  const newChildId = `new-${Date.now()}`
  
  // 在学院模式下，自动设置当前选中的学院
  const defaultCollege = sidebarMode.value === 'college' && selectedCollege.value 
    ? [selectedCollege.value] 
    : []
  
  newChildIndicators[parentIndicatorId].push({
    id: newChildId,
    name: parentIndicator?.name || '',  // 继承父指标名称
    college: defaultCollege,
    targetValue: 100,
    unit: '%',
    weight: 10,
    remark: parentIndicator?.remark || '',  // 继承父指标说明
    type1: '定量',  // 默认定量指标
    targetProgress: 100,  // 定量指标默认目标进度100%
    milestones: [],  // 定性指标里程碑列表
    isNew: true
  })
  
  addingParentId.value = parentIndicatorId
  editingNewChildId.value = newChildId  // 设置当前编辑的新增子指标
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
  ElMessageBox.confirm(
    `确认删除子指标"${child.name}"？此操作不可恢复。`,
    '删除确认',
    {
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    strategicStore.removeIndicator(child.id.toString())
    ElMessage.success('已删除子指标')
  }).catch(() => {
    // 取消删除
  })
}

// 获取所有待下发的子指标数量
const getPendingChildCount = (parentId: string) => {
  return (newChildIndicators[parentId] || []).length
}

// 下发所有新增的子指标
const distributeNewChildren = (parentIndicator: StrategicIndicator) => {
  const parentId = parentIndicator.id.toString()
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
  
  ElMessageBox.confirm(
    `确认下发 ${children.length} 个子指标到对应学院？`,
    '下发确认',
    {
      confirmButtonText: '确认下发',
      cancelButtonText: '取消',
      type: 'info'
    }
  ).then(() => {
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
        milestones: child.type1 === '定性' ? child.milestones.map(m => ({
          id: m.id,
          name: m.name,
          targetProgress: m.progress,
          deadline: m.expectedDate,
          status: 'pending' as const
        })) : [],
        targetValue: child.type1 === '定量' ? child.targetProgress : child.milestones.length,
        unit: child.type1 === '定量' ? '%' : '个里程碑',
        responsibleDept: Array.isArray(child.college) ? child.college.join(',') : child.college,
        responsiblePerson: '',
        status: 'active',
        isStrategic: false,
        ownerDept: currentDept.value,
        parentIndicatorId: parentId,
        year: timeContext.currentYear,
        statusAudit: [{
          id: `audit-${Date.now()}`,
          timestamp: new Date(),
          operator: authStore.user?.id || 'admin',
          operatorName: authStore.user?.name || '管理员',
          operatorDept: currentDept.value,
          action: 'distribute',
          comment: '下发子指标'
        }]
      }
      strategicStore.addIndicator(newIndicator)
    })
    
    // 清空临时数据
    delete newChildIndicators[parentId]
    addingParentId.value = null
    
    ElMessage.success(`已成功下发 ${children.length} 个子指标`)
  })
}

// ================== 子指标编辑相关 ==================

// 当前编辑的子指标
const editingChildId = ref<string | null>(null)
const editingChildField = ref<string | null>(null)
const editingChildValue = ref<any>(null)

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
    // 检查是否点击在三角形添加按钮上
    const isInAddTrigger = !!target.closest('.add-child-trigger')
    
    if (!isInNewChildRow && !isInPopper && !isInAddTrigger) {
      // 点击在新增行外部，保存并退出编辑
      validateAndSaveNewChild(addingParentId.value, editingNewChildId.value)
    }
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleGlobalMousedown, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleGlobalMousedown, true)
})

// 双击编辑子指标
const handleChildDblClick = (child: StrategicIndicator, field: string) => {
  if (!canEditChild.value) return
  
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
      const input = editingEl.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement
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

// 保存子指标编辑
const saveChildEdit = (child: StrategicIndicator, field: string) => {
  if (editingChildId.value === null) return
  
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
  
  const updates: Partial<StrategicIndicator> = {
    [field]: valueToSave
  }
  
  strategicStore.updateIndicator(child.id.toString(), updates)
  
  cancelChildEdit()
}

// 学院选择器下拉框可见性变化
const handleCollegeSelectClose = (visible: boolean) => {
  collegeDropdownVisible.value = visible
}

// 学院选择器失焦处理
const handleCollegeSelectBlur = (child: StrategicIndicator) => {
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
    if (editingChildId.value === child.id.toString() && 
        editingChildField.value === 'responsibleDept') {
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

// ================== 任务选择 ==================

const selectTask = (task: StrategicTask) => {
  selectedTask.value = task
  // 清空之前的临时数据
  Object.keys(newChildIndicators).forEach(key => {
    delete newChildIndicators[key]
  })
  addingParentId.value = null
}

// ================== 审批相关 ==================

// 审批通过
const handleApprove = (indicator: StrategicIndicator) => {
  ElMessageBox.confirm('确认通过该学院的进度提交？', '审批确认', {
    confirmButtonText: '通过',
    cancelButtonText: '取消',
    type: 'success'
  }).then(() => {
    strategicStore.addStatusAuditEntry(indicator.id.toString(), {
      operator: authStore.user?.id || 'admin',
      operatorName: authStore.user?.name || '管理员',
      operatorDept: currentDept.value,
      action: 'approve',
      comment: '审批通过'
    })
    ElMessage.success('审批通过')
  })
}

// 打回（退回给下级部门重新提交）
const handleReject = (indicator: StrategicIndicator) => {
  ElMessageBox.prompt('请输入打回原因', '打回确认', {
    confirmButtonText: '确认打回',
    cancelButtonText: '取消',
    type: 'warning',
    inputType: 'textarea',
    inputPlaceholder: '请输入打回原因（选填）'
  }).then(({ value }) => {
    strategicStore.addStatusAuditEntry(indicator.id.toString(), {
      operator: authStore.user?.id || 'admin',
      operatorName: authStore.user?.name || '管理员',
      operatorDept: currentDept.value,
      action: 'reject',
      comment: value || '打回重新提交'
    })
    ElMessage.success('已打回，等待下级部门重新提交')
  })
}

// 查看详情
const handleViewDetail = (indicator: StrategicIndicator) => {
  currentAuditIndicator.value = indicator
  auditLogVisible.value = true
}

// 获取子指标状态
// 状态流转：distributed(已下发) → pending(待审批，下级提交后) → approved(已通过)
// 打回后回到 distributed 状态
const getChildStatus = (child: StrategicIndicator) => {
  const audit = child.statusAudit || []
  if (audit.length === 0) return 'distributed'
  const lastAudit = audit[audit.length - 1]
  if (!lastAudit) return 'distributed'
  const lastAction = lastAudit.action
  // 下级部门提交后变为待审批
  if (lastAction === 'submit') return 'pending'
  // 审批通过
  if (lastAction === 'approve') return 'approved'
  // 打回后回到已下发状态，等待重新提交
  if (lastAction === 'reject') return 'distributed'
  // 初始下发状态
  if (lastAction === 'distribute') return 'distributed'
  return 'distributed'
}

// 获取状态标签类型
const getStatusTagType = (status: string) => {
  switch (status) {
    case 'distributed': return 'info'      // 已下发 - 蓝色
    case 'pending': return 'warning'       // 待审批 - 橙色
    case 'approved': return 'success'      // 已通过 - 绿色
    default: return 'info'
  }
}

// 获取状态文本
const getStatusText = (status: string) => {
  switch (status) {
    case 'distributed': return '已下发'
    case 'pending': return '待审批'
    case 'approved': return '已通过'
    default: return '已下发'
  }
}

// 格式化学院显示（完整列表）
const formatColleges = (depts: string | string[] | undefined): string => {
  if (!depts) return '-'
  if (Array.isArray(depts)) return depts.join('、')
  return depts.split(',').join('、')
}

// 格式化学院显示（简短版，超过2个显示+N）
const formatCollegesShort = (depts: string | string[] | undefined): string => {
  if (!depts) return '-'
  const arr = Array.isArray(depts) ? depts : depts.split(',')
  if (arr.length <= 2) return arr.join('、')
  return `${arr.slice(0, 2).join('、')} +${arr.length - 2}`
}

// 解析学院字符串为数组（用于编辑时）
const parseColleges = (depts: string | string[] | undefined): string[] => {
  if (!depts) return []
  if (Array.isArray(depts)) return depts
  return depts.split(',')
}

// 获取任务类型对应的颜色（基于指标的type2：发展性/基础性）
const getTaskTypeColor = (type2: string) => {
  return type2 === '发展性' ? '#409EFF' : '#67C23A'
}

// 获取指标类型颜色（定性/定量）
const getIndicatorTypeColor = (type1: string) => {
  return type1 === '定性' ? 'var(--color-qualitative, #9333ea)' : 'var(--color-quantitative, #0891b2)'
}

// 处理子指标类型变更
const handleChildTypeChange = (child: NewChildIndicator | StrategicIndicator, newType: '定量' | '定性') => {
  if ('isNew' in child && child.isNew) {
    // 新增的子指标
    child.type1 = newType
    if (newType === '定量') {
      child.targetProgress = 100
      child.milestones = []
    } else {
      child.targetProgress = 0
      child.milestones = []
    }
  } else {
    // 已有的子指标
    const updates: Partial<StrategicIndicator> = {
      type1: newType,
      isQualitative: newType === '定性',
      targetValue: newType === '定量' ? 100 : 0,
      milestones: []
    }
    strategicStore.updateIndicator((child as StrategicIndicator).id.toString(), updates)
    cancelChildEdit()
  }
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

// 添加里程碑
const addMilestone = () => {
  const lastProgress = editingMilestones.value.length > 0 
    ? editingMilestones.value[editingMilestones.value.length - 1]?.progress ?? 0
    : 0
  editingMilestones.value.push({
    id: `ms-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: '',
    expectedDate: '',
    progress: lastProgress
  })
}

// 删除里程碑
const removeMilestone = (index: number) => {
  editingMilestones.value.splice(index, 1)
}

// 验证里程碑进度（后面的不能小于前面的）
const validateMilestoneProgress = (index: number) => {
  const current = editingMilestones.value[index]
  if (!current) return
  
  // 检查是否小于前一个里程碑的进度
  if (index > 0) {
    const prev = editingMilestones.value[index - 1]
    if (prev && current.progress < prev.progress) {
      ElMessage.warning(`第 ${index + 1} 个里程碑的进度不能小于第 ${index} 个里程碑的进度 (${prev.progress}%)`)
      current.progress = prev.progress
      return
    }
  }
  
  // 检查是否大于后一个里程碑的进度
  if (index < editingMilestones.value.length - 1) {
    const next = editingMilestones.value[index + 1]
    if (next && current.progress > next.progress) {
      ElMessage.warning(`第 ${index + 1} 个里程碑的进度不能大于第 ${index + 2} 个里程碑的进度 (${next.progress}%)`)
      current.progress = next.progress
      return
    }
  }
}

// 保存里程碑
const saveMilestones = () => {
  if (!editingMilestonesChild.value) return
  
  const child = editingMilestonesChild.value
  if ('isNew' in child && child.isNew) {
    child.milestones = JSON.parse(JSON.stringify(editingMilestones.value))
  } else {
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
    strategicStore.updateIndicator((child as StrategicIndicator).id.toString(), updates)
  }
  
  milestonesDialogVisible.value = false
  editingMilestonesChild.value = null
  editingMilestones.value = []
}

// 格式化里程碑显示
const formatMilestones = (child: StrategicIndicator | NewChildIndicator): string => {
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
const isMilestoneCompleted = (child: StrategicIndicator | NewChildIndicator, milestoneProgress: number): boolean => {
  if ('isNew' in child && child.isNew) {
    return false // 新增的子指标还没有进度
  }
  const indicator = child as StrategicIndicator
  return (indicator.progress || 0) >= milestoneProgress
}

// ================== 表格数据处理 ==================

// 构建扁平化表格数据（用于单元格合并）
// 每一行代表一个子指标（或待添加的子指标），父指标信息作为属性存储
interface TableRowData {
  type: 'child' | 'new-child' | 'indicator-only'  // indicator-only 表示没有子指标的父指标
  taskTitle: string
  indicator: StrategicIndicator  // 父指标
  child?: StrategicIndicator | NewChildIndicator  // 子指标
  parentIndicatorId: string
  rowIndex?: number  // 新增子指标的索引
}

// 扁平化表格数据
const flatTableData = computed(() => {
  if (!selectedTask.value) return []
  
  const data: TableRowData[] = []
  const indicators = taskIndicators.value
  
  indicators.forEach((indicator) => {
    const indicatorId = indicator.id.toString()
    
    // 获取已有子指标
    const children = getChildIndicators(indicatorId)
    // 获取新增的子指标
    const newChildren = newChildIndicators[indicatorId] || []
    
    // 如果该父指标没有任何子指标（包括待添加的），则添加一个 indicator-only 行
    if (children.length === 0 && newChildren.length === 0) {
      data.push({
        type: 'indicator-only',
        taskTitle: selectedTask.value!.title,
        indicator,
        parentIndicatorId: indicatorId
      })
    } else {
      // 添加已有子指标行
      children.forEach(child => {
        data.push({
          type: 'child',
          taskTitle: selectedTask.value!.title,
          indicator,
          child,
          parentIndicatorId: indicatorId
        })
      })
      
      // 添加新增的子指标行
      newChildren.forEach((newChild, newIdx) => {
        data.push({
          type: 'new-child',
          taskTitle: selectedTask.value!.title,
          indicator,
          child: newChild,
          parentIndicatorId: indicatorId,
          rowIndex: newIdx
        })
      })
    }
  })
  
  return data
})

// 单元格合并方法
const spanMethod = ({ row, column, rowIndex, columnIndex }: { row: TableRowData; column: any; rowIndex: number; columnIndex: number }) => {
  const dataList = flatTableData.value
  
  // 第一列（战略任务列）合并
  if (columnIndex === 0) {
    // 检查是否是第一行
    if (rowIndex === 0) {
      // 合并所有行
      return { rowspan: dataList.length, colspan: 1 }
    } else {
      return { rowspan: 0, colspan: 0 }
    }
  }
  
  // 第二列（父指标列）合并 - 同一个父指标的行合并
  if (columnIndex === 1) {
    const currentIndicatorId = row.parentIndicatorId
    
    // 检查是否是该父指标的第一行
    const isFirstRowOfIndicator = rowIndex === 0 || dataList[rowIndex - 1]?.parentIndicatorId !== currentIndicatorId
    
    if (isFirstRowOfIndicator) {
      // 计算该父指标下的所有行数
      let rowspan = 1
      for (let i = rowIndex + 1; i < dataList.length; i++) {
        if (dataList[i]?.parentIndicatorId === currentIndicatorId) {
          rowspan++
        } else {
          break
        }
      }
      return { rowspan, colspan: 1 }
    } else {
      return { rowspan: 0, colspan: 0 }
    }
  }
  
  return { rowspan: 1, colspan: 1 }
}

// ================== 学院视图数据 ==================

// 学院视图表格数据
const collegeTableData = computed(() => {
  if (!selectedCollege.value) return []
  
  const data: TableRowData[] = []
  const indicators = collegeIndicators.value
  
  indicators.forEach((indicator) => {
    const indicatorId = indicator.id.toString()
    
    // 获取下发给该学院的子指标（支持字符串或数组格式）
    const children = strategicStore.indicators.filter(i => {
      if (i.parentIndicatorId !== indicatorId || i.isStrategic) return false
      // 支持字符串或数组格式的 responsibleDept
      if (Array.isArray(i.responsibleDept)) {
        return i.responsibleDept.includes(selectedCollege.value!)
      }
      return i.responsibleDept === selectedCollege.value
    })
    
    // 获取新增的子指标（只显示分配给当前学院的）
    const newChildren = (newChildIndicators[indicatorId] || []).filter(
      nc => nc.college.includes(selectedCollege.value!)
    )
    
    // 如果该父指标没有任何子指标（包括待添加的），则添加一个 indicator-only 行
    if (children.length === 0 && newChildren.length === 0) {
      data.push({
        type: 'indicator-only',
        taskTitle: indicator.taskContent || '',
        indicator,
        parentIndicatorId: indicatorId
      })
    } else {
      // 添加已有子指标行
      children.forEach(child => {
        data.push({
          type: 'child',
          taskTitle: indicator.taskContent || '',
          indicator,
          child,
          parentIndicatorId: indicatorId
        })
      })
      
      // 添加新增的子指标行
      newChildren.forEach((newChild, newIdx) => {
        // 查找原始索引
        const originalIdx = (newChildIndicators[indicatorId] || []).findIndex(nc => nc.id === newChild.id)
        data.push({
          type: 'new-child',
          taskTitle: indicator.taskContent || '',
          indicator,
          child: newChild,
          parentIndicatorId: indicatorId,
          rowIndex: originalIdx >= 0 ? originalIdx : newIdx
        })
      })
    }
  })
  
  return data
})

// 学院视图单元格合并方法
const collegeSpanMethod = ({ row, column, rowIndex, columnIndex }: { row: TableRowData; column: any; rowIndex: number; columnIndex: number }) => {
  const dataList = collegeTableData.value
  
  // 第一列（战略任务列）合并 - 同一个任务的行合并
  if (columnIndex === 0) {
    const currentTaskTitle = row.taskTitle
    
    // 检查是否是该任务的第一行
    const isFirstRowOfTask = rowIndex === 0 || dataList[rowIndex - 1]?.taskTitle !== currentTaskTitle
    
    if (isFirstRowOfTask) {
      // 计算该任务下的所有行数
      let rowspan = 1
      for (let i = rowIndex + 1; i < dataList.length; i++) {
        if (dataList[i]?.taskTitle === currentTaskTitle) {
          rowspan++
        } else {
          break
        }
      }
      return { rowspan, colspan: 1 }
    } else {
      return { rowspan: 0, colspan: 0 }
    }
  }
  
  // 第二列（父指标列）合并 - 同一个父指标的行合并
  if (columnIndex === 1) {
    const currentIndicatorId = row.parentIndicatorId
    
    // 检查是否是该父指标的第一行
    const isFirstRowOfIndicator = rowIndex === 0 || dataList[rowIndex - 1]?.parentIndicatorId !== currentIndicatorId
    
    if (isFirstRowOfIndicator) {
      // 计算该父指标下的所有行数
      let rowspan = 1
      for (let i = rowIndex + 1; i < dataList.length; i++) {
        if (dataList[i]?.parentIndicatorId === currentIndicatorId) {
          rowspan++
        } else {
          break
        }
      }
      return { rowspan, colspan: 1 }
    } else {
      return { rowspan: 0, colspan: 0 }
    }
  }
  
  return { rowspan: 1, colspan: 1 }
}

// 获取行的 class 名称（用于标识新增子指标行）
const getRowClassName = ({ row }: { row: TableRowData }) => {
  if (row.type === 'new-child') {
    return 'new-child-row'
  }
  return ''
}
</script>

<template>
  <div class="distribution-view">
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
      <!-- 左侧：侧边栏（战略任务/学院切换） -->
      <div class="strategic-panel">
        <div class="panel-header">
          <el-radio-group v-model="sidebarMode" size="small" @change="() => { selectedTask = null; selectedCollege = null; searchKeyword = '' }">
            <el-radio-button value="task">战略任务</el-radio-button>
            <el-radio-button value="college">学院</el-radio-button>
          </el-radio-group>
          <el-input
            v-model="searchKeyword"
            :placeholder="sidebarMode === 'task' ? '搜索任务...' : '搜索学院...'"
            :prefix-icon="Search"
            clearable
            size="small"
            style="width: 120px"
          />
        </div>

        <!-- 战略任务列表 -->
        <div v-if="sidebarMode === 'task'" class="indicator-list">
          <div
            v-for="task in filteredTasks"
            :key="task.id"
            :class="['task-card', { selected: selectedTask?.id === task.id }]"
            @click="selectTask(task)"
          >
            <div class="task-card-header">
              <el-tag type="primary" size="small">{{ task.cycle }}</el-tag>
              <span class="indicator-count-badge">
                {{ strategicStore.indicators.filter(i => i.taskContent === task.title && i.isStrategic).length }} 个指标
              </span>
            </div>
            <div class="task-card-title">{{ task.title }}</div>
            <div class="task-card-desc">{{ task.desc }}</div>
            <div class="task-card-progress">
              <el-progress
                :percentage="getTaskProgress(task)"
                :stroke-width="8"
                :show-text="false"
              />
              <span class="progress-label">{{ getTaskProgress(task) }}%</span>
            </div>
          </div>

          <el-empty v-if="filteredTasks.length === 0" description="暂无任务" />
        </div>

        <!-- 学院列表 -->
        <div v-else class="indicator-list">
          <div
            v-for="college in filteredColleges"
            :key="college"
            :class="['college-card', { selected: selectedCollege === college }]"
            @click="selectedCollege = college"
          >
            <span class="college-card-name">{{ college }}</span>
            <span class="college-card-count">{{ getCollegeChildCount(college) }} 个子指标</span>
          </div>

          <el-empty v-if="filteredColleges.length === 0" description="暂无学院" />
        </div>
      </div>

      <!-- 右侧：指标表格 -->
      <div class="distribution-panel">
        <!-- 战略任务模式：选中任务时显示 -->
        <div v-if="sidebarMode === 'task' && selectedTask" class="table-card card-base">
          <!-- 表头 -->
          <div class="card-header">
            <div class="header-left">
              <span class="card-title">{{ selectedTask.title }}</span>
              <span class="indicator-count">共 {{ taskIndicators.length }} 个指标</span>
            </div>
            <!-- 战略任务模式下不显示下发按钮 -->
          </div>

          <!-- 表格主体 -->
          <div class="card-body table-body">
            <div class="table-container">
              <el-table
                :data="flatTableData"
                border
                :span-method="spanMethod"
                :row-class-name="getRowClassName"
                class="unified-table distribution-table"
              >
                <!-- 战略任务列 -->
                <el-table-column label="战略任务" width="160">
                  <template #default="{ row }">
                    <el-tooltip 
                      :content="row.indicator?.type2 === '发展性' ? '发展性任务' : '基础性任务'" 
                      placement="top"
                    >
                      <span 
                        class="task-content-colored"
                        :style="{ color: getTaskTypeColor(row.indicator?.type2 || '发展性') }"
                      >{{ row.taskTitle }}</span>
                    </el-tooltip>
                  </template>
                </el-table-column>

                <!-- 父指标列 -->
                <el-table-column label="战略指标" min-width="200">
                  <template #default="{ row }">
                    <div class="indicator-name-wrapper">
                      <div class="indicator-name-cell">
                        <el-tooltip 
                          :content="row.indicator?.type1 === '定性' ? '定性指标' : '定量指标'" 
                          placement="top"
                        >
                          <span 
                            class="indicator-name-text"
                            :class="row.indicator?.type1 === '定性' ? 'indicator-qualitative' : 'indicator-quantitative'"
                          >{{ row.indicator?.name }}</span>
                        </el-tooltip>
                      </div>
                      <!-- 战略任务模式下不显示添加按钮 -->
                    </div>
                  </template>
                </el-table-column>

                <!-- 子指标名称列 -->
                <el-table-column label="子指标名称" min-width="180">
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
                          v-if="editingChildId === row.child?.id?.toString() && editingChildField === 'name'"
                          v-model="editingChildValue"
                          type="textarea"
                          :autosize="{ minRows: 2 }"
                          resize="vertical"
                          class="textarea-cell editing-field"
                          @blur="saveChildEdit(row.child, 'name')"
                        />
                        <span 
                          v-else 
                          class="child-text"
                        >{{ row.child?.name }}</span>
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
                          :autosize="{ minRows: 2 }"
                          resize="vertical"
                          class="textarea-cell new-child-editing"
                          placeholder="子指标名称"
                        />
                        <span 
                          v-else 
                          class="child-text new-child-text"
                          :class="{ 'placeholder-text': !row.child.name }"
                        >{{ row.child.name || '点击编辑子指标名称' }}</span>
                      </div>
                    </template>
                  </template>
                </el-table-column>

                <!-- 说明列 -->
                <el-table-column label="说明" width="140">
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
                          v-if="editingChildId === row.child?.id?.toString() && editingChildField === 'remark'"
                          v-model="editingChildValue"
                          type="textarea"
                          :autosize="{ minRows: 2 }"
                          resize="vertical"
                          class="textarea-cell editing-field"
                          @blur="saveChildEdit(row.child, 'remark')"
                        />
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
                          :autosize="{ minRows: 2 }"
                          resize="vertical"
                          class="textarea-cell new-child-editing"
                          placeholder="说明"
                        />
                        <span 
                          v-else 
                          class="remark-text new-child-text"
                          :class="{ 'placeholder-text': !row.child.remark }"
                        >{{ row.child.remark || '点击编辑' }}</span>
                      </div>
                    </template>
                  </template>
                </el-table-column>

                <!-- 学院列（支持多选） -->
                <el-table-column label="学院" width="180">
                  <template #default="{ row }">
                    <template v-if="row.type === 'indicator-only'">
                      <span class="dept-text">-</span>
                    </template>
                    <template v-else-if="row.type === 'child'">
                      <div 
                        class="college-cell"
                        @dblclick="handleChildDblClick(row.child, 'responsibleDept')"
                      >
                        <el-select
                          v-if="editingChildId === row.child?.id?.toString() && editingChildField === 'responsibleDept'"
                          v-model="editingChildValue"
                          multiple
                          collapse-tags
                          collapse-tags-tooltip
                          size="small"
                          placeholder="选择学院"
                          style="width: 100%"
                          class="editing-field college-select-editing"
                          @blur="handleCollegeSelectBlur(row.child)"
                          @visible-change="handleCollegeSelectClose"
                        >
                          <el-option
                            v-for="college in colleges"
                            :key="college"
                            :label="college"
                            :value="college"
                          />
                        </el-select>
                        <template v-else>
                          <el-tooltip 
                            :content="formatColleges(row.child?.responsibleDept)" 
                            placement="top"
                            :disabled="!row.child?.responsibleDept"
                          >
                            <span class="dept-text college-tags">
                              {{ formatCollegesShort(row.child?.responsibleDept) }}
                            </span>
                          </el-tooltip>
                        </template>
                      </div>
                    </template>
                    <template v-else-if="row.type === 'new-child'">
                      <div 
                        class="new-child-cell"
                        @click="handleNewChildRowClick(row.child.id, row.parentIndicatorId)"
                      >
                        <template v-if="editingNewChildId === row.child.id">
                          <el-select
                            v-model="row.child.college"
                            multiple
                            collapse-tags
                            collapse-tags-tooltip
                            size="small"
                            placeholder="选择学院"
                            style="width: 100%"
                            class="new-child-editing"
                          >
                            <el-option
                              v-for="college in colleges"
                              :key="college"
                              :label="college"
                              :value="college"
                            />
                          </el-select>
                        </template>
                        <template v-else>
                          <el-tooltip 
                            :content="formatColleges(row.child.college)" 
                            placement="top"
                            :disabled="!row.child.college?.length"
                          >
                            <span 
                              class="dept-text college-tags new-child-text"
                              :class="{ 'placeholder-text': !row.child.college?.length }"
                            >
                              {{ row.child.college?.length ? formatCollegesShort(row.child.college) : '点击选择学院' }}
                            </span>
                          </el-tooltip>
                        </template>
                      </div>
                    </template>
                  </template>
                </el-table-column>

                <!-- 目标进度列 -->
                <el-table-column label="目标进度" width="120" align="center">
                  <template #default="{ row }">
                    <template v-if="row.type === 'indicator-only'">
                      <span class="target-progress-text">-</span>
                    </template>
                    <template v-else-if="row.type === 'child'">
                      <!-- 定量指标 -->
                      <template v-if="(row.child?.type1 || (row.child?.isQualitative ? '定性' : '定量')) === '定量'">
                        <div 
                          class="target-progress-cell"
                          @dblclick="handleChildDblClick(row.child, 'targetValue')"
                        >
                          <el-input-number
                            v-if="editingChildId === row.child?.id?.toString() && editingChildField === 'targetValue'"
                            v-model="editingChildValue"
                            :min="0"
                            :max="100"
                            :step="5"
                            size="small"
                            controls-position="right"
                            style="width: 80px"
                            class="editing-field"
                            @blur="saveChildEdit(row.child, 'targetValue')"
                          />
                          <span v-else class="target-progress-text editable">{{ row.child?.targetValue || 100 }}%</span>
                        </div>
                      </template>
                      <!-- 定性指标 -->
                      <template v-else>
                        <el-popover
                          placement="left"
                          :width="320"
                          trigger="hover"
                          :disabled="!row.child?.milestones?.length"
                        >
                          <template #reference>
                            <div 
                              class="milestone-cell"
                              @click="canEditChild && openMilestonesDialog(row.child)"
                            >
                              <span class="milestone-count" :class="{ editable: canEditChild }">
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
                              :class="{ 'milestone-completed': isMilestoneCompleted(row.child, ms.progress) }"
                            >
                              <div class="milestone-item-header">
                                <span class="milestone-index">{{ idx + 1 }}.</span>
                                <span class="milestone-name">{{ ms.name || '未命名' }}</span>
                                <el-icon v-if="isMilestoneCompleted(row.child, ms.progress)" class="milestone-check-icon"><Check /></el-icon>
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
                    <template v-else-if="row.type === 'new-child'">
                      <div 
                        class="new-child-cell"
                        @click="handleNewChildRowClick(row.child.id, row.parentIndicatorId)"
                      >
                        <!-- 新增子指标 - 定量 -->
                        <template v-if="row.child.type1 === '定量'">
                          <el-input-number
                            v-if="editingNewChildId === row.child.id"
                            v-model="row.child.targetProgress"
                            :min="0"
                            :max="100"
                            :step="5"
                            size="small"
                            controls-position="right"
                            style="width: 80px"
                            class="new-child-editing"
                          />
                          <span 
                            v-else 
                            class="target-progress-text new-child-text"
                          >{{ row.child.targetProgress || 100 }}%</span>
                        </template>
                        <!-- 新增子指标 - 定性 -->
                        <template v-else>
                          <div 
                            class="milestone-cell"
                            @click.stop="openMilestonesDialog(row.child)"
                          >
                            <span class="milestone-count editable">
                              {{ row.child.milestones?.length || 0 }} 个里程碑
                            </span>
                          </div>
                        </template>
                      </div>
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
                      <div class="progress-cell">
                        <el-progress
                          :percentage="row.child?.progress || 0"
                          :stroke-width="6"
                          :show-text="false"
                          style="width: 50px;"
                        />
                        <span class="progress-text">{{ row.child?.progress || 0 }}%</span>
                      </div>
                    </template>
                    <template v-else-if="row.type === 'new-child'">
                      <span class="progress-text">-</span>
                    </template>
                  </template>
                </el-table-column>

                <!-- 状态列 -->
                <el-table-column label="状态" width="85" align="center">
                  <template #default="{ row }">
                    <template v-if="row.type === 'indicator-only'">
                      <span class="status-text">-</span>
                    </template>
                    <template v-else-if="row.type === 'child'">
                      <el-tag 
                        :type="getStatusTagType(getChildStatus(row.child))" 
                        size="small"
                      >
                        {{ getStatusText(getChildStatus(row.child)) }}
                      </el-tag>
                    </template>
                    <template v-else-if="row.type === 'new-child'">
                      <el-tag class="status-tag-pending-distribute" size="small">待下发</el-tag>
                    </template>
                  </template>
                </el-table-column>

                <!-- 操作列 -->
                <el-table-column label="操作" width="180" align="center">
                  <template #default="{ row }">
                    <!-- 没有子指标的父指标 - 无操作 -->
                    <template v-if="row.type === 'indicator-only'">
                      <span class="action-placeholder">-</span>
                    </template>
                    <!-- 子指标操作 -->
                    <template v-else-if="row.type === 'child'">
                      <div class="action-cell">
                        <el-button link type="primary" size="small" @click="handleViewDetail(row.child)">
                          <el-icon><View /></el-icon>查看
                        </el-button>
                        <el-button 
                          v-if="getChildStatus(row.child) === 'pending' && canEditChild"
                          link 
                          type="success" 
                          size="small" 
                          @click="handleApprove(row.child)"
                        >
                          <el-icon><Check /></el-icon>通过
                        </el-button>
                        <el-button 
                          v-if="getChildStatus(row.child) === 'pending' && canEditChild"
                          link 
                          type="danger" 
                          size="small" 
                          @click="handleReject(row.child)"
                        >
                          <el-icon><Close /></el-icon>打回
                        </el-button>
                        <el-button 
                          v-if="canEditChild"
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

            <!-- 空状态 -->
            <div v-if="taskIndicators.length === 0" class="empty-state">
              <el-empty description="该任务下暂无指标" />
            </div>
          </div>
        </div>

        <!-- 学院模式：选中学院时显示 -->
        <div v-else-if="sidebarMode === 'college' && selectedCollege" class="table-card card-base">
          <!-- 表头 -->
          <div class="card-header">
            <div class="header-left">
              <span class="card-title">{{ selectedCollege }}</span>
              <span class="indicator-count">共 {{ collegeIndicators.length }} 个父指标</span>
            </div>
            <div class="header-actions" v-if="canEditChild">
              <el-button 
                type="primary" 
                :icon="Promotion" 
                @click="() => {
                  const parentId = Object.keys(newChildIndicators).find(k => newChildIndicators[k]?.length > 0)
                  if (parentId) {
                    const parent = collegeIndicators.find(i => i.id.toString() === parentId)
                    if (parent) distributeNewChildren(parent)
                  } else {
                    ElMessage.warning('请先添加待下发的子指标')
                  }
                }"
              >
                下发子指标
              </el-button>
            </div>
          </div>

          <!-- 表格主体 -->
          <div class="card-body table-body">
            <div class="table-container">
              <el-table
                :data="collegeTableData"
                border
                :span-method="collegeSpanMethod"
                :row-class-name="getRowClassName"
                class="unified-table distribution-table"
              >
                <!-- 战略任务列 -->
                <el-table-column label="战略任务" width="160">
                  <template #default="{ row }">
                    <el-tooltip 
                      :content="row.indicator?.type2 === '发展性' ? '发展性任务' : '基础性任务'" 
                      placement="top"
                    >
                      <span 
                        class="task-content-colored"
                        :style="{ color: getTaskTypeColor(row.indicator?.type2 || '发展性') }"
                      >{{ row.taskTitle }}</span>
                    </el-tooltip>
                  </template>
                </el-table-column>

                <!-- 父指标列 -->
                <el-table-column label="战略指标" min-width="200">
                  <template #default="{ row }">
                    <div class="indicator-name-wrapper">
                      <div class="indicator-name-cell">
                        <el-tooltip 
                          :content="row.indicator?.type1 === '定性' ? '定性指标' : '定量指标'" 
                          placement="top"
                        >
                          <span 
                            class="indicator-name-text"
                            :class="row.indicator?.type1 === '定性' ? 'indicator-qualitative' : 'indicator-quantitative'"
                          >{{ row.indicator?.name }}</span>
                        </el-tooltip>
                      </div>
                      <!-- 右下角三角形添加子指标按钮 -->
                      <div 
                        v-if="canEditChild" 
                        class="add-child-trigger"
                        @click.stop="addNewChildRow(row.parentIndicatorId)"
                      >
                        <span class="trigger-icon">+</span>
                      </div>
                    </div>
                  </template>
                </el-table-column>

                <!-- 子指标名称列 -->
                <el-table-column label="子指标名称" min-width="180">
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
                          v-if="editingChildId === row.child?.id?.toString() && editingChildField === 'name'"
                          v-model="editingChildValue"
                          type="textarea"
                          :rows="1"
                          autosize
                          class="editing-field textarea-cell"
                          @blur="saveChildEdit(row.child, 'name')"
                        />
                        <el-tooltip v-else :content="row.child?.name" placement="top" :disabled="!row.child?.name || row.child?.name.length < 15">
                          <span 
                            class="child-text"
                            :class="row.child?.type1 === '定性' ? 'indicator-qualitative' : 'indicator-quantitative'"
                          >{{ row.child?.name || '未命名' }}</span>
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
                          @blur="validateAndSaveNewChild(row.child, row.parentIndicatorId)"
                        />
                        <span 
                          v-else 
                          class="new-child-text"
                          :class="{ 'placeholder-text': !row.child.name }"
                        >{{ row.child.name || '点击输入名称' }}</span>
                      </div>
                    </template>
                  </template>
                </el-table-column>

                <!-- 说明列 -->
                <el-table-column label="说明" width="140">
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
                          v-if="editingChildId === row.child?.id?.toString() && editingChildField === 'remark'"
                          v-model="editingChildValue"
                          type="textarea"
                          :rows="1"
                          autosize
                          class="editing-field textarea-cell"
                          @blur="saveChildEdit(row.child, 'remark')"
                        />
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
                          placeholder="输入说明（选填）"
                          class="new-child-editing textarea-cell"
                        />
                        <span 
                          v-else 
                          class="remark-text new-child-text"
                          :class="{ 'placeholder-text': !row.child.remark }"
                        >{{ row.child.remark || '-' }}</span>
                      </div>
                    </template>
                  </template>
                </el-table-column>

                <!-- 学院模式下不显示学院列 -->

                <!-- 目标进度列 -->
                <el-table-column label="目标进度" width="120" align="center">
                  <template #default="{ row }">
                    <template v-if="row.type === 'indicator-only'">
                      <span class="target-progress-text">-</span>
                    </template>
                    <template v-else-if="row.type === 'child'">
                      <!-- 定量指标 -->
                      <template v-if="(row.child?.type1 || (row.child?.isQualitative ? '定性' : '定量')) === '定量'">
                        <div 
                          class="target-progress-cell"
                          @dblclick="handleChildDblClick(row.child, 'targetValue')"
                        >
                          <el-input-number
                            v-if="editingChildId === row.child?.id?.toString() && editingChildField === 'targetValue'"
                            v-model="editingChildValue"
                            :min="0"
                            :max="100"
                            :step="5"
                            size="small"
                            controls-position="right"
                            style="width: 80px"
                            class="editing-field"
                            @blur="saveChildEdit(row.child, 'targetValue')"
                          />
                          <span v-else class="target-progress-text editable">{{ row.child?.targetValue || 100 }}%</span>
                        </div>
                      </template>
                      <!-- 定性指标 -->
                      <template v-else>
                        <el-popover
                          placement="left"
                          :width="320"
                          trigger="hover"
                          :disabled="!row.child?.milestones?.length"
                        >
                          <template #reference>
                            <div 
                              class="milestone-cell"
                              @click="canEditChild && openMilestonesDialog(row.child)"
                            >
                              <span class="milestone-count" :class="{ editable: canEditChild }">
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
                              :class="{ 'milestone-completed': isMilestoneCompleted(row.child, ms.progress) }"
                            >
                              <div class="milestone-item-header">
                                <span class="milestone-index">{{ idx + 1 }}.</span>
                                <span class="milestone-name">{{ ms.name || '未命名' }}</span>
                                <el-icon v-if="isMilestoneCompleted(row.child, ms.progress)" class="milestone-check-icon"><Check /></el-icon>
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
                    <template v-else-if="row.type === 'new-child'">
                      <div 
                        class="new-child-cell"
                        @click="handleNewChildRowClick(row.child.id, row.parentIndicatorId)"
                      >
                        <!-- 新增子指标 - 定量 -->
                        <template v-if="row.child.type1 === '定量'">
                          <el-input-number
                            v-if="editingNewChildId === row.child.id"
                            v-model="row.child.targetProgress"
                            :min="0"
                            :max="100"
                            :step="5"
                            size="small"
                            controls-position="right"
                            style="width: 80px"
                            class="new-child-editing"
                          />
                          <span 
                            v-else 
                            class="target-progress-text new-child-text"
                          >{{ row.child.targetProgress || 100 }}%</span>
                        </template>
                        <!-- 新增子指标 - 定性 -->
                        <template v-else>
                          <div 
                            class="milestone-cell"
                            @click.stop="openMilestonesDialog(row.child)"
                          >
                            <span class="milestone-count editable">
                              {{ row.child.milestones?.length || 0 }} 个里程碑
                            </span>
                          </div>
                        </template>
                      </div>
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
                      <div class="progress-cell">
                        <el-progress
                          :percentage="row.child?.progress || 0"
                          :stroke-width="6"
                          :show-text="false"
                          style="width: 50px;"
                        />
                        <span class="progress-text">{{ row.child?.progress || 0 }}%</span>
                      </div>
                    </template>
                    <template v-else-if="row.type === 'new-child'">
                      <span class="progress-text">-</span>
                    </template>
                  </template>
                </el-table-column>

                <!-- 状态列 -->
                <el-table-column label="状态" width="85" align="center">
                  <template #default="{ row }">
                    <template v-if="row.type === 'indicator-only'">
                      <span class="status-text">-</span>
                    </template>
                    <template v-else-if="row.type === 'child'">
                      <el-tag 
                        :type="getStatusTagType(getChildStatus(row.child))" 
                        size="small"
                      >
                        {{ getStatusText(getChildStatus(row.child)) }}
                      </el-tag>
                    </template>
                    <template v-else-if="row.type === 'new-child'">
                      <el-tag class="status-tag-pending-distribute" size="small">待下发</el-tag>
                    </template>
                  </template>
                </el-table-column>

                <!-- 操作列 -->
                <el-table-column label="操作" width="180" align="center">
                  <template #default="{ row }">
                    <!-- 没有子指标的父指标 - 无操作 -->
                    <template v-if="row.type === 'indicator-only'">
                      <span class="action-placeholder">-</span>
                    </template>
                    <!-- 子指标操作 -->
                    <template v-else-if="row.type === 'child'">
                      <div class="action-cell">
                        <el-button link type="primary" size="small" @click="handleViewDetail(row.child)">
                          <el-icon><View /></el-icon>查看
                        </el-button>
                        <el-button 
                          v-if="getChildStatus(row.child) === 'pending' && canEditChild"
                          link 
                          type="success" 
                          size="small" 
                          @click="handleApprove(row.child)"
                        >
                          <el-icon><Check /></el-icon>通过
                        </el-button>
                        <el-button 
                          v-if="getChildStatus(row.child) === 'pending' && canEditChild"
                          link 
                          type="danger" 
                          size="small" 
                          @click="handleReject(row.child)"
                        >
                          <el-icon><Close /></el-icon>打回
                        </el-button>
                        <el-button 
                          v-if="canEditChild"
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

            <!-- 空状态 -->
            <div v-if="collegeIndicators.length === 0" class="empty-state">
              <el-empty description="该学院暂无子指标" />
            </div>
          </div>
        </div>

        <!-- 空状态：未选择任务或学院 -->
        <el-empty 
          v-else 
          :description="sidebarMode === 'task' ? '请选择左侧战略任务' : '请选择左侧学院'" 
          class="empty-placeholder" 
        />
      </div>
    </div>

    <!-- 审计日志抽屉 -->
    <AuditLogDrawer
      v-model:visible="auditLogVisible"
      :indicator="currentAuditIndicator"
      @close="auditLogVisible = false"
    />

    <!-- 里程碑编辑弹窗 -->
    <el-dialog
      v-model="milestonesDialogVisible"
      title="编辑里程碑"
      width="600px"
      :close-on-click-modal="false"
    >
      <div class="milestones-editor">
        <div class="milestones-header">
          <span class="milestones-tip">设置里程碑节点，后续节点进度不能小于前面节点</span>
          <el-button type="primary" size="small" :icon="Plus" @click="addMilestone">
            添加里程碑
          </el-button>
        </div>
        
        <div class="milestones-list" v-if="editingMilestones.length > 0">
          <div 
            v-for="(milestone, index) in editingMilestones" 
            :key="milestone.id"
            class="milestone-edit-item"
          >
            <div class="milestone-edit-header">
              <span class="milestone-edit-index">{{ index + 1 }}</span>
              <el-button 
                type="danger" 
                :icon="Close" 
                size="small" 
                circle 
                @click="removeMilestone(index)"
              />
            </div>
            <div class="milestone-edit-body">
              <el-form-item label="节点名称" label-width="80px">
                <el-input 
                  v-model="milestone.name" 
                  placeholder="请输入节点名称"
                  size="small"
                />
              </el-form-item>
              <el-form-item label="预期完成" label-width="80px">
                <el-date-picker
                  v-model="milestone.expectedDate"
                  type="date"
                  placeholder="选择日期"
                  size="small"
                  format="YYYY-MM-DD"
                  value-format="YYYY-MM-DD"
                  style="width: 100%"
                />
              </el-form-item>
              <el-form-item label="节点进度" label-width="80px">
                <div class="milestone-progress-row">
                  <el-input-number
                    v-model="milestone.progress"
                    :min="0"
                    :max="100"
                    :step="5"
                    size="small"
                    controls-position="right"
                    style="width: 120px;"
                    @change="validateMilestoneProgress(index)"
                  />
                  <span class="milestone-progress-unit">%</span>
                </div>
              </el-form-item>
            </div>
          </div>
        </div>
        
        <el-empty v-else description="暂无里程碑，点击上方按钮添加" :image-size="60" />
      </div>
      
      <template #footer>
        <el-button @click="milestonesDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveMilestones">确定</el-button>
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

/* 右下角三角形添加子指标按钮 */
.add-child-trigger {
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

.add-child-trigger .trigger-icon {
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

.add-child-trigger:hover {
  border-color: transparent transparent var(--color-primary, #409eff) transparent;
  border-width: 0 0 24px 24px;
}

.add-child-trigger:hover .trigger-icon {
  color: #fff;
  right: 3px;
  bottom: -21px;
  font-size: 12px;
}

.add-child-trigger:active {
  border-color: transparent transparent var(--color-primary-dark, #337ecc) transparent;
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
  color: var(--color-primary, #409EFF);
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
  color: var(--color-primary, #409EFF);
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
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex-wrap: wrap;
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
}

.milestone-count.editable {
  cursor: pointer;
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
  border-bottom: 1px dashed var(--border-light, #f1f5f9);
  border-radius: 6px;
  margin-bottom: 4px;
  transition: background-color 0.2s ease;
}

.milestone-item:last-child {
  border-bottom: none;
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
  font-size: 14px;
  margin-left: 4px;
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

/* 里程碑编辑弹窗 */
.milestones-editor {
  max-height: 500px;
  overflow-y: auto;
}

.milestones-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-light, #f1f5f9);
}

.milestones-tip {
  font-size: 12px;
  color: var(--text-secondary, #64748b);
}

.milestones-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.milestone-edit-item {
  background: #f8fafc;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 8px;
  padding: 12px;
}

.milestone-edit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.milestone-edit-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: var(--color-qualitative, #9333ea);
  color: #fff;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
}

.milestone-edit-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.milestone-edit-body :deep(.el-form-item) {
  margin-bottom: 0;
}

.milestone-progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.milestone-progress-unit {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary, #64748b);
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
  border-color: var(--color-primary, #409EFF);
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
</style>
