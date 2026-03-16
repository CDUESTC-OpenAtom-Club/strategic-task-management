/**
 * Strategic Indicator Feature - Business Validations
 *
 * Business rule validations for indicators.
 */

import type { Indicator } from '@/4-entities/indicator/model/types'
import { validateWeightSum } from './calculations'

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Check if indicator can be edited
 *
 * @param indicator - Indicator to check
 * @returns True if editable
 */
export function canEditIndicator(indicator: Indicator): boolean {
  // Can only edit draft indicators
  return indicator.status === 'DRAFT'
}

/**
 * Check if indicator can be deleted
 *
 * @param indicator - Indicator to check
 * @returns True if deletable
 */
export function canDeleteIndicator(indicator: Indicator): boolean {
  // Can only delete draft indicators
  return indicator.status === 'DRAFT'
}

/**
 * Check if indicator can be distributed
 *
 * @param indicator - Indicator to check
 * @returns True if distributable
 */
export function canDistributeIndicator(indicator: Indicator): boolean {
  // Can only distribute approved/distributed indicators
  return indicator.status === 'DISTRIBUTED' || indicator.status === 'PENDING_REVIEW'
}

/**
 * Check if indicator can be withdrawn
 *
 * @param indicator - Indicator to check
 * @returns True if withdrawable
 */
export function canWithdrawIndicator(indicator: Indicator): boolean {
  // Can withdraw distributed indicators
  return indicator.status === 'DISTRIBUTED' && (indicator.canWithdraw ?? true)
}

/**
 * Check if indicator can be submitted for approval
 *
 * @param indicator - Indicator to check
 * @returns True if submittable
 */
export function canSubmitForApproval(indicator: Indicator): boolean {
  // Can submit draft indicators
  return indicator.status === 'DRAFT'
}

/**
 * Validate indicator data before creation
 *
 * @param data - Indicator data
 * @returns Validation result
 */
export function validateIndicatorCreate(data: Partial<Indicator>): ValidationResult {
  const errors: string[] = []

  // Required fields
  if (!data.name || data.name.trim() === '') {
    errors.push('指标名称不能为空')
  }

  if (!data.taskId) {
    errors.push('请选择所属任务')
  }

  if (!data.ownerOrgId) {
    errors.push('请选择责任组织')
  }

  if (!data.targetOrgId) {
    errors.push('请选择目标组织')
  }

  // Weight validation
  if (data.weight !== undefined) {
    if (data.weight < 0 || data.weight > 1) {
      errors.push('权重必须在0-1之间')
    }
  }

  // Target value validation for quantitative indicators
  if (data.type === 'QUANTITATIVE') {
    if (data.targetValue === undefined || data.targetValue === null) {
      errors.push('定量指标必须设置目标值')
    }

    if (!data.unit || data.unit.trim() === '') {
      errors.push('定量指标必须设置单位')
    }
  }

  // Qualitative options validation
  if (data.type === 'QUALITATIVE') {
    if (!data.qualitativeOptions || data.qualitativeOptions.length === 0) {
      errors.push('定性指标必须设置评价选项')
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Validate indicator update
 *
 * @param indicator - Current indicator
 * @param updates - Update data
 * @returns Validation result
 */
export function validateIndicatorUpdate(
  indicator: Indicator,
  updates: Partial<Indicator>
): ValidationResult {
  const errors: string[] = []

  // Check if indicator can be edited
  if (!canEditIndicator(indicator)) {
    errors.push('只能编辑草稿状态的指标')
  }

  // Name validation
  if (updates.name !== undefined && updates.name.trim() === '') {
    errors.push('指标名称不能为空')
  }

  // Weight validation
  if (updates.weight !== undefined) {
    if (updates.weight < 0 || updates.weight > 1) {
      errors.push('权重必须在0-1之间')
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Validate indicator distribution
 *
 * @param indicator - Indicator to distribute
 * @param targetOrgIds - Target organization IDs
 * @returns Validation result
 */
export function validateIndicatorDistribution(
  indicator: Indicator,
  targetOrgIds: number[]
): ValidationResult {
  const errors: string[] = []

  // Check if indicator can be distributed
  if (!canDistributeIndicator(indicator)) {
    errors.push('只能下发已批准的指标')
  }

  // Check target organizations
  if (!targetOrgIds || targetOrgIds.length === 0) {
    errors.push('请至少选择一个目标组织')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Validate weight sum for a group of indicators
 *
 * @param indicators - List of indicators
 * @returns Validation result
 */
export function validateIndicatorWeights(indicators: Indicator[]): ValidationResult {
  const errors: string[] = []

  if (!validateWeightSum(indicators)) {
    errors.push('指标权重总和必须为1（或100%）')
  }

  // Check individual weights
  indicators.forEach((indicator, _index) => {
    if (indicator.weight !== undefined) {
      if (indicator.weight < 0 || indicator.weight > 1) {
        errors.push(`指标"${indicator.name}"的权重必须在0-1之间`)
      }
    }
  })

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Validate progress submission
 *
 * @param indicator - Indicator
 * @param value - Progress value
 * @returns Validation result
 */
export function validateProgressSubmission(indicator: Indicator, value: number): ValidationResult {
  const errors: string[] = []

  // Check indicator status
  if (indicator.status !== 'DISTRIBUTED') {
    errors.push('只能为已下发的指标提交进度')
  }

  // Check value range
  if (value < 0) {
    errors.push('进度值不能为负数')
  }

  if (indicator.targetValue && value > indicator.targetValue) {
    errors.push('进度值不能超过目标值')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Get available actions for an indicator
 *
 * @param indicator - Indicator
 * @returns List of available action codes
 */
export function getAvailableActions(indicator: Indicator): string[] {
  const actions: string[] = []

  if (canEditIndicator(indicator)) {
    actions.push('edit')
  }

  if (canDeleteIndicator(indicator)) {
    actions.push('delete')
  }

  if (canDistributeIndicator(indicator)) {
    actions.push('distribute')
  }

  if (canWithdrawIndicator(indicator)) {
    actions.push('withdraw')
  }

  if (canSubmitForApproval(indicator)) {
    actions.push('submit')
  }

  // Always allow view
  actions.push('view')

  return actions
}
