/**
 * Auth Feature Store
 *
 * Migrated from stores/auth.ts
 * Authentication and authorization state management
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/5-shared/api'
import type { User, UserRole } from '@/5-shared/types'
import { logger } from '@/5-shared/lib/utils/logger'
import { tokenManager, TokenRefreshError } from '@/5-shared/lib/utils/tokenManager'
import { parseLoginResponse, mapBackendUser } from '@/5-shared/lib/utils/authHelpers'
import { useTimeContextStore } from '@/5-shared/lib/timeContext'
import { buildQueryKey, fetchWithCache, invalidateQueries } from '@/5-shared/lib/utils/cache'

export const useAuthStore = defineStore('auth', () => {
  // ============ State ============
  const user = ref<User | null>(null)
  const token = ref<string | null>(tokenManager.getAccessToken())
  const loading = ref(false)
  const sessionRestoring = ref(false)

  // 视角切换状态（用于战略发展部查看其他部门视角）
  const viewingAsRole = ref<UserRole | null>(null)
  const viewingAsDepartment = ref<string | null>(null)

  const persistUser = (value: User | null) => {
    if (value) {
      localStorage.setItem('currentUser', JSON.stringify(value))
      localStorage.setItem('user', JSON.stringify(value))
      return
    }

    localStorage.removeItem('currentUser')
    localStorage.removeItem('user')
  }

  const clearLegacyAccessTokenStorage = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('auth_token')
    localStorage.removeItem('access_token')
    localStorage.removeItem('accessToken')
  }

  // ============ Getters ============
  const isAuthenticated = computed(() => !!token.value && !!user.value)

  const userRole = computed(() => {
    if (!user.value) {
      return null
    }
    return user.value.role || null
  })

  const userName = computed(() => {
    if (!user.value) {
      return ''
    }
    return user.value.name || (user.value as { realName?: string }).realName || ''
  })

  const userDepartment = computed(() => {
    if (!user.value) {
      return ''
    }
    return user.value.department || (user.value as { orgName?: string }).orgName || ''
  })

  // 当前有效角色（考虑视角切换?
  const effectiveRole = computed(() => viewingAsRole.value || user.value?.role || null)
  const effectiveDepartment = computed(
    () => viewingAsDepartment.value || user.value?.department || ''
  )

  const enrichUserWithOrganization = async (
    userData: Record<string, unknown>
  ): Promise<Record<string, unknown>> => {
    const orgId = userData.orgId

    const hasOrgMetadata = Boolean(
      String(userData.orgName ?? userData.department ?? '').trim() &&
      String(userData.orgType ?? userData.role ?? '').trim()
    )

    if (hasOrgMetadata || !orgId) {
      return userData
    }

    try {
      if (token.value) {
        const response = await api.get('/organizations', {
          headers: {
            Authorization: `Bearer ${token.value}`
          }
        })

        const organizations =
          response &&
          typeof response === 'object' &&
          'data' in response &&
          Array.isArray(response.data)
            ? (response.data as Array<Record<string, unknown>>)
            : []

        const matchedOrg = organizations.find(org => {
          const candidateId = org.id ?? org.orgId
          return String(candidateId) === String(orgId)
        })

        if (matchedOrg) {
          return {
            ...userData,
            orgType: (matchedOrg.orgType as string | undefined) || userData.orgType,
            orgName:
              (matchedOrg.orgName as string | undefined) ||
              (matchedOrg.name as string | undefined) ||
              userData.orgName
          }
        }
      }

      const savedUser = localStorage.getItem('currentUser')
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser) as {
          department?: string
          role?: string
          orgId?: string | number
        }

        if (
          String(parsedUser.orgId ?? '') === String(orgId) &&
          (parsedUser.department || parsedUser.role)
        ) {
          return {
            ...userData,
            orgName: parsedUser.department || userData.orgName,
            department: parsedUser.department || userData.department,
            orgType: parsedUser.role || userData.orgType,
            role: parsedUser.role || userData.role
          }
        }
      }
    } catch (error) {
      logger.debug('ℹ️ [Auth] 读取本地缓存组织信息失败，继续使用登录响应原始数据:', error)
    }

    return userData
  }

  // ============ Actions ============
  const login = async (credentials: { username: string; password: string }) => {
    loading.value = true
    logger.debug('🔐 [Auth] 开始登?', credentials.username)

    try {
      const response = await api.post('/auth/login', credentials)
      logger.debug('📦 [Auth] 登录响应:', response)

      const parseResult = parseLoginResponse(response as Record<string, unknown>)

      if (parseResult.success && parseResult.data) {
        const { token: loginToken, user: userData, refreshToken } = parseResult.data

        logger.debug('?[Auth] 登录成功，Token:', loginToken.substring(0, 20) + '...')
        logger.debug('👤 [Auth] 用户数据:', userData)

        token.value = loginToken
        tokenManager.setAccessToken(loginToken)
        clearLegacyAccessTokenStorage()
        if (refreshToken) {
          localStorage.setItem('refreshToken', refreshToken)
        }

        const enrichedUserData = await enrichUserWithOrganization(userData)
        const mappedUser = mapBackendUser(enrichedUserData)
        logger.debug('?[Auth] 映射后的用户:', mappedUser)

        user.value = mappedUser
        persistUser(mappedUser)
        invalidateQueries(['auth.user'])

        logger.debug('?[Auth] 登录状态已保存')

        // 等待响应式更新完?
        await new Promise(resolve => setTimeout(resolve, 200))

        logger.debug('✅[Auth] Token设置完成，准备加载数据')

        // 登录成功后，触发数据重新加载
        import('@/3-features/task/model/strategic')
          .then(({ useStrategicStore }) => {
            const strategicStore = useStrategicStore()
            const timeContext = useTimeContextStore()
            logger.debug('🔄 [Auth] 登录成功，重新加载指标数据..')
            strategicStore.loadIndicatorsByYear(timeContext.currentYear)
          })
          .catch(err => {
            logger.warn('⚠️ [Auth] 重新加载数据失败:', err)
          })

        return { success: true }
      } else {
        return {
          success: false,
          error: parseResult.error || '登录失败：服务器响应格式错误'
        }
      }
    } catch (error: unknown) {
      logger.error('❌[Auth] 登录异常:', error)
      return {
        success: false,
        error:
          (error as any).response?.data?.message || (error as any).message || '登录失败：网络错误'
      }
    } finally {
      loading.value = false
      logger.debug('🏁 [Auth] 登录流程结束')
    }
  }

  const logout = () => {
    user.value = null
    token.value = null
    tokenManager.clearAccessToken()
    persistUser(null)
    clearLegacyAccessTokenStorage()
    localStorage.removeItem('refreshToken')
    invalidateQueries(['auth.user'])

    logger.debug('[Auth] 用户已登出，所有凭证已清除')

    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login'
    }
  }

  const fetchUser = async () => {
    if (!token.value) {
      return
    }

    try {
      const response = await fetchWithCache({
        key: buildQueryKey('auth', 'user'),
        policy: {
          ttlMs: 10 * 60 * 1000,
          scope: 'session',
          persist: true,
          dedupeWindowMs: 1000,
          tags: ['auth.user']
        },
        fetcher: () => api.get('/auth/me'),
        force: true
      })

      const authResponse = response as {
        success?: boolean
        data?: Record<string, unknown>
      }

      if (authResponse.success && authResponse.data) {
        const enrichedUserData = await enrichUserWithOrganization(authResponse.data)
        const mappedUser = mapBackendUser(enrichedUserData)
        user.value = mappedUser
        persistUser(mappedUser)
      } else {
        logout()
      }
    } catch (error) {
      logger.error('Fetch user error:', error)
      logout()
    }
  }

  const hasPermission = (resource: string, action: string) => {
    if (!user.value) {
      return false
    }

    const permissions = {
      strategic_dept: [
        'strategic_tasks:create',
        'strategic_tasks:read',
        'strategic_tasks:update',
        'strategic_tasks:delete',
        'indicators:create',
        'indicators:read',
        'indicators:update',
        'indicators:delete',
        'approvals:read',
        'approvals:approve'
      ],
      functional_dept: [
        'indicators:read',
        'indicators:update',
        'reports:create',
        'reports:read',
        'reports:update',
        'approvals:read',
        'approvals:approve'
      ],
      secondary_college: ['reports:create', 'reports:read', 'reports:update']
    }

    const rolePermissions = permissions[user.value.role] || []
    return rolePermissions.includes(`${resource}:${action}`)
  }

  const initializeAuth = async () => {
    const savedUser = localStorage.getItem('currentUser')
    const memoryToken = tokenManager.getAccessToken()
    clearLegacyAccessTokenStorage()

    if (memoryToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser)
        if (parsedUser && parsedUser.role && tokenManager.hasValidToken()) {
          user.value = parsedUser
          token.value = memoryToken
          localStorage.setItem('user', JSON.stringify(parsedUser))
          logger.debug('[Auth] 从内存恢复会?', parsedUser.name, parsedUser.role)
          return
        }

        if (!tokenManager.hasValidToken()) {
          logger.warn('[Auth] 检测到过期 access token，改为走 refresh 恢复流程')
          tokenManager.clearAccessToken()
        }
      } catch (e) {
        logger.error('[Auth] 解析用户信息失败:', e)
      }
    }

    if (savedUser) {
      sessionRestoring.value = true
      logger.debug('[Auth] 尝试通过 Refresh Token 恢复会话...')

      try {
        const newToken = await tokenManager.refreshAccessToken()
        const parsedUser = JSON.parse(savedUser)
        if (parsedUser && parsedUser.role) {
          user.value = parsedUser
          token.value = newToken
          persistUser(parsedUser)
          logger.debug('[Auth] 会话恢复成功:', parsedUser.name)
        } else {
          logger.warn('[Auth] 用户信息缺少 role，清除登录状态')
          logout()
        }
      } catch (error) {
        if (error instanceof TokenRefreshError) {
          logger.warn('[Auth] Refresh Token 无效，需要重新登录', error.message)
        } else {
          logger.error('[Auth] 会话恢复失败:', error)
        }
        logout()
      } finally {
        sessionRestoring.value = false
      }
    }

    clearLegacyAccessTokenStorage()
  }

  // 立即初始?
  initializeAuth()

  // 切换视角
  const setViewingAs = (role: UserRole | null, department: string | null) => {
    viewingAsRole.value = role
    viewingAsDepartment.value = department
  }

  const resetViewingAs = () => {
    viewingAsRole.value = null
    viewingAsDepartment.value = null
  }

  return {
    // State
    user,
    token,
    loading,
    sessionRestoring,
    viewingAsRole,
    viewingAsDepartment,

    // Getters
    isAuthenticated,
    userRole,
    userName,
    userDepartment,
    effectiveRole,
    effectiveDepartment,

    // Actions
    login,
    logout,
    fetchUser,
    hasPermission,
    setViewingAs,
    resetViewingAs
  }
})
