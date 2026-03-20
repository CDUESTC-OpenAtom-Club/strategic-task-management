/**
 * Strategic Indicator Feature - Zod Validation Schemas
 *
 * Runtime validation schemas for indicator data.
 */

import { z } from 'zod'
import { VALIDATION_RULES, WEIGHT_MIN, WEIGHT_MAX } from './constants'

/**
 * Indicator create schema
 */
export const indicatorCreateSchema = z.object({
  name: z
    .string()
    .min(1, '指标名称不能为空')
    .max(
      VALIDATION_RULES.NAME_MAX_LENGTH,
      `指标名称不能超过${VALIDATION_RULES.NAME_MAX_LENGTH}个字符`
    ),

  code: z
    .string()
    .max(
      VALIDATION_RULES.CODE_MAX_LENGTH,
      `指标编码不能超过${VALIDATION_RULES.CODE_MAX_LENGTH}个字符`
    )
    .optional(),

  description: z
    .string()
    .max(
      VALIDATION_RULES.DESCRIPTION_MAX_LENGTH,
      `描述不能超过${VALIDATION_RULES.DESCRIPTION_MAX_LENGTH}个字符`
    )
    .optional(),

  type: z.enum(['QUALITATIVE', 'QUANTITATIVE'], {
    message: '请选择指标类型'
  }),

  taskId: z
    .number({ message: '任务ID必须是数字' })
    .positive('任务ID必须大于0'),

  ownerOrgId: z
    .number({ message: '组织ID必须是数字' })
    .positive('组织ID必须大于0'),

  targetOrgId: z
    .number({ message: '组织ID必须是数字' })
    .positive('组织ID必须大于0'),

  level: z.enum(['FIRST', 'SECOND']).optional(),

  indicatorLevel: z.number().min(1).max(2).optional(),

  parentIndicatorId: z.number().positive().optional(),

  weight: z
    .number()
    .min(WEIGHT_MIN, `权重不能小于${WEIGHT_MIN}`)
    .max(WEIGHT_MAX, `权重不能大于${WEIGHT_MAX}`)
    .optional(),

  weightPercent: z
    .number()
    .min(0, '权重百分比不能小于0')
    .max(100, '权重百分比不能大于100')
    .optional(),

  targetValue: z.number().optional(),

  actualValue: z.number().optional(),

  unit: z
    .string()
    .max(VALIDATION_RULES.UNIT_MAX_LENGTH, `单位不能超过${VALIDATION_RULES.UNIT_MAX_LENGTH}个字符`)
    .optional(),

  year: z.number().min(2020, '年份不能小于2020').max(2100, '年份不能大于2100').optional(),

  deadline: z.string().optional(),

  type1: z.string().optional(),

  type2: z.string().optional(),

  isQualitative: z.boolean().optional(),

  qualitativeOptions: z.array(z.string()).optional(),

  remark: z.string().optional()
})

/**
 * Indicator update schema
 */
export const indicatorUpdateSchema = z.object({
  name: z
    .string()
    .min(1, '指标名称不能为空')
    .max(
      VALIDATION_RULES.NAME_MAX_LENGTH,
      `指标名称不能超过${VALIDATION_RULES.NAME_MAX_LENGTH}个字符`
    )
    .optional(),

  description: z
    .string()
    .max(
      VALIDATION_RULES.DESCRIPTION_MAX_LENGTH,
      `描述不能超过${VALIDATION_RULES.DESCRIPTION_MAX_LENGTH}个字符`
    )
    .optional(),

  targetValue: z.number().optional(),

  actualValue: z.number().optional(),

  unit: z
    .string()
    .max(VALIDATION_RULES.UNIT_MAX_LENGTH, `单位不能超过${VALIDATION_RULES.UNIT_MAX_LENGTH}个字符`)
    .optional(),

  weight: z
    .number()
    .min(WEIGHT_MIN, `权重不能小于${WEIGHT_MIN}`)
    .max(WEIGHT_MAX, `权重不能大于${WEIGHT_MAX}`)
    .optional(),

  weightPercent: z
    .number()
    .min(0, '权重百分比不能小于0')
    .max(100, '权重百分比不能大于100')
    .optional(),

  progress: z.number().min(0, '进度不能小于0').max(100, '进度不能大于100').optional(),

  remark: z.string().optional(),

  responsiblePerson: z.string().optional(),

  deadline: z.string().optional(),

  type1: z.string().optional(),

  type2: z.string().optional()
})

/**
 * Distribute request schema
 */
export const distributeRequestSchema = z.object({
  targetOrgIds: z.array(z.number().positive()).min(1, '请至少选择一个目标组织'),

  message: z.string().optional(),

  deadline: z.string().optional()
})

/**
 * Progress submit schema
 */
export const progressSubmitSchema = z.object({
  value: z.number({ message: '进度值必须是数字' }),

  evidence: z.string().optional(),

  attachments: z.array(z.number()).optional(),

  remark: z.string().optional()
})

/**
 * Type exports
 */
export type IndicatorCreateInput = z.infer<typeof indicatorCreateSchema>
export type IndicatorUpdateInput = z.infer<typeof indicatorUpdateSchema>
export type DistributeRequestInput = z.infer<typeof distributeRequestSchema>
export type ProgressSubmitInput = z.infer<typeof progressSubmitSchema>
