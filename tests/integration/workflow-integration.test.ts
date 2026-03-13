/**
 * Complete Workflow Integration Tests
 * 
 * End-to-end integration tests combining API, state, and routing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/features/auth/model/store'
import { useIndicatorStore } from '@/features/strategic-indicator/model/store'
import type { User } from '@/entities/user/model/types'

// Mock all dependencies
vi.mock('@/api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn()
  }
}))

vi.mock('@/features/strategic-indicator/api/query', () => ({
  queryIndicators: vi.fn()
}))

vi.mock('@/utils/authHelpers', () => ({
  parseLoginResponse: vi.fn(),
  mapBackendUser: vi.fn()
}))

vi.mock('@/utils/tokenManager', () => ({
  tokenManager: {
    getAccessToken: vi.fn(() => null),
    setAccessToken: vi.fn(),
    clearAccessToken: vi.fn()
  }
}))

describe('Complete Workflow Integration', () => {
  let authStore: ReturnType<typeof useAuthStore>
  let indicatorStore: ReturnType<typeof useIndicatorStore>

  const mockUser: User = {
    id: 1,
    name: 'Integration Test User',
    username: 'testuser',
    role: 'strategic_dept',
    department: 'Strategic Development',
    email: 'test@example.com'
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    authStore = useAuthStore()
    indicatorStore = useIndicatorStore()
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('Login to Data Access Workflow', () => {
    it('should complete login and data fetch workflow', async () => {
      // Step 1: Verify initial unauthenticated state
      expect(authStore.isAuthenticated).toBe(false)

      // Step 2: Mock successful login
      const mockApi = await import('@/api')
      const mockAuthHelpers = await import('@/utils/authHelpers')
      
      mockApi.default.post.mockResolvedValue({
        code: 0,
        data: { token: 'workflow-token', user: mockUser }
      })
      
      mockAuthHelpers.parseLoginResponse.mockReturnValue({
        success: true,
        data: { token: 'workflow-token', user: mockUser }
      })
      
      mockAuthHelpers.mapBackendUser.mockReturnValue(mockUser)

      // Step 3: Perform login
      const loginResult = await authStore.login({
        username: 'testuser',
        password: 'password123'
      })

      // Step 4: Verify authentication state
      expect(loginResult.success).toBe(true)
      expect(authStore.isAuthenticated).toBe(true)
      expect(authStore.user).toEqual(mockUser)

      // Step 5: Mock data fetch
      const mockQuery = await import('@/features/strategic-indicator/api/query')
      
      mockQuery.queryIndicators.mockResolvedValue({
        content: [],
        totalElements: 0
      })

      // Step 6: Fetch data with authenticated state
      await indicatorStore.fetchIndicators()

      // Step 7: Verify complete workflow state
      expect(authStore.isAuthenticated).toBe(true)
      expect(indicatorStore.loading).toBe(false)
      expect(indicatorStore.error).toBe(null)
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle API errors without breaking application state', async () => {
      // Set up authenticated state
      authStore.user = mockUser
      authStore.token = 'test-token'

      // Mock API error
      const mockQuery = await import('@/features/strategic-indicator/api/query')
      mockQuery.queryIndicators.mockRejectedValue(new Error('Network error'))

      // Attempt data fetch
      await expect(indicatorStore.fetchIndicators()).rejects.toThrow('Network error')

      // Verify auth state unaffected
      expect(authStore.isAuthenticated).toBe(true)
      expect(authStore.user).toEqual(mockUser)

      // Verify error state in indicator store
      expect(indicatorStore.error).toBe('Network error')
    })
  })
})