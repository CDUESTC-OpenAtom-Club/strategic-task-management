import type { UserRole } from '@/shared/types'

interface RouteAccessInput {
  allowedRoles?: string[]
  effectiveRole?: UserRole | null
  isAuthenticated: boolean
  path: string
  requiresAuth: boolean
  userRole?: UserRole | null
}

export function resolveProtectedRouteRedirect({
  allowedRoles,
  effectiveRole,
  isAuthenticated,
  path,
  requiresAuth,
  userRole
}: RouteAccessInput): string | null {
  if (requiresAuth && !isAuthenticated) {
    return '/login'
  }

  if (!requiresAuth || !isAuthenticated) {
    return null
  }

  if (!userRole) {
    return '/login'
  }

  if (!allowedRoles?.length || userRole === 'strategic_dept') {
    return null
  }

  if (!effectiveRole) {
    return '/login'
  }

  if (allowedRoles.includes(effectiveRole)) {
    return null
  }

  return path.startsWith('/admin') ? '/403' : '/dashboard'
}
