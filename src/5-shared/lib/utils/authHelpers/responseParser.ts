// @ts-nocheck
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

import type { User, UserRole } from '@/shared/types'
import { logger } from '@/shared/lib/utils/logger'

const KNOWN_USER_ROLES: UserRole[] = ['strategic_dept', 'functional_dept', 'secondary_college']

/** 登录响应数据接口 */
export interface LoginResponseData {
  token: string
  refreshToken?: string
  user: Record<string, unknown>
}

/** 解析结果接口 */
export interface ParseResult {
  success: boolean
  data?: LoginResponseData
  error?: string
}

export function isKnownUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && KNOWN_USER_ROLES.includes(value as UserRole)
}

/**
 * 映射后端 OrgType 到前端 UserRole
 *
 * 与 mapOrgTypeToFrontend 保持一致的映射规则
 * - admin / ADMIN → strategic_dept
 * - FUNCTIONAL_DEPT, FUNCTION_DEPT, functional, FUNCTIONAL → functional_dept
 * - COLLEGE, SECONDARY_COLLEGE, DIVISION, OTHER, academic, ACADEMIC → secondary_college
 */
export function mapOrgTypeToRole(orgType: string, orgName?: string): UserRole | null {
  const normalizedType = String(orgType || '').trim()

  if (normalizedType === 'admin' || normalizedType === 'ADMIN') {
    return 'strategic_dept'
  }

  const mapping: Record<string, UserRole> = {
    // 战略发展部
    STRATEGY_DEPT: 'strategic_dept',
    strategic_dept: 'strategic_dept',
    SCHOOL: 'strategic_dept',

    // 职能部门
    FUNCTIONAL_DEPT: 'functional_dept',
    functional_dept: 'functional_dept',
    FUNCTION_DEPT: 'functional_dept',
    function_dept: 'functional_dept',
    functional: 'functional_dept',
    FUNCTIONAL: 'functional_dept',

    // 二级学院
    COLLEGE: 'secondary_college',
    college: 'secondary_college',
    SECONDARY_COLLEGE: 'secondary_college',
    secondary_college: 'secondary_college',
    DIVISION: 'secondary_college',
    OTHER: 'secondary_college',
    academic: 'secondary_college',
    ACADEMIC: 'secondary_college'
  }
  return mapping[normalizedType] || null
}

function resolveUserRole(userData: Record<string, unknown>): UserRole | null {
  const explicitRoleCandidates = [userData.role, userData.userRole, userData.frontendRole]

  for (const candidate of explicitRoleCandidates) {
    if (isKnownUserRole(candidate)) {
      return candidate
    }
  }

  return mapOrgTypeToRole(
    String(userData.orgType || userData.role || '').trim(),
    String(userData.orgName || userData.department || '').trim()
  )
}

/**
 * 映射后端用户数据到前端 User 类型
 */
export function mapBackendUser(userData: Record<string, unknown>): User | null {
  const resolvedRole = resolveUserRole(userData)
  if (!resolvedRole) {
    logger.error('❌ [Auth] 无法从响应中解析有效前端角色:', userData)
    return null
  }

  const roles = Array.isArray(userData.roles)
    ? userData.roles.map(item => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
    : []

  return {
    id: userData.userId?.toString() || userData.id?.toString() || '',
    username: userData.username || '',
    name: userData.realName || userData.name || userData.username || '',
    role: resolvedRole,
    department: userData.orgName || userData.department || '',
    orgName: userData.orgName || userData.department || '',
    orgType: typeof userData.orgType === 'string' ? userData.orgType : null,
    createdAt: new Date(),
    updatedAt: new Date(),
    userId: Number(userData.userId || userData.id || 0),
    orgId: Number(userData.orgId || 0),
    realName: userData.realName || userData.name || userData.username || '',
    roles,
    permissions: Array.isArray(userData.permissions) ? userData.permissions : []
  } as User
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
export function parseLoginResponse(response: Record<string, unknown>): ParseResult {
  let loginData: LoginResponseData | null = null

  // API拦截器返回 response.data，所以：
  // 后端返回 { code: 0, data: { token, user } }
  // 拦截器返回 { code: 0, data: { token, user } }

  // 格式1: { success: true, data: { token, user } } (经过拦截器转换)
  if (response.success && (response.data?.token || response.data?.accessToken)) {
    logger.debug('✅ [Auth] 响应格式1: { success: true, data: { token, user } }')
    loginData = {
      token: response.data.token || response.data.accessToken,
      refreshToken: response.data.refreshToken,
      user: response.data.user
    }
  }
  // 格式2: { code: 0, data: { token, user } } (原始后端格式)
  else if (response.code === 0 && (response.data?.token || response.data?.accessToken)) {
    logger.debug('✅ [Auth] 响应格式2: { code: 0, data: {...} }')
    loginData = {
      token: response.data.token || response.data.accessToken,
      refreshToken: response.data.refreshToken,
      user: response.data.user
    }
  }
  // 格式3: { token, user } (直接返回)
  else if (response.token && response.user) {
    logger.debug('✅ [Auth] 响应格式3: { token, user }')
    loginData = response
  }
  // 格式4: 嵌套的data.data (兼容某些特殊情况)
  else if (response.data?.data?.token || response.data?.data?.accessToken) {
    logger.debug('✅ [Auth] 响应格式4: { data: { token, user } }')
    loginData = {
      token: response.data.data.token || response.data.data.accessToken,
      refreshToken: response.data.data.refreshToken,
      user: response.data.data.user
    }
  }
  // 格式5: 尝试直接提取
  else if (response) {
    logger.debug('⚠️ [Auth] 尝试解析未知格式:', response)
    if (response.token || response.accessToken) {
      loginData = {
        token: response.token || response.accessToken,
        refreshToken: response.refreshToken,
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
