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

  it('rewrites functional department plan approvals to the distribution workbench', () => {
    expect(
      resolveApprovalRoute({
        entityType: 'PLAN',
        approvalInstanceId: 3,
        entityId: 4044,
        actionUrl: '/strategic-tasks?tab=approval&approvalInstanceId=3',
        viewerRole: 'functional_dept'
      })
    ).toBe(
      '/distribution?tab=approval&approvalInstanceId=3&openApproval=1&approvalEntityType=PLAN&approvalEntityId=4044'
    )
  })
})
