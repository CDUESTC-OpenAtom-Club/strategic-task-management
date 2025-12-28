<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  User, Clock, Document, Check, Close,
  RefreshLeft, Delete, Search
} from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useStrategicStore } from '@/stores/strategic'
import type { StrategicIndicator } from '@/types'

// 接收视角角色（可选）
defineProps<{
  viewingRole?: string
}>()

// 使用共享 Store
const authStore = useAuthStore()
const strategicStore = useStrategicStore()

// ================== 1. 类型定义 (严谨性基础) ==================

// 审批状态枚举
type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'revoked'

interface AuditLog {
  timestamp: string
  action: string
  operator: string
  comment?: string
}

// 里程碑结构
interface Milestone {
  id: number
  name: string
  targetProgress: number
  deadline: string
  status: 'pending' | 'completed' | 'overdue'
}

// 审批项结构（对应截图：序号、任务类别、战略任务、核心指标、权重、说明）
interface ApprovalItem {
  id: string
  indicatorId: string // 关联的指标ID
  indicatorCategory: '发展性任务' | '基础性任务' // 任务类别
  strategicTask: string // 战略任务名称
  coreIndicator: string // 核心指标（即指标名称）
  weight: number // 权重
  remark: string // 说明
  submitter: string // 提交人
  dept: string // 部门
  time: string // 提交时间
  type: '定量' | '定性' // 指标类型
  status: ApprovalStatus
  auditLogs: AuditLog[] // 审批链路日志
  progress: number // 里程碑进度
  milestones: Milestone[] // 里程碑列表
  canWithdraw: boolean // 是否可下发（用于进度条颜色判断）
  targetValue: number // 目标值
}

// ================== 2. 数据源（从 Store 获取） ==================

const currentUser = computed(() => `${authStore.userDepartment}-${authStore.userName}` || '未登录用户')

// 获取当前选中的战略任务名称
const currentTaskName = computed(() => {
  const task = strategicStore.tasks[0] // 默认取第一个任务
  return task?.title || '年度战略任务'
})

// 将 Store 中的指标转换为审批项格式
const convertIndicatorToApprovalItem = (indicator: StrategicIndicator): ApprovalItem => {
  return {
    id: indicator.id,
    indicatorId: indicator.id,
    indicatorCategory: indicator.type2 === '发展性' ? '发展性任务' : '基础性任务',
    strategicTask: indicator.taskContent || currentTaskName.value,
    coreIndicator: indicator.name,
    weight: indicator.weight,
    remark: indicator.remark,
    submitter: indicator.responsiblePerson,
    dept: indicator.responsibleDept,
    time: indicator.createTime,
    type: indicator.type1,
    status: indicator.approvalStatus || 'pending',
    auditLogs: [{ timestamp: indicator.createTime, action: '提交', operator: indicator.responsiblePerson }],
    progress: indicator.progress || 0,
    milestones: indicator.milestones || [],
    canWithdraw: indicator.canWithdraw ?? true,
    targetValue: indicator.targetValue || 100
  }
}

// 待审批数据源（从 Store 中筛选 approvalStatus 为 pending 或未设置的指标）
const pendingList = computed(() => {
  return strategicStore.indicators
    .filter(i => !i.approvalStatus || i.approvalStatus === 'pending')
    .map(convertIndicatorToApprovalItem)
})

// 历史审批数据（已通过或已驳回的指标）
const historyList = ref<ApprovalItem[]>([])

// 按任务类别和战略任务分组
const groupItemsByCategory = (list: ApprovalItem[]) => {
  // 先按任务类别分组（发展性任务、基础性任务）
  const developmentItems = list.filter(i => i.indicatorCategory === '发展性任务')
  const basicItems = list.filter(i => i.indicatorCategory === '基础性任务')
  
  return {
    development: groupByTask(developmentItems),
    basic: groupByTask(basicItems)
  }
}

// 按战略任务分组
const groupByTask = (list: ApprovalItem[]) => {
  const groups: Array<{ strategicTask: string; rows: ApprovalItem[] }> = []
  const indexMap: Record<string, number> = {}

  list.forEach(item => {
    const key = item.strategicTask || '未命名任务'
    if (indexMap[key] === undefined) {
      groups.push({ strategicTask: key, rows: [item] })
      indexMap[key] = groups.length - 1
    } else {
      groups[indexMap[key]].rows.push(item)
    }
  })

  return groups
}

// 分组后的待审批数据
const groupedPendingList = computed(() => groupItemsByCategory(pendingList.value))

// 分组后的历史数据
const groupedHistoryList = computed(() => groupItemsByCategory(filteredHistory.value))

// ================== 3. 业务逻辑 ==================

// --- 搜索逻辑 ---
const searchKeyword = ref('')
const filteredHistory = computed(() => {
  if (!searchKeyword.value) return historyList.value
  return historyList.value.filter(item =>
    item.coreIndicator.includes(searchKeyword.value) ||
    item.submitter.includes(searchKeyword.value) ||
    item.strategicTask.includes(searchKeyword.value)
  )
})

// --- 驳回相关 ---
const rejectDialogVisible = ref(false)
const rejectReason = ref('')
const currentRejectItem = ref<ApprovalItem | null>(null)

// --- 详情抽屉 ---
const detailDrawerVisible = ref(false)
const currentDetail = ref<ApprovalItem | null>(null)

// 1. 审批通过
const handleApprove = (item: ApprovalItem) => {
  ElMessageBox.confirm(`确认同意 "${item.coreIndicator}" 的考核指标申报？`, '审批确认', {
    confirmButtonText: '确认通过',
    cancelButtonText: '取消',
    type: 'success'
  }).then(() => {
    // 更新 Store 中的指标审批状态
    strategicStore.updateIndicator(item.indicatorId, { approvalStatus: 'approved' })

    // 添加到历史记录
    const historyItem: ApprovalItem = {
      ...item,
      status: 'approved',
      auditLogs: [
        ...item.auditLogs,
        {
          timestamp: new Date().toLocaleString(),
          action: '审批通过',
          operator: currentUser.value,
          comment: '同意申报'
        }
      ]
    }
    historyList.value.unshift(historyItem)

    ElMessage.success('审批已通过')
  })
}

// 2. 打开驳回弹窗
const openRejectDialog = (item: ApprovalItem) => {
  currentRejectItem.value = item
  rejectReason.value = ''
  rejectDialogVisible.value = true
}

// 确认驳回
const confirmReject = () => {
  if (!rejectReason.value.trim()) {
    ElMessage.warning('请输入驳回原因，严谨的考核需要反馈依据')
    return
  }
  if (currentRejectItem.value) {
    const item = currentRejectItem.value

    // 更新 Store 中的指标审批状态
    strategicStore.updateIndicator(item.indicatorId, { approvalStatus: 'rejected' })

    // 添加到历史记录
    const historyItem: ApprovalItem = {
      ...item,
      status: 'rejected',
      auditLogs: [
        ...item.auditLogs,
        {
          timestamp: new Date().toLocaleString(),
          action: '审批驳回',
          operator: currentUser.value,
          comment: rejectReason.value
        }
      ]
    }
    historyList.value.unshift(historyItem)

    rejectDialogVisible.value = false
    ElMessage.warning('已驳回该申请')
  }
}

// 3. 撤回 (History -> Pending)
const handleRevoke = (item: ApprovalItem) => {
  ElMessageBox.confirm(
    '撤回后，该单据将重新回到"待我审批"列表，且对方不可见当前审批结果。是否继续？',
    '撤回操作',
    { type: 'warning' }
  ).then(() => {
    // 从历史移除
    const index = historyList.value.findIndex(i => i.id === item.id)
    if (index !== -1) historyList.value.splice(index, 1)

    // 更新 Store 中的指标审批状态为 pending
    strategicStore.updateIndicator(item.indicatorId, { approvalStatus: 'pending' })

    ElMessage.info('已撤回至待审批列表')
  })
}

// 4. 删除记录
const handleDelete = (item: ApprovalItem) => {
  ElMessageBox.confirm(
    '删除后将无法恢复，且审计日志中将保留删除痕迹。确定删除？',
    '高风险操作',
    { confirmButtonText: '彻底删除', confirmButtonClass: 'el-button--danger', type: 'error' }
  ).then(() => {
    const index = historyList.value.findIndex(i => i.id === item.id)
    if (index !== -1) {
      historyList.value.splice(index, 1)
      ElMessage.success('记录已删除')
    }
  })
}

// 5. 查看详情
const handleViewDetail = (item: ApprovalItem) => {
  currentDetail.value = item
  detailDrawerVisible.value = true
}

// 辅助：状态颜色映射
const getStatusTag = (status: string) => {
  const map: Record<string, string> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
    revoked: 'info'
  }
  return map[status] || 'info'
}

const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    pending: '待审批',
    approved: '已通过',
    rejected: '已驳回',
    revoked: '已撤回'
  }
  return map[status]
}

// 任务类别颜色映射
const getCategoryColor = (category: string) => {
  return category === '发展性任务' ? '#409EFF' : '#67C23A'
}

// 进度条颜色计算
// 未下发：灰色 | 任务周期内未达标：黄色 | 超过任务周期未达标：红色 | 任务周期内已达标：绿色
const getProgressColor = (item: ApprovalItem): string => {
  // 未下发的进度条为灰色
  if (item.canWithdraw) {
    return '#C0C4CC'
  }
  
  const progress = item.progress || 0
  const targetValue = item.targetValue || 100
  const isAchieved = progress >= targetValue
  
  // 检查是否有里程碑及其截止日期
  const currentDate = new Date()
  let isOverdue = false
  
  if (item.milestones && item.milestones.length > 0) {
    // 检查最后一个里程碑的截止日期
    const lastMilestone = item.milestones[item.milestones.length - 1]
    if (lastMilestone.deadline) {
      const deadlineDate = new Date(lastMilestone.deadline)
      isOverdue = currentDate > deadlineDate
    }
  }
  
  if (isAchieved) {
    return '#67C23A' // 绿色：已达标
  } else if (isOverdue) {
    return '#F56C6C' // 红色：超过任务周期未达标
  } else {
    return '#E6A23C' // 黄色：任务周期内未达标
  }
}

// 表格滚动状态
const pendingTableScrollRef = ref<HTMLElement | null>(null)
const historyTableScrollRef = ref<HTMLElement | null>(null)
const isPendingTableScrolling = ref(false)
const isHistoryTableScrolling = ref(false)

// 监听表格滚动
const handlePendingTableScroll = (e: Event) => {
  const target = e.target as HTMLElement
  const scrollLeft = target.scrollLeft
  const scrollWidth = target.scrollWidth
  const clientWidth = target.clientWidth
  isPendingTableScrolling.value = scrollLeft < scrollWidth - clientWidth - 2
}

const handleHistoryTableScroll = (e: Event) => {
  const target = e.target as HTMLElement
  const scrollLeft = target.scrollLeft
  const scrollWidth = target.scrollWidth
  const clientWidth = target.clientWidth
  isHistoryTableScrolling.value = scrollLeft < scrollWidth - clientWidth - 2
}

// 批量通过（按任务组）
const handleBatchApprove = (group: { strategicTask: string; rows: ApprovalItem[] }) => {
  const pendingRows = group.rows.filter(r => r.status === 'pending')
  if (pendingRows.length === 0) {
    ElMessage.warning('该任务下所有指标已审批')
    return
  }
  
  ElMessageBox.confirm(
    `确认批量通过任务 "${group.strategicTask}" 下的 ${pendingRows.length} 个指标？`,
    '批量审批确认',
    {
      confirmButtonText: '确认通过',
      cancelButtonText: '取消',
      type: 'success'
    }
  ).then(() => {
    pendingRows.forEach(row => {
      strategicStore.updateIndicator(row.indicatorId, { approvalStatus: 'approved' })
      // 添加到历史记录
      const historyItem: ApprovalItem = {
        ...row,
        status: 'approved',
        auditLogs: [
          ...row.auditLogs,
          {
            timestamp: new Date().toLocaleString(),
            action: '批量审批通过',
            operator: currentUser.value,
            comment: '批量操作'
          }
        ]
      }
      historyList.value.unshift(historyItem)
    })
    ElMessage.success(`已批量通过 ${pendingRows.length} 个指标`)
  })
}
</script>

<template>
  <div class="approval-view">

    <!-- 模块一：待我审批 (表格形式，对应截图结构) -->
    <div class="approval-card pending-section">
      <div class="card-header-row">
        <h3 class="card-title">
          待我审批
          <span class="badge" v-if="pendingList.length > 0">{{ pendingList.length }}</span>
        </h3>
        <div class="header-desc">请严格依据《年度战略考核标准》进行核定</div>
      </div>

      <div v-if="pendingList.length === 0" class="empty-state-mini">
        <el-icon><Check /></el-icon>
        <span>当前无待处理事项，您已完成所有审批。</span>
      </div>

      <!-- 待审批表格（带单元格合并） -->
      <div v-else ref="pendingTableScrollRef" class="approval-table-wrapper" :class="{ 'is-scrolling': isPendingTableScrolling }" @scroll="handlePendingTableScroll">
        <table class="approval-table">
          <thead>
            <tr>
              <th style="width: 60px;">序号</th>
              <th style="width: 120px;">任务类别</th>
              <th style="min-width: 200px;">战略任务</th>
              <th style="min-width: 220px;">核心指标</th>
              <th style="width: 100px;">指标类型</th>
              <th style="width: 80px;">权重</th>
              <th style="width: 150px;">里程碑进度</th>
              <th style="min-width: 180px;">说明</th>
              <th style="width: 160px;">提交信息</th>
              <th class="sticky-col sticky-col-first sticky-col-last cell-center" style="width: 280px;" colspan="2">操作</th>
            </tr>
          </thead>
          <tbody>
            <!-- 发展性任务 -->
            <template v-for="(group, groupIndex) in groupedPendingList.development" :key="'dev-group-' + groupIndex">
              <template v-for="(row, index) in group.rows" :key="'dev-' + row.id">
                <tr class="hover-row">
                  <!-- 序号：第一行合并 -->
                  <td v-if="groupIndex === 0 && index === 0" class="cell-center" :rowspan="pendingList.filter(i => i.indicatorCategory === '发展性任务').length || 1">1</td>
                  <!-- 任务类别：第一行合并 -->
                  <td v-if="groupIndex === 0 && index === 0" class="cell-center" :rowspan="pendingList.filter(i => i.indicatorCategory === '发展性任务').length || 1">
                    <span :style="{ color: getCategoryColor(row.indicatorCategory), fontWeight: 600 }">{{ row.indicatorCategory }}</span>
                  </td>
                  <!-- 战略任务（相同任务合并单元格） -->
                  <td v-if="index === 0" :rowspan="group.rows.length">{{ group.strategicTask }}</td>
                  <!-- 核心指标 -->
                  <td>{{ row.coreIndicator }}</td>
                  <!-- 指标类型 -->
                  <td class="cell-center">
                    <el-tag :type="row.type === '定量' ? 'primary' : 'warning'" size="small" effect="plain">{{ row.type }}</el-tag>
                  </td>
                  <!-- 权重 -->
                  <td class="cell-center"><span class="weight-value">{{ row.weight }}</span></td>
                  <!-- 里程碑进度 -->
                  <td class="cell-center">
                    <div class="progress-cell">
                      <el-progress :percentage="row.progress || 0" :stroke-width="10" :color="getProgressColor(row)" :show-text="false" style="width: 80px;" />
                      <span class="progress-text">{{ row.progress || 0 }}%</span>
                    </div>
                  </td>
                  <!-- 说明 -->
                  <td>{{ row.remark }}</td>
                  <!-- 提交信息 -->
                  <td>
                    <div class="submitter-info">
                      <span><el-icon><User /></el-icon> {{ row.submitter }}</span>
                      <span class="dept-name">{{ row.dept }}</span>
                    </div>
                  </td>
                  <!-- 操作 -->
                  <td class="cell-center sticky-col sticky-col-first">
                    <el-button link type="primary" @click="handleViewDetail(row)">查看</el-button>
                    <el-button link type="danger" @click="openRejectDialog(row)">驳回</el-button>
                    <el-button link type="success" @click="handleApprove(row)">通过</el-button>
                  </td>
                  <!-- 批量处理：每个任务组第一行合并 -->
                  <td v-if="index === 0" class="cell-center sticky-col sticky-col-last" :rowspan="group.rows.length">
                    <el-button type="success" link size="small" @click="handleBatchApprove(group)">批量通过</el-button>
                  </td>
                </tr>
              </template>
            </template>
            <!-- 基础性任务 -->
            <template v-for="(group, groupIndex) in groupedPendingList.basic" :key="'basic-group-' + groupIndex">
              <template v-for="(row, index) in group.rows" :key="'basic-' + row.id">
                <tr class="hover-row">
                  <!-- 序号：第一行合并 -->
                  <td v-if="groupIndex === 0 && index === 0" class="cell-center" :rowspan="pendingList.filter(i => i.indicatorCategory === '基础性任务').length || 1">2</td>
                  <!-- 任务类别：第一行合并 -->
                  <td v-if="groupIndex === 0 && index === 0" class="cell-center" :rowspan="pendingList.filter(i => i.indicatorCategory === '基础性任务').length || 1">
                    <span :style="{ color: getCategoryColor(row.indicatorCategory), fontWeight: 600 }">{{ row.indicatorCategory }}</span>
                  </td>
                  <!-- 战略任务（相同任务合并单元格） -->
                  <td v-if="index === 0" :rowspan="group.rows.length">{{ group.strategicTask }}</td>
                  <!-- 核心指标 -->
                  <td>{{ row.coreIndicator }}</td>
                  <!-- 指标类型 -->
                  <td class="cell-center">
                    <el-tag :type="row.type === '定量' ? 'primary' : 'warning'" size="small" effect="plain">{{ row.type }}</el-tag>
                  </td>
                  <!-- 权重 -->
                  <td class="cell-center"><span class="weight-value">{{ row.weight }}</span></td>
                  <!-- 里程碑进度 -->
                  <td class="cell-center">
                    <div class="progress-cell">
                      <el-progress :percentage="row.progress || 0" :stroke-width="10" :color="getProgressColor(row)" :show-text="false" style="width: 80px;" />
                      <span class="progress-text">{{ row.progress || 0 }}%</span>
                    </div>
                  </td>
                  <!-- 说明 -->
                  <td>{{ row.remark }}</td>
                  <!-- 提交信息 -->
                  <td>
                    <div class="submitter-info">
                      <span><el-icon><User /></el-icon> {{ row.submitter }}</span>
                      <span class="dept-name">{{ row.dept }}</span>
                    </div>
                  </td>
                  <!-- 操作 -->
                  <td class="cell-center sticky-col sticky-col-first">
                    <el-button link type="primary" @click="handleViewDetail(row)">查看</el-button>
                    <el-button link type="danger" @click="openRejectDialog(row)">驳回</el-button>
                    <el-button link type="success" @click="handleApprove(row)">通过</el-button>
                  </td>
                  <!-- 批量处理：每个任务组第一行合并 -->
                  <td v-if="index === 0" class="cell-center sticky-col sticky-col-last" :rowspan="group.rows.length">
                    <el-button type="success" link size="small" @click="handleBatchApprove(group)">批量通过</el-button>
                  </td>
                </tr>
              </template>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 模块二：审批历史 (表格形式) -->
    <div class="approval-card history-section">
      <div class="card-header-row">
        <h3 class="card-title">审批历史记录</h3>
        <div class="search-box">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索指标名称/战略任务/提交人..."
            :prefix-icon="Search"
            clearable
            style="width: 280px;"
          />
        </div>
      </div>

      <!-- 历史审批表格（带单元格合并） -->
      <div ref="historyTableScrollRef" class="approval-table-wrapper" :class="{ 'is-scrolling': isHistoryTableScrolling }" @scroll="handleHistoryTableScroll">
        <table class="approval-table">
          <thead>
            <tr>
              <th style="width: 60px;">序号</th>
              <th style="width: 120px;">任务类别</th>
              <th style="min-width: 180px;">战略任务</th>
              <th style="min-width: 200px;">核心指标</th>
              <th style="width: 100px;">指标类型</th>
              <th style="width: 80px;">权重</th>
              <th style="width: 150px;">里程碑进度</th>
              <th style="width: 100px;">提交人</th>
              <th style="width: 100px;">最终状态</th>
              <th class="sticky-col sticky-col-only" style="width: 200px;">操作</th>
            </tr>
          </thead>
          <tbody v-if="filteredHistory.length > 0">
            <!-- 发展性任务 -->
            <template v-for="(group, groupIndex) in groupedHistoryList.development" :key="'hist-dev-group-' + groupIndex">
              <template v-for="(row, index) in group.rows" :key="'hist-dev-' + row.id">
                <tr class="hover-row">
                  <td v-if="groupIndex === 0 && index === 0" class="cell-center" :rowspan="filteredHistory.filter(i => i.indicatorCategory === '发展性任务').length || 1">1</td>
                  <td v-if="groupIndex === 0 && index === 0" class="cell-center" :rowspan="filteredHistory.filter(i => i.indicatorCategory === '发展性任务').length || 1">
                    <span :style="{ color: getCategoryColor(row.indicatorCategory), fontWeight: 600 }">{{ row.indicatorCategory }}</span>
                  </td>
                  <td v-if="index === 0" :rowspan="group.rows.length">{{ group.strategicTask }}</td>
                  <td>{{ row.coreIndicator }}</td>
                  <td class="cell-center">
                    <el-tag :type="row.type === '定量' ? 'primary' : 'warning'" size="small" effect="plain">{{ row.type }}</el-tag>
                  </td>
                  <td class="cell-center"><span class="weight-value">{{ row.weight }}</span></td>
                  <td class="cell-center">
                    <div class="progress-cell">
                      <el-progress :percentage="row.progress || 0" :stroke-width="10" :color="getProgressColor(row)" :show-text="false" style="width: 80px;" />
                      <span class="progress-text">{{ row.progress || 0 }}%</span>
                    </div>
                  </td>
                  <td class="cell-center">{{ row.submitter }}</td>
                  <td class="cell-center">
                    <el-tag :type="getStatusTag(row.status)" size="small" effect="dark">{{ getStatusLabel(row.status) }}</el-tag>
                  </td>
                  <td class="cell-center sticky-col sticky-col-only">
                    <el-button link type="primary" @click="handleViewDetail(row)">查看</el-button>
                    <el-button link type="warning" @click="handleRevoke(row)">撤回</el-button>
                    <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
                  </td>
                </tr>
              </template>
            </template>
            <!-- 基础性任务 -->
            <template v-for="(group, groupIndex) in groupedHistoryList.basic" :key="'hist-basic-group-' + groupIndex">
              <template v-for="(row, index) in group.rows" :key="'hist-basic-' + row.id">
                <tr class="hover-row">
                  <td v-if="groupIndex === 0 && index === 0" class="cell-center" :rowspan="filteredHistory.filter(i => i.indicatorCategory === '基础性任务').length || 1">2</td>
                  <td v-if="groupIndex === 0 && index === 0" class="cell-center" :rowspan="filteredHistory.filter(i => i.indicatorCategory === '基础性任务').length || 1">
                    <span :style="{ color: getCategoryColor(row.indicatorCategory), fontWeight: 600 }">{{ row.indicatorCategory }}</span>
                  </td>
                  <td v-if="index === 0" :rowspan="group.rows.length">{{ group.strategicTask }}</td>
                  <td>{{ row.coreIndicator }}</td>
                  <td class="cell-center">
                    <el-tag :type="row.type === '定量' ? 'primary' : 'warning'" size="small" effect="plain">{{ row.type }}</el-tag>
                  </td>
                  <td class="cell-center"><span class="weight-value">{{ row.weight }}</span></td>
                  <td class="cell-center">
                    <div class="progress-cell">
                      <el-progress :percentage="row.progress || 0" :stroke-width="10" :color="getProgressColor(row)" :show-text="false" style="width: 80px;" />
                      <span class="progress-text">{{ row.progress || 0 }}%</span>
                    </div>
                  </td>
                  <td class="cell-center">{{ row.submitter }}</td>
                  <td class="cell-center">
                    <el-tag :type="getStatusTag(row.status)" size="small" effect="dark">{{ getStatusLabel(row.status) }}</el-tag>
                  </td>
                  <td class="cell-center sticky-col sticky-col-only">
                    <el-button link type="primary" @click="handleViewDetail(row)">查看</el-button>
                    <el-button link type="warning" @click="handleRevoke(row)">撤回</el-button>
                    <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
                  </td>
                </tr>
              </template>
            </template>
          </tbody>
          <tbody v-else>
            <tr>
              <td colspan="10" class="empty-cell">
                <div class="empty-state">
                  <el-icon :size="48" class="empty-icon"><Document /></el-icon>
                  <p>暂无历史审批记录</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 弹窗：驳回原因 (严谨性要求) -->
    <el-dialog v-model="rejectDialogVisible" title="审批驳回" width="400px">
      <div class="dialog-content">
        <p style="margin-bottom: 10px; color: #606266;">请填写驳回原因，该内容将反馈给提交人：</p>
        <el-input
          v-model="rejectReason"
          type="textarea"
          rows="3"
          placeholder="例如：数据佐证不足，请补充附件后重新提交..."
        />
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="rejectDialogVisible = false">取消</el-button>
          <el-button type="danger" @click="confirmReject">确认驳回</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 抽屉：查看详情 & 审计追踪 -->
    <el-drawer v-model="detailDrawerVisible" title="考核指标详情追溯" size="45%">
      <div v-if="currentDetail" class="detail-container">
        <!-- 基础信息 -->
        <div class="detail-header">
          <h3>{{ currentDetail.coreIndicator }}</h3>
          <div class="detail-tags">
            <el-tag size="small" :type="currentDetail.type === '定量' ? 'primary' : 'warning'">{{ currentDetail.type }}</el-tag>
            <el-tag size="small" :style="{ backgroundColor: getCategoryColor(currentDetail.indicatorCategory), color: '#fff', border: 'none' }">
              {{ currentDetail.indicatorCategory }}
            </el-tag>
          </div>
        </div>

        <el-descriptions :column="2" border class="detail-desc">
          <el-descriptions-item label="战略任务" :span="2">{{ currentDetail.strategicTask }}</el-descriptions-item>
          <el-descriptions-item label="任务类别">{{ currentDetail.indicatorCategory }}</el-descriptions-item>
          <el-descriptions-item label="权重">{{ currentDetail.weight }}</el-descriptions-item>
          <el-descriptions-item label="提交人员">{{ currentDetail.submitter }}</el-descriptions-item>
          <el-descriptions-item label="所属部门">{{ currentDetail.dept }}</el-descriptions-item>
          <el-descriptions-item label="提交时间" :span="2">{{ currentDetail.time }}</el-descriptions-item>
          <el-descriptions-item label="说明" :span="2">{{ currentDetail.remark }}</el-descriptions-item>
        </el-descriptions>

        <div class="divider"></div>

        <!-- 核心：审批链路日志 -->
        <h4>审批流转记录 (Audit Trail)</h4>
        <el-timeline style="margin-top: 20px; padding-left: 5px;">
          <el-timeline-item
            v-for="(log, index) in currentDetail.auditLogs"
            :key="index"
            :timestamp="log.timestamp"
            :type="index === currentDetail.auditLogs.length - 1 ? 'primary' : ''"
            placement="top"
          >
            <div class="timeline-card">
              <div class="timeline-header">
                <span class="action-text">{{ log.action }}</span>
                <span class="operator-text">操作人: {{ log.operator }}</span>
              </div>
              <div v-if="log.comment" class="timeline-comment">
                "{{ log.comment }}"
              </div>
            </div>
          </el-timeline-item>
        </el-timeline>
      </div>
    </el-drawer>

  </div>
</template>

<style scoped>
/* ========================================
   ApprovalView 统一样式
   使用 colors.css 中定义的 CSS 变量
   ======================================== */

/* 页面主容器 */
.approval-view {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2xl);
  max-width: 1200px;
  margin: 0 auto;
}

/* ========================================
   卡片样式 - 使用统一的卡片规范
   Requirements: 2.1, 2.2
   ======================================== */
.approval-card {
  background: var(--bg-white);
  border-radius: var(--radius-lg);
  padding: var(--spacing-2xl);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-card);
  transition: box-shadow var(--transition-normal);
}

.approval-card:hover {
  box-shadow: var(--shadow-hover);
}

/* 待办卡片顶部强调条 */
.pending-section {
  border-top: 4px solid var(--color-warning);
}

/* 历史卡片顶部强调条 */
.history-section {
  border-top: 4px solid var(--text-secondary);
}

/* ========================================
   卡片头部样式 - 统一页面头部规范
   Requirements: 5.1, 5.2, 5.3, 5.4
   ======================================== */
.card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-xl);
  padding-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--border-light);
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-main);
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

/* 徽章样式 */
.badge {
  background: var(--color-danger);
  color: var(--bg-white);
  font-size: 12px;
  padding: 2px var(--spacing-sm);
  border-radius: 10px;
  font-weight: normal;
}

/* 头部描述文字 */
.header-desc {
  font-size: 13px;
  color: var(--text-secondary);
}

/* ========================================
   空状态样式 - 统一空状态规范
   Requirements: 7.1, 7.2, 7.3
   ======================================== */
.empty-state-mini {
  padding: var(--spacing-2xl);
  text-align: center;
  color: var(--color-success);
  background: rgba(103, 194, 58, 0.1);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: calc(var(--spacing-2xl) * 2) 0;
  color: var(--text-secondary);
}

.empty-icon {
  opacity: 0.5;
  margin-bottom: var(--spacing-sm);
}

/* ========================================
   抽屉详情样式
   ======================================== */
.detail-header {
  margin-bottom: var(--spacing-xl);
}

.detail-header h3 {
  margin: 0 0 var(--spacing-md) 0;
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

/* 时间线卡片 */
.timeline-card {
  padding: var(--spacing-md);
  background: var(--bg-page);
  border-radius: var(--radius-sm);
}

.timeline-header {
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: var(--text-main);
}

.operator-text {
  font-weight: normal;
  color: var(--text-secondary);
  font-size: 12px;
}

.timeline-comment {
  margin-top: var(--spacing-sm);
  color: var(--text-regular);
  font-size: 13px;
  font-style: italic;
}

/* ========================================
   表格相关样式
   ======================================== */
.core-indicator-cell {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.indicator-name {
  font-weight: 500;
  color: var(--text-main);
  line-height: 1.4;
}

.weight-value {
  font-weight: 600;
  color: var(--color-primary);
}

.submitter-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
}

.submitter-info span {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  color: var(--text-regular);
}

.dept-name {
  color: var(--text-secondary);
  font-size: 12px;
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
   审批表格样式 - 统一表格规范
   Requirements: 4.1, 4.2, 4.3, 4.4
   ======================================== */
.approval-table-wrapper {
  overflow-x: auto;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
}

.approval-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 14px;
}

.approval-table th,
.approval-table td {
  border: 1px solid var(--border-color);
  padding: var(--spacing-md) var(--spacing-sm);
  text-align: left;
  vertical-align: middle;
}

/* 表头样式 - 使用统一背景色 */
.approval-table th {
  background: var(--bg-light);
  color: var(--text-regular);
  font-weight: 600;
  white-space: nowrap;
}

/* 表格行悬停效果 - 使用实色背景 */
.approval-table .hover-row:hover {
  background: #f0f7ff;
}

.approval-table .cell-center {
  text-align: center;
}

.approval-table .empty-cell {
  text-align: center;
  padding: calc(var(--spacing-2xl) * 2) 0;
}

/* ========================================
   Sticky 列样式
   ======================================== */
.approval-table .sticky-col {
  position: sticky;
  background: var(--bg-white);
  z-index: 2;
}

.approval-table .sticky-col-first {
  right: 100px;
  min-width: 150px;
}

.approval-table .sticky-col-last {
  right: 0;
  min-width: 100px;
}

.approval-table .sticky-col-only {
  right: 0;
}

.approval-table thead .sticky-col {
  background: var(--bg-light);
  z-index: 11;
}

/* 滚动时显示阴影和边框 */
.approval-table-wrapper.is-scrolling .sticky-col-first {
  box-shadow: -4px 0 8px rgba(0, 0, 0, 0.1);
  border-left: 1px solid var(--border-color);
}

.approval-table-wrapper.is-scrolling .sticky-col-only {
  box-shadow: -4px 0 8px rgba(0, 0, 0, 0.1);
  border-left: 1px solid var(--border-color);
}

/* hover 时固定列背景 - 使用实色背景 */
.approval-table .hover-row:hover .sticky-col {
  background: #f0f7ff;
}

/* ========================================
   操作按钮样式
   ======================================== */
.approval-table td .el-button {
  margin: 0 2px;
}

.approval-table .cell-center .el-button + .el-button {
  margin-left: var(--spacing-xs);
}

/* 操作列按钮容器 */
.approval-table .sticky-col-first,
.approval-table .sticky-col-only {
  white-space: nowrap;
}

/* 批量处理按钮样式 */
.approval-table .sticky-col-last .el-button {
  font-weight: 500;
}

/* ========================================
   表格行样式 - 斑马纹和悬停效果
   Requirements: 4.2, 4.3
   ======================================== */
.approval-table tbody tr {
  transition: background-color var(--transition-fast);
}

/* 斑马纹 - 偶数行 */
.approval-table tbody tr:nth-child(even) {
  background-color: var(--bg-page);
}

/* 悬停高亮 - 使用实色背景 */
.approval-table tbody tr:hover {
  background-color: #f0f7ff;
}

/* 合并单元格样式优化 */
.approval-table td[rowspan] {
  vertical-align: middle;
  background-color: var(--bg-white);
  font-weight: 500;
}

/* ========================================
   标签样式 - 统一标签间距
   Requirements: 9.1, 9.3
   ======================================== */
.detail-tags :deep(.el-tag) {
  margin-right: 0;
}

/* ========================================
   弹窗样式优化
   Requirements: 6.4
   ======================================== */
.dialog-content p {
  margin-bottom: var(--spacing-md);
  color: var(--text-regular);
}
</style>