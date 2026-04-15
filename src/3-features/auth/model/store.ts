/**
 * Auth Feature Store
 *
 * Migrated from stores/auth.ts
 * Authentication and authorization state management
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient as api } from '@/shared/api/client'
import type { User, UserRole } from '@/shared/types'
import { logger } from '@/shared/lib/utils/logger'
import { tokenManager, TokenRefreshError } from '@/shared/lib/utils/tokenManager'
import { parseLoginResponse, mapBackendUser } from '@/shared/lib/utils/authHelpers'
import { getUserPermissions } from '@/features/auth/api/query'
import { useTimeContextStore } from '@/shared/lib/timeContext'
import { buildQueryKey, fetchWithCache, invalidateQueries } from '@/shared/lib/utils/cache'

export const useAuthStore = defineStore('auth', () => {
  // ============ State ============
  const user = ref<User | null>(null)
  const token = ref<string | null>(tokenManager.getAccessToken())
  const loading = ref(false)
  const sessionRestoring = ref(false)
  const authInitialized = ref(false)
  let initializePromise: Promise<void> | null = null

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

  const normalizePermissionCodes = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
      return []
    }

    return [...new Set(
      value
        .map(item => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
    )]
  }

  const fetchPermissionCodes = async (fallbackPermissions?: unknown): Promise<string[]> => {
    try {
      const response = await getUserPermissions()
      if (response.success && Array.isArray(response.data)) {
        return normalizePermissionCodes(response.data)
      }
    } catch (error) {
      logger.warn('[Auth] 获取当前用户权限列表失败，回退到已有权限数据:', error)
    }

    return normalizePermissionCodes(fallbackPermissions)
  }

  const attachPermissionCodes = async (
    userData: Record<string, unknown>
  ): Promise<Record<string, unknown>> => {
    const permissions = await fetchPermissionCodes(userData.permissions)
    return {
      ...userData,
      permissions
    }
  }

  const restorePersistedUser = (savedUser: string): User | null => {
    try {
      const parsedUser = JSON.parse(savedUser) as User & { permissions?: unknown }
      if (!parsedUser) {
        return null
      }

      parsedUser.permissions = normalizePermissionCodes(parsedUser.permissions)
      return parsedUser
    } catch (error) {
      logger.error('[Auth] 解析用户信息失败:', error)
      return null
    }
  }

  const refreshCurrentUserPermissions = async () => {
    if (!user.value || !token.value || !tokenManager.hasValidToken()) {
      return
    }

    const permissions = await fetchPermissionCodes(user.value.permissions)
    user.value = {
      ...user.value,
      permissions
    }
    persistUser(user.value)
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

    if (!token.value || !tokenManager.hasValidToken()) {
      return userData
    }

    const hasOrgMetadata = Boolean(
      String(userData.orgName ?? userData.department ?? '').trim() &&
      String(userData.orgType ?? userData.role ?? '').trim()
    )

    if (hasOrgMetadata || !orgId) {
      return userData
    }

    try {
      const response = await api.get('/organizations')

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
      const status = Number(
        (error as { code?: number; response?: { status?: number } }).code ??
        (error as { response?: { status?: number } }).response?.status ??
        NaN
      )

      if (status === 401 || status === 403) {
        logger.debug('ℹ️ [Auth] 当前未取得组织接口访问权限，跳过组织信息补全')
        return userData
      }

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
        const userWithPermissions = await attachPermissionCodes(enrichedUserData)
        const mappedUser = mapBackendUser(userWithPermissions)
        logger.debug('?[Auth] 映射后的用户:', mappedUser)

        user.value = mappedUser
        persistUser(mappedUser)
        invalidateQueries(['auth.user'])
        authInitialized.value = true

        logger.debug('?[Auth] 登录状态已保存')

        // 等待响应式更新完?
        await new Promise(resolve => setTimeout(resolve, 200))

        logger.debug('✅[Auth] Token设置完成，准备加载数据')

        // 登录成功后，触发数据重新加载
        if (mappedUser.role === 'strategic_dept') {
          import('@/features/task/model/strategic')
            .then(({ useStrategicStore }) => {
              const strategicStore = useStrategicStore()
              const timeContext = useTimeContextStore()
              logger.debug('🔄 [Auth] 登录成功，重新加载指标数据..')
              strategicStore.loadIndicatorsByYear(timeContext.currentYear)
            })
            .catch(err => {
              logger.warn('⚠️ [Auth] 重新加载数据失败:', err)
            })
        }

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

  const logout = (options: { redirect?: boolean } = {}) => {
    const shouldRedirect = options.redirect !== false
    user.value = null
    token.value = null
    tokenManager.clearAccessToken()
    persistUser(null)
    clearLegacyAccessTokenStorage()
    localStorage.removeItem('refreshToken')
    invalidateQueries(['auth.user'])
    authInitialized.value = true

    logger.debug('[Auth] 用户已登出，所有凭证已清除')

    if (shouldRedirect && !window.location.pathname.includes('/login')) {
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
        const userWithPermissions = await attachPermissionCodes(enrichedUserData)
        const mappedUser = mapBackendUser(userWithPermissions)
        user.value = mappedUser
        persistUser(mappedUser)
      } else {
          logout({ redirect: false })
      }
    } catch (error) {
      logger.error('Fetch user error:', error)
      logout({ redirect: false })
    }
  }

  const hasPermission = (resource: string, action: string) => {
    if (!user.value) {
      return false
    }

    const explicitPermissionCode = `${resource}:${action}`
    const userPermissionCodes = normalizePermissionCodes(
      (user.value as User & { permissions?: unknown }).permissions
    )
    if (userPermissionCodes.includes(explicitPermissionCode)) {
      return true
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
        'indicators:delete'
      ],
      functional_dept: [
        'indicators:read',
        'indicators:update',
        'reports:create',
        'reports:read',
        'reports:update'
      ],
      secondary_college: ['reports:create', 'reports:read', 'reports:update']
    }

    const rolePermissions = permissions[user.value.role] || []
    return rolePermissions.includes(explicitPermissionCode)
  }

  const initializeAuth = async () => {
    if (authInitialized.value) {
      return
    }

    if (initializePromise) {
      await initializePromise
      return
    }

    initializePromise = (async () => {
      const savedUser = localStorage.getItem('currentUser')
      const memoryToken = tokenManager.getAccessToken()
      clearLegacyAccessTokenStorage()

      if (memoryToken && savedUser) {
        const parsedUser = restorePersistedUser(savedUser)
        if (parsedUser && parsedUser.role && tokenManager.hasValidToken()) {
          user.value = parsedUser
          token.value = memoryToken
          localStorage.setItem('user', JSON.stringify(parsedUser))
          logger.debug('[Auth] 从内存恢复会?', parsedUser.name, parsedUser.role)
          void refreshCurrentUserPermissions()
          authInitialized.value = true
          return
        }

        if (!tokenManager.hasValidToken()) {
          logger.warn('[Auth] 检测到过期 access token，改为走 refresh 恢复流程')
          tokenManager.clearAccessToken()
          token.value = null
        }
      }

      if (savedUser) {
        sessionRestoring.value = true
        logger.debug('[Auth] 尝试通过 Refresh Token 恢复会话...')

        try {
          const newToken = await tokenManager.refreshAccessToken()
          const parsedUser = restorePersistedUser(savedUser)
          if (parsedUser && parsedUser.role) {
            user.value = parsedUser
            token.value = newToken
            persistUser(parsedUser)
            logger.debug('[Auth] 会话恢复成功:', parsedUser.name)
            void refreshCurrentUserPermissions()
          } else {
            logger.warn('[Auth] 用户信息缺少 role，清除登录状态')
            logout({ redirect: false })
          }
        } catch (error) {
          if (error instanceof TokenRefreshError) {
            logger.warn('[Auth] Refresh Token 无效，需要重新登录', error.message)
          } else {
            logger.error('[Auth] 会话恢复失败:', error)
          }
          logout({ redirect: false })
        } finally {
          sessionRestoring.value = false
        }
      }

      clearLegacyAccessTokenStorage()
      authInitialized.value = true
    })()

    try {
      await initializePromise
    } finally {
      initializePromise = null
    }
  }

  // 立即初始?
  void initializeAuth()

  // 切换视角
  const setViewingAs = (role: UserRole | null, department: string | null) => {
    viewingAsRole.value = role
    viewingAsDepartment.value = department
  }

  const resetViewingAs = () => {
    viewingAsRole.value = null
    viewingAsDepartment.value = null
  }

  /**
   * Update user avatar
   * 更新用户头像URL
   */
  const updateUserAvatar = (avatarUrl: string) => {
    if (user.value) {
      user.value = {
        ...user.value,
        avatar: avatarUrl,
        avatarUrl: avatarUrl
      }
      persistUser(user.value)
      logger.debug('[Auth] 用户头像已更新:', avatarUrl)
    }
  }

  return {
    // State
    user,
    token,
    loading,
    sessionRestoring,
    authInitialized,
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
    initializeAuth,
    hasPermission,
    setViewingAs,
    resetViewingAs,
    updateUserAvatar
  }
})
