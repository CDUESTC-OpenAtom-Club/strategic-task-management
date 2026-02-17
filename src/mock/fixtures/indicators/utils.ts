/**
 * 指标数据工具函数
 */
import type { Milestone } from '@/types'

// 生成季度里程碑（历史数据里程碑大部分已完成）
export const generateQuarterlyMilestones = (year: number, progress: number): Milestone[] => {
  const milestones: Milestone[] = []
  for (let q = 1; q <= 4; q++) {
    const targetProgress = q * 25
    const deadline = `${year}-${String(q * 3).padStart(2, '0')}-${q === 1 ? '31' : q === 2 ? '30' : q === 3 ? '30' : '31'}`
    const status: 'completed' | 'pending' | 'overdue' = progress >= targetProgress ? 'completed' : 'pending'
    milestones.push({
      id: `hist-${year}-${q}`,
      name: `Q${q}: 阶段目标`,
      targetProgress,
      deadline,
      status
    })
  }
  return milestones
}

// 别名：生成历史数据里程碑（与 generateQuarterlyMilestones 相同）
export const generateHistoricalMilestones = generateQuarterlyMilestones

// 生成12个月里程碑
export const generateMonthlyMilestones = (year: number, progress: number): Milestone[] => {
  const milestones: Milestone[] = []
  for (let month = 1; month <= 12; month++) {
    const lastDay = new Date(year, month, 0).getDate()
    const targetProgress = Math.round((month / 12) * 100)
    const deadline = `${year}-${String(month).padStart(2, '0')}-${lastDay}`
    const status: 'completed' | 'pending' | 'overdue' = progress >= targetProgress ? 'completed' : 'pending'
    milestones.push({
      id: `hist-${year}-m${month}`,
      name: `${month}月: 阶段目标`,
      targetProgress,
      deadline,
      status
    })
  }
  return milestones
}
