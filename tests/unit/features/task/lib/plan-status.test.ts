import { describe, expect, it } from 'vitest'
import { getPlanStatusDisplay, normalizePlanStatus } from '@/3-features/task/lib/planStatus'

describe('task/lib/planStatus', () => {
  it('normalizes lowercase draft status from plan module', () => {
    expect(normalizePlanStatus('draft')).toBe('DRAFT')
    expect(getPlanStatusDisplay('draft')).toEqual({
      label: '草稿',
      type: 'info'
    })
  })

  it('normalizes published and active states to distributed display', () => {
    expect(normalizePlanStatus('published')).toBe('DISTRIBUTED')
    expect(normalizePlanStatus('ACTIVE')).toBe('DISTRIBUTED')
    expect(getPlanStatusDisplay('published')).toEqual({
      label: '已下发',
      type: 'success'
    })
  })

  it('normalizes pending approval aliases to pending display', () => {
    expect(normalizePlanStatus('PENDING_APPROVAL')).toBe('PENDING')
    expect(normalizePlanStatus('pending_review')).toBe('PENDING')
    expect(normalizePlanStatus('IN_REVIEW')).toBe('PENDING')
    expect(getPlanStatusDisplay('pending')).toEqual({
      label: '待审核',
      type: 'warning'
    })
  })

  it('collapses workflow-only plan states back to draft display', () => {
    expect(normalizePlanStatus('REJECTED')).toBe('DRAFT')
    expect(normalizePlanStatus('WITHDRAWN')).toBe('DRAFT')
    expect(getPlanStatusDisplay('RETURNED')).toEqual({
      label: '草稿',
      type: 'info'
    })
  })
})
