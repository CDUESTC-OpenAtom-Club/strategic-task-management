<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue'
  import { Plus, View, Download, Delete, ArrowDown, Promotion, RefreshLeft } from '@element-plus/icons-vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import type { ElTable } from 'element-plus'
  import type { StrategicTask, StrategicIndicator } from '@/types'
  import { useStrategicStore } from '@/stores/strategic'
  import { useAuthStore } from '@/stores/auth'
  import { useTimeContextStore } from '@/stores/timeContext'
  import AuditLogDrawer from '@/components/task/AuditLogDrawer.vue'
  
  // --- 新增：自定义指令，用于自动聚焦 ---
  const vFocus = {
    mounted: (el: HTMLElement) => {
      // 尝试查找内部的 input 或 textarea 元素
      const input = el.querySelector('input') || el.querySelector('textarea')
      if (input) {
        input.focus()
      } else {
        // 如果找不到（或者是 div 等），直接聚焦元素本身
        el.focus()
      }
    }
  }
  
  // 使用共享 Store
  const strategicStore = useStrategicStore()
  const authStore = useAuthStore()
  const timeContext = useTimeContextStore()

  // 只读模式（历史年份为只读）
  const isReadOnly = computed(() => timeContext.isReadOnly)
  
  // 接收父组件传递的选中角色
  const props = defineProps<{
    selectedRole: string
  }>()
  
  // 判断是否可以编辑（只有战略发展部可以编辑，且非只读模式）
  const canEdit = computed(() => {
    if (isReadOnly.value) return false
    return authStore.userRole === 'strategic_dept' || props.selectedRole === 'strategic_dept'
  })
  
  // 当前选中任务索引
  const currentTaskIndex = ref(0)
  const isAddingOrEditing = ref(false)
  
  // 职能部门列表
  const functionalDepartments = [
    '党委办公室 | 党委统战部',
    '纪委办公室 | 监察处',
    '党委宣传部 | 宣传策划部',
    '党委组织部 | 党委教师工作部 | 人力资源部',
    '党委学工部 | 学生工作处',
    '党委保卫部 | 保卫处',
    '学校综合办公室',
    '教务处',
    '科技处',
    '财务部',
    '招生工作处',
    '就业创业指导中心',
    '实验室建设管理处',
    '数字校园建设办公室',
    '图书馆 | 档案馆',
    '后勤资产处',
    '继续教育部',
    '国际合作与交流处'
  ]

  // 选中的部门 - 默认选中第一个
  const selectedDepartment = ref(functionalDepartments[0])
  
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
  
  // 从 Store 获取指标列表（带里程碑），按年份和部门过滤，按任务类型和战略任务分组排序
  const indicators = computed(() => {
    // 过滤当前年份的指标
    let list = strategicStore.indicators
      .filter(i => !i.year || i.year === timeContext.currentYear)
    
    // 根据选中的部门筛选指标
    // 战略发展部视角：显示下发给该职能部门的指标（ownerDept 或 responsibleDept 匹配）
    if (selectedDepartment.value) {
      list = list.filter(i => 
        i.responsibleDept === selectedDepartment.value || 
        i.ownerDept === selectedDepartment.value
      )
    }
    
    const mappedList = list.map(i => ({
      ...i,
      id: Number(i.id)
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
  const getSpanMethod = ({ row, column, rowIndex, columnIndex }: { row: any; column: any; rowIndex: number; columnIndex: number }) => {
    const dataList = indicators.value
  
    // 战略任务列（第0列）和批量操作列（第7列）
    if (columnIndex === 0 || columnIndex === 7) {
      const currentTask = row.taskContent || '未关联任务'
  
      let startIndex = rowIndex
      while (startIndex > 0 && (dataList[startIndex - 1].taskContent || '未关联任务') === currentTask) {
        startIndex--
      }
  
      if (startIndex === rowIndex) {
        let count = 1
        while (rowIndex + count < dataList.length && (dataList[rowIndex + count].taskContent || '未关联任务') === currentTask) {
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
  
  const groupedDevelopmentIndicators = computed(() => groupIndicatorsByTask(developmentIndicators.value))
  const groupedBasicIndicators = computed(() => groupIndicatorsByTask(basicIndicators.value))
  
  // 获取已有的任务名称列表（去重，只包含未下发的任务）
  const existingTaskNames = computed(() => {
    const taskSet = new Set<string>()
    indicators.value.forEach(i => {
      // 只添加未下发的任务（canWithdraw 为 true）
      if (i.taskContent && i.taskContent !== '未命名任务' && i.canWithdraw) {
        taskSet.add(i.taskContent)
      }
    })
    return Array.from(taskSet)
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
  const taskSelectRef = ref<any>(null)

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
    type1: '定性' as '定性' | '定量',
    type2: '发展性' as '发展性' | '基础性',
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
    const currentYear = timeContext.currentYear
    const indicatorName = newRow.value.name || '指标完成'
    newRow.value.milestones = []
    
    for (let month = 1; month <= 12; month++) {
      const lastDay = new Date(currentYear, month, 0).getDate()
      const deadline = `${currentYear}-${String(month).padStart(2, '0')}-${lastDay}`
      const progress = Math.round((month / 12) * 100)
      
      newRow.value.milestones.push({
        id: Date.now() + month,
        name: indicatorName,
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
    // 如果值没有变化或者被清空（根据需求，这里假设如果不填则取消编辑或保留原值，这里逻辑是如果不填则取消）
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
    // 如果已经在取消过程中或值无效，直接退出
    if (editingIndicatorId.value === null) return; 
  
    if (editingIndicatorValue.value === null || editingIndicatorValue.value === undefined) {
        cancelIndicatorEdit()
        return
    }
    
    // 使用 Store 更新指标
    const updates: Partial<StrategicIndicator> = {}
    
    if (field === 'type1' || field === 'type2') {
        updates[field] = editingIndicatorValue.value
        // 更新 isQualitative 状态如果修改的是 type1
        if (field === 'type1') {
            updates.isQualitative = editingIndicatorValue.value === '定性'
        }
    } else {
        (updates as any)[field] = editingIndicatorValue.value
    }

    // 如果编辑的是核心指标名称，且当前没有指标类型，则设置默认类型为"定性"
    if (field === 'name' && !row.type1) {
        updates.type1 = '定性'
        updates.isQualitative = true
    }
    
    strategicStore.updateIndicator(row.id.toString(), updates)
    cancelIndicatorEdit()
    updateEditTime()
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
    if (editingIndicatorId.value === null) return
  
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
  onMounted(() => {
    document.addEventListener('click', handleGlobalClick, true)
  })
  
  onUnmounted(() => {
    document.removeEventListener('click', handleGlobalClick, true)
  })
  
  // 方法
  const addNewRow = () => {
    isAddingOrEditing.value = true
  }
  
  // 在指定类别中添加新指标
  const addIndicatorToCategory = (category: '发展性' | '基础性') => {
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
    newRow.value = { taskContent: '', name: '', type1: '定性', type2: '发展性', weight: '', remark: '', milestones: [] }
    updateEditTime()
  }
  
  // 保存新行
  const saveNewRow = () => {
    if (!newRow.value.name) return
  
    // 使用 Store 添加指标
    strategicStore.addIndicator({
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
      responsibleDept: selectedDepartment.value || authStore.userDepartment || '未分配',
      ownerDept: selectedDepartment.value || authStore.userDepartment || '未分配',
      responsiblePerson: authStore.userName || '未分配',
      status: 'active',
      isStrategic: true,
      year: timeContext.currentYear,
      statusAudit: []
    })
    cancelAdd()
    updateEditTime()
  }

  // 删除指标
  const deleteIndicator = (indicator: StrategicIndicator) => {
    ElMessageBox.confirm(
      `确定要删除指标 "${indicator.name}" 吗？删除后无法恢复。`,
      '删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    ).then(() => {
      strategicStore.deleteIndicator(indicator.id.toString())
      ElMessage.success('指标已删除')
      updateEditTime()
    })
  }
  
  // 最后编辑时间
  const lastEditTime = ref(new Date().toLocaleString())
  
  // 更新最后编辑时间的函数
  const updateEditTime = () => {
    lastEditTime.value = new Date().toLocaleString()
  }
  
  // 里程碑状态计算
  const calculateMilestoneStatus = (indicator: StrategicIndicator): 'success' | 'warning' | 'exception' => {
    if (!indicator.milestones || indicator.milestones.length === 0) {
      return getProgressStatus(indicator.progress)
    }
  
    const currentDate = new Date()
    const currentYear = currentDate.getFullYear()
  
    // 检查是否有逾期未完成的里程碑
    const hasOverdueMilestone = indicator.milestones.some(milestone => {
      const deadlineDate = new Date(milestone.deadline)
      return milestone.status === 'pending' && deadlineDate < currentDate
    })
  
    // 检查是否有即将到期的里程碑（30天内）
    const hasUpcomingMilestone = indicator.milestones.some(milestone => {
      if (milestone.status === 'completed') return false
      const deadlineDate = new Date(milestone.deadline)
      const daysUntilDeadline = Math.ceil((deadlineDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24))
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
  const getMilestoneProgressText = (indicator: StrategicIndicator): string => {
    if (!indicator.milestones || indicator.milestones.length === 0) {
      return `当前进度: ${indicator.progress}%`
    }
  
    const totalMilestones = indicator.milestones.length
    const completedMilestones = indicator.milestones.filter(m => m.status === 'completed').length
    const overdueMilestones = indicator.milestones.filter(m => m.status === 'overdue').length
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
      // 这里应该调用API进行任务下发
      ElMessage.success(`成功下发${selectedIndicators.value.length}项指标到${assignmentTarget.value}`)
      showAssignmentDialog.value = false
      assignmentTarget.value = ''
      assignmentMethod.value = 'self'
    })
  }
  
  // ================== 详情抽屉 & 单个下发/撤回 ==================

  // 详情抽屉状态
  const detailDrawerVisible = ref(false)
  const currentDetail = ref<StrategicIndicator | null>(null)

  // 审计日志抽屉状态
  const auditLogVisible = ref(false)
  const currentAuditIndicator = ref<StrategicIndicator | null>(null)

  // 查看审计日志
  const handleViewAuditLog = (row: StrategicIndicator) => {
    currentAuditIndicator.value = row
    auditLogVisible.value = true
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
  const handleOpenApprovalDialog = (row: StrategicIndicator) => {
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
    if (!currentApprovalIndicator.value) return

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
    ).then(() => {
      if (isApprove) {
        // 审批通过：更新实际进度，清除待审批状态
        strategicStore.updateIndicator(indicator.id.toString(), {
          progress: pendingProgress,
          progressApprovalStatus: 'approved',
          pendingProgress: undefined,
          pendingRemark: undefined,
          pendingAttachments: undefined
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
          previousStatus: 'pending_approval',
          newStatus: 'active'
        })

        ElMessage.success('审批通过，进度已更新')
      } else {
        // 审批驳回：设置驳回状态，保留待审批数据供查看
        strategicStore.updateIndicator(indicator.id.toString(), {
          progressApprovalStatus: 'rejected'
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
          previousStatus: 'pending_approval',
          newStatus: 'rejected'
        })

        ElMessage.info('已驳回该进度填报')
      }

      closeApprovalDialog()
      updateEditTime()
    })
  }
  
  // 查看详情
  const handleViewDetail = (row: StrategicIndicator) => {
    currentDetail.value = row
    detailDrawerVisible.value = true
  }
  
  // 打开下发弹窗
  const openDistributeDialog = (row: StrategicIndicator) => {
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
      ).then(() => {
        // 为每个目标部门创建指标副本
        pendingRows.forEach(row => {
          // 更新原指标状态
          strategicStore.updateIndicator(row.id.toString(), { canWithdraw: false })
          
          // 为每个额外的目标部门创建副本（第一个部门使用原指标）
          distributeTarget.value.forEach((dept, index) => {
            if (index === 0) {
              // 第一个部门更新原指标的责任部门
              strategicStore.updateIndicator(row.id.toString(), { 
                responsibleDept: dept,
                ownerDept: dept
              })
            } else {
              // 其他部门创建新的指标副本
              strategicStore.addIndicator({
                ...row,
                id: `${Date.now()}-${index}-${row.id}`,
                responsibleDept: dept,
                ownerDept: dept,
                canWithdraw: false,
                progress: 0,
                statusAudit: []
              })
            }
          })
        })
        ElMessage.success(`已成功下发 ${pendingRows.length} 个指标到 ${distributeTarget.value.length} 个部门`)
        closeDistributeDialog()
        updateEditTime()
      })
      return
    }
    
    // 单个下发模式
    if (!currentDistributeItem.value) return
    
    ElMessageBox.confirm(
      `确认将指标 "${currentDistributeItem.value.name}" 下发到以下部门？\n\n${targetDepts}`,
      '下发确认',
      {
        confirmButtonText: '确认下发',
        cancelButtonText: '取消',
        type: 'info'
      }
    ).then(() => {
      const row = currentDistributeItem.value!
      // 更新原指标状态
      strategicStore.updateIndicator(row.id.toString(), { canWithdraw: false })
      
      // 为每个目标部门处理
      distributeTarget.value.forEach((dept, index) => {
        if (index === 0) {
          // 第一个部门更新原指标的责任部门
          strategicStore.updateIndicator(row.id.toString(), { 
            responsibleDept: dept,
            ownerDept: dept
          })
        } else {
          // 其他部门创建新的指标副本
          strategicStore.addIndicator({
            ...row,
            id: `${Date.now()}-${index}-${row.id}`,
            responsibleDept: dept,
            ownerDept: dept,
            canWithdraw: false,
            progress: 0,
            statusAudit: []
          })
        }
      })
      ElMessage.success(`指标已成功下发到 ${distributeTarget.value.length} 个部门`)
      closeDistributeDialog()
      updateEditTime()
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
  const handleWithdraw = (row: StrategicIndicator) => {
    ElMessageBox.confirm(
      `撤回后，该指标将重新变为可下发状态。确认撤回 "${row.name}"？`,
      '撤回操作',
      {
        confirmButtonText: '确认撤回',
        cancelButtonText: '取消',
        type: 'warning'
      }
    ).then(() => {
      strategicStore.updateIndicator(row.id.toString(), { canWithdraw: true })
      ElMessage.info('指标已撤回')
      updateEditTime()
    })
  }

  // 全部下发（下发当前界面所有未下发的指标）
  const handleDistributeAll = () => {
    const pendingRows = indicators.value.filter(r => r.canWithdraw && r.name) // 只下发有核心指标的记录
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
    ).then(() => {
      pendingRows.forEach(row => {
        strategicStore.updateIndicator(row.id.toString(), { canWithdraw: false })
      })
      ElMessage.success(`已成功下发 ${pendingRows.length} 个指标`)
      updateEditTime()
    })
  }
  
  // 按任务整体下发（复用下发弹窗）
  const handleBatchDistributeByTask = (group: { taskContent: string; rows: StrategicIndicator[] }) => {
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
  const handleBatchWithdrawByTask = (group: { taskContent: string; rows: StrategicIndicator[] }) => {
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
    ).then(() => {
      distributedRows.forEach(row => {
        strategicStore.updateIndicator(row.id.toString(), { canWithdraw: true })
      })
      ElMessage.success(`已成功撤回 ${distributedRows.length} 个指标`)
      updateEditTime()
    })
  }

  // 按任务整体删除
  const handleBatchDeleteByTask = (group: { taskContent: string; rows: StrategicIndicator[] }) => {
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
    ).then(() => {
      group.rows.forEach(row => {
        strategicStore.deleteIndicator(row.id.toString())
      })
      ElMessage.success(`已成功删除 ${group.rows.length} 个指标`)
      updateEditTime()
    })
  }
  
  // 删除单个指标
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
      updateEditTime()
    })
  }
  
  // 任务类别颜色映射
  const getCategoryColor = (type2: string) => {
    return type2 === '发展性' ? '#409EFF' : '#67C23A'
  }
  
  // 表格滚动状态
  const tableScrollRef = ref<HTMLElement | null>(null)
  const isTableScrolling = ref(false)
  
  // 监听表格滚动，判断是否需要显示操作列的固定效果
  const handleTableScroll = (e: Event) => {
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
    const currentDate = new Date()
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
    if (progress >= 80) return 'success'
    if (progress >= 50) return 'warning'
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
          <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="toggle-hint">{{ selectedDepartment || '部门' }}</span>
      </div>
  
      <!-- 右侧详情区域 - Excel风格 -->
      <section class="task-detail excel-style card-animate" style="animation-delay: 0.1s;">
        <!-- Excel标题头 -->
        <div class="excel-header">
          <h2 class="excel-title">战略任务指标总表</h2>
        </div>
  
        <!-- Excel工具栏 -->
        <div class="excel-toolbar">
          <div class="toolbar-left">
            <el-button type="primary" size="small" :disabled="isReadOnly" @click.stop="addNewRow">
              <el-icon><Plus /></el-icon>
              新增行
            </el-button>
            <el-button type="success" size="small" :disabled="isReadOnly" @click.stop="handleDistributeAll">
              <el-icon><Promotion /></el-icon>
              下发
            </el-button>
            <el-button size="small">
              <el-icon><Download /></el-icon>
              导出
            </el-button>
          </div>
          <div class="toolbar-right">
            <el-tag v-if="isReadOnly" type="warning" size="small" style="margin-right: 12px;">
              历史快照 (只读)
            </el-tag>
            <span class="update-time">更新时间: {{ new Date().toLocaleString() }}</span>
          </div>
        </div>
  
        <!-- Excel表格 -->
        <div class="excel-table-wrapper">
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

              <el-table-column prop="taskContent" label="战略任务" width="150">
                <template #default="{ row }">
                  <div class="task-cell-wrapper">
                    <div class="indicator-name-cell" @dblclick="handleIndicatorDblClick(row, 'taskContent')">
                      <el-input
                        v-if="editingIndicatorId === row.id && editingIndicatorField === 'taskContent'"
                        v-model="editingIndicatorValue"
                        v-focus
                        type="textarea"
                        :autosize="{ minRows: 2, maxRows: 6 }"
                        @blur="saveIndicatorEdit(row, 'taskContent')"
                        @keyup.esc="cancelIndicatorEdit"
                      />
                      <el-tooltip v-else :content="row.type2 === '发展性' ? '发展性任务' : '基础性任务'" placement="top">
                        <span
                          class="indicator-name-text task-content-colored"
                          :style="{ color: row.type2 === '发展性' ? '#409EFF' : '#67C23A' }"
                        >{{ row.taskContent || '未关联任务' }}</span>
                      </el-tooltip>
                    </div>
                    <!-- 右下角新增指标三角形按钮 -->
                    <div 
                      v-if="!isReadOnly && row.canWithdraw" 
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
                      <el-tooltip v-if="row.name && row.type1" :content="row.type1 === '定性' ? '定性指标' : '定量指标'" placement="top">
                        <span
                          class="indicator-name-text"
                          :class="row.type1 === '定性' ? 'indicator-qualitative' : 'indicator-quantitative'"
                        >{{ row.name }}</span>
                      </el-tooltip>
                      <span v-else class="indicator-name-text placeholder-text">双击编辑指标，如：党员发展质量达标率95%以上</span>
                    </template>
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
                      @keyup.esc="cancelIndicatorEdit"
                    />
                    <span v-else class="indicator-name-text remark-text-wrap">{{ row.remark || '样例：双击编辑说明' }}</span>
                  </div>
                </template>
              </el-table-column>
                <el-table-column prop="weight" label="权重" width="90" align="center">
                  <template #default="{ row }">
                    <span @dblclick="handleIndicatorDblClick(row, 'weight')">
                      <el-input-number
                        v-if="editingIndicatorId === row.id && editingIndicatorField === 'weight'"
                        v-model="editingIndicatorValue"
                        v-focus
                        size="small"
                        :controls="false"
                        style="width: 50px"
                        @blur="saveIndicatorEdit(row, 'weight')"
                        @keyup.enter="saveIndicatorEdit(row, 'weight')"
                      />
                      <span v-else>{{ row.weight }}</span>
                    </span>
                  </template>
                </el-table-column>
                <el-table-column prop="progress" label="进度" width="100" align="center">
                  <template #default="{ row }">
                    <span @dblclick="handleIndicatorDblClick(row, 'progress')">
                      <el-input-number
                        v-if="editingIndicatorId === row.id && editingIndicatorField === 'progress'"
                        v-model="editingIndicatorValue"
                        v-focus
                        size="small"
                        :min="0"
                        :max="100"
                        :controls="false"
                        style="width: 50px"
                        @blur="saveIndicatorEdit(row, 'progress')"
                        @keyup.enter="saveIndicatorEdit(row, 'progress')"
                      />
                      <el-tooltip v-else :content="`当前进度: ${row.progress || 0}%`" placement="top">
                      <el-progress
                        :percentage="row.progress || 0"
                        :stroke-width="8"
                        :color="getProgressColor(row)"
                        :show-text="false"
                        style="width: 80px;"
                      />
                    </el-tooltip>
                  </span>
                </template>
              </el-table-column>
              <el-table-column prop="status" label="状态" width="85" align="center">
                <template #default="{ row }">
                  <div class="status-cell">
                    <!-- 优先显示进度审批状态 -->
                    <el-tag v-if="row.progressApprovalStatus === 'pending'" type="warning" size="small">待审批</el-tag>
                    <el-tag v-else-if="row.progressApprovalStatus === 'rejected'" type="danger" size="small">已驳回</el-tag>
                    <el-tag v-else :type="row.canWithdraw ? 'info' : 'success'" size="small">
                      {{ row.canWithdraw ? '待下发' : '已下发' }}
                    </el-tag>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="120" align="center">
                <template #default="{ row }">
                  <div class="action-buttons-inline">
                    <el-button link type="primary" size="small" @click="handleViewDetail(row)">查看</el-button>
                    <!-- 战略发展部可以审批待审批的进度 -->
                    <el-button 
                      v-if="row.progressApprovalStatus === 'pending' && !isReadOnly" 
                      link 
                      type="success" 
                      size="small" 
                      @click="handleOpenApprovalDialog(row)"
                    >审批</el-button>
                    <el-button v-if="row.canWithdraw && !isReadOnly" link type="danger" size="small" @click="handleDeleteIndicator(row)">删除</el-button>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="批量" width="120" align="center" class-name="batch-column">
                <template #default="{ row }">
                  <div class="batch-buttons"> 
                    <el-button 
                      v-if="getTaskGroup(row).rows.some(r => r.canWithdraw)" 
                      type="primary" 
                      size="small" 
                      :disabled="isReadOnly" 
                      @click="handleBatchDistributeByTask(getTaskGroup(row))"
                    >下发</el-button>
                    <el-button 
                      v-if="getTaskGroup(row).rows.some(r => !r.canWithdraw)" 
                      type="warning" 
                      size="small" 
                      :disabled="isReadOnly" 
                      @click="handleBatchWithdrawByTask(getTaskGroup(row))"
                    >撤回</el-button>
                    <el-button 
                      v-if="getTaskGroup(row).rows.every(r => r.canWithdraw)"
                      type="danger" 
                      size="small" 
                      :disabled="isReadOnly" 
                      @click="handleBatchDeleteByTask(getTaskGroup(row))"
                    >删除</el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>
  
          <!-- 新增行表单 -->
          <div v-if="isAddingOrEditing" class="add-row-form">
            <h3 class="form-title">新增任务指标</h3>
            <el-form label-width="80px">
              <el-row :gutter="16">
                <el-col :span="4">
                  <el-form-item label="任务类型">
                    <el-select v-model="newRow.type2" style="width: 100%" :disabled="!!taskTypeMap[newRow.taskContent]">
                      <el-option label="发展性" value="发展性" />
                      <el-option label="基础性" value="基础性" />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="战略任务">
                    <el-select
                      ref="taskSelectRef"
                      v-model="newRow.taskContent"
                      filterable
                      allow-create
                      default-first-option
                      placeholder="选择或输入战略任务名称"
                      style="width: 100%"
                      @change="handleTaskSelect"
                      @visible-change="handleTaskVisibleChange"
                      :teleported="false"
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
                    <el-select v-model="newRow.type1" style="width: 100%" @change="(val: string) => { if (val === '定量') generateMonthlyMilestones() }">
                      <el-option label="定性" value="定性" />
                      <el-option label="定量" value="定量" />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="核心指标">
                    <el-input v-model="newRow.name" placeholder="设置核心指标内容" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="16">
                <el-col :span="16">
                  <el-form-item label="说明">
                    <el-input v-model="newRow.remark" placeholder="输入指标说明" />
                  </el-form-item>
                </el-col>
                  <el-col :span="4">
                    <el-form-item label="权重">
                      <el-input-number v-model="newRow.weight" :min="0" placeholder="权重" :controls="false" style="width: 100%" />
                    </el-form-item>
                  </el-col>
              </el-row>
              <el-row :gutter="16">
                <el-col :span="24">
                  <el-form-item label="里程碑">
                    <div class="milestone-form-area">
                      <el-button v-if="newRow.type1 === '定性'" size="small" type="primary" plain @click="addMilestone">
                        <el-icon><Plus /></el-icon> 添加里程碑
                      </el-button>
                      <div v-if="newRow.milestones.length > 0" class="milestone-list">
                        <div v-for="(ms, idx) in newRow.milestones" :key="ms.id" class="milestone-item">
                          <span class="milestone-index">{{ idx + 1 }}.</span>
                          <el-input v-model="ms.name" placeholder="里程碑名称" style="width: 160px" size="small" />
                          <el-input-number v-model="ms.targetProgress" :min="0" :max="100" placeholder="目标进度%" size="small" style="width: 110px" />
                          <el-date-picker v-model="ms.deadline" type="date" placeholder="截止日期" size="small" style="width: 130px" value-format="YYYY-MM-DD" />
                          <el-button type="danger" size="small" text @click="removeMilestone(idx)">
                            <el-icon><Delete /></el-icon>
                          </el-button>
                        </div>
                      </div>
                      <span v-else class="milestone-hint">{{ newRow.type1 === '定量' ? '选择定量后自动生成12月里程碑' : '暂无里程碑，点击添加' }}</span>
                    </div>
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row>
                <el-col :span="24" style="text-align: right;">
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
        :before-close="() => { showAssignmentDialog = false; assignmentTarget = ''; assignmentMethod = 'self' }"
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
                <el-radio value="self" v-if="props.selectedRole === '战略发展部'">职能部门完成</el-radio>
                <el-radio value="college" v-if="props.selectedRole === '战略发展部'">分解到职能部门</el-radio>
                <el-radio value="self" v-else-if="props.selectedRole === '教务处' || props.selectedRole === '科研处'">自己完成</el-radio>
                <el-radio value="college" v-if="props.selectedRole === '教务处' || props.selectedRole === '科研处'">下发给学院</el-radio>
              </el-radio-group>
            </el-form-item>
  
            <el-form-item label="目标部门" v-if="assignmentMethod === 'college'">
              <el-select v-model="assignmentTarget" placeholder="选择学院" style="width: 100%;">
                <el-option label="计算机学院" value="计算机学院" />
                <el-option label="艺术与科技学院" value="艺术与科技学院" />
              </el-select>
            </el-form-item>
          </el-form>
        </div>
  
        <template #footer>
          <el-button @click="showAssignmentDialog = false; assignmentTarget = ''; assignmentMethod = 'self'">
            取消
          </el-button>
          <el-button type="primary" @click="confirmAssignment" :disabled="assignmentMethod === 'college' && !assignmentTarget">
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
              <el-tag size="small" :type="currentDetail.type1 === '定量' ? 'primary' : 'warning'">{{ currentDetail.type1 }}</el-tag>
              <el-tag size="small" :style="{ backgroundColor: getCategoryColor(currentDetail.type2), color: '#fff', border: 'none' }">
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
            <el-descriptions-item label="当前进度">{{ currentDetail.progress }}%</el-descriptions-item>
            <el-descriptions-item label="责任部门">{{ currentDetail.responsibleDept }}</el-descriptions-item>
            <el-descriptions-item label="责任人">{{ currentDetail.responsiblePerson }}</el-descriptions-item>
            <el-descriptions-item label="创建时间" :span="2">{{ currentDetail.createTime }}</el-descriptions-item>
            <el-descriptions-item label="说明" :span="2">{{ currentDetail.remark }}</el-descriptions-item>
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

          <!-- 审计日志 - 直接显示完整日志 -->
          <div class="audit-log-section">
            <div class="divider"></div>
            <div class="audit-log-header">
              <h4>审计日志</h4>
              <span v-if="currentDetail.statusAudit && currentDetail.statusAudit.length > 0" class="log-count">
                共 {{ currentDetail.statusAudit.length }} 条记录
              </span>
            </div>
            
            <!-- 审计日志时间线 -->
            <div v-if="currentDetail.statusAudit && currentDetail.statusAudit.length > 0" class="audit-log-timeline">
              <el-timeline>
                <el-timeline-item
                  v-for="log in [...currentDetail.statusAudit].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())"
                  :key="log.id"
                  :type="log.action === 'approve' ? 'success' : log.action === 'reject' ? 'danger' : log.action === 'submit' ? 'primary' : 'warning'"
                  :hollow="false"
                  placement="top"
                >
                  <div class="log-card">
                    <div class="log-header">
                      <el-tag
                        :type="log.action === 'approve' ? 'success' : log.action === 'reject' ? 'danger' : log.action === 'submit' ? 'primary' : 'warning'"
                        size="small"
                        effect="dark"
                      >
                        {{ log.action === 'submit' ? '提交进度' : log.action === 'approve' ? '审批通过' : log.action === 'reject' ? '审批驳回' : log.action === 'revoke' ? '撤回提交' : '更新进度' }}
                      </el-tag>
                      <span class="log-time">{{ new Date(log.timestamp).toLocaleString('zh-CN') }}</span>
                    </div>
                    <div class="log-operator">
                      <span class="operator-name">{{ log.operatorName }}</span>
                      <span class="operator-dept">· {{ log.operatorDept }}</span>
                    </div>
                    <div v-if="log.previousProgress !== undefined && log.newProgress !== undefined" class="log-progress">
                      <span>进度: {{ log.previousProgress }}% → {{ log.newProgress }}%</span>
                    </div>
                    <div v-if="log.comment" class="log-comment">
                      {{ log.comment }}
                    </div>
                  </div>
                </el-timeline-item>
              </el-timeline>
            </div>
            
            <div v-else class="audit-log-empty">
              <span>暂无审计记录</span>
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
            <p><strong>待下发指标数：</strong>{{ currentDistributeGroup.rows.filter(r => r.canWithdraw).length }} 个</p>
            <div class="indicator-list">
              <p><strong>包含指标：</strong></p>
              <ul>
                <li v-for="row in currentDistributeGroup.rows.filter(r => r.canWithdraw)" :key="row.id">{{ row.name }}</li>
              </ul>
            </div>
          </div>
          <el-form label-width="100px" style="margin-top: 20px;">
            <el-form-item label="下发目标">
              <el-select 
                v-model="distributeTarget" 
                multiple 
                placeholder="选择下发目标部门（可多选）" 
                style="width: 100%;"
              >
                <el-option v-for="dept in functionalDepartments" :key="dept" :label="dept" :value="dept" />
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
              <span class="info-value highlight">{{ currentApprovalIndicator.pendingProgress || 0 }}%</span>
              <span class="progress-change">
                ({{ (currentApprovalIndicator.pendingProgress || 0) - (currentApprovalIndicator.progress || 0) > 0 ? '+' : '' }}{{ (currentApprovalIndicator.pendingProgress || 0) - (currentApprovalIndicator.progress || 0) }}%)
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
        v-model:visible="auditLogVisible"
        :indicator="currentAuditIndicator"
        @close="auditLogVisible = false"
      />
    </div>
  </template>
  
  <style scoped>
  /* ========================================
     StrategicTaskView 统一样式
     使用 colors.css 中定义的 CSS 变量
     Requirements: 2.1, 4.1, 5.1, 10.2
     ======================================== */
  
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
    background: linear-gradient(
      90deg,
      rgba(26, 54, 93, 0.08) 0%,
      transparent 50%
    );
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
    background: linear-gradient(135deg, var(--color-primary, #409EFF) 0%, #2c5282 100%);
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
    background: linear-gradient(
      180deg,
      rgba(248, 250, 252, 0.8) 0%,
      transparent 100%
    );
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
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark, #1a365d) 100%);
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

  .milestone-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--bg-white);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-color);
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

  /* 审计日志区域样式 */
  .audit-log-section {
    margin-top: var(--spacing-lg);
  }

  .audit-log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
  }

  .audit-log-header h4 {
    font-size: 16px;
    color: var(--text-main);
    margin: 0;
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
    width: 5px;
  }

  .audit-log-timeline::-webkit-scrollbar-track {
    background: transparent;
  }

  .audit-log-timeline::-webkit-scrollbar-thumb {
    background: var(--border-light, #e2e8f0);
    border-radius: 3px;
  }

  .audit-log-timeline .log-card {
    background: var(--bg-page);
    padding: 12px;
    border-radius: 8px;
  }

  .audit-log-timeline .log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .audit-log-timeline .log-time {
    font-size: 12px;
    color: var(--text-placeholder);
  }

  .audit-log-timeline .log-operator {
    font-size: 13px;
    color: var(--text-regular);
    margin-bottom: 6px;
  }

  .audit-log-timeline .operator-name {
    font-weight: 500;
  }

  .audit-log-timeline .operator-dept {
    color: var(--text-secondary);
  }

  .audit-log-timeline .log-progress {
    font-size: 13px;
    color: var(--color-primary);
    background: var(--bg-white);
    padding: 6px 10px;
    border-radius: 4px;
    margin-bottom: 6px;
  }

  .audit-log-timeline .log-comment {
    font-size: 13px;
    color: var(--text-regular);
    background: var(--bg-white);
    padding: 8px 10px;
    border-radius: 4px;
    border-left: 3px solid var(--color-primary-light, #93c5fd);
  }

  .audit-log-empty {
    background: var(--bg-page);
    padding: var(--spacing-md);
    border-radius: var(--radius-sm);
    text-align: center;
    color: var(--text-placeholder);
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
  </style>