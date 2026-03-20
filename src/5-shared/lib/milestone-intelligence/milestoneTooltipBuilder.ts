/**
 * Milestone Intelligence - Tooltip Builder
 *
 * Builds milestone tooltip data for display purposes.
 */

import type { StrategicIndicator } from '@/shared/types'
import type { MilestoneTooltipItem, MilestoneStatusValue } from './types'
import { milestoneDeadline } from '@/shared/lib/utils/dataMappers/milestoneDateNormalizer'
import { validateMilestone, safeGet } from '@/shared/lib/validation/dataValidator'
import { MILESTONE_STATUS_VALUES } from '@/shared/config/validationRules'

/**
 * Validates and gets milestone data for tooltip display
 *
 * Validates each milestone's data integrity and provides default values
 * for missing fields.
 *
 * @param indicator - The indicator object
 * @returns Validated milestone list with default values
 */
export function getMilestonesTooltip(indicator: StrategicIndicator): MilestoneTooltipItem[] {
  const milestones = indicator.milestones || []

  return milestones.map((m, index) => {
    const validationResult = validateMilestone(m)

    const id = safeGet(m, 'id', `milestone-${index}`)
    const name = safeGet(m, 'name', '未命名里程碑')
    // Normalize to canonical deadline via mapper (handles deadline or dueDate)
    const deadline = milestoneDeadline(m)
    const targetProgress = safeGet(m, 'targetProgress', 0)
    const status = safeGet(m, 'status', 'pending')

    const statusValue = status as unknown as MilestoneStatusValue
    const validStatus: MilestoneStatusValue = (MILESTONE_STATUS_VALUES as readonly MilestoneStatusValue[]).includes(
      statusValue
    )
      ? statusValue
      : 'pending'

    let expectedDate = ''
    if (deadline) {
      try {
        const date = new Date(deadline)
        if (!isNaN(date.getTime())) {
          expectedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
            date.getDate()
          ).padStart(2, '0')}`
        } else {
          expectedDate = '日期格式错误'
        }
      } catch {
        expectedDate = '日期格式错误'
      }
    } else {
      expectedDate = '未设置'
    }

    return {
      id,
      name,
      expectedDate,
      progress: typeof targetProgress === 'number' ? targetProgress : 0,
      status: validStatus,
      isValid: validationResult.isValid
    }
  })
}

/**
 * Builds milestone progress text for indicator
 *
 * @param indicator - The indicator object
 * @returns Progress text
 */
export function getIndicatorMilestoneProgressText(indicator: StrategicIndicator): string {
  const milestones = indicator.milestones || []

  if (milestones.length === 0) {
    return '暂无里程碑'
  }

  const completedCount = milestones.filter(m => safeGet(m, 'status') === 'completed').length
  const pendingCount = milestones.filter(m => safeGet(m, 'status') === 'pending').length

  if (completedCount === milestones.length) {
    return '所有里程碑已完成'
  } else if (pendingCount > 0) {
    return `${pendingCount}个待完成里程碑`
  } else {
    return `里程碑总数: ${milestones.length}`
  }
}
