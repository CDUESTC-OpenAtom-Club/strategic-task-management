/**
 * Layout Composables - Backward Compatibility Layer
 *
 * This file provides backward compatibility for imports from the old composables/layout/ directory.
 * The remaining shared-safe layout composables live in @/shared/lib/layout/.
 *
 * Migration Map:
 * - useNavigation → @/shared/lib/layout/useNavigation
 *
 * @deprecated Import from @/shared/lib/layout instead
 */

// Re-export from new location
export * from '@/shared/lib/layout'
