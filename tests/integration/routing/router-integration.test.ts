/**
 * Router Integration Tests
 * 
 * Tests the integration between Vue Router and auth guards.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/features/auth/model/store'
import type { User } from '@/entities/user/model/types'

// Mock components
const MockLoginPage = { template: '<div>Login Page</div>' }
const MockDashboardPage = { template: '<div>Dashboard Page</div>' }
const MockAdminPage = { template: '<div>Admin Page</div>' }

const createTestRouter = () => {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/login', name: 'Login', component: MockLoginPage, meta: { requiresAuth: false } },
      { path: '/dashboard', name: 'Dashboard', component: MockDashboardPage, meta: { requiresAuth: true } },
      { path: '/admin', name: 'Admin', component: MockAdminPage, meta: { requiresAuth: true, roles: ['strategic_dept'] } }
    ]
  })

  // Add navigation guards
  router.beforeEach((to, _from, next) => {
    const authStore = useAuthStore()
    
    if (to.meta['requiresAuth'] && !authStore.isAuthenticated) {
      next('/login')
      return
    }
    
    if (to.meta['roles'] && authStore.isAuthenticated) {
      const userRole = authStore.userRole
      if (userRole !== 'strategic_dept' && !(to.meta['roles'] as string[]).includes(userRole || '')) {
        next('/dashboard')
        return
      }
    }
    
    next()
  })

  return router
}

describe('Router Integration', () => {
  let router: ReturnType<typeof createTestRouter>
  let authStore: ReturnType<typeof useAuthStore>

  const mockUser: User = {
    id: 1,
    name: 'Test User',
    username: 'testuser',
    role: 'strategic_dept',
    department: 'Strategic Development',
    email: 'test@example.com'
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    authStore = useAuthStore()
    router = createTestRouter()
    vi.clearAllMocks()
  })

  describe('Authentication Guards', () => {
    it('should redirect unauthenticated users to login', async () => {
      expect(authStore.isAuthenticated).toBe(false)

      await router.push('/dashboard')

      expect(router.currentRoute.value.path).toBe('/login')
    })

    it('should allow access to protected routes when authenticated', async () => {
      authStore.user = mockUser
      authStore.token = 'test-token'

      expect(authStore.isAuthenticated).toBe(true)

      await router.push('/dashboard')

      expect(router.currentRoute.value.path).toBe('/dashboard')
    })

    it('should enforce role-based access control', async () => {
      authStore.user = { ...mockUser, role: 'functional_dept' }
      authStore.token = 'test-token'

      await router.push('/admin')

      // Should be redirected to dashboard due to insufficient permissions
      expect(router.currentRoute.value.path).toBe('/dashboard')
    })
  })
})