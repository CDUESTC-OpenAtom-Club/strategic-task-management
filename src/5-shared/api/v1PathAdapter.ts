/**
 * V1 API Path Adapter
 *
 * Normalize and rewrite legacy frontend paths to the backend OpenAPI V1 contract.
 * This is a compatibility layer to speed up frontend/backend alignment.
 */

export interface PathAdaptResult {
  adaptedPath: string
  changed: boolean
  reason?: string
  unsupported?: boolean
}

const EXACT_MAP: Record<string, string> = {
  '/auth/userinfo': '/auth/me',
  '/users/me': '/auth/me',
  '/analytics/dashboard/overview': '/analytics/dashboard',
  '/analytics/dashboard/charts': '/analytics/dashboard',
  '/alerts/events/unclosed': '/alerts/unresolved'
}

function normalizePath(input: string): string {
  if (!input) {
    return input
  }

  // Keep absolute URLs untouched.
  if (/^https?:\/\//.test(input)) {
    return input
  }

  // Normalize duplicated legacy prefix.
  if (input.startsWith('/api/v1/')) {
    return input.slice('/api/v1'.length)
  }
  if (input.startsWith('/api/')) {
    return input.slice('/api'.length)
  }

  return input
}

/**
 * Adapt legacy path to V1 path.
 */
export function adaptV1Path(path: string): PathAdaptResult {
  const normalized = normalizePath(path)
  const [rawPath, query = ''] = normalized.split('?')

  if (!rawPath || /^https?:\/\//.test(rawPath)) {
    return { adaptedPath: path, changed: false }
  }

  const suffix = query ? `?${query}` : ''

  if (EXACT_MAP[rawPath]) {
    return {
      adaptedPath: `${EXACT_MAP[rawPath]}${suffix}`,
      changed: true,
      reason: 'exact-map'
    }
  }

  if (rawPath.startsWith('/plans/approval/instances')) {
    return {
      adaptedPath: `${rawPath.replace('/plans/approval/instances', '/approval/instances')}${suffix}`,
      changed: true,
      reason: 'approval-instance-prefix'
    }
  }

  if (rawPath === '/plans/approval/pending') {
    return {
      adaptedPath: `/approval/instances/my-pending${suffix}`,
      changed: true,
      reason: 'approval-pending-map'
    }
  }

  if (rawPath.startsWith('/milestones/') && rawPath.endsWith('/is-paired')) {
    return {
      adaptedPath: rawPath.replace('/is-paired', '/pairing-status') + suffix,
      changed: true,
      reason: 'milestone-pairing-status'
    }
  }

  if (rawPath.startsWith('/notifications/user/')) {
    return {
      adaptedPath: `/notifications/my${suffix}`,
      changed: true,
      reason: 'notifications-my'
    }
  }

  // User/admin-user endpoints are unified under /auth/users in OpenAPI V1.
  if (rawPath === '/users' || rawPath.startsWith('/users/')) {
    return {
      adaptedPath: `/auth${rawPath}${suffix}`,
      changed: true,
      reason: 'users-to-auth-users'
    }
  }
  if (rawPath === '/admin/users' || rawPath.startsWith('/admin/users/')) {
    return {
      adaptedPath: rawPath.replace('/admin/users', '/auth/users') + suffix,
      changed: true,
      reason: 'admin-users-to-auth-users'
    }
  }

  // Keep organization entrypoint normalized even when legacy '/orgs' is still used.
  if (rawPath === '/orgs' || rawPath.startsWith('/orgs/')) {
    return {
      adaptedPath: rawPath.replace('/orgs', '/organizations') + suffix,
      changed: true,
      reason: 'orgs-to-organizations'
    }
  }

  // Normalize legacy indicator review aliases to the canonical V1 endpoints.
  if (/^\/indicators\/\d+\/submit-review$/.test(rawPath)) {
    return {
      adaptedPath: rawPath.replace('/submit-review', '/submit') + suffix,
      changed: true,
      reason: 'indicator-submit-review-alias'
    }
  }
  if (/^\/indicators\/\d+\/approve-review$/.test(rawPath)) {
    return {
      adaptedPath: rawPath.replace('/approve-review', '/approve') + suffix,
      changed: true,
      reason: 'indicator-approve-review-alias'
    }
  }
  if (/^\/indicators\/\d+\/reject-review$/.test(rawPath)) {
    return {
      adaptedPath: rawPath.replace('/reject-review', '/reject') + suffix,
      changed: true,
      reason: 'indicator-reject-review-alias'
    }
  }

  // Normalize historical owner-org/target-org endpoints.
  if (rawPath.startsWith('/indicators/owner-org/')) {
    return {
      adaptedPath: rawPath.replace('/indicators/owner-org/', '/indicators/owner/') + suffix,
      changed: true,
      reason: 'indicator-owner-org-alias'
    }
  }
  if (rawPath.startsWith('/indicators/target-org/')) {
    return {
      adaptedPath: rawPath.replace('/indicators/target-org/', '/indicators/target/') + suffix,
      changed: true,
      reason: 'indicator-target-org-alias'
    }
  }

  // Mark known unsupported contracts for visibility (do not force rewrite).
  if (
    rawPath.startsWith('/strategic/') ||
    rawPath.endsWith('/submit-approval') ||
    /^\/plans\/[^/]+\/(submit|approve|reject)$/.test(rawPath) ||
    rawPath.includes('/is-paired')
  ) {
    return {
      adaptedPath: `${rawPath}${suffix}`,
      changed: false,
      unsupported: true,
      reason: 'unsupported-or-unmapped-contract'
    }
  }

  return { adaptedPath: `${rawPath}${suffix}`, changed: normalized !== path, reason: 'normalized' }
}
