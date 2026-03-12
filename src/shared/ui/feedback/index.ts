/**
 * Feedback Components
 * 
 * User feedback and interaction components following FSD architecture
 * - ConfirmDialog: Confirmation dialog for destructive actions
 * - SkeletonLoader: Loading skeleton placeholder
 * - EmptyState: Empty state placeholder
 */

// Export feedback components here
export {
  showConfirm,
  showDeleteConfirm,
  showSubmitConfirm,
  showApprovalConfirm,
  useConfirmDialog
} from './ConfirmDialog.vue'
export type { ConfirmDialogOptions, DialogType } from './ConfirmDialog.vue'
export { default as SkeletonLoader } from './SkeletonLoader.vue'
export { default as EmptyState } from './EmptyState.vue'
