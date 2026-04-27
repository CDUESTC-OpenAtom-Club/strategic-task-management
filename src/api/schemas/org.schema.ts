/**
 * @deprecated Compatibility entrypoint.
 * Canonical path: `@/features/organization/api/org` or `@/shared/types/backend-aligned`.
 * Remove after 2026-05-31.
 */

import { z } from 'zod'

export const orgTypeSchema = z.enum([
  'STRATEGY_DEPT',
  'FUNCTIONAL_DEPT',
  'COLLEGE',
  'DIVISION',
  'SCHOOL',
  'OTHER',
  'SECONDARY_COLLEGE'
])

export const orgVOSchema = z.object({
  orgId: z.number(),
  orgName: z.string().min(1),
  orgType: orgTypeSchema,
  parentOrgId: z.number().nullable(),
  isActive: z.boolean(),
  sortOrder: z.number(),
  remark: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
})

export const orgListResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(orgVOSchema),
  message: z.string(),
  timestamp: z.union([z.string(), z.number(), z.date()])
})

export const orgDetailResponseSchema = z.object({
  success: z.boolean(),
  data: orgVOSchema,
  message: z.string(),
  timestamp: z.union([z.string(), z.number(), z.date()])
})

export type OrgType = z.infer<typeof orgTypeSchema>
export type OrgVO = z.infer<typeof orgVOSchema>
export type OrgListResponse = z.infer<typeof orgListResponseSchema>
export type OrgDetailResponse = z.infer<typeof orgDetailResponseSchema>
