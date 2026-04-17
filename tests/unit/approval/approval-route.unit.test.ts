import { describe, expect, it } from 'vitest'

import {
  requiresApprovalCenterFallback,
  resolveApprovalRoute
} from '@/features/approval/lib/approvalNotifications'

describe('approval route fallbacks', () => {
  it('uses approval-center fallback for plan approval entities', () => {
    expect(
      requiresApprovalCenterFallback({
        entityType: 'PLAN',
        approvalInstanceId: 3
      })
    ).toBe(true)
  })

  it('keeps task approvals on the strategic task route', () => {
    expect(
      resolveApprovalRoute({
        entityType: 'TASK',
        entityId: 401,
        approvalInstanceId: 16
      })
    ).toBe(
      '/strategic-tasks?openApproval=1&approvalEntityType=TASK&approvalEntityId=401&approvalInstanceId=16'
    )
  })
})
