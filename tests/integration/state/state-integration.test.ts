/**
 * State Management Integration Tests
 * 
 * Tests the integration between different feature stores.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/features/auth/model/store'
import { useIndicatorStore } from '@/features/strategic-indicator/model/store'
import type { User } from '@/entities/user/model/types'

// Mock API dependencies
vi.mock('@/features/strategic-indicator/api/query', () => ({
  queryIndicators: vi.fn()
}))

describe('State Management Integration', () => {
  let authStore: ReturnType<typeof useAuthStore>
  let indicatorStore: ReturnType<typeof useIndicatorStore>

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
    indicatorStore = useIndicatorStore()
    vi.clearAllMocks()
  })

  describe('Cross-Store State Consistency', () => {
    it('should maintain consistent state across multiple store instances', () => {
      // Create multiple store instances (simulates different components)
      const authStore1 = useAuthStore()
      const authStore2 = useAuthStore()

      // Verify they reference the same state
      expect(authStore1).toBe(authStore2)

      // Modify state in one instance
      authStore1.user = mockUser

      // Verify change reflected in other instance
      expect(authStore2.user).toEqual(mockUser)
    })

    it('should handle role switching correctly', () => {
      // Set up strategic dept user
      authStore.user = mockUser
      authStore.token = 'test-token'

      // Verify initial permissions
      expect(authStore.effectiveRole).toBe('strategic_dept')

      // Switch to functional dept view
      authStore.setViewingAs('functional_dept', 'Finance Department')

      // Verify effective role changed
      expect(authStore.effectiveRole).toBe('functional_dept')
      expect(authStore.effectiveDepartment).toBe('Finance Department')

      // Reset view
      authStore.resetViewingAs()

      // Verify back to original role
      expect(authStore.effectiveRole).toBe('strategic_dept')
    })
  })
})