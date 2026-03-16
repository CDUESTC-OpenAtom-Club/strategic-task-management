/**
 * Layout Composables - Backward Compatibility Layer
 *
 * This file provides backward compatibility for imports from the old composables/layout/ directory.
 * All layout composables have been migrated to @/5-shared/lib/layout/.
 *
 * Migration Map:
 * - useAppLayout → @/5-shared/lib/layout/useAppLayout
 * - useNavigation → @/5-shared/lib/layout/useNavigation
 * - useDepartmentSwitcher → @/5-shared/lib/layout/useDepartmentSwitcher
 * - useNotificationCenter → @/5-shared/lib/layout/useNotificationCenter
 *
 * @deprecated Import from @/5-shared/lib/layout instead
 */

// Re-export from new location
export * from '@/5-shared/lib/layout'
