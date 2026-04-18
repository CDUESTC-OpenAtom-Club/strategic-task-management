import { describe, expect, it } from 'vitest'

function hasWorkflowBinding(
  summary:
    | {
        id?: number | null
        workflowInstanceId?: number | null
        currentTaskId?: number | null
        workflowStatus?: string | null
        status?: string | null
        currentStepName?: string | null
      }
    | null
    | undefined
): boolean {
  if (!summary?.id) {
    return false
  }

  const workflowInstanceId = Number(summary.workflowInstanceId ?? NaN)
  if (Number.isFinite(workflowInstanceId) && workflowInstanceId > 0) {
    return true
  }

  const currentTaskId = Number(summary.currentTaskId ?? NaN)
  if (Number.isFinite(currentTaskId) && currentTaskId > 0) {
    return true
  }

  const workflowStatus = String(summary.workflowStatus || summary.status || '')
    .trim()
    .toUpperCase()
  if (workflowStatus && workflowStatus !== 'DRAFT') {
    return true
  }

  return Boolean(String(summary.currentStepName || '').trim())
}

describe('strategic task approval workflow binding', () => {
  it('does not treat latest report placeholder id as a real workflow binding', () => {
    expect(
      hasWorkflowBinding({
        id: 88
      })
    ).toBe(false)
  })

  it('treats workflow instance id as a valid report workflow binding', () => {
    expect(
      hasWorkflowBinding({
        id: 88,
        workflowInstanceId: 1234
      })
    ).toBe(true)
  })

  it('treats non-draft workflow status as a valid report workflow binding', () => {
    expect(
      hasWorkflowBinding({
        id: 88,
        workflowStatus: 'PENDING'
      })
    ).toBe(true)
  })
})
