/**
 * @deprecated Compatibility entrypoint.
 * Canonical path: `@/shared/lib/utils`.
 * Remove after 2026-05-31.
 */

export * from '@/shared/lib/utils'

export function getProgressColor(progress: number): string {
  if (progress >= 80) {
    return 'var(--color-success)'
  }
  if (progress >= 50) {
    return 'var(--color-warning)'
  }
  return 'var(--color-danger)'
}

export function getProgressStatus(progress: number): 'success' | 'warning' | 'exception' {
  if (progress >= 80) {
    return 'success'
  }
  if (progress >= 50) {
    return 'warning'
  }
  return 'exception'
}

export function getStatusTagType(
  status: string
): 'success' | 'warning' | 'danger' | 'info' | 'primary' {
  const normalized = String(status).trim().toLowerCase()

  if (['approved', 'completed', 'passed', 'create', 'approve'].includes(normalized)) {
    return 'success'
  }
  if (['pending', 'processing', 'in_progress', 'update'].includes(normalized)) {
    return 'warning'
  }
  if (['rejected', 'overdue', 'failed', 'delete', 'reject'].includes(normalized)) {
    return 'danger'
  }
  if (['active', 'submit'].includes(normalized)) {
    return 'primary'
  }
  return 'info'
}
