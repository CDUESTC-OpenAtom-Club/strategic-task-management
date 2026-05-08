import type { User } from '@/shared/types'

function normalizeOrgType(orgType: unknown): string {
  return typeof orgType === 'string' ? orgType.trim().toLowerCase() : ''
}

export function isAdminOrgType(orgType: unknown): boolean {
  return normalizeOrgType(orgType) === 'admin'
}

export function hasAdminConsoleAccess(user: Pick<User, 'orgType'> | null | undefined): boolean {
  return isAdminOrgType(user?.orgType)
}
