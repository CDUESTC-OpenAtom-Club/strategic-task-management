/**
 * V1 API Path Adapter
 *
 * Normalize frontend paths to the backend OpenAPI V1 contract.
 * Only explicit compatibility mappings live here.
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
  '/analytics/dashboard/charts': '/analytics/dashboard'
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

  return { adaptedPath: `${rawPath}${suffix}`, changed: normalized !== path, reason: 'normalized' }
}
