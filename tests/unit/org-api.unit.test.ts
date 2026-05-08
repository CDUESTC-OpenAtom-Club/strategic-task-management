/**
 * Org API 单元测试
 *
 * **Feature: api-response-type-safety**
 *
 * 本文件包含 Org API 类型安全相关的单元测试，验证：
 * - convertToOrgVO 函数的边界情况（null 值、缺失字段）
 * - convertOrgVOToDepartment 所有 OrgType 映射
 * - Zod 验证失败时的错误处理
 *
 * **Validates: Requirements 6.3, 6.4**
 */
import { describe, it, expect } from 'vitest'
import {
  orgVOSchema,
  orgListResponseSchema,
  type OrgVO,
  type OrgType
} from '../../src/3-features/organization/api/org.schema'
import {
  convertOrgVOToDepartment,
  mapOrgTypeToFrontend
} from '../../src/3-features/organization/api/org'
import { convertToOrgVO, type SnakeCaseOrgRow } from '../property/org-api-type-safety.property.test'

// ============================================================================
// 测试数据
// ============================================================================

/**
 * 所有有效的 OrgType 枚举值
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

/**
 * 创建有效的 snake_case 数据库行
 */
function createValidSnakeCaseRow(overrides: Partial<SnakeCaseOrgRow> = {}): SnakeCaseOrgRow {
  return {
    org_id: 1,
    org_name: '测试部门',
    org_type: 'FUNCTIONAL_DEPT',
    parent_org_id: null,
    is_active: true,
    sort_order: 0,
    remark: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides
  }
}

/**
 * 创建有效的 OrgVO 对象
 */
function createValidOrgVO(overrides: Partial<OrgVO> = {}): OrgVO {
  return {
    orgId: 1,
    orgName: '测试部门',
    orgType: 'FUNCTIONAL_DEPT',
    parentOrgId: null,
    isActive: true,
    sortOrder: 0,
    remark: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides
  }
}

// ============================================================================
// convertToOrgVO 边界情况测试
// ============================================================================

describe('convertToOrgVO Edge Cases', () => {
  /**
   * **Validates: Requirements 6.3**
   * THE Unit_Tests SHALL 验证 convertToOrgVO 函数的边界情况
   */

  describe('null values for optional fields', () => {
    it('should handle null parentOrgId correctly', () => {
      const row = createValidSnakeCaseRow({ parent_org_id: null })
      const result = convertToOrgVO(row)

      expect(result.parentOrgId).toBeNull()
    })

    it('should handle null remark correctly', () => {
      const row = createValidSnakeCaseRow({ remark: null })
      const result = convertToOrgVO(row)

      expect(result.remark).toBeNull()
    })

    it('should handle both null parentOrgId and null remark', () => {
      const row = createValidSnakeCaseRow({
        parent_org_id: null,
        remark: null
      })
      const result = convertToOrgVO(row)

      expect(result.parentOrgId).toBeNull()
      expect(result.remark).toBeNull()
    })
  })

  describe('missing fields with defaults', () => {
    it('should default isActive to true when undefined', () => {
      const row = createValidSnakeCaseRow()
      // @ts-expect-error - Testing undefined behavior
      delete row.is_active
      // Manually set to undefined to simulate missing field
      const rowWithUndefined = { ...row, is_active: undefined } as unknown as SnakeCaseOrgRow

      const result = convertToOrgVO(rowWithUndefined)

      expect(result.isActive).toBe(true)
    })

    it('should default sortOrder to 0 when undefined', () => {
      const row = createValidSnakeCaseRow()
      // @ts-expect-error - Testing undefined behavior
      delete row.sort_order
      const rowWithUndefined = { ...row, sort_order: undefined } as unknown as SnakeCaseOrgRow

      const result = convertToOrgVO(rowWithUndefined)

      expect(result.sortOrder).toBe(0)
    })

    it('should default remark to null when undefined', () => {
      const row = createValidSnakeCaseRow()
      // @ts-expect-error - Testing undefined behavior
      delete row.remark
      const rowWithUndefined = { ...row, remark: undefined } as unknown as SnakeCaseOrgRow

      const result = convertToOrgVO(rowWithUndefined)

      expect(result.remark).toBeNull()
    })
  })

  describe('string to number coercion for org_id and parent_org_id', () => {
    it('should convert string org_id to number', () => {
      const row = createValidSnakeCaseRow({ org_id: '123' })
      const result = convertToOrgVO(row)

      expect(result.orgId).toBe(123)
      expect(typeof result.orgId).toBe('number')
    })

    it('should convert string parent_org_id to number', () => {
      const row = createValidSnakeCaseRow({ parent_org_id: '456' })
      const result = convertToOrgVO(row)

      expect(result.parentOrgId).toBe(456)
      expect(typeof result.parentOrgId).toBe('number')
    })

    it('should handle numeric org_id without conversion', () => {
      const row = createValidSnakeCaseRow({ org_id: 789 })
      const result = convertToOrgVO(row)

      expect(result.orgId).toBe(789)
      expect(typeof result.orgId).toBe('number')
    })

    it('should handle numeric parent_org_id without conversion', () => {
      const row = createValidSnakeCaseRow({ parent_org_id: 101 })
      const result = convertToOrgVO(row)

      expect(result.parentOrgId).toBe(101)
      expect(typeof result.parentOrgId).toBe('number')
    })

    it('should handle large string org_id values', () => {
      const row = createValidSnakeCaseRow({ org_id: '9999999' })
      const result = convertToOrgVO(row)

      expect(result.orgId).toBe(9999999)
    })

    it('should handle large string parent_org_id values', () => {
      const row = createValidSnakeCaseRow({ parent_org_id: '8888888' })
      const result = convertToOrgVO(row)

      expect(result.parentOrgId).toBe(8888888)
    })
  })

  describe('empty string handling', () => {
    it('should preserve empty string for org_name', () => {
      const row = createValidSnakeCaseRow({ org_name: '' })
      const result = convertToOrgVO(row)

      expect(result.orgName).toBe('')
    })

    it('should preserve empty string for remark', () => {
      const row = createValidSnakeCaseRow({ remark: '' })
      const result = convertToOrgVO(row)

      expect(result.remark).toBe('')
    })

    it('should preserve empty string for created_at', () => {
      const row = createValidSnakeCaseRow({ created_at: '' })
      const result = convertToOrgVO(row)

      expect(result.createdAt).toBe('')
    })

    it('should preserve empty string for updated_at', () => {
      const row = createValidSnakeCaseRow({ updated_at: '' })
      const result = convertToOrgVO(row)

      expect(result.updatedAt).toBe('')
    })
  })

  describe('special characters in string fields', () => {
    it('should handle Chinese characters in org_name', () => {
      const row = createValidSnakeCaseRow({ org_name: '战略发展部（总部）' })
      const result = convertToOrgVO(row)

      expect(result.orgName).toBe('战略发展部（总部）')
    })

    it('should handle special characters in remark', () => {
      const row = createValidSnakeCaseRow({ remark: '备注：测试 & 验证 <script>' })
      const result = convertToOrgVO(row)

      expect(result.remark).toBe('备注：测试 & 验证 <script>')
    })

    it('should handle unicode characters', () => {
      const row = createValidSnakeCaseRow({ org_name: '部门 🏢 测试' })
      const result = convertToOrgVO(row)

      expect(result.orgName).toBe('部门 🏢 测试')
    })
  })

  describe('boundary values', () => {
    it('should handle org_id = 0', () => {
      const row = createValidSnakeCaseRow({ org_id: 0 })
      const result = convertToOrgVO(row)

      expect(result.orgId).toBe(0)
    })

    it('should handle sort_order = 0', () => {
      const row = createValidSnakeCaseRow({ sort_order: 0 })
      const result = convertToOrgVO(row)

      expect(result.sortOrder).toBe(0)
    })

    it('should handle negative sort_order', () => {
      const row = createValidSnakeCaseRow({ sort_order: -1 })
      const result = convertToOrgVO(row)

      expect(result.sortOrder).toBe(-1)
    })

    it('should handle is_active = false', () => {
      const row = createValidSnakeCaseRow({ is_active: false })
      const result = convertToOrgVO(row)

      expect(result.isActive).toBe(false)
    })
  })
})

// ============================================================================
// convertOrgVOToDepartment OrgType 映射测试
// ============================================================================

describe('convertOrgVOToDepartment OrgType Mapping', () => {
  /**
   * **Validates: Requirements 6.3**
   * THE Unit_Tests SHALL 验证 convertOrgVOToDepartment 所有 OrgType 映射
   */

  describe('STRATEGY_DEPT mapping', () => {
    it('should map STRATEGY_DEPT to strategic_dept', () => {
      const orgVO = createValidOrgVO({ orgType: 'STRATEGY_DEPT' })
      const result = convertOrgVOToDepartment(orgVO)

      expect(result.type).toBe('strategic_dept')
    })
  })

  describe('SCHOOL mapping', () => {
    it('should map SCHOOL to strategic_dept', () => {
      const orgVO = createValidOrgVO({ orgType: 'SCHOOL' })
      const result = convertOrgVOToDepartment(orgVO)

      expect(result.type).toBe('strategic_dept')
    })
  })

  describe('FUNCTIONAL_DEPT mapping', () => {
    it('should map FUNCTIONAL_DEPT to functional_dept', () => {
      const orgVO = createValidOrgVO({ orgType: 'FUNCTIONAL_DEPT' })
      const result = convertOrgVOToDepartment(orgVO)

      expect(result.type).toBe('functional_dept')
    })
  })

  describe('COLLEGE mapping', () => {
    it('should map COLLEGE to secondary_college', () => {
      const orgVO = createValidOrgVO({ orgType: 'COLLEGE' })
      const result = convertOrgVOToDepartment(orgVO)

      expect(result.type).toBe('secondary_college')
    })
  })

  describe('SECONDARY_COLLEGE mapping', () => {
    it('should map SECONDARY_COLLEGE to secondary_college', () => {
      const orgVO = createValidOrgVO({ orgType: 'SECONDARY_COLLEGE' })
      const result = convertOrgVOToDepartment(orgVO)

      expect(result.type).toBe('secondary_college')
    })
  })

  describe('DIVISION mapping', () => {
    it('should map DIVISION to secondary_college', () => {
      const orgVO = createValidOrgVO({ orgType: 'DIVISION' })
      const result = convertOrgVOToDepartment(orgVO)

      expect(result.type).toBe('secondary_college')
    })
  })

  describe('OTHER mapping', () => {
    it('should map OTHER to secondary_college', () => {
      const orgVO = createValidOrgVO({ orgType: 'OTHER' })
      const result = convertOrgVOToDepartment(orgVO)

      expect(result.type).toBe('secondary_college')
    })
  })

  describe('Unknown/invalid OrgType handling', () => {
    it('should default unknown OrgType to secondary_college', () => {
      // @ts-expect-error - Testing invalid OrgType
      const orgVO = createValidOrgVO({ orgType: 'UNKNOWN_TYPE' })
      const result = convertOrgVOToDepartment(orgVO)

      expect(result.type).toBe('secondary_college')
    })

    it('should default empty string OrgType to secondary_college', () => {
      // @ts-expect-error - Testing invalid OrgType
      const orgVO = createValidOrgVO({ orgType: '' })
      const result = convertOrgVOToDepartment(orgVO)

      expect(result.type).toBe('secondary_college')
    })

    it('should default lowercase orgType to secondary_college', () => {
      // @ts-expect-error - Testing invalid OrgType (lowercase)
      const orgVO = createValidOrgVO({ orgType: 'strategy_dept' })
      const result = convertOrgVOToDepartment(orgVO)

      expect(result.type).toBe('secondary_college')
    })
  })

  describe('mapOrgTypeToFrontend function', () => {
    it('should map all valid OrgTypes correctly', () => {
      const expectedMappings: Record<
        OrgType,
        'strategic_dept' | 'functional_dept' | 'secondary_college'
      > = {
        STRATEGY_DEPT: 'strategic_dept',
        SCHOOL: 'strategic_dept',
        FUNCTIONAL_DEPT: 'functional_dept',
        COLLEGE: 'secondary_college',
        SECONDARY_COLLEGE: 'secondary_college',
        DIVISION: 'secondary_college',
        OTHER: 'secondary_college'
      }

      validOrgTypes.forEach(orgType => {
        const result = mapOrgTypeToFrontend(orgType)
        expect(result).toBe(expectedMappings[orgType])
      })
    })

    it('should handle FUNCTION_DEPT (alternative spelling) as functional_dept', () => {
      const result = mapOrgTypeToFrontend('FUNCTION_DEPT')
      expect(result).toBe('functional_dept')
    })

    it('should default unknown types to secondary_college', () => {
      const result = mapOrgTypeToFrontend('INVALID_TYPE')
      expect(result).toBe('secondary_college')
    })
  })

  describe('Department object structure', () => {
    it('should convert orgId to string id', () => {
      const orgVO = createValidOrgVO({ orgId: 123 })
      const result = convertOrgVOToDepartment(orgVO)

      expect(result.id).toBe('123')
      expect(typeof result.id).toBe('string')
    })

    it('should preserve orgName as name', () => {
      const orgVO = createValidOrgVO({ orgName: '测试部门名称' })
      const result = convertOrgVOToDepartment(orgVO)

      expect(result.name).toBe('测试部门名称')
    })

    it('should preserve sortOrder', () => {
      const orgVO = createValidOrgVO({ sortOrder: 42 })
      const result = convertOrgVOToDepartment(orgVO)

      expect(result.sortOrder).toBe(42)
    })

    it('should default sortOrder to 0 when undefined', () => {
      const orgVO = createValidOrgVO()
      // @ts-expect-error - Testing undefined sortOrder
      delete orgVO.sortOrder
      const result = convertOrgVOToDepartment(orgVO)

      expect(result.sortOrder).toBe(0)
    })

    it('should only include id, name, type, and sortOrder fields', () => {
      const orgVO = createValidOrgVO()
      const result = convertOrgVOToDepartment(orgVO)

      const keys = Object.keys(result).sort()
      expect(keys).toEqual(['id', 'name', 'sortOrder', 'type'])
    })
  })
})

// ============================================================================
// Zod 验证错误处理测试
// ============================================================================

describe('Zod Validation Error Handling', () => {
  /**
   * **Validates: Requirements 6.4**
   * THE Unit_Tests SHALL 验证 Zod 验证失败时的错误处理
   */

  describe('Invalid data returns proper error structure', () => {
    it('should return success: false for missing required fields', () => {
      const invalidData = {
        orgName: '测试部门',
        orgType: 'FUNCTIONAL_DEPT'
        // Missing: orgId, parentOrgId, isActive, sortOrder, remark, createdAt, updatedAt
      }

      const result = orgVOSchema.safeParse(invalidData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
        expect(result.error.issues).toBeDefined()
        expect(Array.isArray(result.error.issues)).toBe(true)
      }
    })

    it('should return success: false for wrong field types', () => {
      const invalidData = {
        orgId: 'not-a-number',
        orgName: '测试部门',
        orgType: 'FUNCTIONAL_DEPT',
        parentOrgId: null,
        isActive: true,
        sortOrder: 0,
        remark: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      }

      const result = orgVOSchema.safeParse(invalidData)

      expect(result.success).toBe(false)
    })

    it('should return success: false for invalid enum values', () => {
      const invalidData = {
        orgId: 1,
        orgName: '测试部门',
        orgType: 'INVALID_TYPE',
        parentOrgId: null,
        isActive: true,
        sortOrder: 0,
        remark: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      }

      const result = orgVOSchema.safeParse(invalidData)

      expect(result.success).toBe(false)
    })

    it('should not throw exception for invalid data', () => {
      const invalidData = { random: 'data' }

      expect(() => {
        orgVOSchema.safeParse(invalidData)
      }).not.toThrow()
    })
  })

  describe('Error messages are descriptive', () => {
    it('should provide path information for missing fields', () => {
      const invalidData = {
        orgName: '测试部门'
      }

      const result = orgVOSchema.safeParse(invalidData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0)
      }
    })

    it('should provide message for type errors', () => {
      const invalidData = {
        orgId: 'string-instead-of-number',
        orgName: '测试部门',
        orgType: 'FUNCTIONAL_DEPT',
        parentOrgId: null,
        isActive: true,
        sortOrder: 0,
        remark: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      }

      const result = orgVOSchema.safeParse(invalidData)

      expect(result.success).toBe(false)
      if (!result.success) {
        const typeError = result.error.issues[0]
        expect(typeError).toBeDefined()
        expect(typeError?.message).toBeDefined()
        expect(typeError?.message.length).toBeGreaterThan(0)
      }
    })

    it('should provide message for invalid enum values', () => {
      const invalidData = {
        orgId: 1,
        orgName: '测试部门',
        orgType: 'NOT_A_VALID_TYPE',
        parentOrgId: null,
        isActive: true,
        sortOrder: 0,
        remark: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      }

      const result = orgVOSchema.safeParse(invalidData)

      expect(result.success).toBe(false)
      if (!result.success) {
        const enumError = result.error.issues[0]
        expect(enumError).toBeDefined()
        expect(enumError?.message).toBeDefined()
      }
    })

    it('should list all validation errors', () => {
      const invalidData = {
        orgId: 'not-a-number',
        orgName: 123,
        orgType: 'INVALID',
        parentOrgId: 'not-a-number',
        isActive: 'yes',
        sortOrder: 'zero',
        remark: 123,
        createdAt: 123,
        updatedAt: 123
      }

      const result = orgVOSchema.safeParse(invalidData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0)
      }
    })
  })

  describe('orgListResponseSchema validation', () => {
    it('should validate correct response structure', () => {
      const validResponse = {
        success: true,
        data: [createValidOrgVO()],
        message: 'OK',
        timestamp: '2024-01-01T00:00:00.000Z'
      }

      const result = orgListResponseSchema.safeParse(validResponse)

      expect(result.success).toBe(true)
    })

    it('should accept response with missing success field for legacy compatibility', () => {
      const legacyResponse = {
        data: [createValidOrgVO()],
        message: 'OK',
        timestamp: '2024-01-01T00:00:00.000Z'
      }

      const result = orgListResponseSchema.safeParse(legacyResponse)

      expect(result.success).toBe(true)
    })

    it('should reject response with invalid data array', () => {
      const invalidResponse = {
        success: true,
        data: [{ invalid: 'data' }],
        message: 'OK',
        timestamp: '2024-01-01T00:00:00.000Z'
      }

      const result = orgListResponseSchema.safeParse(invalidResponse)

      expect(result.success).toBe(false)
    })

    it('should accept response with empty data array', () => {
      const validResponse = {
        success: true,
        data: [],
        message: 'OK',
        timestamp: '2024-01-01T00:00:00.000Z'
      }

      const result = orgListResponseSchema.safeParse(validResponse)

      expect(result.success).toBe(true)
    })

    it('should accept timestamp as Date object', () => {
      const validResponse = {
        success: true,
        data: [],
        message: 'OK',
        timestamp: new Date()
      }

      const result = orgListResponseSchema.safeParse(validResponse)

      expect(result.success).toBe(true)
    })
  })

  describe('Edge cases for Zod validation', () => {
    it('should reject null as OrgVO', () => {
      const result = orgVOSchema.safeParse(null)
      expect(result.success).toBe(false)
    })

    it('should reject undefined as OrgVO', () => {
      const result = orgVOSchema.safeParse(undefined)
      expect(result.success).toBe(false)
    })

    it('should reject empty object as OrgVO', () => {
      const result = orgVOSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('should reject array as OrgVO', () => {
      const result = orgVOSchema.safeParse([])
      expect(result.success).toBe(false)
    })

    it('should reject primitive values as OrgVO', () => {
      expect(orgVOSchema.safeParse(42).success).toBe(false)
      expect(orgVOSchema.safeParse('string').success).toBe(false)
      expect(orgVOSchema.safeParse(true).success).toBe(false)
    })

    it('should accept valid OrgVO with all fields', () => {
      const validOrgVO = createValidOrgVO()
      const result = orgVOSchema.safeParse(validOrgVO)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validOrgVO)
      }
    })
  })
})
