/**
 * API Response Cache Manager
 * 
 * Implements caching with ETag and Last-Modified validation for API responses.
 * 
 * Features:
 * - ETag-based cache validation (If-None-Match header)
 * - Last-Modified-based cache validation (If-Modified-Since header)
 * - Configurable TTL (Time To Live) per cache entry
 * - Manual cache invalidation
 * - Memory-based storage with automatic cleanup
 * 
 * **Validates: Requirements 4.2.1, 4.2.2, 4.2.3, 4.2.4, 4.2.5**
 */

import { logger } from './logger'

/**
 * Cache entry structure
 */
export interface CacheEntry<T = unknown> {
  /** Cached response data */
  data: T
  /** ETag from server response */
  etag?: string
  /** Last-Modified timestamp from server response */
  lastModified?: string
  /** Cache creation timestamp */
  createdAt: number
  /** Cache expiration timestamp */
  expiresAt: number
}

/**
 * Cache configuration for a specific endpoint
 */
export interface CacheConfig {
  /** Time to live in milliseconds */
  ttl: number
  /** Whether to use ETag validation */
  useEtag: boolean
  /** Whether to use Last-Modified validation */
  useLastModified: boolean
}

/**
 * Default cache configurations for different endpoints
 */
export const DEFAULT_CACHE_CONFIGS: Record<string, CacheConfig> = {
  // Organization tree - cache for 5 minutes with ETag
  '/orgs/hierarchy': {
    ttl: 5 * 60 * 1000, // 5 minutes
    useEtag: true,
    useLastModified: false,
  },
  '/orgs': {
    ttl: 5 * 60 * 1000, // 5 minutes
    useEtag: true,
    useLastModified: false,
  },
  // Indicator list - conditional cache with Last-Modified
  '/indicators': {
    ttl: 2 * 60 * 1000, // 2 minutes
    useEtag: false,
    useLastModified: true,
  },
}

/**
 * Default TTL for endpoints without specific configuration
 */
export const DEFAULT_TTL = 60 * 1000 // 1 minute

/**
 * Cache key generator
 */
export function generateCacheKey(url: string, params?: Record<string, unknown>): string {
  const baseKey = url.replace(/^\/api/, '')
  if (!params || Object.keys(params).length === 0) {
    return baseKey
  }
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${JSON.stringify(params[key])}`)
    .join('&')
  return `${baseKey}?${sortedParams}`
}


/**
 * Cache Manager class
 * Manages in-memory cache with ETag and Last-Modified validation
 */
export class CacheManager {
  private cache: Map<string, CacheEntry> = new Map()
  private configs: Map<string, CacheConfig> = new Map()
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    // Initialize with default configs
    Object.entries(DEFAULT_CACHE_CONFIGS).forEach(([path, config]) => {
      this.configs.set(path, config)
    })
    
    // Start cleanup interval (every minute)
    this.startCleanup()
  }

  /**
   * Start automatic cleanup of expired entries
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired()
    }, 60 * 1000) // Every minute
  }

  /**
   * Stop automatic cleanup
   */
  public stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  /**
   * Remove expired cache entries
   */
  private cleanupExpired(): void {
    const now = Date.now()
    let removedCount = 0
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key)
        removedCount++
      }
    }
    
    if (removedCount > 0) {
      logger.debug(`[Cache] Cleaned up ${removedCount} expired entries`)
    }
  }

  /**
   * Get cache configuration for a URL
   */
  public getConfig(url: string): CacheConfig | undefined {
    // Try exact match first
    const normalizedUrl = url.replace(/^\/api/, '')
    if (this.configs.has(normalizedUrl)) {
      return this.configs.get(normalizedUrl)
    }
    
    // Try prefix match
    for (const [path, config] of this.configs.entries()) {
      if (normalizedUrl.startsWith(path)) {
        return config
      }
    }
    
    return undefined
  }

  /**
   * Set cache configuration for a URL pattern
   */
  public setConfig(urlPattern: string, config: CacheConfig): void {
    this.configs.set(urlPattern, config)
    logger.debug(`[Cache] Config set for ${urlPattern}:`, config)
  }

  /**
   * Get cached entry
   */
  public get<T>(key: string): CacheEntry<T> | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined
    
    if (!entry) {
      logger.debug(`[Cache] Miss: ${key}`)
      return undefined
    }
    
    // Check if expired
    if (entry.expiresAt < Date.now()) {
      logger.debug(`[Cache] Expired: ${key}`)
      this.cache.delete(key)
      return undefined
    }
    
    logger.debug(`[Cache] Hit: ${key}`)
    return entry
  }

  /**
   * Set cache entry
   */
  public set<T>(
    key: string, 
    data: T, 
    options: {
      etag?: string
      lastModified?: string
      ttl?: number
    } = {}
  ): void {
    const config = this.getConfig(key)
    const ttl = options.ttl ?? config?.ttl ?? DEFAULT_TTL
    const now = Date.now()
    
    const entry: CacheEntry<T> = {
      data,
      etag: options.etag,
      lastModified: options.lastModified,
      createdAt: now,
      expiresAt: now + ttl,
    }
    
    this.cache.set(key, entry)
    logger.debug(`[Cache] Set: ${key}, TTL: ${ttl}ms, ETag: ${options.etag || 'none'}`)
  }

  /**
   * Check if cache entry is valid (not expired)
   */
  public isValid(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    return entry.expiresAt >= Date.now()
  }

  /**
   * Get ETag for cache validation
   */
  public getEtag(key: string): string | undefined {
    const entry = this.cache.get(key)
    return entry?.etag
  }

  /**
   * Get Last-Modified for cache validation
   */
  public getLastModified(key: string): string | undefined {
    const entry = this.cache.get(key)
    return entry?.lastModified
  }

  /**
   * Invalidate (remove) a specific cache entry
   */
  public invalidate(key: string): boolean {
    const deleted = this.cache.delete(key)
    if (deleted) {
      logger.debug(`[Cache] Invalidated: ${key}`)
    }
    return deleted
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  public invalidatePattern(pattern: string | RegExp): number {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern
    let count = 0
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
        count++
      }
    }
    
    if (count > 0) {
      logger.debug(`[Cache] Invalidated ${count} entries matching pattern: ${pattern}`)
    }
    return count
  }

  /**
   * Clear all cache entries
   */
  public clear(): void {
    const size = this.cache.size
    this.cache.clear()
    logger.debug(`[Cache] Cleared all ${size} entries`)
  }

  /**
   * Get cache statistics
   */
  public getStats(): {
    size: number
    entries: Array<{ key: string; expiresIn: number; hasEtag: boolean }>
  } {
    const now = Date.now()
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      expiresIn: Math.max(0, entry.expiresAt - now),
      hasEtag: !!entry.etag,
    }))
    
    return {
      size: this.cache.size,
      entries,
    }
  }
}

// Singleton instance
export const cacheManager = new CacheManager()


/**
 * Check if a request should use caching
 */
export function shouldCache(method: string, url: string): boolean {
  // Only cache GET requests
  if (method.toUpperCase() !== 'GET') {
    return false
  }
  
  // Check if URL has a cache config
  const config = cacheManager.getConfig(url)
  return config !== undefined
}

/**
 * Get cache validation headers for a request
 * Returns headers to send with the request for cache validation
 */
export function getCacheValidationHeaders(
  url: string, 
  params?: Record<string, unknown>
): Record<string, string> {
  const cacheKey = generateCacheKey(url, params)
  const config = cacheManager.getConfig(url)
  const headers: Record<string, string> = {}
  
  if (!config) {
    return headers
  }
  
  // Add If-None-Match header for ETag validation
  if (config.useEtag) {
    const etag = cacheManager.getEtag(cacheKey)
    if (etag) {
      headers['If-None-Match'] = etag
    }
  }
  
  // Add If-Modified-Since header for Last-Modified validation
  if (config.useLastModified) {
    const lastModified = cacheManager.getLastModified(cacheKey)
    if (lastModified) {
      headers['If-Modified-Since'] = lastModified
    }
  }
  
  return headers
}

/**
 * Handle cache response
 * Updates cache based on response headers and returns cached data if 304
 */
export function handleCacheResponse<T>(
  url: string,
  params: Record<string, unknown> | undefined,
  response: {
    status: number
    data: T
    headers: {
      etag?: string
      'last-modified'?: string
      [key: string]: string | undefined
    }
  }
): { data: T; fromCache: boolean } {
  const cacheKey = generateCacheKey(url, params)
  
  // 304 Not Modified - return cached data
  if (response.status === 304) {
    const cached = cacheManager.get<T>(cacheKey)
    if (cached) {
      logger.debug(`[Cache] 304 Not Modified, using cached data: ${cacheKey}`)
      return { data: cached.data, fromCache: true }
    }
    // Cache was invalidated, but server returned 304 - this shouldn't happen
    // Fall through to cache the response
    logger.warn(`[Cache] 304 received but no cached data for: ${cacheKey}`)
  }
  
  // Cache the new response
  const etag = response.headers.etag || response.headers['etag']
  const lastModified = response.headers['last-modified']
  
  cacheManager.set(cacheKey, response.data, {
    etag,
    lastModified,
  })
  
  return { data: response.data, fromCache: false }
}

/**
 * Try to get data from cache without making a request
 * Returns undefined if cache miss or expired
 */
export function getFromCache<T>(
  url: string, 
  params?: Record<string, unknown>
): T | undefined {
  const cacheKey = generateCacheKey(url, params)
  const entry = cacheManager.get<T>(cacheKey)
  return entry?.data
}

/**
 * Manually refresh cache for a specific URL
 * This invalidates the cache entry, forcing the next request to fetch fresh data
 */
export function refreshCache(url: string, params?: Record<string, unknown>): void {
  const cacheKey = generateCacheKey(url, params)
  cacheManager.invalidate(cacheKey)
  logger.info(`[Cache] Manual refresh requested for: ${cacheKey}`)
}

/**
 * Refresh all cache entries for a URL pattern
 */
export function refreshCachePattern(pattern: string | RegExp): number {
  const count = cacheManager.invalidatePattern(pattern)
  logger.info(`[Cache] Manual refresh for pattern: ${pattern}, invalidated ${count} entries`)
  return count
}

// Export types for external use
export type { CacheEntry, CacheConfig }
