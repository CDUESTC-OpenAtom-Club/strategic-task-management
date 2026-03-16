/**
 * Zod Validation Helpers
 * 
 * Common Zod schemas and helpers for data validation
 */

import { z } from 'zod'

/**
 * Common string schemas
 */
export const stringSchemas = {
  email: z.string().email('Invalid email format'),
  phone: z.string().regex(/^1[3-9]\d{9}$/, 'Invalid phone number'),
  url: z.string().url('Invalid URL format'),
  nonEmpty: z.string().min(1, 'This field is required')
}

/**
 * Common number schemas
 */
export const numberSchemas = {
  positive: z.number().positive('Must be a positive number'),
  nonNegative: z.number().nonnegative('Must be non-negative'),
  percentage: z.number().min(0).max(100, 'Must be between 0 and 100')
}

/**
 * Date schemas
 */
export const dateSchemas = {
  future: z.date().refine((date) => date > new Date(), 'Date must be in the future'),
  past: z.date().refine((date) => date < new Date(), 'Date must be in the past')
}

/**
 * Create optional field with default
 */
export function optionalWithDefault<T>(schema: z.ZodType<T>, defaultValue: T) {
  return schema.optional().default(defaultValue)
}

/**
 * Create array schema with min/max length
 */
export function arrayWithLength<T>(schema: z.ZodType<T>, min: number, max?: number) {
  let arraySchema = z.array(schema).min(min, `At least ${min} items required`)
  if (max !== undefined) {
    arraySchema = arraySchema.max(max, `At most ${max} items allowed`)
  }
  return arraySchema
}
