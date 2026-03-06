/**
 * 指标状态显示工具函数
 * 
 * 用于统一处理指标状态的显示逻辑
 */

export type IndicatorDisplayStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'DISTRIBUTED'

/**
 * 状态文本映射
 */
export const STATUS_TEXT_MAP: Record<IndicatorDisplayStatus, string> = {
  DRAFT: '草稿',
  PENDING_APPROVAL: '待审核',
  DISTRIBUTED: '已下发'
}

/**
 * 状态类型映射（Element Plus Tag 类型）
 */
export const STATUS_TYPE_MAP: Record<IndicatorDisplayStatus, 'info' | 'warning' | 'success'> = {
  DRAFT: 'info',
  PENDING_APPROVAL: 'warning',
  DISTRIBUTED: 'success'
}

/**
 * 状态图标映射
 */
export const STATUS_ICON_MAP: Record<IndicatorDisplayStatus, string> = {
  DRAFT: '📝',
  PENDING_APPROVAL: '⏳',
  DISTRIBUTED: '✅'
}

/**
 * 获取状态显示文本
 */
export function getStatusText(status?: IndicatorDisplayStatus): string {
  if (!status) return '未知'
  return STATUS_TEXT_MAP[status] || status
}

/**
 * 获取状态类型（用于 el-tag）
 */
export function getStatusType(status?: IndicatorDisplayStatus): 'info' | 'warning' | 'success' {
  if (!status) return 'info'
  return STATUS_TYPE_MAP[status] || 'info'
}

/**
 * 获取状态图标
 */
export function getStatusIcon(status?: IndicatorDisplayStatus): string {
  if (!status) return ''
  return STATUS_ICON_MAP[status] || ''
}

/**
 * 获取完整的状态显示文本（包含图标）
 */
export function getFullStatusText(status?: IndicatorDisplayStatus): string {
  if (!status) return '未知'
  return `${getStatusIcon(status)} ${getStatusText(status)}`
}
