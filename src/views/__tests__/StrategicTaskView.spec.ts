/**
 * StrategicTaskView Component Unit Tests
 *
 * Tests for the StrategicTaskView component to verify UI changes
 * related to the approval workflow auto-trigger fix.
 *
 * Requirements: 2.1 - Verify "Submit for Approval" button is removed
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('StrategicTaskView - Approval Workflow UI Changes', () => {
  /**
   * Test 5.1: Verify "Submit for Approval" button is removed
   *
   * **Validates: Requirements 2.1**
   *
   * This test verifies that the redundant "Submit for Approval" button
   * has been removed from the UI, since approval is now automatically
   * triggered when indicators are distributed.
   *
   * This test uses static code analysis to check that no button element
   * contains text related to submitting plans for approval.
   */
  it('should not contain "Submit Plan for Approval" button in source code', () => {
    // Read the StrategicTaskView.vue source file
    const componentPath = join(__dirname, '../StrategicTaskView.vue')
    const componentSource = readFileSync(componentPath, 'utf-8')

    // Verify that the specific button text for "Submit Plan for Approval" does not exist
    // The button was removed in task 3.6, so this specific string should not appear
    expect(componentSource).not.toContain('提交计划审批')
    expect(componentSource).not.toContain('Submit Plan for Approval')
    
    // Note: "提交审批" (Submit for Approval) may appear in:
    // 1. Success message: "并自动提交审批" (and automatically submit for approval) - this is correct
    // 2. Comment for submitApproval function (used for approving/rejecting progress updates) - this is different
    // We're specifically checking that there's no button for submitting PLANS for approval
  })

  /**
   * Additional verification: Check that handleSubmitPlanForApproval method is removed
   *
   * **Validates: Requirements 2.1**
   *
   * The manual approval handler method should have been removed in task 3.7.
   */
  it('should not contain handleSubmitPlanForApproval method', () => {
    // Read the StrategicTaskView.vue source file
    const componentPath = join(__dirname, '../StrategicTaskView.vue')
    const componentSource = readFileSync(componentPath, 'utf-8')

    // Verify that the handleSubmitPlanForApproval method does not exist
    expect(componentSource).not.toContain('handleSubmitPlanForApproval')
  })

  /**
   * Verify that the success message mentions automatic approval
   *
   * **Validates: Requirements 2.1**
   *
   * The success message should have been updated in task 3.8 to mention
   * automatic approval submission.
   */
  it('should contain updated success message mentioning automatic approval', () => {
    // Read the StrategicTaskView.vue source file
    const componentPath = join(__dirname, '../StrategicTaskView.vue')
    const componentSource = readFileSync(componentPath, 'utf-8')

    // Verify that the success message mentions automatic approval
    expect(componentSource).toContain('自动提交审批')
    expect(componentSource).toContain('等待上级审批')
  })
})
