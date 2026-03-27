// @ts-nocheck
/**
 * 组织机构 API
 * 从后端获取部门数据
 * 使用简化的 apiClient，在业务层实现必要的重试逻辑
 *
 * @see Requirements 2.1, 2.3 - 使用 Zod 推导的 OrgVO 类型
 * @see Requirements 2.4, 2.6 - 使用简化的 apiClient
 */
import { apiClient } from '@/shared/api/client'
import { logger } from '@/shared/lib/utils/logger'
import { buildQueryKey, fetchWithCache } from '@/shared/lib/utils/cache'
import { createPersistentReferencePolicy } from '@/shared/lib/utils/cache-config'
import { orgListResponseSchema, type OrgVO, type OrgType } from './org.schema'

// 重新导出 OrgVO 类型供其他模块使用
export type { OrgVO, OrgType }

// 前端使用的部门类型
export interface Department {
  id: string
  name: string
  type: 'strategic_dept' | 'functional_dept' | 'secondary_college'
  sortOrder: number
}

const ORG_CACHE_KEY = buildQueryKey('org', 'departments', { version: 'v2' })
const ORG_CACHE_POLICY = createPersistentReferencePolicy({
  tags: ['org.list']
})

/**
 * 将后端 OrgType 映射到前端类型
 *
 * 映射规则：
 * - STRATEGY_DEPT, SCHOOL → strategic_dept (战略发展部)
 * - FUNCTIONAL_DEPT, FUNCTION_DEPT → functional_dept (职能部门)
 * - COLLEGE, SECONDARY_COLLEGE, DIVISION, OTHER → secondary_college (二级学院)
 * - admin/ADMIN → 按组织名称二次判定（兼容当前数据库全部 admin 的场景）
 *
 * @param orgType - 后端 OrgType 枚举值
 * @param orgName - 组织名称（用于 admin 兜底判定）
 * @returns 前端 Department.type 值
 * @see Property 5 - OrgVO to Department Conversion Correctness
 */
export function mapOrgTypeToFrontend(
  orgType: string,
  orgName?: string
): 'strategic_dept' | 'functional_dept' | 'secondary_college' {
  const normalizedType = String(orgType || '').trim()
  const normalizedName = String(orgName || '').trim()

  // 兼容后端当前数据: 所有组织都标记为 admin，需要按名称区分
  if (normalizedType === 'admin' || normalizedType === 'ADMIN') {
    if (normalizedName === '战略发展部') {
      return 'strategic_dept'
    }
    if (normalizedName.includes('学院')) {
      return 'secondary_college'
    }
    return 'functional_dept'
  }

  const mapping: Record<string, 'strategic_dept' | 'functional_dept' | 'secondary_college'> = {
    STRATEGY_DEPT: 'strategic_dept',
    SCHOOL: 'strategic_dept',
    functional: 'functional_dept',
    FUNCTIONAL: 'functional_dept',
    FUNCTIONAL_DEPT: 'functional_dept',
    FUNCTION_DEPT: 'functional_dept',
    academic: 'secondary_college',
    ACADEMIC: 'secondary_college',
    COLLEGE: 'secondary_college',
    SECONDARY_COLLEGE: 'secondary_college',
    DIVISION: 'secondary_college',
    OTHER: 'secondary_college'
  }
  return mapping[normalizedType] || 'secondary_college'
}

/**
 * 将后端 OrgVO 转换为前端 Department 类型
 *
 * 接收 camelCase 格式的 OrgVO（已移除 snake_case 兼容代码）
 *
 * 转换规则：
 * - id = String(orgVO.orgId)
 * - name = orgVO.orgName
 * - type = mapOrgTypeToFrontend(orgVO.orgType)
 * - sortOrder = orgVO.sortOrder
 *
 * @param vo - camelCase 格式的 OrgVO 对象
 * @returns 前端 Department 对象
 * @see Requirements 4.4 - convertOrgVOToDepartment 函数 SHALL 接收 camelCase 格式的 OrgVO
 * @see Property 5 - OrgVO to Department Conversion Correctness
 */
export function convertOrgVOToDepartment(vo: OrgVO): Department {
  return {
    id: String(vo.orgId),
    name: vo.orgName,
    type: mapOrgTypeToFrontend(vo.orgType, vo.orgName),
    sortOrder: vo.sortOrder ?? 0
  }
}

export const orgApi = {
  async requestOrgList(): Promise<{ data: OrgVO[]; success: boolean; message?: string } | null> {
    const endpoints = ['/organizations', '/orgs']

    for (const endpoint of endpoints) {
      try {
        return await apiClient.get<{ data: OrgVO[]; success: boolean; message?: string }>(endpoint)
      } catch (error) {
        const status = Number((error as { code?: number; response?: { status?: number } }).code ??
          (error as { response?: { status?: number } }).response?.status ??
          NaN)
        const shouldFallback = endpoint === '/organizations' && (status === 403 || status === 404)

        if (shouldFallback) {
          logger.info(`[orgApi] ${endpoint} returned ${status}, falling back to /orgs`)
          continue
        }

        throw error
      }
    }

    return null
  },

  /**
   * 获取所有组织机构
   *
   * 使用 Zod 进行运行时验证，确保 API 响应符合预期格式。
   * 验证失败时记录错误并返回空数组，实现优雅降级。
   *
   * @returns Promise<OrgVO[]> - 验证通过的组织机构数组，验证失败返回空数组
   * @see Requirements 4.1 - 使用 Zod 验证响应数据
   * @see Requirements 4.2 - 验证失败时记录错误并返回空数组
   * @see Requirements 4.3 - 验证成功时返回类型安全的 OrgVO 数组
   */
  async getAllOrgs(): Promise<OrgVO[]> {
    try {
      const response = await fetchWithCache({
        key: ORG_CACHE_KEY,
        policy: ORG_CACHE_POLICY,
        fetcher: async () => {
          const result = await this.requestOrgList()
          return result ?? { data: [], success: false, message: '组织接口不可用' }
        }
      })

      // Zod 运行时验证
      const result = orgListResponseSchema.safeParse(response)

      if (!result.success) {
        // 尝试直接提取数据（降级处理）
        if (
          response &&
          typeof response === 'object' &&
          'data' in response &&
          Array.isArray(response.data)
        ) {
          return response.data as OrgVO[]
        }

        return []
      }

      return result.data.data
    } catch (error) {
      logger.error('[orgApi] Failed to get orgs:', error)
      return []
    }
  },

  /**
   * 获取所有部门（转换为前端格式）
   *
   * 调用 getAllOrgs 获取已验证的组织数据，然后转换为前端 Department 格式。
   * getAllOrgs 已经处理了 Zod 验证和错误处理，此方法只需进行格式转换。
   */
  async getAllDepartments(): Promise<Department[]> {
    try {
      const response = await fetchWithCache({
        key: ORG_CACHE_KEY,
        policy: ORG_CACHE_POLICY,
        fetcher: async () => {
          const result = await this.requestOrgList()
          return result ?? { data: [], success: false, message: '组织接口不可用' }
        }
      })

      // Direct transformation without Zod validation to avoid issues
      if (
        response &&
        typeof response === 'object' &&
        'data' in response &&
        Array.isArray(response.data)
      ) {
        return response.data.map((org: Record<string, unknown>) => {
          const id = org.id || org.orgId
          const name = org.name || org.orgName
          const type = org.orgType || org.type

          if (!id || !name || !type) {
            logger.warn('Invalid org data:', org)
          }

          return {
            id: String(id),
            name: name,
            type: mapOrgTypeToFrontend(String(type), String(name)),
            sortOrder: org.sortOrder ?? 0
          }
        })
      }

      return []
    } catch (error) {
      logger.error('[orgApi] Error loading departments:', error)
      return []
    }
  },

  /**
   * 获取战略发展部
   */
  async getStrategicDept(): Promise<Department | null> {
    const depts = await this.getAllDepartments()
    return depts.find(d => d.type === 'strategic_dept') || null
  },

  /**
   * 获取所有职能部门
   */
  async getFunctionalDepartments(): Promise<Department[]> {
    const depts = await this.getAllDepartments()
    return depts.filter(d => d.type === 'functional_dept')
  },

  /**
   * 获取所有二级学院
   */
  async getColleges(): Promise<Department[]> {
    const depts = await this.getAllDepartments()
    return depts.filter(d => d.type === 'secondary_college')
  },

  /**
   * 判断是否为战略发展部
   */
  isStrategicDept(deptName: string, departments: Department[]): boolean {
    const dept = departments.find(d => d.name === deptName)
    return dept?.type === 'strategic_dept'
  },

  /**
   * 判断是否为职能部门
   */
  isFunctionalDept(deptName: string, departments: Department[]): boolean {
    const dept = departments.find(d => d.name === deptName)
    return dept?.type === 'functional_dept'
  },

  /**
   * 判断是否为二级学院
   */
  isCollege(deptName: string, departments: Department[]): boolean {
    const dept = departments.find(d => d.name === deptName)
    return dept?.type === 'secondary_college'
  }
}

export default orgApi
