/**
 * Unit tests for strategicApi module
 * 
 * **Validates: Requirements 2.1**
 */
import { describe, it, expect } from 'vitest'
import * as strategicApiModule from '../strategicApi'
import { approvalApi } from '../strategicApi'

describe('strategicApi - API function removal verification', () => {
  it('should not export submitPlanForApproval function', () => {
    // Verify that submitPlanForApproval is not exported from the module
    expect(strategicApiModule).not.toHaveProperty('submitPlanForApproval')
    
    // Verify that submitPlanForApproval is not in the approvalApi object
    expect(approvalApi).not.toHaveProperty('submitPlanForApproval')
    
    // Verify that the function name doesn't exist in the module's exports
    const exportedNames = Object.keys(strategicApiModule)
    expect(exportedNames).not.toContain('submitPlanForApproval')
  })

  it('should still export other approval API functions', () => {
    // Verify that other approval functions are still exported
    expect(approvalApi).toHaveProperty('approvePlan')
    expect(approvalApi).toHaveProperty('rejectPlan')
    expect(approvalApi).toHaveProperty('getPendingApprovals')
    expect(approvalApi).toHaveProperty('getPlanApprovalStatus')
    expect(approvalApi).toHaveProperty('countPendingApprovals')
    expect(approvalApi).toHaveProperty('getCurrentStep')
    
    // Verify these are functions
    expect(typeof approvalApi.approvePlan).toBe('function')
    expect(typeof approvalApi.rejectPlan).toBe('function')
    expect(typeof approvalApi.getPendingApprovals).toBe('function')
    expect(typeof approvalApi.getPlanApprovalStatus).toBe('function')
    expect(typeof approvalApi.countPendingApprovals).toBe('function')
    expect(typeof approvalApi.getCurrentStep).toBe('function')
  })

  it('should export strategicApi with expected functions', () => {
    // Verify that strategicApi is exported
    expect(strategicApiModule).toHaveProperty('strategicApi')
    expect(strategicApiModule.strategicApi).toBeDefined()
    
    // Verify core functions exist
    expect(strategicApiModule.strategicApi).toHaveProperty('getAllCycles')
    expect(strategicApiModule.strategicApi).toHaveProperty('getCycleByYear')
    expect(strategicApiModule.strategicApi).toHaveProperty('getTasksByYear')
    expect(strategicApiModule.strategicApi).toHaveProperty('getAllTasks')
    expect(strategicApiModule.strategicApi).toHaveProperty('getIndicatorsByYear')
    expect(strategicApiModule.strategicApi).toHaveProperty('getAllIndicators')
  })
})
