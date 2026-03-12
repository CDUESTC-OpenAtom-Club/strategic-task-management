/**
 * Auth API Integration Tests (Simplified)
 * 
 * Tests the integration between auth API and store, including login/logout flows.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/features/auth/model/store'
import type { User, LoginCredentials } from '@/entities/user/model/types'

// Mock dependencies
vi.mock('@/api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn()
  }
}))

vi.mock('@/utils/tokenManager', () => ({
  tokenManager: {
    getAccessToken: vi.fn(() => null),
    setAccessToken: vi.fn(),
    clearAccessToken: vi.fn()
  }
}))

vi.mock('@/utils/authHelpers', () => ({
  parseLoginResponse: vi.fn(),
  mapBackendUser: vi.fn()
}))

describe('Auth API Integration', () => {
  let authStore: ReturnType<typeof useAuthStore>

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
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('Login Flow Integration', () => {
    it('should complete full login flow with API and store integration', async () => {
      const mockApi = await import('@/api')
      const mockAuthHelpers = await import('@/utils/authHelpers')
      const mockTokenManager = await import('@/utils/tokenManager')

      // Mock successful API response
      mockApi.default.post.mockResolvedValue({
        code: 0,
        data: { token: 'mock-jwt-token', user: mockUser }
      })

      mockAuthHelpers.parseLoginResponse.mockReturnValue({
        success: true,
        data: { token: 'mock-jwt-token', user: mockUser }
      })

      mockAuthHelpers.mapBackendUser.mockReturnValue(mockUser)

      // Perform login
      const result = await authStore.login({ username: 'testuser', password: 'password123' })

      // Verify integration
      expect(result.success).toBe(true)
      expect(authStore.user).toEqual(mockUser)
      expect(authStore.token).toBe('mock-jwt-token')
      expect(authStore.isAuthenticated).toBe(true)
    })
  })
})