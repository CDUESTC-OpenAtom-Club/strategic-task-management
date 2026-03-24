export interface CachedUserContext {
  userId?: string
  orgId?: string
  role?: string
}

function parseStoredUser(raw: string | null): Record<string, unknown> | null {
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export function getCachedUserContext(): CachedUserContext {
  if (typeof localStorage === 'undefined') {
    return {}
  }

  const storedUser =
    parseStoredUser(localStorage.getItem('currentUser')) ??
    parseStoredUser(localStorage.getItem('user'))

  if (!storedUser) {
    return {}
  }

  const userId = storedUser.userId ?? storedUser.id
  const orgId = storedUser.orgId
  const role = storedUser.role ?? storedUser.orgType

  return {
    ...(userId != null ? { userId: String(userId) } : {}),
    ...(orgId != null ? { orgId: String(orgId) } : {}),
    ...(typeof role === 'string' && role.trim() ? { role: role.trim() } : {})
  }
}
