
// ===========================================
// 告警数据类型定义（与后端对齐）
// ===========================================

export interface Alert {
  alertId: number
  indicatorId: number
  alertType: 'PROGRESS_DELAY' | 'QUALITY_ISSUE' | 'TARGET_MISSED' | 'RISK'
  severity: 'SEVERE' | 'MODERATE' | 'LOW'
  title: string
  description: string
  status: 'ACTIVE' | 'RESOLVED' | 'IGNORED'
  assignee: string
  assigneeDept: string
  createdAt: string
  updatedAt: string
  resolvedAt?: string
  resolutionNotes?: string
}

// ===========================================
// 模拟告警数据
// ===========================================

export const mockAlerts: Alert[] = [
  {
    alertId: 1,
    indicatorId: 1,
    alertType: 'PROGRESS_DELAY',
    severity: 'SEVERE',
    title: '国家级项目立项数进度严重滞后',
    description: '指标"国家级项目立项数"当前进度仅为50%，距离目标值还有较大差距',
    status: 'ACTIVE',
    assignee: '张三',
    assigneeDept: '科研处',
    createdAt: '2025-11-10T09:00:00Z',
    updatedAt: '2025-11-10T09:00:00Z'
  },
  {
    alertId: 2,
    indicatorId: 4,
    alertType: 'TARGET_MISSED',
    severity: 'MODERATE',
    title: '就业率指标未达到预期目标',
    description: '指标"就业率"当前值为85%，低于目标值95%',
    status: 'ACTIVE',
    assignee: '赵六',
    assigneeDept: '学生处',
    createdAt: '2025-11-08T14:30:00Z',
    updatedAt: '2025-11-08T14:30:00Z'
  },
  {
    alertId: 3,
    indicatorId: 3,
    alertType: 'QUALITY_ISSUE',
    severity: 'LOW',
    title: '课程满意度指标质量下降',
    description: '指标"课程满意度"当前值为88分，较上月下降5分',
    status: 'RESOLVED',
    assignee: '王五',
    assigneeDept: '教务处',
    createdAt: '2025-11-05T10:15:00Z',
    updatedAt: '2025-11-07T16:45:00Z',
    resolvedAt: '2025-11-07T16:45:00Z',
    resolutionNotes: '已组织课程评估反馈会议，制定改进措施'
  },
  {
    alertId: 4,
    indicatorId: 2,
    alertType: 'PROGRESS_DELAY',
    severity: 'MODERATE',
    title: '科研经费到账额进度滞后',
    description: '指标"科研经费到账额"当前进度为60%，距离目标值还有40%',
    status: 'ACTIVE',
    assignee: '李四',
    assigneeDept: '科研处',
    createdAt: '2025-11-03T09:30:00Z',
    updatedAt: '2025-11-03T09:30:00Z'
  },
  {
    alertId: 5,
    indicatorId: 5,
    alertType: 'RISK',
    severity: 'LOW',
    title: '博士学位授权点建设风险提示',
    description: '指标"博士学位授权点建设"进度缓慢，存在未达到要求的风险',
    status: 'ACTIVE',
    assignee: '孙七',
    assigneeDept: '研究生院',
    createdAt: '2025-11-01T14:00:00Z',
    updatedAt: '2025-11-01T14:00:00Z'
  }
]

