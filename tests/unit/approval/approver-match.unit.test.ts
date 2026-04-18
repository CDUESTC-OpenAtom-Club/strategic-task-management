import { describe, expect, it } from 'vitest'

import { canCurrentUserHandleWorkflowApproval } from '@/features/approval/lib/approverMatch'

describe('canCurrentUserHandleWorkflowApproval', () => {
  it('prefers explicit approver id over missing frontend role codes', () => {
    expect(
      canCurrentUserHandleWorkflowApproval({
        currentUserId: 101,
        currentUserOrgId: 35,
        currentUserRoleCodes: [],
        hasApprovalPermission: true,
        isPendingApproval: true,
        explicitApproverId: 101,
        expectedApproverRoleCodes: ['ROLE_APPROVER'],
        expectedApproverOrgId: 35
      })
    ).toBe(true)
  })

  it('rejects when explicit approver id points to another user', () => {
    expect(
      canCurrentUserHandleWorkflowApproval({
        currentUserId: 101,
        currentUserOrgId: 35,
        currentUserRoleCodes: ['ROLE_APPROVER'],
        hasApprovalPermission: true,
        isPendingApproval: true,
        explicitApproverId: 202,
        expectedApproverRoleCodes: ['ROLE_APPROVER'],
        expectedApproverOrgId: 35
      })
    ).toBe(false)
  })

  it('falls back to role and org matching when explicit approver id is absent', () => {
    expect(
      canCurrentUserHandleWorkflowApproval({
        currentUserId: 101,
        currentUserOrgId: 35,
        currentUserRoleCodes: ['ROLE_APPROVER'],
        hasApprovalPermission: true,
        isPendingApproval: true,
        expectedApproverRoleCodes: ['ROLE_APPROVER'],
        expectedApproverOrgId: 35
      })
    ).toBe(true)
  })

  it('allows action when backend does not expose approver constraints but permission exists', () => {
    expect(
      canCurrentUserHandleWorkflowApproval({
        currentUserId: 101,
        currentUserOrgId: 35,
        currentUserRoleCodes: [],
        hasApprovalPermission: true,
        isPendingApproval: true
      })
    ).toBe(true)
  })
})
