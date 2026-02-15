/**
 * Org API Zod Schema 定义
 *
 * 本文件定义了组织机构 API 的运行时类型验证 schema。
 * 使用 Zod 进行运行时验证，并通过 z.infer 推导 TypeScript 类型。
 *
 * @module api/schemas/org.schema
 * @see Requirements 3.1, 3.2, 3.5
 */
import { z } from 'zod'

/**
 * OrgType 枚举 schema
 * 定义所有有效的组织类型
 *
 * @see Requirements 2.2 - OrgType_Enum SHALL 定义所有有效的组织类型
 */
export const orgTypeSchema = z.enum([
  'STRATEGY_DEPT',
  'FUNCTIONAL_DEPT',
  'COLLEGE',
  'DIVISION',
  'SCHOOL',
  'OTHER',
  'SECONDARY_COLLEGE'
])

/**
 * OrgVO schema
 * 定义组织机构值对象的完整验证模式（camelCase 格式）
 *
 * 注意：后端返回的字段可能不完整，使用 optional() 处理可选字段
 *
 * @see Requirements 2.1 - OrgVO_Interface SHALL 定义所有 camelCase 字段及其类型
 * @see Requirements 3.1 - Zod_Schema SHALL 定义 OrgVO 的完整验证模式
 */
export const orgVOSchema = z.object({
  orgId: z.number(),
  orgName: z.string(),
  orgType: orgTypeSchema,
  parentOrgId: z.number().nullable().optional(),
  parentOrgName: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
  remark: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
})

/**
 * ApiResponse<OrgVO[]> schema
 * 定义组织列表 API 响应的验证模式
 *
 * 支持两种响应格式：
 * 1. 新格式: { success: true, data: [...], message: "..." }
 * 2. 旧格式: { code: 0, data: [...], message: "...", timestamp: number }
 *
 * @see Requirements 1.3 - Org_API SHALL 使用标准 ApiResponse 格式包装
 * @see Requirements 3.2 - Zod_Schema SHALL 定义 ApiResponse<OrgVO[]> 的验证模式
 */
export const orgListResponseSchema = z.object({
  // 支持 success 或 code 字段
  success: z.boolean().optional(),
  code: z.number().optional(),
  data: z.array(orgVOSchema),
  message: z.string().optional(),
  timestamp: z.union([z.string(), z.number(), z.date()]).optional()
})

/**
 * ApiResponse<OrgVO> schema
 * 定义单个组织 API 响应的验证模式
 */
export const orgDetailResponseSchema = z.object({
  success: z.boolean(),
  data: orgVOSchema,
  message: z.string(),
  timestamp: z.string().or(z.date())
})

// ============================================
// 从 schema 推导 TypeScript 类型
// @see Requirements 3.5 - Zod_Schema SHALL 与 TypeScript 类型定义保持同步
// ============================================

/**
 * OrgType 类型
 * 从 orgTypeSchema 推导的组织类型枚举
 */
export type OrgType = z.infer<typeof orgTypeSchema>

/**
 * OrgVO 类型
 * 从 orgVOSchema 推导的组织值对象类型（camelCase 格式）
 *
 * 等价于：
 * ```typescript
 * interface OrgVO {
 *   orgId: number;
 *   orgName: string;
 *   orgType: 'STRATEGY_DEPT' | 'FUNCTIONAL_DEPT' | 'COLLEGE' | 'DIVISION' | 'SCHOOL' | 'OTHER' | 'SECONDARY_COLLEGE';
 *   parentOrgId: number | null;
 *   isActive: boolean;
 *   sortOrder: number;
 *   remark: string | null;
 *   createdAt: string;
 *   updatedAt: string;
 * }
 * ```
 */
export type OrgVO = z.infer<typeof orgVOSchema>

/**
 * OrgListResponse 类型
 * 从 orgListResponseSchema 推导的组织列表响应类型
 */
export type OrgListResponse = z.infer<typeof orgListResponseSchema>

/**
 * OrgDetailResponse 类型
 * 从 orgDetailResponseSchema 推导的单个组织响应类型
 */
export type OrgDetailResponse = z.infer<typeof orgDetailResponseSchema>
