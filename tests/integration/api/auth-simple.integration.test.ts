/**
 * Auth API Integration Tests (Simplified)
 *
 * Tests the integration between auth API and store, including login/logout flows.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/features/auth/model/store'
import type { User } from '@/entities/user/model/types'
import { getTestCredentials } from '../../../helpers/testCredentials'

// Mock dependencies
vi.mock('@/shared/api/client', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn()
  }
}))

vi.mock('@/shared/lib/utils/tokenManager', () => ({
  tokenManager: {
    getAccessToken: vi.fn(() => null),
    setAccessToken: vi.fn(),
    clearAccessToken: vi.fn(),
    hasValidToken: vi.fn(() => true)
  }
}))

vi.mock('@/shared/lib/utils/authHelpers', () => ({
  parseLoginResponse: vi.fn(),
  mapBackendUser: vi.fn(),
  isKnownUserRole: vi.fn(() => true)
}))

vi.mock('@/features/auth/api/query', () => ({
  getUserPermissions: vi.fn(async () => ({ success: true, data: [] }))
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
      const mockApi = await import('@/shared/api/client')
      const mockAuthHelpers = await import('@/shared/lib/utils/authHelpers')

      // Mock successful API response
      mockApi.apiClient.post.mockResolvedValue({
        code: 0,
        data: { token: 'mock-jwt-token', user: mockUser }
      })

      mockAuthHelpers.parseLoginResponse.mockReturnValue({
        success: true,
        data: { token: 'mock-jwt-token', user: mockUser }
      })

      mockAuthHelpers.mapBackendUser.mockReturnValue(mockUser)

      // Perform login
      const testCreds = getTestCredentials('STANDARD')
      const result = await authStore.login({
        username: testCreds.username,
        password: testCreds.password
      })

      // Verify integration
      expect(result.success).toBe(true)
      expect(authStore.user).toEqual(mockUser)
      expect(authStore.token).toBe('mock-jwt-token')
      expect(authStore.isAuthenticated).toBe(true)
    })
  })
})
