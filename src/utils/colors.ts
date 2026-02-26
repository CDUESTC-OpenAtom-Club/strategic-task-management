/**
 * 统一颜色工具
 * 用于确保所有图表组件的颜色分级一致性
 */

// 进度阈值常量
export const PROGRESS_THRESHOLDS = {
  EXCELLENT: 90, // 优秀 (≥90%)
  GOOD: 70,      // 良好 (70%-90%)
  POOR: 0        // 需关注 (<70%)
} as const

// 进度颜色常量 (与 Element Plus 主题色一致)
export const PROGRESS_COLORS = {
  EXCELLENT: '#67C23A', // 绿色 - success
  GOOD: '#E6A23C',      // 黄色 - warning
  POOR: '#F56C6C'       // 红色 - danger
} as const

// 预警级别颜色
export const ALERT_COLORS = {
  severe: '#F56C6C',    // 严重 - 红色
  moderate: '#E6A23C',  // 中度 - 黄色
  normal: '#67C23A'     // 正常 - 绿色
} as const

/**
 * 根据进度值返回对应的颜色
 * @param progress 进度值 (0-100)
 * @returns 颜色值 (HEX)
 */
export function getProgressColor(progress: number): string {
  if (progress >= PROGRESS_THRESHOLDS.EXCELLENT) {
    return PROGRESS_COLORS.EXCELLENT
  }
  if (progress >= PROGRESS_THRESHOLDS.GOOD) {
    return PROGRESS_COLORS.GOOD
  }
  return PROGRESS_COLORS.POOR
}

/**
 * 根据进度值返回对应的状态
 * @param progress 进度值 (0-100)
 * @returns Element Plus 状态类型
 */
export function getProgressStatus(progress: number): 'success' | 'warning' | 'danger' {
  if (progress >= PROGRESS_THRESHOLDS.EXCELLENT) {
    return 'success'
  }
  if (progress >= PROGRESS_THRESHOLDS.GOOD) {
    return 'warning'
  }
  return 'danger'
}

/**
 * 根据预警级别返回对应的颜色
 * @param level 预警级别
 * @returns 颜色值 (HEX)
 */
export function getAlertColor(level: 'severe' | 'moderate' | 'normal'): string {
  return ALERT_COLORS[level]
}

/**
 * 根据索引获取图表颜色 (用于饼图等多色场景)
 * @param index 索引值
 * @returns 颜色值 (HEX)
 */
export function getColorByIndex(index: number): string {
  const colors = [
    '#409EFF', // 蓝色 - primary
    '#67C23A', // 绿色 - success
    '#E6A23C', // 黄色 - warning
    '#F56C6C', // 红色 - danger
    '#909399', // 灰色 - info
    '#C0C4CC', // 浅灰色
    '#67C23A', // 绿色变体
    '#13C2C2', // 青色
    '#722ED1', // 紫色
    '#FA8C16'  // 橙色
  ]
  return colors[index % colors.length]
}

/**
 * 生成渐变色 (用于 ECharts 渐变效果)
 * @param startColor 起始颜色
 * @param endColor 结束颜色
 * @returns ECharts 渐变色配置
 */
export function getGradientColor(startColor: string, endColor: string) {
  return {
    type: 'linear',
    x: 0,
    y: 0,
    x2: 1,
    y2: 0,
    colorStops: [
      { offset: 0, color: startColor },
      { offset: 1, color: endColor }
    ]
  }
}

/**
 * 根据得分返回颜色 (满分120分)
 * @param score 得分值
 * @param maxScore 满分 (默认120)
 * @returns 颜色值 (HEX)
 */
export function getScoreColor(score: number, maxScore: number = 120): string {
  const percentage = (score / maxScore) * 100
  return getProgressColor(percentage)
}

/**
 * 获取部门状态颜色
 * @param status 部门状态
 * @returns 颜色值 (HEX)
 */
export function getDepartmentStatusColor(status: 'success' | 'warning' | 'exception'): string {
  const statusColorMap = {
    success: PROGRESS_COLORS.EXCELLENT,
    warning: PROGRESS_COLORS.GOOD,
    exception: PROGRESS_COLORS.POOR
  }
  return statusColorMap[status]
}

/**
 * 判断部门是否为二级学院
 * @param deptName 部门名称
 * @returns true 表示二级学院，false 表示职能部门
 */
export function isSecondaryCollege(deptName: string | undefined): boolean {
  if (!deptName) return false

  // 职能部门特征后缀
  const functionalDeptSuffixes = ['处', '部', '办公室', '中心', '馆']

  // 如果包含职能部门后缀，则明确为职能部门
  if (functionalDeptSuffixes.some(suffix => deptName.includes(suffix))) {
    return false
  }

  // 如果包含"学院"，则为二级学院
  if (deptName.includes('学院')) {
    return true
  }

  // 默认作为职能部门处理
  return false
}
