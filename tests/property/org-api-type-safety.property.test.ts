/**
 * Org API 类型安全属性测试
 * 
 * **Feature: api-response-type-safety**
 * 
 * 本文件包含 Org API 类型安全相关的属性测试，验证：
 * - Zod schema 与 TypeScript 类型的一致性
 * - snake_case 到 camelCase 转换的正确性
 * - OrgVO 到 Department 转换的正确性
 * 
 * **Validates: Requirements 6.1, 6.2**
 */
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { 
  orgTypeSchema, 
  orgVOSchema, 
  orgListResponseSchema,
  type OrgVO, 
  type OrgType 
} from '../../src/api/schemas/org.schema'
import { 
  convertOrgVOToDepartment, 
  mapOrgTypeToFrontend,
  type Department 
} from '../../src/api/org'

// ============================================================================
// 测试配置
// ============================================================================

/**
 * fast-check 测试配置
 * 每个属性测试运行 100 次迭代
 */
const testConfig = { numRuns: 100 }

// ============================================================================
// OrgType 枚举值
// ============================================================================

/**
 * 所有有效的 OrgType 枚举值
 * @see Requirements 2.2 - OrgType_Enum SHALL 定义所有有效的组织类型
 */
const validOrgTypes: OrgType[] = [
  'STRATEGY_DEPT',
  'FUNCTIONAL_DEPT',
  'COLLEGE',
  'DIVISION',
  'SCHOOL',
  'OTHER',
  'SECONDARY_COLLEGE'
]

// ============================================================================
// 数据生成器 (Arbitraries)
// ============================================================================

/**
 * OrgType 枚举生成器
 * 生成有效的 OrgType 枚举值
 * 
 * @see Requirements 2.2 - OrgType_Enum SHALL 定义所有有效的组织类型
 */
export const orgTypeArbitrary: fc.Arbitrary<OrgType> = fc.constantFrom(...validOrgTypes)

/**
 * OrgVO 对象生成器
 * 生成有效的 OrgVO 对象（camelCase 格式）
 * 
 * @see Requirements 2.1 - OrgVO_Interface SHALL 定义所有 camelCase 字段及其类型
 */
export const orgVOArbitrary: fc.Arbitrary<OrgVO> = fc.record({
  orgId: fc.integer({ min: 1, max: 10000 }),
  orgName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  orgType: orgTypeArbitrary,
  parentOrgId: fc.option(fc.integer({ min: 1, max: 10000 }), { nil: null }),
  isActive: fc.boolean(),
  sortOrder: fc.integer({ min: 0, max: 1000 }),
  remark: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: null }),
  createdAt: fc.constantFrom(
    '2024-01-01T00:00:00.000Z',
    '2024-06-15T12:30:00.000Z',
    '2025-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z'
  ),
  updatedAt: fc.constantFrom(
    '2024-01-01T00:00:00.000Z',
    '2024-06-15T12:30:00.000Z',
    '2025-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z'
  )
})

/**
 * snake_case 数据库行对象接口
 * 模拟数据库返回的原始数据格式
 */
export interface SnakeCaseOrgRow {
  org_id: number | string
  org_name: string
  org_type: string
  parent_org_id: number | string | null
  is_active: boolean
  sort_order: number
  remark: string | null
  created_at: string
  updated_at: string
}

/**
 * snake_case 数据库行生成器
 * 生成模拟数据库返回的 snake_case 格式数据
 * 
 * @see Requirements 1.4 - 数据库返回 snake_case 字段
 */
export const snakeCaseOrgRowArbitrary: fc.Arbitrary<SnakeCaseOrgRow> = fc.record({
  org_id: fc.oneof(
    fc.integer({ min: 1, max: 10000 }),
    fc.integer({ min: 1, max: 10000 }).map(String)
  ),
  org_name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  org_type: fc.constantFrom(...validOrgTypes),
  parent_org_id: fc.option(
    fc.oneof(
      fc.integer({ min: 1, max: 10000 }),
      fc.integer({ min: 1, max: 10000 }).map(String)
    ),
    { nil: null }
  ),
  is_active: fc.boolean(),
  sort_order: fc.integer({ min: 0, max: 1000 }),
  remark: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: null }),
  created_at: fc.constantFrom(
    '2024-01-01T00:00:00.000Z',
    '2024-06-15T12:30:00.000Z',
    '2025-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z'
  ),
  updated_at: fc.constantFrom(
    '2024-01-01T00:00:00.000Z',
    '2024-06-15T12:30:00.000Z',
    '2025-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z'
  )
})

/**
 * 无效 OrgVO 对象类型
 * 用于测试 Zod 验证拒绝无效数据
 */
export type InvalidOrgVO = Record<string, unknown>

/**
 * 无效 OrgVO 对象生成器
 * 生成不符合 OrgVO schema 的对象，用于测试 Zod 验证拒绝功能
 * 
 * 生成策略：
 * 1. 缺少必需字段
 * 2. 字段类型错误
 * 3. 枚举值无效
 * 
 * @see Requirements 3.3 - Zod 验证 SHALL 拒绝无效数据
 */
export const invalidOrgVOArbitrary: fc.Arbitrary<InvalidOrgVO> = fc.oneof(
  // 策略 1: 缺少必需字段 (orgId)
  fc.record({
    orgName: fc.string({ minLength: 1, maxLength: 50 }),
    orgType: orgTypeArbitrary,
    parentOrgId: fc.constant(null),
    isActive: fc.boolean(),
    sortOrder: fc.integer({ min: 0, max: 100 }),
    remark: fc.constant(null),
    createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
    updatedAt: fc.constant('2024-01-01T00:00:00.000Z')
  }),
  
  // 策略 2: orgId 类型错误 (string instead of number)
  fc.record({
    orgId: fc.string({ minLength: 1, maxLength: 10 }),
    orgName: fc.string({ minLength: 1, maxLength: 50 }),
    orgType: orgTypeArbitrary,
    parentOrgId: fc.constant(null),
    isActive: fc.boolean(),
    sortOrder: fc.integer({ min: 0, max: 100 }),
    remark: fc.constant(null),
    createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
    updatedAt: fc.constant('2024-01-01T00:00:00.000Z')
  }),
  
  // 策略 3: orgType 枚举值无效
  fc.record({
    orgId: fc.integer({ min: 1, max: 10000 }),
    orgName: fc.string({ minLength: 1, maxLength: 50 }),
    orgType: fc.constantFrom('INVALID_TYPE', 'UNKNOWN', 'BAD_VALUE', ''),
    parentOrgId: fc.constant(null),
    isActive: fc.boolean(),
    sortOrder: fc.integer({ min: 0, max: 100 }),
    remark: fc.constant(null),
    createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
    updatedAt: fc.constant('2024-01-01T00:00:00.000Z')
  }),
  
  // 策略 4: isActive 类型错误 (string instead of boolean)
  fc.record({
    orgId: fc.integer({ min: 1, max: 10000 }),
    orgName: fc.string({ minLength: 1, maxLength: 50 }),
    orgType: orgTypeArbitrary,
    parentOrgId: fc.constant(null),
    isActive: fc.constantFrom('true', 'false', 'yes', 'no'),
    sortOrder: fc.integer({ min: 0, max: 100 }),
    remark: fc.constant(null),
    createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
    updatedAt: fc.constant('2024-01-01T00:00:00.000Z')
  }),
  
  // 策略 5: 完全空对象
  fc.constant({}),
  
  // 策略 6: 缺少多个必需字段
  fc.record({
    orgId: fc.integer({ min: 1, max: 10000 }),
    orgName: fc.string({ minLength: 1, maxLength: 50 })
  }),
  
  // 策略 7: sortOrder 类型错误 (string instead of number)
  fc.record({
    orgId: fc.integer({ min: 1, max: 10000 }),
    orgName: fc.string({ minLength: 1, maxLength: 50 }),
    orgType: orgTypeArbitrary,
    parentOrgId: fc.constant(null),
    isActive: fc.boolean(),
    sortOrder: fc.string({ minLength: 1, maxLength: 5 }),
    remark: fc.constant(null),
    createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
    updatedAt: fc.constant('2024-01-01T00:00:00.000Z')
  })
)

/**
 * API 响应生成器
 * 生成有效的 ApiResponse<OrgVO[]> 格式响应
 * 
 * @see Requirements 1.3 - Org_API SHALL 使用标准 ApiResponse 格式包装
 */
export const orgListResponseArbitrary = fc.record({
  success: fc.constant(true),
  data: fc.array(orgVOArbitrary, { minLength: 0, maxLength: 20 }),
  message: fc.constantFrom('OK', 'Success', '操作成功'),
  timestamp: fc.constantFrom(
    '2024-01-01T00:00:00.000Z',
    '2024-06-15T12:30:00.000Z',
    new Date().toISOString()
  )
})

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 将 snake_case 数据库行转换为 camelCase OrgVO
 * 模拟后端 convertToOrgVO 函数的行为
 * 
 * @param row - snake_case 格式的数据库行
 * @returns camelCase 格式的 OrgVO 对象
 * @see Requirements 1.4 - convertToOrgVO 函数转换 snake_case 到 camelCase
 */
export function convertToOrgVO(row: SnakeCaseOrgRow): OrgVO {
  return {
    orgId: typeof row.org_id === 'string' ? parseInt(row.org_id, 10) : row.org_id,
    orgName: row.org_name,
    orgType: row.org_type as OrgType,
    parentOrgId: row.parent_org_id !== null 
      ? (typeof row.parent_org_id === 'string' ? parseInt(row.parent_org_id, 10) : row.parent_org_id)
      : null,
    isActive: row.is_active ?? true,
    sortOrder: row.sort_order ?? 0,
    remark: row.remark ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

// ============================================================================
// 导出测试配置供其他测试文件使用
// ============================================================================

export { testConfig, validOrgTypes }

// ============================================================================
// 属性测试占位符 - 将在后续任务中实现
// ============================================================================

describe('Org API Type Safety Property Tests', () => {
  describe('Test Configuration', () => {
    it('should have correct test configuration', () => {
      expect(testConfig.numRuns).toBe(100)
    })

    it('should have all valid OrgType values', () => {
      expect(validOrgTypes).toHaveLength(7)
      expect(validOrgTypes).toContain('STRATEGY_DEPT')
      expect(validOrgTypes).toContain('FUNCTIONAL_DEPT')
      expect(validOrgTypes).toContain('COLLEGE')
      expect(validOrgTypes).toContain('DIVISION')
      expect(validOrgTypes).toContain('SCHOOL')
      expect(validOrgTypes).toContain('OTHER')
      expect(validOrgTypes).toContain('SECONDARY_COLLEGE')
    })
  })

  describe('Data Generators Validation', () => {
    it('orgTypeArbitrary should generate valid OrgType values', () => {
      fc.assert(
        fc.property(orgTypeArbitrary, (orgType) => {
          expect(validOrgTypes).toContain(orgType)
          return true
        }),
        testConfig
      )
    })

    it('orgVOArbitrary should generate valid OrgVO objects', () => {
      fc.assert(
        fc.property(orgVOArbitrary, (orgVO) => {
          // 验证必需字段存在
          expect(orgVO.orgId).toBeDefined()
          expect(typeof orgVO.orgId).toBe('number')
          expect(orgVO.orgName).toBeDefined()
          expect(typeof orgVO.orgName).toBe('string')
          expect(orgVO.orgType).toBeDefined()
          expect(validOrgTypes).toContain(orgVO.orgType)
          expect(typeof orgVO.isActive).toBe('boolean')
          expect(typeof orgVO.sortOrder).toBe('number')
          expect(typeof orgVO.createdAt).toBe('string')
          expect(typeof orgVO.updatedAt).toBe('string')
          
          // 验证可选字段类型
          expect(orgVO.parentOrgId === null || typeof orgVO.parentOrgId === 'number').toBe(true)
          expect(orgVO.remark === null || typeof orgVO.remark === 'string').toBe(true)
          
          return true
        }),
        testConfig
      )
    })

    it('snakeCaseOrgRowArbitrary should generate valid snake_case rows', () => {
      fc.assert(
        fc.property(snakeCaseOrgRowArbitrary, (row) => {
          // 验证 snake_case 字段存在
          expect(row.org_id).toBeDefined()
          expect(row.org_name).toBeDefined()
          expect(row.org_type).toBeDefined()
          expect(row.is_active).toBeDefined()
          expect(row.sort_order).toBeDefined()
          expect(row.created_at).toBeDefined()
          expect(row.updated_at).toBeDefined()
          
          // 验证 org_id 可以是 number 或 string
          expect(['number', 'string']).toContain(typeof row.org_id)
          
          return true
        }),
        testConfig
      )
    })

    it('invalidOrgVOArbitrary should generate objects that fail Zod validation', () => {
      fc.assert(
        fc.property(invalidOrgVOArbitrary, (invalidObj) => {
          const result = orgVOSchema.safeParse(invalidObj)
          // 无效对象应该被 Zod 拒绝
          expect(result.success).toBe(false)
          return true
        }),
        testConfig
      )
    })

    it('orgListResponseArbitrary should generate valid API responses', () => {
      fc.assert(
        fc.property(orgListResponseArbitrary, (response) => {
          const result = orgListResponseSchema.safeParse(response)
          expect(result.success).toBe(true)
          return true
        }),
        testConfig
      )
    })
  })

  describe('Helper Function: convertToOrgVO', () => {
    it('should convert snake_case to camelCase correctly', () => {
      fc.assert(
        fc.property(snakeCaseOrgRowArbitrary, (row) => {
          const converted = convertToOrgVO(row)
          
          // 验证转换后的字段名是 camelCase
          expect(converted).toHaveProperty('orgId')
          expect(converted).toHaveProperty('orgName')
          expect(converted).toHaveProperty('orgType')
          expect(converted).toHaveProperty('parentOrgId')
          expect(converted).toHaveProperty('isActive')
          expect(converted).toHaveProperty('sortOrder')
          expect(converted).toHaveProperty('remark')
          expect(converted).toHaveProperty('createdAt')
          expect(converted).toHaveProperty('updatedAt')
          
          // 验证没有 snake_case 字段
          expect(converted).not.toHaveProperty('org_id')
          expect(converted).not.toHaveProperty('org_name')
          expect(converted).not.toHaveProperty('org_type')
          
          return true
        }),
        testConfig
      )
    })
  })

  // ==========================================================================
  // Property 1: snake_case to camelCase Conversion Preserves Data
  // ==========================================================================

  /**
   * **Property 1: snake_case to camelCase Conversion Preserves Data**
   * 
   * *For any* valid database row with snake_case fields (org_id, org_name, 
   * org_type, parent_org_id, is_active, sort_order, remark, created_at, 
   * updated_at), when converted by `convertToOrgVO`, the resulting object 
   * SHALL have:
   * - All values preserved (orgId equals org_id, orgName equals org_name, etc.)
   * - All keys in camelCase format
   * - Correct type coercion (org_id string → orgId number)
   * 
   * **Validates: Requirements 1.1, 1.2, 1.4**
   */
  describe('Property 1: snake_case to camelCase Conversion Preserves Data', () => {
    
    it('should preserve all values during conversion', () => {
      fc.assert(
        fc.property(snakeCaseOrgRowArbitrary, (row) => {
          const converted = convertToOrgVO(row)
          
          // 验证值保持一致 (考虑类型转换)
          const expectedOrgId = typeof row.org_id === 'string' 
            ? parseInt(row.org_id, 10) 
            : row.org_id
          expect(converted.orgId).toBe(expectedOrgId)
          
          expect(converted.orgName).toBe(row.org_name)
          expect(converted.orgType).toBe(row.org_type)
          
          // parentOrgId 可能需要类型转换
          if (row.parent_org_id === null) {
            expect(converted.parentOrgId).toBeNull()
          } else {
            const expectedParentOrgId = typeof row.parent_org_id === 'string'
              ? parseInt(row.parent_org_id, 10)
              : row.parent_org_id
            expect(converted.parentOrgId).toBe(expectedParentOrgId)
          }
          
          expect(converted.isActive).toBe(row.is_active ?? true)
          expect(converted.sortOrder).toBe(row.sort_order ?? 0)
          expect(converted.remark).toBe(row.remark ?? null)
          expect(converted.createdAt).toBe(row.created_at)
          expect(converted.updatedAt).toBe(row.updated_at)
          
          return true
        }),
        testConfig
      )
    })

    it('should produce all keys in camelCase format', () => {
      fc.assert(
        fc.property(snakeCaseOrgRowArbitrary, (row) => {
          const converted = convertToOrgVO(row)
          const keys = Object.keys(converted)
          
          // 验证所有键都是 camelCase 格式
          const expectedCamelCaseKeys = [
            'orgId', 'orgName', 'orgType', 'parentOrgId', 
            'isActive', 'sortOrder', 'remark', 'createdAt', 'updatedAt'
          ]
          
          expect(keys.sort()).toEqual(expectedCamelCaseKeys.sort())
          
          // 验证没有 snake_case 键
          const snakeCaseKeys = ['org_id', 'org_name', 'org_type', 'parent_org_id', 
            'is_active', 'sort_order', 'created_at', 'updated_at']
          snakeCaseKeys.forEach(key => {
            expect(keys).not.toContain(key)
          })
          
          return true
        }),
        testConfig
      )
    })

    it('should correctly coerce string IDs to numbers', () => {
      fc.assert(
        fc.property(snakeCaseOrgRowArbitrary, (row) => {
          const converted = convertToOrgVO(row)
          
          // orgId 应该始终是 number 类型
          expect(typeof converted.orgId).toBe('number')
          expect(Number.isInteger(converted.orgId)).toBe(true)
          expect(converted.orgId).toBeGreaterThan(0)
          
          // parentOrgId 应该是 number 或 null
          if (converted.parentOrgId !== null) {
            expect(typeof converted.parentOrgId).toBe('number')
            expect(Number.isInteger(converted.parentOrgId)).toBe(true)
            expect(converted.parentOrgId).toBeGreaterThan(0)
          }
          
          return true
        }),
        testConfig
      )
    })

    it('should handle string org_id correctly', () => {
      // 专门测试 org_id 为字符串的情况
      const stringIdArbitrary = fc.record({
        org_id: fc.integer({ min: 1, max: 10000 }).map(String),
        org_name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        org_type: fc.constantFrom(...validOrgTypes),
        parent_org_id: fc.constant(null),
        is_active: fc.boolean(),
        sort_order: fc.integer({ min: 0, max: 1000 }),
        remark: fc.constant(null),
        created_at: fc.constant('2024-01-01T00:00:00.000Z'),
        updated_at: fc.constant('2024-01-01T00:00:00.000Z')
      })

      fc.assert(
        fc.property(stringIdArbitrary, (row) => {
          const converted = convertToOrgVO(row)
          
          // 验证字符串 ID 被正确转换为数字
          expect(typeof converted.orgId).toBe('number')
          expect(converted.orgId).toBe(parseInt(row.org_id, 10))
          
          return true
        }),
        testConfig
      )
    })

    it('should handle string parent_org_id correctly', () => {
      // 专门测试 parent_org_id 为字符串的情况
      const stringParentIdArbitrary = fc.record({
        org_id: fc.integer({ min: 1, max: 10000 }),
        org_name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        org_type: fc.constantFrom(...validOrgTypes),
        parent_org_id: fc.integer({ min: 1, max: 10000 }).map(String),
        is_active: fc.boolean(),
        sort_order: fc.integer({ min: 0, max: 1000 }),
        remark: fc.constant(null),
        created_at: fc.constant('2024-01-01T00:00:00.000Z'),
        updated_at: fc.constant('2024-01-01T00:00:00.000Z')
      })

      fc.assert(
        fc.property(stringParentIdArbitrary, (row) => {
          const converted = convertToOrgVO(row)
          
          // 验证字符串 parent_org_id 被正确转换为数字
          expect(typeof converted.parentOrgId).toBe('number')
          expect(converted.parentOrgId).toBe(parseInt(row.parent_org_id as string, 10))
          
          return true
        }),
        testConfig
      )
    })

    it('should produce Zod-valid OrgVO objects', () => {
      fc.assert(
        fc.property(snakeCaseOrgRowArbitrary, (row) => {
          const converted = convertToOrgVO(row)
          
          // 验证转换后的对象符合 Zod schema
          const result = orgVOSchema.safeParse(converted)
          expect(result.success).toBe(true)
          
          if (result.success) {
            // 验证 Zod 解析后的数据与转换结果一致
            expect(result.data).toEqual(converted)
          }
          
          return true
        }),
        testConfig
      )
    })
  })

  // ==========================================================================
  // Property 3: Zod Validation Rejects Invalid Data
  // ==========================================================================

  /**
   * **Property 3: Zod Validation Rejects Invalid Data**
   * 
   * *For any* object that does not conform to the OrgVO schema (missing required 
   * fields, wrong types, invalid enum values), the Zod validation SHALL:
   * - Return `success: false` from `safeParse`
   * - Provide error details in the `error` field
   * - Not throw an exception
   * 
   * **Validates: Requirements 3.3**
   */
  describe('Property 3: Zod Validation Rejects Invalid Data', () => {
    
    it('should return success: false for invalid objects', () => {
      fc.assert(
        fc.property(invalidOrgVOArbitrary, (invalidObj) => {
          // Zod safeParse 不应抛出异常
          let result: ReturnType<typeof orgVOSchema.safeParse>
          let threwException = false
          
          try {
            result = orgVOSchema.safeParse(invalidObj)
          } catch {
            threwException = true
            return false
          }
          
          // 验证没有抛出异常
          expect(threwException).toBe(false)
          
          // 验证返回 success: false
          expect(result!.success).toBe(false)
          
          return true
        }),
        testConfig
      )
    })

    it('should provide error details in the error field', () => {
      fc.assert(
        fc.property(invalidOrgVOArbitrary, (invalidObj) => {
          const result = orgVOSchema.safeParse(invalidObj)
          
          // 验证返回 success: false
          expect(result.success).toBe(false)
          
          // 验证 error 字段存在且包含错误详情
          if (!result.success) {
            expect(result.error).toBeDefined()
            // Zod 使用 issues 而不是 errors
            expect(result.error.issues).toBeDefined()
            expect(Array.isArray(result.error.issues)).toBe(true)
            expect(result.error.issues.length).toBeGreaterThan(0)
            
            // 验证每个错误都有必要的字段
            result.error.issues.forEach(issue => {
              expect(issue).toHaveProperty('message')
              expect(issue).toHaveProperty('path')
            })
          }
          
          return true
        }),
        testConfig
      )
    })

    it('should not throw an exception for any invalid input', () => {
      fc.assert(
        fc.property(invalidOrgVOArbitrary, (invalidObj) => {
          // 使用 try-catch 确保 safeParse 不会抛出异常
          const safeParseDoesNotThrow = () => {
            try {
              orgVOSchema.safeParse(invalidObj)
              return true
            } catch {
              return false
            }
          }
          
          expect(safeParseDoesNotThrow()).toBe(true)
          
          return true
        }),
        testConfig
      )
    })

    it('should reject objects with missing required fields', () => {
      // 专门测试缺少必需字段的情况
      const missingFieldsArbitrary = fc.oneof(
        // 缺少 orgId
        fc.record({
          orgName: fc.string({ minLength: 1, maxLength: 50 }),
          orgType: orgTypeArbitrary,
          parentOrgId: fc.constant(null),
          isActive: fc.boolean(),
          sortOrder: fc.integer({ min: 0, max: 100 }),
          remark: fc.constant(null),
          createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
          updatedAt: fc.constant('2024-01-01T00:00:00.000Z')
        }),
        // 缺少 orgName
        fc.record({
          orgId: fc.integer({ min: 1, max: 10000 }),
          orgType: orgTypeArbitrary,
          parentOrgId: fc.constant(null),
          isActive: fc.boolean(),
          sortOrder: fc.integer({ min: 0, max: 100 }),
          remark: fc.constant(null),
          createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
          updatedAt: fc.constant('2024-01-01T00:00:00.000Z')
        }),
        // 缺少 orgType
        fc.record({
          orgId: fc.integer({ min: 1, max: 10000 }),
          orgName: fc.string({ minLength: 1, maxLength: 50 }),
          parentOrgId: fc.constant(null),
          isActive: fc.boolean(),
          sortOrder: fc.integer({ min: 0, max: 100 }),
          remark: fc.constant(null),
          createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
          updatedAt: fc.constant('2024-01-01T00:00:00.000Z')
        })
      )

      fc.assert(
        fc.property(missingFieldsArbitrary, (obj) => {
          const result = orgVOSchema.safeParse(obj)
          
          expect(result.success).toBe(false)
          if (!result.success) {
            // Zod 使用 issues 而不是 errors
            expect(result.error.issues.length).toBeGreaterThan(0)
          }
          
          return true
        }),
        testConfig
      )
    })

    it('should reject objects with wrong field types', () => {
      // 专门测试字段类型错误的情况
      const wrongTypesArbitrary = fc.oneof(
        // orgId 应该是 number，但传入 string
        fc.record({
          orgId: fc.string({ minLength: 1, maxLength: 10 }),
          orgName: fc.string({ minLength: 1, maxLength: 50 }),
          orgType: orgTypeArbitrary,
          parentOrgId: fc.constant(null),
          isActive: fc.boolean(),
          sortOrder: fc.integer({ min: 0, max: 100 }),
          remark: fc.constant(null),
          createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
          updatedAt: fc.constant('2024-01-01T00:00:00.000Z')
        }),
        // isActive 应该是 boolean，但传入 string
        fc.record({
          orgId: fc.integer({ min: 1, max: 10000 }),
          orgName: fc.string({ minLength: 1, maxLength: 50 }),
          orgType: orgTypeArbitrary,
          parentOrgId: fc.constant(null),
          isActive: fc.constantFrom('true', 'false', '1', '0'),
          sortOrder: fc.integer({ min: 0, max: 100 }),
          remark: fc.constant(null),
          createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
          updatedAt: fc.constant('2024-01-01T00:00:00.000Z')
        }),
        // sortOrder 应该是 number，但传入 string
        fc.record({
          orgId: fc.integer({ min: 1, max: 10000 }),
          orgName: fc.string({ minLength: 1, maxLength: 50 }),
          orgType: orgTypeArbitrary,
          parentOrgId: fc.constant(null),
          isActive: fc.boolean(),
          sortOrder: fc.string({ minLength: 1, maxLength: 5 }),
          remark: fc.constant(null),
          createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
          updatedAt: fc.constant('2024-01-01T00:00:00.000Z')
        })
      )

      fc.assert(
        fc.property(wrongTypesArbitrary, (obj) => {
          const result = orgVOSchema.safeParse(obj)
          
          expect(result.success).toBe(false)
          if (!result.success) {
            // Zod 使用 issues 而不是 errors
            expect(result.error.issues.length).toBeGreaterThan(0)
          }
          
          return true
        }),
        testConfig
      )
    })

    it('should reject objects with invalid enum values', () => {
      // 专门测试无效枚举值的情况
      const invalidEnumArbitrary = fc.record({
        orgId: fc.integer({ min: 1, max: 10000 }),
        orgName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        orgType: fc.constantFrom(
          'INVALID_TYPE', 
          'UNKNOWN', 
          'BAD_VALUE', 
          '', 
          'strategy_dept',  // 小写版本（无效）
          'functional',
          'DEPT',
          'TYPE_1'
        ),
        parentOrgId: fc.constant(null),
        isActive: fc.boolean(),
        sortOrder: fc.integer({ min: 0, max: 100 }),
        remark: fc.constant(null),
        createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
        updatedAt: fc.constant('2024-01-01T00:00:00.000Z')
      })

      fc.assert(
        fc.property(invalidEnumArbitrary, (obj) => {
          const result = orgVOSchema.safeParse(obj)
          
          expect(result.success).toBe(false)
          if (!result.success) {
            // 验证错误与 orgType 字段相关
            // Zod 使用 issues 而不是 errors
            const hasOrgTypeError = result.error.issues.some(
              issue => issue.path.includes('orgType')
            )
            expect(hasOrgTypeError).toBe(true)
          }
          
          return true
        }),
        testConfig
      )
    })

    it('should reject empty objects', () => {
      const result = orgVOSchema.safeParse({})
      
      expect(result.success).toBe(false)
      if (!result.success) {
        // 空对象应该有多个缺失字段的错误
        // Zod 使用 issues 而不是 errors
        expect(result.error.issues.length).toBeGreaterThan(0)
      }
    })

    it('should reject null and undefined', () => {
      const nullResult = orgVOSchema.safeParse(null)
      const undefinedResult = orgVOSchema.safeParse(undefined)
      
      expect(nullResult.success).toBe(false)
      expect(undefinedResult.success).toBe(false)
    })

    it('should reject primitive values', () => {
      const primitives = [42, 'string', true, [], Symbol('test')]
      
      primitives.forEach(primitive => {
        const result = orgVOSchema.safeParse(primitive)
        expect(result.success).toBe(false)
      })
    })
  })

  // ==========================================================================
  // Property 4: Zod Validation Accepts Valid Data
  // ==========================================================================

  /**
   * **Property 4: Zod Validation Accepts Valid Data**
   * 
   * *For any* object that conforms to the OrgVO schema (all required fields 
   * present with correct types), the Zod validation SHALL:
   * - Return `success: true` from `safeParse`
   * - Return the validated data in the `data` field
   * - The returned data SHALL be type-safe (TypeScript infers correct types)
   * 
   * **Validates: Requirements 3.4, 3.5**
   */
  describe('Property 4: Zod Validation Accepts Valid Data', () => {
    
    it('should return success: true for valid OrgVO objects', () => {
      fc.assert(
        fc.property(orgVOArbitrary, (validOrgVO) => {
          const result = orgVOSchema.safeParse(validOrgVO)
          
          // 验证返回 success: true
          expect(result.success).toBe(true)
          
          return true
        }),
        testConfig
      )
    })

    it('should return the validated data in the data field', () => {
      fc.assert(
        fc.property(orgVOArbitrary, (validOrgVO) => {
          const result = orgVOSchema.safeParse(validOrgVO)
          
          // 验证返回 success: true
          expect(result.success).toBe(true)
          
          if (result.success) {
            // 验证 data 字段存在
            expect(result.data).toBeDefined()
            
            // 验证 data 字段包含所有原始数据
            expect(result.data.orgId).toBe(validOrgVO.orgId)
            expect(result.data.orgName).toBe(validOrgVO.orgName)
            expect(result.data.orgType).toBe(validOrgVO.orgType)
            expect(result.data.parentOrgId).toBe(validOrgVO.parentOrgId)
            expect(result.data.isActive).toBe(validOrgVO.isActive)
            expect(result.data.sortOrder).toBe(validOrgVO.sortOrder)
            expect(result.data.remark).toBe(validOrgVO.remark)
            expect(result.data.createdAt).toBe(validOrgVO.createdAt)
            expect(result.data.updatedAt).toBe(validOrgVO.updatedAt)
          }
          
          return true
        }),
        testConfig
      )
    })

    it('should return data that matches the input exactly', () => {
      fc.assert(
        fc.property(orgVOArbitrary, (validOrgVO) => {
          const result = orgVOSchema.safeParse(validOrgVO)
          
          expect(result.success).toBe(true)
          
          if (result.success) {
            // 验证返回的数据与输入完全匹配
            expect(result.data).toEqual(validOrgVO)
          }
          
          return true
        }),
        testConfig
      )
    })

    it('should return type-safe data (TypeScript infers correct types)', () => {
      fc.assert(
        fc.property(orgVOArbitrary, (validOrgVO) => {
          const result = orgVOSchema.safeParse(validOrgVO)
          
          expect(result.success).toBe(true)
          
          if (result.success) {
            // 验证返回数据的类型正确
            // TypeScript 会在编译时检查这些类型
            const data = result.data
            
            // 验证 number 类型字段
            expect(typeof data.orgId).toBe('number')
            expect(typeof data.sortOrder).toBe('number')
            
            // 验证 string 类型字段
            expect(typeof data.orgName).toBe('string')
            expect(typeof data.orgType).toBe('string')
            expect(typeof data.createdAt).toBe('string')
            expect(typeof data.updatedAt).toBe('string')
            
            // 验证 boolean 类型字段
            expect(typeof data.isActive).toBe('boolean')
            
            // 验证 nullable 字段
            expect(data.parentOrgId === null || typeof data.parentOrgId === 'number').toBe(true)
            expect(data.remark === null || typeof data.remark === 'string').toBe(true)
            
            // 验证 orgType 是有效的枚举值
            expect(validOrgTypes).toContain(data.orgType)
          }
          
          return true
        }),
        testConfig
      )
    })

    it('should accept valid OrgVO with null parentOrgId', () => {
      // 专门测试 parentOrgId 为 null 的情况
      const nullParentIdArbitrary = fc.record({
        orgId: fc.integer({ min: 1, max: 10000 }),
        orgName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        orgType: orgTypeArbitrary,
        parentOrgId: fc.constant(null),
        isActive: fc.boolean(),
        sortOrder: fc.integer({ min: 0, max: 1000 }),
        remark: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: null }),
        createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
        updatedAt: fc.constant('2024-01-01T00:00:00.000Z')
      })

      fc.assert(
        fc.property(nullParentIdArbitrary, (validOrgVO) => {
          const result = orgVOSchema.safeParse(validOrgVO)
          
          expect(result.success).toBe(true)
          if (result.success) {
            expect(result.data.parentOrgId).toBeNull()
          }
          
          return true
        }),
        testConfig
      )
    })

    it('should accept valid OrgVO with non-null parentOrgId', () => {
      // 专门测试 parentOrgId 为非 null 的情况
      const nonNullParentIdArbitrary = fc.record({
        orgId: fc.integer({ min: 1, max: 10000 }),
        orgName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        orgType: orgTypeArbitrary,
        parentOrgId: fc.integer({ min: 1, max: 10000 }),
        isActive: fc.boolean(),
        sortOrder: fc.integer({ min: 0, max: 1000 }),
        remark: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: null }),
        createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
        updatedAt: fc.constant('2024-01-01T00:00:00.000Z')
      })

      fc.assert(
        fc.property(nonNullParentIdArbitrary, (validOrgVO) => {
          const result = orgVOSchema.safeParse(validOrgVO)
          
          expect(result.success).toBe(true)
          if (result.success) {
            expect(typeof result.data.parentOrgId).toBe('number')
            expect(result.data.parentOrgId).toBeGreaterThan(0)
          }
          
          return true
        }),
        testConfig
      )
    })

    it('should accept valid OrgVO with null remark', () => {
      // 专门测试 remark 为 null 的情况
      const nullRemarkArbitrary = fc.record({
        orgId: fc.integer({ min: 1, max: 10000 }),
        orgName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        orgType: orgTypeArbitrary,
        parentOrgId: fc.option(fc.integer({ min: 1, max: 10000 }), { nil: null }),
        isActive: fc.boolean(),
        sortOrder: fc.integer({ min: 0, max: 1000 }),
        remark: fc.constant(null),
        createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
        updatedAt: fc.constant('2024-01-01T00:00:00.000Z')
      })

      fc.assert(
        fc.property(nullRemarkArbitrary, (validOrgVO) => {
          const result = orgVOSchema.safeParse(validOrgVO)
          
          expect(result.success).toBe(true)
          if (result.success) {
            expect(result.data.remark).toBeNull()
          }
          
          return true
        }),
        testConfig
      )
    })

    it('should accept valid OrgVO with non-null remark', () => {
      // 专门测试 remark 为非 null 的情况
      const nonNullRemarkArbitrary = fc.record({
        orgId: fc.integer({ min: 1, max: 10000 }),
        orgName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        orgType: orgTypeArbitrary,
        parentOrgId: fc.option(fc.integer({ min: 1, max: 10000 }), { nil: null }),
        isActive: fc.boolean(),
        sortOrder: fc.integer({ min: 0, max: 1000 }),
        remark: fc.string({ minLength: 1, maxLength: 200 }),
        createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
        updatedAt: fc.constant('2024-01-01T00:00:00.000Z')
      })

      fc.assert(
        fc.property(nonNullRemarkArbitrary, (validOrgVO) => {
          const result = orgVOSchema.safeParse(validOrgVO)
          
          expect(result.success).toBe(true)
          if (result.success) {
            expect(typeof result.data.remark).toBe('string')
          }
          
          return true
        }),
        testConfig
      )
    })

    it('should accept valid OrgVO for all OrgType enum values', () => {
      // 测试所有 OrgType 枚举值都能被接受
      validOrgTypes.forEach(orgType => {
        const validOrgVO: OrgVO = {
          orgId: 1,
          orgName: 'Test Org',
          orgType: orgType,
          parentOrgId: null,
          isActive: true,
          sortOrder: 0,
          remark: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z'
        }

        const result = orgVOSchema.safeParse(validOrgVO)
        
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.orgType).toBe(orgType)
        }
      })
    })

    it('should accept valid orgListResponse with empty data array', () => {
      const emptyResponse = {
        success: true,
        data: [],
        message: 'OK',
        timestamp: '2024-01-01T00:00:00.000Z'
      }

      const result = orgListResponseSchema.safeParse(emptyResponse)
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.data).toEqual([])
        expect(result.data.success).toBe(true)
      }
    })

    it('should accept valid orgListResponse with multiple OrgVO items', () => {
      fc.assert(
        fc.property(orgListResponseArbitrary, (validResponse) => {
          const result = orgListResponseSchema.safeParse(validResponse)
          
          // 验证返回 success: true
          expect(result.success).toBe(true)
          
          if (result.success) {
            // 验证响应结构
            expect(result.data.success).toBe(true)
            expect(Array.isArray(result.data.data)).toBe(true)
            expect(typeof result.data.message).toBe('string')
            expect(typeof result.data.timestamp).toBe('string')
            
            // 验证 data 数组中的每个元素都是有效的 OrgVO
            result.data.data.forEach(orgVO => {
              expect(typeof orgVO.orgId).toBe('number')
              expect(typeof orgVO.orgName).toBe('string')
              expect(validOrgTypes).toContain(orgVO.orgType)
              expect(typeof orgVO.isActive).toBe('boolean')
              expect(typeof orgVO.sortOrder).toBe('number')
            })
          }
          
          return true
        }),
        testConfig
      )
    })

    it('should return data that matches input for orgListResponse', () => {
      fc.assert(
        fc.property(orgListResponseArbitrary, (validResponse) => {
          const result = orgListResponseSchema.safeParse(validResponse)
          
          expect(result.success).toBe(true)
          
          if (result.success) {
            // 验证返回的数据与输入完全匹配
            expect(result.data).toEqual(validResponse)
          }
          
          return true
        }),
        testConfig
      )
    })
  })

  // ==========================================================================
  // Property 5: OrgVO to Department Conversion Correctness
  // ==========================================================================

  /**
   * **Property 5: OrgVO to Department Conversion Correctness**
   * 
   * *For any* valid OrgVO object with camelCase fields, when converted by 
   * `convertOrgVOToDepartment`, the resulting Department object SHALL have:
   * - `id` equal to `String(orgVO.orgId)`
   * - `name` equal to `orgVO.orgName`
   * - `type` correctly mapped from `orgVO.orgType` (STRATEGY_DEPT/SCHOOL → strategic_dept, 
   *   FUNCTIONAL_DEPT → functional_dept, others → secondary_college)
   * - `sortOrder` equal to `orgVO.sortOrder`
   * 
   * **Validates: Requirements 4.4**
   */
  describe('Property 5: OrgVO to Department Conversion Correctness', () => {
    
    /**
     * OrgType 到 Department.type 的映射表
     * 
     * | OrgType | Department.type |
     * |---------|-----------------|
     * | STRATEGY_DEPT | strategic_dept |
     * | SCHOOL | strategic_dept |
     * | FUNCTIONAL_DEPT | functional_dept |
     * | COLLEGE | secondary_college |
     * | SECONDARY_COLLEGE | secondary_college |
     * | DIVISION | secondary_college |
     * | OTHER | secondary_college |
     */
    const orgTypeToDepartmentTypeMapping: Record<OrgType, 'strategic_dept' | 'functional_dept' | 'secondary_college'> = {
      'STRATEGY_DEPT': 'strategic_dept',
      'SCHOOL': 'strategic_dept',
      'FUNCTIONAL_DEPT': 'functional_dept',
      'COLLEGE': 'secondary_college',
      'SECONDARY_COLLEGE': 'secondary_college',
      'DIVISION': 'secondary_college',
      'OTHER': 'secondary_college'
    }

    it('should convert id correctly: id equals String(orgVO.orgId)', () => {
      fc.assert(
        fc.property(orgVOArbitrary, (orgVO) => {
          const department = convertOrgVOToDepartment(orgVO)
          
          // 验证 id 等于 String(orgVO.orgId)
          expect(department.id).toBe(String(orgVO.orgId))
          
          // 验证 id 是字符串类型
          expect(typeof department.id).toBe('string')
          
          return true
        }),
        testConfig
      )
    })

    it('should convert name correctly: name equals orgVO.orgName', () => {
      fc.assert(
        fc.property(orgVOArbitrary, (orgVO) => {
          const department = convertOrgVOToDepartment(orgVO)
          
          // 验证 name 等于 orgVO.orgName
          expect(department.name).toBe(orgVO.orgName)
          
          // 验证 name 是字符串类型
          expect(typeof department.name).toBe('string')
          
          return true
        }),
        testConfig
      )
    })

    it('should convert sortOrder correctly: sortOrder equals orgVO.sortOrder', () => {
      fc.assert(
        fc.property(orgVOArbitrary, (orgVO) => {
          const department = convertOrgVOToDepartment(orgVO)
          
          // 验证 sortOrder 等于 orgVO.sortOrder
          expect(department.sortOrder).toBe(orgVO.sortOrder)
          
          // 验证 sortOrder 是数字类型
          expect(typeof department.sortOrder).toBe('number')
          
          return true
        }),
        testConfig
      )
    })

    it('should convert type correctly based on orgType mapping', () => {
      fc.assert(
        fc.property(orgVOArbitrary, (orgVO) => {
          const department = convertOrgVOToDepartment(orgVO)
          
          // 获取预期的 Department.type
          const expectedType = orgTypeToDepartmentTypeMapping[orgVO.orgType]
          
          // 验证 type 正确映射
          expect(department.type).toBe(expectedType)
          
          // 验证 type 是有效的 Department.type 值
          expect(['strategic_dept', 'functional_dept', 'secondary_college']).toContain(department.type)
          
          return true
        }),
        testConfig
      )
    })

    it('should map STRATEGY_DEPT to strategic_dept', () => {
      // 专门测试 STRATEGY_DEPT 映射
      const strategyDeptArbitrary = fc.record({
        orgId: fc.integer({ min: 1, max: 10000 }),
        orgName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        orgType: fc.constant('STRATEGY_DEPT' as OrgType),
        parentOrgId: fc.option(fc.integer({ min: 1, max: 10000 }), { nil: null }),
        isActive: fc.boolean(),
        sortOrder: fc.integer({ min: 0, max: 1000 }),
        remark: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: null }),
        createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
        updatedAt: fc.constant('2024-01-01T00:00:00.000Z')
      })

      fc.assert(
        fc.property(strategyDeptArbitrary, (orgVO) => {
          const department = convertOrgVOToDepartment(orgVO)
          expect(department.type).toBe('strategic_dept')
          return true
        }),
        testConfig
      )
    })

    it('should map SCHOOL to strategic_dept', () => {
      // 专门测试 SCHOOL 映射
      const schoolArbitrary = fc.record({
        orgId: fc.integer({ min: 1, max: 10000 }),
        orgName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        orgType: fc.constant('SCHOOL' as OrgType),
        parentOrgId: fc.option(fc.integer({ min: 1, max: 10000 }), { nil: null }),
        isActive: fc.boolean(),
        sortOrder: fc.integer({ min: 0, max: 1000 }),
        remark: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: null }),
        createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
        updatedAt: fc.constant('2024-01-01T00:00:00.000Z')
      })

      fc.assert(
        fc.property(schoolArbitrary, (orgVO) => {
          const department = convertOrgVOToDepartment(orgVO)
          expect(department.type).toBe('strategic_dept')
          return true
        }),
        testConfig
      )
    })

    it('should map FUNCTIONAL_DEPT to functional_dept', () => {
      // 专门测试 FUNCTIONAL_DEPT 映射
      const functionalDeptArbitrary = fc.record({
        orgId: fc.integer({ min: 1, max: 10000 }),
        orgName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        orgType: fc.constant('FUNCTIONAL_DEPT' as OrgType),
        parentOrgId: fc.option(fc.integer({ min: 1, max: 10000 }), { nil: null }),
        isActive: fc.boolean(),
        sortOrder: fc.integer({ min: 0, max: 1000 }),
        remark: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: null }),
        createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
        updatedAt: fc.constant('2024-01-01T00:00:00.000Z')
      })

      fc.assert(
        fc.property(functionalDeptArbitrary, (orgVO) => {
          const department = convertOrgVOToDepartment(orgVO)
          expect(department.type).toBe('functional_dept')
          return true
        }),
        testConfig
      )
    })

    it('should map COLLEGE, SECONDARY_COLLEGE, DIVISION, OTHER to secondary_college', () => {
      // 测试所有映射到 secondary_college 的 OrgType
      const secondaryCollegeTypes: OrgType[] = ['COLLEGE', 'SECONDARY_COLLEGE', 'DIVISION', 'OTHER']
      
      const secondaryCollegeArbitrary = fc.record({
        orgId: fc.integer({ min: 1, max: 10000 }),
        orgName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        orgType: fc.constantFrom(...secondaryCollegeTypes),
        parentOrgId: fc.option(fc.integer({ min: 1, max: 10000 }), { nil: null }),
        isActive: fc.boolean(),
        sortOrder: fc.integer({ min: 0, max: 1000 }),
        remark: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: null }),
        createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
        updatedAt: fc.constant('2024-01-01T00:00:00.000Z')
      })

      fc.assert(
        fc.property(secondaryCollegeArbitrary, (orgVO) => {
          const department = convertOrgVOToDepartment(orgVO)
          expect(department.type).toBe('secondary_college')
          return true
        }),
        testConfig
      )
    })

    it('should produce a valid Department object with all required fields', () => {
      fc.assert(
        fc.property(orgVOArbitrary, (orgVO) => {
          const department = convertOrgVOToDepartment(orgVO)
          
          // 验证 Department 对象包含所有必需字段
          expect(department).toHaveProperty('id')
          expect(department).toHaveProperty('name')
          expect(department).toHaveProperty('type')
          expect(department).toHaveProperty('sortOrder')
          
          // 验证字段类型
          expect(typeof department.id).toBe('string')
          expect(typeof department.name).toBe('string')
          expect(typeof department.type).toBe('string')
          expect(typeof department.sortOrder).toBe('number')
          
          // 验证 Department 对象只有这四个字段
          const keys = Object.keys(department)
          expect(keys.sort()).toEqual(['id', 'name', 'sortOrder', 'type'].sort())
          
          return true
        }),
        testConfig
      )
    })

    it('should correctly convert all fields together', () => {
      fc.assert(
        fc.property(orgVOArbitrary, (orgVO) => {
          const department = convertOrgVOToDepartment(orgVO)
          const expectedType = orgTypeToDepartmentTypeMapping[orgVO.orgType]
          
          // 验证所有字段同时正确转换
          expect(department).toEqual({
            id: String(orgVO.orgId),
            name: orgVO.orgName,
            type: expectedType,
            sortOrder: orgVO.sortOrder
          })
          
          return true
        }),
        testConfig
      )
    })

    it('should verify mapOrgTypeToFrontend function consistency', () => {
      // 验证 mapOrgTypeToFrontend 函数与预期映射一致
      validOrgTypes.forEach(orgType => {
        const mappedType = mapOrgTypeToFrontend(orgType)
        const expectedType = orgTypeToDepartmentTypeMapping[orgType]
        
        expect(mappedType).toBe(expectedType)
      })
    })

    it('should handle edge case: orgId = 0 (if valid)', () => {
      // 测试边界情况：orgId 为 0
      const zeroIdOrgVO: OrgVO = {
        orgId: 0,
        orgName: 'Test Org',
        orgType: 'FUNCTIONAL_DEPT',
        parentOrgId: null,
        isActive: true,
        sortOrder: 0,
        remark: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      }
      
      const department = convertOrgVOToDepartment(zeroIdOrgVO)
      
      expect(department.id).toBe('0')
      expect(department.name).toBe('Test Org')
      expect(department.type).toBe('functional_dept')
      expect(department.sortOrder).toBe(0)
    })

    it('should handle edge case: large orgId values', () => {
      // 测试边界情况：大数值 orgId
      const largeIdArbitrary = fc.record({
        orgId: fc.integer({ min: 1000000, max: 9999999 }),
        orgName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        orgType: orgTypeArbitrary,
        parentOrgId: fc.option(fc.integer({ min: 1, max: 10000 }), { nil: null }),
        isActive: fc.boolean(),
        sortOrder: fc.integer({ min: 0, max: 1000 }),
        remark: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: null }),
        createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
        updatedAt: fc.constant('2024-01-01T00:00:00.000Z')
      })

      fc.assert(
        fc.property(largeIdArbitrary, (orgVO) => {
          const department = convertOrgVOToDepartment(orgVO)
          
          // 验证大数值 ID 正确转换为字符串
          expect(department.id).toBe(String(orgVO.orgId))
          expect(department.id.length).toBeGreaterThan(0)
          
          return true
        }),
        testConfig
      )
    })

    it('should handle edge case: special characters in orgName', () => {
      // 测试边界情况：orgName 包含特殊字符
      const specialNameArbitrary = fc.record({
        orgId: fc.integer({ min: 1, max: 10000 }),
        orgName: fc.constantFrom(
          '战略发展部（总部）',
          '信息技术中心/IT部',
          '人力资源部-HR',
          '财务部 & 审计部',
          '研发中心@总部',
          '测试部门#1'
        ),
        orgType: orgTypeArbitrary,
        parentOrgId: fc.option(fc.integer({ min: 1, max: 10000 }), { nil: null }),
        isActive: fc.boolean(),
        sortOrder: fc.integer({ min: 0, max: 1000 }),
        remark: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: null }),
        createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
        updatedAt: fc.constant('2024-01-01T00:00:00.000Z')
      })

      fc.assert(
        fc.property(specialNameArbitrary, (orgVO) => {
          const department = convertOrgVOToDepartment(orgVO)
          
          // 验证特殊字符的 orgName 正确保留
          expect(department.name).toBe(orgVO.orgName)
          
          return true
        }),
        testConfig
      )
    })
  })
})
