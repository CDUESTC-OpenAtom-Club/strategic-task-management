/**
 * Task Feature Constants
 */

export const TASK_STATUS = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED', 
  CANCELLED: 'CANCELLED',
  DRAFT: 'DRAFT'
} as const

export const TASK_STATUS_LABELS = {
  [TASK_STATUS.ACTIVE]: '进行中',
  [TASK_STATUS.COMPLETED]: '已完成',
  [TASK_STATUS.CANCELLED]: '已取消',
  [TASK_STATUS.DRAFT]: '草稿'
} as const

export const TASK_STATUS_COLORS = {
  [TASK_STATUS.ACTIVE]: 'success',
  [TASK_STATUS.COMPLETED]: 'info',
  [TASK_STATUS.CANCELLED]: 'danger',
  [TASK_STATUS.DRAFT]: 'warning'
} as const