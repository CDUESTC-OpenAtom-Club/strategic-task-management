/**
 * Permission Checking Utilities
 * 
 * Functions for checking user permissions and roles
 */

export type Permission = string
export type Role = string

/**
 * Check if user has specific permission
 */
export function hasPermission(userPermissions: Permission[], requiredPermission: Permission): boolean {
  return userPermissions.includes(requiredPermission)
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(userPermissions: Permission[], requiredPermissions: Permission[]): boolean {
  return requiredPermissions.some((permission) => userPermissions.includes(permission))
}

/**
 * Check if user has all of the specified permissions
 */
export function hasAllPermissions(userPermissions: Permission[], requiredPermissions: Permission[]): boolean {
  return requiredPermissions.every((permission) => userPermissions.includes(permission))
}

/**
 * Check if user has specific role
 */
export function hasRole(userRoles: Role[], requiredRole: Role): boolean {
  return userRoles.includes(requiredRole)
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(userRoles: Role[], requiredRoles: Role[]): boolean {
  return requiredRoles.some((role) => userRoles.includes(role))
}

/**
 * Check if user has all of the specified roles
 */
export function hasAllRoles(userRoles: Role[], requiredRoles: Role[]): boolean {
  return requiredRoles.every((role) => userRoles.includes(role))
}

/**
 * Check if user is admin
 */
export function isAdmin(userRoles: Role[]): boolean {
  return userRoles.includes('admin') || userRoles.includes('ADMIN')
}

/**
 * Check if user can access resource based on permissions and roles
 */
export function canAccess(
  userPermissions: Permission[],
  userRoles: Role[],
  requiredPermissions?: Permission[],
  requiredRoles?: Role[]
): boolean {
  // Admin has access to everything
  if (isAdmin(userRoles)) {return true}

  // Check permissions if specified
  if (requiredPermissions && requiredPermissions.length > 0) {
    if (!hasAnyPermission(userPermissions, requiredPermissions)) {return false}
  }

  // Check roles if specified
  if (requiredRoles && requiredRoles.length > 0) {
    if (!hasAnyRole(userRoles, requiredRoles)) {return false}
  }

  return true
}
