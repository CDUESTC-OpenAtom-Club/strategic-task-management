import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, UserRole } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('auth_token'))
  const loading = ref(false)
  
  // 视角切换状态（用于战略发展部查看其他部门视角）
  const viewingAsRole = ref<UserRole | null>(null)
  const viewingAsDepartment = ref<string | null>(null)

  // Getters
  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const userRole = computed(() => user.value?.role || null)
  const userName = computed(() => user.value?.name || '')
  const userDepartment = computed(() => user.value?.department || '')
  
  // 当前有效角色（考虑视角切换）
  const effectiveRole = computed(() => viewingAsRole.value || user.value?.role || null)
  const effectiveDepartment = computed(() => viewingAsDepartment.value || user.value?.department || '')

  // Actions
  const login = async (credentials: { username: string; password: string }) => {
    loading.value = true
    try {
      // TODO: Replace with actual API call
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      })

      if (!response.ok) {
        throw new Error('Login failed')
      }

      const data = await response.json()
      token.value = data.token
      user.value = data.user

      // Store token in localStorage
      localStorage.setItem('auth_token', data.token)

      return { success: true }
    } catch (error) {
      console.error('Login error:', error)
      return { success: false, error: 'Invalid credentials' }
    } finally {
      loading.value = false
    }
  }

  const logout = () => {
    user.value = null
    token.value = null
    localStorage.removeItem('auth_token')
    localStorage.removeItem('currentUser')
  }

  const fetchUser = async () => {
    if (!token.value) return

    try {
      // TODO: Replace with actual API call
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token.value}`,
        },
      })

      if (response.ok) {
        const userData = await response.json()
        user.value = userData
      } else {
        // Token invalid, clear auth state
        logout()
      }
    } catch (error) {
      console.error('Fetch user error:', error)
      logout()
    }
  }

  const hasPermission = (resource: string, action: string) => {
    if (!user.value) return false

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
        'approvals:approve',
      ],
      functional_dept: [
        'indicators:read',
        'indicators:update', // Only their own indicators
        'reports:create',
        'reports:read',
        'reports:update',
        'approvals:read',
        'approvals:approve', // Only for secondary college submissions
      ],
      secondary_college: [
        'reports:create',
        'reports:read',
        'reports:update', // Only their own reports
      ],
    }

    const rolePermissions = permissions[user.value.role] || []
    return rolePermissions.includes(`${resource}:${action}`)
  }

  // Initialize auth state on store creation
  // 从 localStorage 恢复用户状态（用于页面刷新后保持登录）
  const savedUser = localStorage.getItem('currentUser')
  if (token.value && savedUser) {
    try {
      user.value = JSON.parse(savedUser)
    } catch (e) {
      console.error('Failed to parse saved user:', e)
      logout()
    }
  } else if (token.value && !savedUser) {
    // 有 token 但没有用户信息，清除登录状态
    logout()
  }

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
    resetViewingAs,
  }
})