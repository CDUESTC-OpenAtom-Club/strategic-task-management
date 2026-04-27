/**
 * @deprecated Compatibility entrypoint.
 * Canonical path: `@/shared/lib/utils/tokenManager`.
 * Remove after 2026-05-31.
 */

const SESSION_TOKEN_KEY = 'sism_session_access_token'

export const DEFAULT_REFRESH_THRESHOLD_MS = 5 * 60 * 1000

type JwtPayload = {
  exp?: number
  iat?: number
  sub?: string
  [key: string]: unknown
}

export interface ExtendedTokenManager {
  getAccessToken(): string | null
  setAccessToken(token: string): void
  clearAccessToken(): void
  refreshAccessToken(): Promise<string>
  isTokenExpiring(thresholdMs?: number): boolean
  getTokenExpiration(): number | null
  hasValidToken(): boolean
  _reset(): void
  _getStoredToken(): string | null
}

let accessToken: string | null = null

function getStorage(name: 'localStorage' | 'sessionStorage') {
  const storage = globalThis[name]
  if (!storage || typeof storage !== 'object') {
    return null
  }
  return storage as {
    getItem?: (key: string) => string | null
    setItem?: (key: string, value: string) => void
    removeItem?: (key: string) => void
  }
}

function clearLegacyStorage(): void {
  const storage = getStorage('localStorage')
  storage?.removeItem?.('token')
  storage?.removeItem?.('auth_token')
  storage?.removeItem?.('access_token')
  storage?.removeItem?.('accessToken')
}

export function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3 || !parts[1]) {
      return null
    }

    const payloadPart = parts[1]
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const decoded = atob(padded)
    return JSON.parse(decoded) as JwtPayload
  } catch {
    return null
  }
}

export function getTokenExpirationTime(token: string): number | null {
  const payload = parseJwtPayload(token)
  return typeof payload?.exp === 'number' ? payload.exp * 1000 : null
}

export function isTokenExpired(token: string): boolean {
  const expiration = getTokenExpirationTime(token)
  if (expiration === null) {
    return true
  }
  return expiration <= Date.now()
}

export class TokenRefreshError extends Error {
  readonly statusCode: number | undefined
  readonly shouldRedirectToLogin: boolean

  constructor(message: string, statusCode?: number, shouldRedirectToLogin: boolean = true) {
    super(message)
    this.name = 'TokenRefreshError'
    this.statusCode = statusCode
    this.shouldRedirectToLogin = shouldRedirectToLogin
  }
}

export const tokenManager: ExtendedTokenManager = {
  getAccessToken() {
    return accessToken
  },

  setAccessToken(token: string) {
    accessToken = token
    clearLegacyStorage()
    const session = getStorage('sessionStorage')
    if (token) {
      session?.setItem?.(SESSION_TOKEN_KEY, token)
    } else {
      session?.removeItem?.(SESSION_TOKEN_KEY)
    }
  },

  clearAccessToken() {
    accessToken = null
    clearLegacyStorage()
    getStorage('sessionStorage')?.removeItem?.(SESSION_TOKEN_KEY)
  },

  async refreshAccessToken() {
    throw new TokenRefreshError('Refresh not implemented in compatibility token manager')
  },

  isTokenExpiring(thresholdMs: number = DEFAULT_REFRESH_THRESHOLD_MS) {
    if (!accessToken) {
      return true
    }
    const expiration = getTokenExpirationTime(accessToken)
    if (expiration === null) {
      return true
    }
    return expiration - Date.now() <= thresholdMs
  },

  getTokenExpiration() {
    return accessToken ? getTokenExpirationTime(accessToken) : null
  },

  hasValidToken() {
    return Boolean(accessToken) && !isTokenExpired(accessToken || '')
  },

  _reset() {
    accessToken = null
    clearLegacyStorage()
    getStorage('sessionStorage')?.removeItem?.(SESSION_TOKEN_KEY)
  },

  _getStoredToken() {
    return accessToken
  }
}
