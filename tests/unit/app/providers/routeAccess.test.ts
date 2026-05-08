import { describe, expect, it } from 'vitest'
import { resolveProtectedRouteRedirect } from '@/app/providers/lib/routeAccess'

describe('resolveProtectedRouteRedirect', () => {
  it('redirects unauthenticated users on protected routes', () => {
    expect(
      resolveProtectedRouteRedirect({
        requiresAuth: true,
        isAuthenticated: false,
        userRole: null,
        effectiveRole: null,
        path: '/dashboard'
      })
    ).toBe('/login')
  })

  it('redirects authenticated users with missing roles back to login', () => {
    expect(
      resolveProtectedRouteRedirect({
        requiresAuth: true,
        isAuthenticated: true,
        userRole: null,
        effectiveRole: null,
        path: '/dashboard'
      })
    ).toBe('/login')
  })

  it('sends non-admin users away from admin-only routes', () => {
    expect(
      resolveProtectedRouteRedirect({
        requiresAuth: true,
        isAuthenticated: true,
        userRole: 'functional_dept',
        effectiveRole: 'functional_dept',
        allowedRoles: ['strategic_dept'],
        path: '/admin/console'
      })
    ).toBe('/403')
  })

  it('allows strategic department users through role-guarded routes', () => {
    expect(
      resolveProtectedRouteRedirect({
        requiresAuth: true,
        isAuthenticated: true,
        userRole: 'strategic_dept',
        effectiveRole: 'strategic_dept',
        allowedRoles: ['strategic_dept'],
        path: '/strategic-tasks'
      })
    ).toBeNull()
  })
})
