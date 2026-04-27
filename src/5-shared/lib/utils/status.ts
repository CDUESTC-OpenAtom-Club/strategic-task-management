/**
 * Status Utility Functions
 *
 * Provides status type mapping and text translation
 */

import type { ProgressStatus } from './progress'

/**
 * Get status tag type for Element Plus components
 * @param status - Status string
 * @returns Progress status type
 */
export function getStatusTagType(status: string): ProgressStatus {
  const typeMap: Record<string, ProgressStatus> = {
    pending: 'warning',
    in_progress: 'normal',
    completed: 'success',
    failed: 'danger',
    approved: 'success',
    rejected: 'danger',
    draft: 'info',
    published: 'success',
    active: 'normal',
    inactive: 'info',
    archived: 'info',
    cancelled: 'danger',
    delayed: 'warning',
    not_started: 'info'
  }
  return typeMap[status] || 'normal'
}

/**
 * Get status text in Chinese
 * @param status - Status string
 * @returns Chinese status text
 */
export function getStatusText(status: string): string {
  const textMap: Record<string, string> = {
    pending: '待处理',
    in_progress: '进行中',
    completed: '已完成',
    failed: '失败',
    approved: '已通过',
    rejected: '已拒绝',
    draft: '草稿',
    published: '已发布',
    active: '活动中',
    inactive: '未激活',
    archived: '已归档',
    cancelled: '已取消',
    delayed: '已延期',
    not_started: '未开始'
  }
  return textMap[status] || status
}

/**
 * Get status color (hex code)
 * @param status - Status string
 * @returns Color hex code
 */
export function getStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    pending: '#e6a23c',
    in_progress: '#409eff',
    completed: '#67c23a',
    failed: '#f56c6c',
    approved: '#67c23a',
    rejected: '#f56c6c',
    draft: '#909399',
    published: '#67c23a',
    active: '#409eff',
    inactive: '#909399',
    archived: '#909399',
    cancelled: '#f56c6c',
    delayed: '#e6a23c',
    not_started: '#909399'
  }
  return colorMap[status] || '#409eff'
}

/**
 * Check if status is a terminal state (no further changes expected)
 * @param status - Status string
 * @returns True if status is terminal
 */
export function isTerminalStatus(status: string): boolean {
  const terminalStates = ['completed', 'approved', 'rejected', 'cancelled', 'archived', 'failed']
  return terminalStates.includes(status)
}

/**
 * Check if status is active (in progress)
 * @param status - Status string
 * @returns True if status is active
 */
export function isActiveStatus(status: string): boolean {
  const activeStates = ['pending', 'in_progress', 'active']
  return activeStates.includes(status)
}
