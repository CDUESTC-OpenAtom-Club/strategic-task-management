/**
 * 组织机构 API
 * 从后端获取部门数据
 *
 * @see Requirements 2.1, 2.3 - 使用 Zod 推导的 OrgVO 类型
 * @see Requirements 4.1, 4.2, 4.3 - 使用 Zod 验证 API 响应
 */
import { apiService } from './index'
import { orgListResponseSchema, type OrgVO, type OrgType } from './schemas/org.schema'

// 重新导出 OrgVO 类型供其他模块使用
export type { OrgVO, OrgType }

// 前端使用的部门类型
export interface Department {
  id: string
  name: string
  type: 'strategic_dept' | 'functional_dept' | 'secondary_college'
  sortOrder: number
}

/**
 * 将后端 OrgType 映射到前端类型
 *
 * 映射规则：
 * - STRATEGY_DEPT, SCHOOL → strategic_dept (战略发展部)
 * - FUNCTIONAL_DEPT, FUNCTION_DEPT → functional_dept (职能部门)
 * - COLLEGE, SECONDARY_COLLEGE, DIVISION, OTHER → secondary_college (二级学院)
 *
 * @param orgType - 后端 OrgType 枚举值
 * @returns 前端 Department.type 值
 * @see Property 5 - OrgVO to Department Conversion Correctness
 */
export function mapOrgTypeToFrontend(
  orgType: string
): 'strategic_dept' | 'functional_dept' | 'secondary_college' {
  const mapping: Record<string, 'strategic_dept' | 'functional_dept' | 'secondary_college'> = {
    STRATEGY_DEPT: 'strategic_dept',
    SCHOOL: 'strategic_dept',
    FUNCTIONAL_DEPT: 'functional_dept',
    FUNCTION_DEPT: 'functional_dept',
    COLLEGE: 'secondary_college',
    SECONDARY_COLLEGE: 'secondary_college',
    DIVISION: 'secondary_college',
    OTHER: 'secondary_college'
  }
  return mapping[orgType] || 'secondary_college'
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
    type: mapOrgTypeToFrontend(vo.orgType),
    sortOrder: vo.sortOrder ?? 0
  }
}

export const orgApi = {
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
      const response = await apiService.get('/orgs')

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
      const orgs = await this.getAllOrgs()
      return orgs.map(vo => convertOrgVOToDepartment(vo))
    } catch {
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
