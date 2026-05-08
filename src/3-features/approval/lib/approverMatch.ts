export interface WorkflowApprovalActorContext {
  currentUserId?: number | null
  currentUserOrgId?: number | null
  currentUserRoleCodes?: string[]
  hasApprovalPermission: boolean
  isPendingApproval: boolean
  explicitApproverId?: number | null
  expectedApproverRoleCodes?: string[]
  expectedApproverOrgId?: number | null
}

function normalizePositiveNumber(value: unknown): number | null {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null
  }
  return numericValue
}

function normalizeRoleCodes(roleCodes?: string[]): string[] {
  if (!Array.isArray(roleCodes)) {
    return []
  }

  return roleCodes
    .map(roleCode => (typeof roleCode === 'string' ? roleCode.trim() : ''))
    .filter(Boolean)
}

export function canCurrentUserHandleWorkflowApproval(
  context: WorkflowApprovalActorContext
): boolean {
  if (!context.hasApprovalPermission || !context.isPendingApproval) {
    return false
  }

  const explicitApproverId = normalizePositiveNumber(context.explicitApproverId)
  const currentUserId = normalizePositiveNumber(context.currentUserId)
  if (explicitApproverId && currentUserId) {
    return explicitApproverId === currentUserId
  }

  const expectedRoleCodes = normalizeRoleCodes(context.expectedApproverRoleCodes)
  const currentUserRoleCodes = normalizeRoleCodes(context.currentUserRoleCodes)
  if (expectedRoleCodes.length > 0) {
    const hasExpectedRole = expectedRoleCodes.some(roleCode =>
      currentUserRoleCodes.includes(roleCode)
    )
    if (!hasExpectedRole) {
      return false
    }
  }

  const expectedApproverOrgId = normalizePositiveNumber(context.expectedApproverOrgId)
  const currentUserOrgId = normalizePositiveNumber(context.currentUserOrgId)
  if (expectedApproverOrgId && currentUserOrgId) {
    return expectedApproverOrgId === currentUserOrgId
  }

  return true
}
