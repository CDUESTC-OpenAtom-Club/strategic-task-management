import { describe, expect, it } from 'vitest'
import { hasAdminConsoleAccess, isAdminOrgType } from '@/shared/lib/permissions/adminConsoleAccess'
import { resolveProtectedRouteRedirect } from '@/app/providers/lib/routeAccess'

describe('admin console access', () => {
  it('grants access only by admin org type', () => {
    expect(
      hasAdminConsoleAccess({
        orgType: 'admin'
      } as any)
    ).toBe(true)

    expect(
      hasAdminConsoleAccess({
        orgType: 'ADMIN'
      } as any)
    ).toBe(true)
  })

  it('rejects every non-admin org type', () => {
    expect(
      hasAdminConsoleAccess({
        orgType: 'functional'
      } as any)
    ).toBe(false)

    expect(
      hasAdminConsoleAccess({
        orgType: 'academic'
      } as any)
    ).toBe(false)
  })

  it('treats org type case-insensitively', () => {
    expect(isAdminOrgType('ADMIN')).toBe(true)
    expect(isAdminOrgType(' admin ')).toBe(true)
    expect(isAdminOrgType('functional')).toBe(false)
  })

  it('routes /admin pages by admin access flag only', () => {
    expect(
      resolveProtectedRouteRedirect({
        path: '/admin/console',
        requiresAuth: true,
        isAuthenticated: true,
        userRole: 'functional_dept',
        effectiveRole: 'functional_dept',
        allowedRoles: ['strategic_dept'],
        hasAdminConsoleAccess: true
      })
    ).toBeNull()

    expect(
      resolveProtectedRouteRedirect({
        path: '/admin/console',
        requiresAuth: true,
        isAuthenticated: true,
        userRole: 'strategic_dept',
        effectiveRole: 'strategic_dept',
        allowedRoles: ['strategic_dept'],
        hasAdminConsoleAccess: false
      })
    ).toBe('/403')
  })
})
