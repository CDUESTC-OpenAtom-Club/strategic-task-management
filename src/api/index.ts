/**
 * @/api - Backward Compatibility Alias
 *
 * This file provides backward compatibility for the @/api alias configured in vite.config.ts.
 * The actual API code lives in @/shared/api.
 *
 * @deprecated Import from @/shared/api instead
 */

// Re-export everything from @/shared/api
export * from '@/shared/api'
export { default } from '@/shared/api'
