/**
 * @/api - Backward Compatibility Alias
 *
 * This file provides backward compatibility for the @/api alias configured in vite.config.ts.
 * The actual API code lives in @/5-shared/api.
 *
 * @deprecated Import from @/5-shared/api instead
 */

// Re-export everything from @/5-shared/api
export * from '@/5-shared/api'
export { default } from '@/5-shared/api'
