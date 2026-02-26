/**
 * Mock 数据文件
 * 用于在没有后端服务的情况下提供模拟数据
 */

import type {
  UserRole,
  StrategicIndicator,
  Task,
  Milestone,
  ApprovalStatus
} from '@/types'

// ===========================================
// Mock 用户数据
// ===========================================

export const mockUsers = {
  // 战略部门管理员
  admin: {
    id: '1',
    username: 'admin',
    realName: '系统管理员',
    orgType: 'strategic_dept' as UserRole,
    orgName: '战略发展部',
    email: 'admin@sism.edu.cn',
    phone: '13800138000'
  },

  // 职能部门用户
  functional: {
    id: '2',
    username: 'functional',
    realName: '张三',
    orgType: 'functional_dept' as UserRole,
    orgName: '人事处',
    email: 'zhangsan@sism.edu.cn',
    phone: '13800138001'
  },

  // 二级学院用户
  college: {
    id: '3',
    username: 'college',
    realName: '李四',
    orgType: 'secondary_college' as UserRole,
    orgName: '计算机学院',
    email: 'lisi@sism.edu.cn',
    phone: '13800138002'
  }
}

// ===========================================
// Mock 系统公告
// ===========================================

export const mockAnnouncements = [
  {
    id: '1',
    title: '2025年度战略指标填报工作已启动',
    content: '请各部门于12月15日前完成数据提交',
    type: 'info',
    publishTime: '2025-12-01 10:00:00',
    publisher: '战略发展部'
  },
  {
    id: '2',
    title: '系统维护通知',
    content: '系统维护时间：每周日 02:00-06:00',
    type: 'warning',
    publishTime: '2025-12-01 09:00:00',
    publisher: '信息化建设办公室'
  }
]

// ===========================================
// Mock 战略指标数据
// ===========================================

function createMockIndicator(
  id: string,
  name: string,
  weight: number,
  targetValue: number,
  currentValue: number,
  status: ApprovalStatus
): StrategicIndicator {
  return {
    id,
    name,
    weight,
    targetValue,
    currentValue,
    progress: (currentValue / targetValue) * 100,
    status,
    orgName: '战略发展部',
    responsiblePerson: '张三',
    description: `${name}的详细描述`,
    milestones: [],
    tasks: [],
    auditTrail: [],
    createdAt: '2025-01-01 10:00:00',
    updatedAt: '2025-12-06 10:00:00'
  }
}

export const mockIndicators: StrategicIndicator[] = [
  createMockIndicator(
    'IND001',
    '年度科研项目立项数',
    85,
    100,
    78,
    'approved'
  ),
  createMockIndicator(
    'IND002',
    '高质量论文发表数',
    90,
    50,
    45,
    'approved'
  ),
  createMockIndicator(
    'IND003',
    '科研经费到账额（万元）',
    80,
    5000,
    4200,
    'approved'
  ),
  createMockIndicator(
    'IND004',
    '国家级平台建设',
    75,
    3,
    2,
    'pending'
  ),
  createMockIndicator(
    'IND005',
    '人才引进计划完成率',
    88,
    20,
    18,
    'approved'
  )
]

// ===========================================
// Mock 任务数据
// ===========================================

export const mockTasks: Task[] = [
  {
    id: 'TASK001',
    title: '国家级科研项目申报',
    content: '组织申报2025年度国家自然科学基金项目',
    indicatorId: 'IND001',
    responsibleDept: '科研处',
    executor: '李四',
    deadline: '2025-06-30',
    status: 'in_progress',
    priority: 'high',
    progress: 65,
    description: '负责组织全校教师申报国家自然科学基金项目',
    createdAt: '2025-01-15 10:00:00',
    updatedAt: '2025-12-05 14:30:00'
  },
  {
    id: 'TASK002',
    title: '高质量论文统计',
    content: '统计2025年度发表的高水平论文数量',
    indicatorId: 'IND002',
    responsibleDept: '科研处',
    executor: '王五',
    deadline: '2025-12-31',
    status: 'pending',
    priority: 'medium',
    progress: 30,
    description: '汇总全校SCI、EI论文发表情况',
    createdAt: '2025-01-20 09:00:00',
    updatedAt: '2025-12-01 10:00:00'
  },
  {
    id: 'TASK003',
    title: '科研经费统计',
    content: '统计2025年度科研经费到账情况',
    indicatorId: 'IND003',
    responsibleDept: '财务处',
    executor: '赵六',
    deadline: '2025-12-31',
    status: 'in_progress',
    priority: 'high',
    progress: 80,
    description: '统计各部门科研经费到账情况',
    createdAt: '2025-01-10 08:00:00',
    updatedAt: '2025-12-05 16:00:00'
  }
]

// ===========================================
// Mock 里程碑数据
// ===========================================

export const mockMilestones: Milestone[] = [
  {
    id: 'MIL001',
    indicatorId: 'IND001',
    name: '第一季度项目申报',
    targetDate: '2025-03-31',
    actualDate: '2025-03-30',
    status: 'completed',
    description: '完成第一季度项目申报工作'
  },
  {
    id: 'MIL002',
    indicatorId: 'IND001',
    name: '年中项目评审',
    targetDate: '2025-06-30',
    actualDate: null,
    status: 'pending',
    description: '组织年中项目评审会议'
  },
  {
    id: 'MIL003',
    indicatorId: 'IND002',
    name: '论文发表统计',
    targetDate: '2025-12-31',
    actualDate: null,
    status: 'in_progress',
    description: '完成全年论文发表统计'
  }
]

// ===========================================
// Mock 仪表板数据
// ===========================================

export const mockDashboardData = {
  overview: {
    totalIndicators: 5,
    completedIndicators: 3,
    inProgressIndicators: 1,
    pendingIndicators: 1,
    averageProgress: 85.2
  },
  trend: {
    labels: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    data: [20, 35, 45, 55, 62, 68, 72, 76, 80, 82, 84, 85.2]
  },
  distribution: [
    { name: '科研类', value: 35, color: '#5470c6' },
    { name: '教学类', value: 25, color: '#91cc75' },
    { name: '人才类', value: 20, color: '#fac858' },
    { name: '平台类', value: 12, color: '#ee6666' },
    { name: '其他', value: 8, color: '#73c0de' }
  ]
}

// ===========================================
// Mock API 响应生成器
// ===========================================

export function createMockResponse<T>(data: T, message = '操作成功') {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  }
}

export function createMockError(code: string, message: string) {
  return {
    success: false,
    code,
    message,
    timestamp: new Date().toISOString()
  }
}
