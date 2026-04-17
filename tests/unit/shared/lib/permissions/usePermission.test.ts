import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Plan } from '@/shared/types'

const mockedAuthState = vi.hoisted(() => ({
  store: {
    user: null as {
      role: 'strategic_dept' | 'functional_dept' | 'secondary_college'
      orgId?: number
      department?: string
    } | null
  }
}))

vi.mock('@/features/auth/model/store', () => ({
  useAuthStore: () => mockedAuthState.store
}))

import { usePermission } from '@/5-shared/lib/permissions/usePermission'

describe('usePermission plan semantics', () => {
  beforeEach(() => {
    mockedAuthState.store.user = null
  })

  it('allows a secondary college user to view and submit its own draft plan', () => {
    mockedAuthState.store.user = {
      role: 'secondary_college',
      orgId: 12,
      department: '计算机学院'
    }

    const permission = usePermission()
    const plan = {
      org_id: 12,
      status: 'draft'
    } as Plan

    expect(permission.canViewPlan(plan)).toBe(true)
    expect(permission.canSubmitPlan(plan)).toBe(true)
  })

  it('still blocks a secondary college user from other organizations plans', () => {
    mockedAuthState.store.user = {
      role: 'secondary_college',
      orgId: 12,
      department: '计算机学院'
    }

    const permission = usePermission()
    const foreignPlan = {
      org_id: 99,
      status: 'draft'
    } as Plan

    expect(permission.canViewPlan(foreignPlan)).toBe(false)
    expect(permission.canSubmitPlan(foreignPlan)).toBe(false)
  })
})
