/**
 * Auth Response Parser - 认证响应解析器
 *
 * 职责:
 * - 解析多种后端响应格式
 * - 统一返回标准化的登录数据
 * - 支持格式兼容性处理
 *
 * @module utils/authHelpers
 */

import type { User, UserRole } from '@/types'
import { logger } from '@/utils/logger'

/** 登录响应数据接口 */
export interface LoginResponseData {
  token: string
  user: any
}

/** 解析结果接口 */
export interface ParseResult {
  success: boolean
  data?: LoginResponseData
  error?: string
}

/**
 * 映射后端 OrgType 到前端 UserRole
 */
export function mapOrgTypeToRole(orgType: string): UserRole | null {
  const mapping: Record<string, UserRole> = {
    // 支持多种格式（后端可能用不同格式）
    STRATEGY_DEPT: 'strategic_dept',
    strategic_dept: 'strategic_dept',
    FUNCTIONAL_DEPT: 'functional_dept',
    functional_dept: 'functional_dept',
    FUNCTION_DEPT: 'functional_dept',
    function_dept: 'functional_dept',
    COLLEGE: 'secondary_college',
    college: 'secondary_college',
    SECONDARY_COLLEGE: 'secondary_college',
    secondary_college: 'secondary_college',
    SCHOOL: 'strategic_dept',
    DIVISION: 'secondary_college',
    OTHER: 'secondary_college'
  }
  return mapping[orgType] || null
}

/**
 * 映射后端用户数据到前端 User 类型
 */
export function mapBackendUser(userData: any): User {
  const mappedRole = mapOrgTypeToRole(userData.orgType || userData.role)

  return {
    id: userData.userId?.toString() || userData.id?.toString() || '',
    username: userData.username || '',
    name: userData.realName || userData.name || userData.username || '',
    role: mappedRole || 'secondary_college', // 默认角色
    department: userData.orgName || userData.department || '',
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

/**
 * 解析登录响应
 * 支持多种后端响应格式:
 * - 格式1: { success: true, data: { token, user } }
 * - 格式2: { code: 0, data: { token, user } }
 * - 格式3: { token, user }
 * - 格式4: { data: { token, user } }
 * - 格式5: 直接在 response.data 中
 */
export function parseLoginResponse(response: any): ParseResult {
  let loginData: LoginResponseData | null = null

  // API拦截器返回 response.data，所以：
  // 后端返回 { code: 0, data: { token, user } }
  // 拦截器返回 { code: 0, data: { token, user } }

  // 格式1: { success: true, data: { token, user } } (经过拦截器转换)
  if (response.success && response.data?.token) {
    logger.debug('✅ [Auth] 响应格式1: { success: true, data: { token, user } }')
    loginData = response.data
  }
  // 格式2: { code: 0, data: { token, user } } (原始后端格式)
  else if (response.code === 0 && response.data?.token) {
    logger.debug('✅ [Auth] 响应格式2: { code: 0, data: {...} }')
    loginData = response.data
  }
  // 格式3: { token, user } (直接返回)
  else if (response.token && response.user) {
    logger.debug('✅ [Auth] 响应格式3: { token, user }')
    loginData = response
  }
  // 格式4: 嵌套的data.data (兼容某些特殊情况)
  else if (response.data?.data?.token) {
    logger.debug('✅ [Auth] 响应格式4: { data: { token, user } }')
    loginData = response.data.data
  }
  // 格式5: 尝试直接提取
  else if (response) {
    logger.debug('⚠️ [Auth] 尝试解析未知格式:', response)
    if (response.token || response.accessToken) {
      loginData = {
        token: response.token || response.accessToken,
        user: response.user || response.userInfo || {}
      }
    }
  }

  if (loginData && loginData.token) {
    return { success: true, data: loginData }
  }

  logger.error('❌ [Auth] 响应中未找到token或user数据')
  logger.error('❌ [Auth] 完整响应:', JSON.stringify(response.data, null, 2))

  return {
    success: false,
    error: response.data?.message || '登录失败：服务器响应格式错误'
  }
}
