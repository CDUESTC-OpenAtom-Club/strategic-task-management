/**
 * Task Feature Utilities
 */

import type { StrategicTask, TaskStatus } from '../model/types'

/**
 * 计算任务进度百分比
 */
export function calculateTaskProgress(task: StrategicTask): number {
  // 基于任务状态计算进度
  switch (task.status) {
    case 'COMPLETED':
      return 100
    case 'ACTIVE':
      // 基于时间进度计算
      const now = new Date()
      const start = new Date(task.startDate)
      const end = new Date(task.endDate)
      const total = end.getTime() - start.getTime()
      const elapsed = now.getTime() - start.getTime()
      return Math.min(Math.max((elapsed / total) * 100, 0), 100)
    case 'CANCELLED':
    case 'DRAFT':
    default:
      return 0
  }
}

/**
 * 检查任务是否逾期
 */
export function isTaskOverdue(task: StrategicTask): boolean {
  if (task.status === 'COMPLETED') {return false}
  return new Date() > new Date(task.endDate)
}

/**
 * 获取任务状态颜色
 */
export function getTaskStatusColor(status: TaskStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'success'
    case 'COMPLETED':
      return 'info'
    case 'CANCELLED':
      return 'danger'
    case 'DRAFT':
      return 'warning'
    default:
      return 'info'
  }
}

/**
 * 格式化任务权重显示
 */
export function formatTaskWeight(weight: number): string {
  return `${(weight * 100).toFixed(1)}%`
}