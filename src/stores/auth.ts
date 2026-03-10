import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, UserRole } from '@/types'
import api from '@/api'
import { logger } from '@/utils/logger'
import { tokenManager, TokenRefreshError } from '@/utils/tokenManager'
import { parseLoginResponse, mapOrgTypeToRole as _mapOrgTypeToRole } from '@/utils/authHelpers'
import { useTimeContextStore } from './timeContext'

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null)
  const token = ref<string | null>(tokenManager.getAccessToken())
  const loading = ref(false)
  const sessionRestoring = ref(false)

  // 视角切换状态（用于战略发展部查看其他部门视角）
  const viewingAsRole = ref<UserRole | null>(null)
  const viewingAsDepartment = ref<string | null>(null)

  // Getters
  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const userRole = computed(() => {
    if (!user.value) {
      return null
    }
    return user.value.role || null
  })
  const userName = computed(() => {
    if (!user.value) {return ''}
    return user.value.name || (user.value as { realName?: string }).realName || ''
  })
  const userDepartment = computed(() => {
    if (!user.value) {return ''}
    return user.value.department || (user.value as { orgName?: string }).orgName || ''
  })

  // 当前有效角色（考虑视角切换）
  const effectiveRole = computed(() => viewingAsRole.value || user.value?.role || null)
  const effectiveDepartment = computed(
    () => viewingAsDepartment.value || user.value?.department || ''
  )

  // Actions
  const login = async (credentials: { username: string; password: string }) => {
    loading.value = true
    logger.debug('🔐 [Auth] 开始登录:', credentials.username)

    try {
      const response = await api.post('/auth/login', credentials)
      logger.debug('📦 [Auth] 登录响应:', response)

      // 使用响应解析器解析响应
      const parseResult = parseLoginResponse(response)

      if (parseResult.success && parseResult.data) {
        const { token: loginToken, user: userData } = parseResult.data

        logger.debug('✅ [Auth] 登录成功，Token:', loginToken.substring(0, 20) + '...')
        logger.debug('👤 [Auth] 用户数据:', userData)

        // 使用响应解析器中的映射函数
        const mappedUser = (await import('@/utils/authHelpers')).mapBackendUser(userData)
        logger.debug('✅ [Auth] 映射后的用户:', mappedUser)
        
        // 设置用户信息
        user.value = mappedUser

        // 设置Token (多重存储确保可靠性)
        token.value = loginToken
        tokenManager.setAccessToken(loginToken)
        localStorage.setItem('token', loginToken)
        localStorage.setItem('currentUser', JSON.stringify(mappedUser))

        logger.debug('✅ [Auth] 登录状态已保存', {
          tokenInStore: !!token.value,
          tokenInLocalStorage: !!localStorage.getItem('token'),
          tokenInManager: !!tokenManager.getAccessToken()
        })

        // 使用 nextTick 确保响应式更新完成
        await nextTick()
        
        // 额外延迟200ms，确保token完全设置并可被拦截器读取
        await new Promise(resolve => setTimeout(resolve, 200))
        
        logger.debug('✅ [Auth] Token设置完成，准备加载数据')

        // 登录成功后，触发数据重新加载
        import('./strategic')
          .then(({ useStrategicStore }) => {
            const strategicStore = useStrategicStore()
            const timeContext = useTimeContextStore()
            logger.debug('🔄 [Auth] 登录成功，重新加载指标数据...')
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
      logger.error('❌ [Auth] 登录异常:', error)
      logger.error('❌ [Auth] 错误详情:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      })
      return {
        success: false,
        error: error.response?.data?.message || error.message || '登录失败：网络错误'
      }
    } finally {
      loading.value = false
      logger.debug('🏁 [Auth] 登录流程结束')
    }
  }

  const logout = () => {
    user.value = null
    token.value = null

    // 清除 TokenManager 中的 Token
    tokenManager.clearAccessToken()

    // 清除 localStorage 中的用户信息和token
    localStorage.removeItem('currentUser')
    localStorage.removeItem('token')

    // 防御性清理: 确保旧的 auth_token 也被清除
    localStorage.removeItem('auth_token')

    logger.debug('[Auth] 用户已登出，所有凭证已清除')

    // 跳转到登录页
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login'
    }
  }

  const fetchUser = async () => {
    if (!token.value) {
      return
    }

    try {
      const response = await api.get('/auth/me')

      // 后端返回格式: { code: 0, message: "...", data: user, timestamp: ... }
      // API拦截器返回 response.data，所以直接访问 response.code
      if (response.code === 0 && response.data) {
        user.value = response.data
        localStorage.setItem('currentUser', JSON.stringify(response.data))
      } else {
        // Token invalid, clear auth state
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

    // Define role-based permissions
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
      secondary_college: [
        'reports:create',
        'reports:read',
        'reports:update'
      ]
    }

    const rolePermissions = permissions[user.value.role] || []
    return rolePermissions.includes(`${resource}:${action}`)
  }

  // Initialize auth state on store creation
  const initializeAuth = async () => {
    const savedUser = localStorage.getItem('currentUser')
    const savedToken = localStorage.getItem('token')

    // 检查是否有内存中的 Token (通常页面刷新后会丢失)
    const memoryToken = tokenManager.getAccessToken()

    if (memoryToken && savedUser) {
      // 内存中有 Token，直接恢复状态
      try {
        const parsedUser = JSON.parse(savedUser)
        if (parsedUser && parsedUser.role) {
          user.value = parsedUser
          token.value = memoryToken
          logger.debug('[Auth] 从内存恢复会话:', parsedUser.name, parsedUser.role)
          return
        }
      } catch (e) {
        logger.error('[Auth] 解析用户信息失败:', e)
      }
    }

    // 内存中没有 Token，但 localStorage 中有 Token，直接恢复
    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser)
        if (parsedUser && parsedUser.role) {
          // 将 localStorage 中的 token 恢复到内存
          tokenManager.setAccessToken(savedToken)
          user.value = parsedUser
          token.value = savedToken
          logger.debug('[Auth] 从 localStorage 恢复会话:', parsedUser.name, parsedUser.role)
          return
        }
      } catch (e) {
        logger.error('[Auth] 解析用户信息失败:', e)
      }
    }

    // localStorage 中也没有有效 Token，尝试通过 Refresh Token 恢复会话
    if (savedUser) {
      sessionRestoring.value = true
      logger.debug('[Auth] 尝试通过 Refresh Token 恢复会话...')

      try {
        // 调用 tokenManager 刷新 Token
        const newToken = await tokenManager.refreshAccessToken()

        // 刷新成功，恢复用户状态
        const parsedUser = JSON.parse(savedUser)
        if (parsedUser && parsedUser.role) {
          user.value = parsedUser
          token.value = newToken
          // 同时保存到 localStorage
          localStorage.setItem('token', newToken)
          logger.debug('[Auth] 会话恢复成功:', parsedUser.name)
        } else {
          logger.warn('[Auth] 用户信息缺少 role，清除登录状态')
          logout()
        }
      } catch (error) {
        // Refresh Token 无效或过期，清除登录状态
        if (error instanceof TokenRefreshError) {
          logger.warn('[Auth] Refresh Token 无效，需要重新登录:', error.message)
        } else {
          logger.error('[Auth] 会话恢复失败:', error)
        }
        logout()
      } finally {
        sessionRestoring.value = false
      }
    }

    // 防御性清理: 确保 localStorage 中没有 auth_token
    localStorage.removeItem('auth_token')
  }

  // 立即初始化 (异步)
  initializeAuth()

  // 切换视角（仅战略发展部可用）
  const setViewingAs = (role: UserRole | null, department: string | null) => {
    viewingAsRole.value = role
    viewingAsDepartment.value = department
  }

  // 重置视角到实际用户
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

// 重新导出 mapOrgTypeToRole 以保持兼容性
export { mapOrgTypeToRole as _mapOrgTypeToRole } from '@/utils/authHelpers'
