/**
 * Auth Feature - Permission Helpers
 *
 * Permission checking utilities for auth feature.
 */

import type { UserRole } from '@/types'

/**
 * Permission definition
 */
export interface Permission {
  resource: string
  action: string
}

/**
 * Role permissions mapping
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  strategic_dept: [
    { resource: 'strategic_tasks', action: 'create' },
    { resource: 'strategic_tasks', action: 'read' },
    { resource: 'strategic_tasks', action: 'update' },
    { resource: 'strategic_tasks', action: 'delete' },
    { resource: 'indicators', action: 'create' },
    { resource: 'indicators', action: 'read' },
    { resource: 'indicators', action: 'update' },
    { resource: 'indicators', action: 'delete' },
    { resource: 'approvals', action: 'read' },
    { resource: 'approvals', action: 'approve' }
  ],
  functional_dept: [
    { resource: 'indicators', action: 'read' },
    { resource: 'indicators', action: 'update' },
    { resource: 'reports', action: 'create' },
    { resource: 'reports', action: 'read' },
    { resource: 'reports', action: 'update' },
    { resource: 'approvals', action: 'read' },
    { resource: 'approvals', action: 'approve' }
  ],
  secondary_college: [
    { resource: 'reports', action: 'create' },
    { resource: 'reports', action: 'read' },
    { resource: 'reports', action: 'update' }
  ]
}

/**
 * Check if role has specific permission
 */
export function roleHasPermission(
  role: UserRole | null,
  resource: string,
  action: string
): boolean {
  if (!role) {
    return false
  }

  const permissions = ROLE_PERMISSIONS[role] || []
  return permissions.some(p => p.resource === resource && p.action === action)
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole | null): Permission[] {
  if (!role) {
    return []
  }
  return ROLE_PERMISSIONS[role] || []
}

/**
 * Format permission as string
 */
export function formatPermission(resource: string, action: string): string {
  return `${resource}:${action}`
}

/**
 * Parse permission string
 */
export function parsePermission(permission: string): Permission {
  const [resource, action] = permission.split(':')
  return { resource, action }
}
