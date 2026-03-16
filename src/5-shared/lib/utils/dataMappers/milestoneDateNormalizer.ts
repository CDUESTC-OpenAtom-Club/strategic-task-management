// Milestone date normalization helper
// Provides a canonical milestone deadline value from milestone objects that may
// have either `deadline` or `dueDate` fields coming from different data shapes.
import type { Milestone } from '@/5-shared/types'

export function milestoneDeadline(ms: Milestone): string {
  // Prefer explicit deadline, fallback to dueDate
  const d = (ms as any).deadline ?? (ms as any).dueDate ?? ''
  return typeof d === 'string' ? d : ''
}
