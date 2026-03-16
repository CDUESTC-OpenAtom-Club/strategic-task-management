/**
 * Feedback Components
 *
 * User feedback and interaction components following FSD architecture
 * - ConfirmDialog: Confirmation dialog for destructive actions
 * - SkeletonLoader: Loading skeleton placeholder
 * - EmptyState: Empty state placeholder
 */

// Export feedback functions (moved from ConfirmDialog.vue to lib)
export {
  showConfirm,
  showDeleteConfirm,
  showSubmitConfirm,
  showApprovalConfirm,
  useConfirmDialog
} from '@/shared/lib/ui/feedback/confirmDialog'
export type { ConfirmDialogOptions, DialogType } from '@/shared/lib/ui/feedback/confirmDialog'
export { default as SkeletonLoader } from './SkeletonLoader.vue'
export { default as EmptyState } from './EmptyState.vue'
