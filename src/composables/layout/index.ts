/**
 * Layout Composables - Backward Compatibility Layer
 *
 * This file provides backward compatibility for imports from the old composables/layout/ directory.
 * All layout composables have been migrated to @/shared/lib/layout/.
 *
 * Migration Map:
 * - useAppLayout → @/shared/lib/layout/useAppLayout
 * - useNavigation → @/shared/lib/layout/useNavigation
 * - useDepartmentSwitcher → @/shared/lib/layout/useDepartmentSwitcher
 * - useNotificationCenter → @/shared/lib/layout/useNotificationCenter
 *
 * @deprecated Import from @/shared/lib/layout instead
 */

// Re-export from new location
export * from '@/shared/lib/layout'
