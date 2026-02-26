/**
 * 统一的模拟指标数据
 *
 * ⚠️ 已废弃：现在所有数据都从后端真实数据库获取
 * 数据库：PostgreSQL @ 175.24.139.148:8386/strategic
 *
 * @deprecated 此文件已废弃，请使用后端API获取真实数据
 * @see src/api/fallback.ts 降级机制已禁用
 */
import type { StrategicIndicator, Milestone, DashboardData, DepartmentProgress } from '@/types'

// ============ 工具函数 ============

/**
 * 生成季度里程碑
 */
export const generateQuarterlyMilestones = (year: number, progress: number): Milestone[] => {
  const milestones: Milestone[] = []
  for (let q = 1; q <= 4; q++) {
    const targetProgress = q * 25
    const deadline = `${year}-${String(q * 3).padStart(2, '0')}-${q === 1 ? '31' : q === 2 ? '30' : q === 3 ? '30' : '31'}`
    const status: 'completed' | 'pending' | 'overdue' = progress >= targetProgress ? 'completed' : 'pending'
    milestones.push({
      id: `mock-${year}-q${q}`,
      name: `Q${q}: 阶段目标`,
      targetProgress,
      deadline,
      status
    })
  }
  return milestones
}

// ============ 模拟指标数据 ============

/**
 * 2026年指标数据（当前工作年份）
 */
export const mockIndicators2026: StrategicIndicator[] = [
  // 战略任务1：全力促进毕业生多元化高质量就业创业
  {
    id: '2026-101',
    name: '优质就业比例不低于15%',
    isQualitative: false,
    type1: '定量',
    type2: '发展性',
    progress: 8,
    createTime: '2026年1月5日',
    weight: 20,
    remark: '力争突破',
    canWithdraw: false,
    taskContent: '全力促进毕业生多元化高质量就业创业',
    milestones: generateQuarterlyMilestones(2026, 8),
    targetValue: 15,
    unit: '%',
    responsibleDept: '就业创业指导中心',
    responsiblePerson: '张老师',
    status: 'active',
    isStrategic: true,
    ownerDept: '战略发展部',
    year: 2026,
    statusAudit: []
  },
  {
    id: '2026-102',
    name: '毕业生就业率不低于95%',
    isQualitative: false,
    type1: '定量',
    type2: '发展性',
    progress: 12,
    createTime: '2026年1月5日',
    weight: 20,
    remark: '确保就业率稳定',
    canWithdraw: false,
    taskContent: '全力促进毕业生多元化高质量就业创业',
    milestones: generateQuarterlyMilestones(2026, 12),
    targetValue: 95,
    unit: '%',
    responsibleDept: '就业创业指导中心',
    responsiblePerson: '张老师',
    status: 'active',
    isStrategic: true,
    ownerDept: '战略发展部',
    year: 2026,
    statusAudit: []
  },
  {
    id: '2026-401',
    name: '提升教学质量，课程优良率达87%以上',
    isQualitative: false,
    type1: '定量',
    type2: '基础性',
    progress: 12,
    createTime: '2026年1月5日',
    weight: 30,
    remark: '中长期发展规划核心内容',
    canWithdraw: false,
    taskContent: '全力促进毕业生多元化高质量就业创业',
    milestones: generateQuarterlyMilestones(2026, 12),
    targetValue: 87,
    unit: '%',
    responsibleDept: '教务处',
    responsiblePerson: '陈处长',
    status: 'active',
    isStrategic: true,
    ownerDept: '战略发展部',
    year: 2026,
    statusAudit: []
  },
  // 二级学院子指标
  {
    id: '2026-101-1',
    name: '计算机学院优质就业比例不低于18%',
    isQualitative: false,
    type1: '定量',
    type2: '发展性',
    progress: 15,
    createTime: '2026年1月10日',
    weight: 25,
    remark: '工科学院就业质量要求更高',
    canWithdraw: false,
    taskContent: '全力促进毕业生多元化高质量就业创业',
    milestones: generateQuarterlyMilestones(2026, 15),
    targetValue: 18,
    unit: '%',
    responsibleDept: '计算机学院',
    responsiblePerson: '赵院长',
    status: 'active',
    isStrategic: false,
    ownerDept: '就业创业指导中心',
    parentIndicatorId: '2026-101',
    year: 2026,
    progressApprovalStatus: 'pending',
    pendingProgress: 20,
    pendingRemark: '已完成Q1就业数据统计，优质就业比例达到20%',
    statusAudit: []
  },
  {
    id: '2026-401-1',
    name: '计算机学院课程优良率达90%',
    isQualitative: false,
    type1: '定量',
    type2: '基础性',
    progress: 10,
    createTime: '2026年1月10日',
    weight: 25,
    remark: '工科专业教学质量领先',
    canWithdraw: false,
    taskContent: '全力促进毕业生多元化高质量就业创业',
    milestones: generateQuarterlyMilestones(2026, 10),
    targetValue: 90,
    unit: '%',
    responsibleDept: '计算机学院',
    responsiblePerson: '赵院长',
    status: 'active',
    isStrategic: false,
    ownerDept: '教务处',
    parentIndicatorId: '2026-401',
    year: 2026,
    progressApprovalStatus: 'pending',
    pendingProgress: 15,
    pendingRemark: '本学期课程优良率统计完成，达到15%',
    statusAudit: []
  }
]

/**
 * 历史年份指标数据（精简版，用于降级）
 */
export const mockIndicators2025: StrategicIndicator[] = [
  {
    id: '2025-101',
    name: '课程优良率达85%以上',
    isQualitative: false,
    type1: '定量',
    type2: '基础性',
    progress: 76,
    createTime: '2025年1月6日',
    weight: 30,
    remark: '2025年度教学质量核心指标',
    canWithdraw: false,
    taskContent: '提升教学质量，深化教学改革',
    milestones: generateQuarterlyMilestones(2025, 76),
    targetValue: 85,
    unit: '%',
    responsibleDept: '教务处',
    responsiblePerson: '陈处长',
    status: 'archived',
    isStrategic: true,
    ownerDept: '战略发展部',
    year: 2025,
    statusAudit: []
  },
  {
    id: '2025-301',
    name: '毕业生就业率达90%以上',
    isQualitative: false,
    type1: '定量',
    type2: '基础性',
    progress: 90,
    createTime: '2025年1月6日',
    weight: 35,
    remark: '就业工作核心指标',
    canWithdraw: false,
    taskContent: '全力促进毕业生多元化高质量就业创业',
    milestones: generateQuarterlyMilestones(2025, 90),
    targetValue: 90,
    unit: '%',
    responsibleDept: '就业创业指导中心',
    responsiblePerson: '张老师',
    status: 'archived',
    isStrategic: true,
    ownerDept: '战略发展部',
    year: 2025,
    statusAudit: []
  }
]

// ============ 合并导出 ============

/**
 * 所有模拟指标数据
 */
export const allMockIndicators: StrategicIndicator[] = [
  ...mockIndicators2026,
  ...mockIndicators2025
]

/**
 * 按年份获取指标
 */
export function getMockIndicatorsByYear(year: number): StrategicIndicator[] {
  return allMockIndicators.filter(ind => ind.year === year)
}

/**
 * 获取当前年份指标（2026）
 */
export function getCurrentYearMockIndicators(): StrategicIndicator[] {
  return mockIndicators2026
}

// ============ 模拟仪表盘数据 ============

export const mockDashboardData: DashboardData = {
  totalScore: 87.5,
  basicScore: 92.3,
  developmentScore: 15.8,
  completionRate: 75.2,
  warningCount: 3,
  totalIndicators: allMockIndicators.length,
  completedIndicators: allMockIndicators.filter(i => i.progress >= 100).length,
  alertIndicators: {
    severe: 1,
    moderate: 2,
    normal: allMockIndicators.length - 3
  }
}

// ============ 模拟部门进度数据 ============

export const mockDepartmentProgress: DepartmentProgress[] = [
  { dept: '教务处', progress: 85, score: 89.5, status: 'success', totalIndicators: 5, completedIndicators: 4, alertCount: 0 },
  { dept: '科技处', progress: 72, score: 78.3, status: 'warning', totalIndicators: 4, completedIndicators: 2, alertCount: 1 },
  { dept: '就业创业指导中心', progress: 65, score: 71.2, status: 'warning', totalIndicators: 6, completedIndicators: 3, alertCount: 1 },
  { dept: '人力资源部', progress: 90, score: 94.1, status: 'success', totalIndicators: 3, completedIndicators: 3, alertCount: 0 },
  { dept: '计算机学院', progress: 55, score: 62.8, status: 'exception', totalIndicators: 8, completedIndicators: 3, alertCount: 2 },
  { dept: '商学院', progress: 68, score: 72.5, status: 'warning', totalIndicators: 6, completedIndicators: 3, alertCount: 1 },
  { dept: '工学院', progress: 75, score: 80.2, status: 'success', totalIndicators: 5, completedIndicators: 4, alertCount: 0 }
]

// ============ 模拟组织树数据 ============

export const mockOrgTree = {
  id: 'root',
  name: '学校',
  children: [
    {
      id: 'strategic',
      name: '战略发展部',
      type: 'strategic_dept'
    },
    {
      id: 'functional',
      name: '职能部门',
      children: [
        { id: 'jiaowu', name: '教务处', type: 'functional_dept' },
        { id: 'keji', name: '科技处', type: 'functional_dept' },
        { id: 'jiuye', name: '就业创业指导中心', type: 'functional_dept' },
        { id: 'renli', name: '人力资源部', type: 'functional_dept' },
        { id: 'caiwu', name: '财务部', type: 'functional_dept' }
      ]
    },
    {
      id: 'colleges',
      name: '二级学院',
      children: [
        { id: 'jisuanji', name: '计算机学院', type: 'secondary_college' },
        { id: 'shangxue', name: '商学院', type: 'secondary_college' },
        { id: 'gongxue', name: '工学院', type: 'secondary_college' },
        { id: 'wenli', name: '文理学院', type: 'secondary_college' },
        { id: 'yishu', name: '艺术与科技学院', type: 'secondary_college' },
        { id: 'hangkong', name: '航空学院', type: 'secondary_college' },
        { id: 'guoji', name: '国际教育学院', type: 'secondary_college' },
        { id: 'makesi', name: '马克思主义学院', type: 'secondary_college' }
      ]
    }
  ]
}
