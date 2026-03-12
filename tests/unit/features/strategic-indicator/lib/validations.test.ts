/**
 * Unit Tests for Strategic Indicator Validations
 * 
 * Tests for features/strategic-indicator/lib/validations.ts
 */

import { describe, it, expect } from 'vitest'
import {
  canEditIndicator,
  canDeleteIndicator,
  canDistributeIndicator,
  canWithdrawIndicator,
  canSubmitForApproval,
  validateIndicatorCreate,
  validateIndicatorUpdate,
  validateIndicatorDistribution,
  validateIndicatorWeights,
  validateProgressSubmission,
  getAvailableActions
} from '@/features/strategic-indicator/lib/validations'
import type { Indicator } from '@/entities/indicator/model/types'

describe('Strategic Indicator Validations', () => {
  const mockIndicator: Indicator = {
    id: 1,
    name: 'Test Indicator',
    description: 'Test Description',
    type: 'QUANTITATIVE',
    unit: 'units',
    targetValue: 100,
    actualValue: 80,
    weight: 0.5,
    level: 'STRATEGIC',
    status: 'DRAFT',
    year: 2026,
    taskId: 1,
    ownerOrgId: 1,
    targetOrgId: 2,
    createdAt: '2026-03-12T00:00:00Z',
    updatedAt: '2026-03-12T00:00:00Z'
  }

  describe('Permission Checks', () => {
    it('should allow editing draft indicators', () => {
      expect(canEditIndicator({ ...mockIndicator, status: 'DRAFT' })).toBe(true)
      expect(canEditIndicator({ ...mockIndicator, status: 'DISTRIBUTED' })).toBe(false)
    })

    it('should allow deleting draft indicators', () => {
      expect(canDeleteIndicator({ ...mockIndicator, status: 'DRAFT' })).toBe(true)
      expect(canDeleteIndicator({ ...mockIndicator, status: 'DISTRIBUTED' })).toBe(false)
    })

    it('should allow distributing approved indicators', () => {
      expect(canDistributeIndicator({ ...mockIndicator, status: 'DISTRIBUTED' })).toBe(true)
      expect(canDistributeIndicator({ ...mockIndicator, status: 'PENDING_REVIEW' })).toBe(true)
      expect(canDistributeIndicator({ ...mockIndicator, status: 'DRAFT' })).toBe(false)
    })

    it('should allow withdrawing distributed indicators', () => {
      expect(canWithdrawIndicator({ 
        ...mockIndicator, 
        status: 'DISTRIBUTED',
        canWithdraw: true 
      })).toBe(true)
      
      expect(canWithdrawIndicator({ 
        ...mockIndicator, 
        status: 'DISTRIBUTED',
        canWithdraw: false 
      })).toBe(false)
      
      expect(canWithdrawIndicator({ ...mockIndicator, status: 'DRAFT' })).toBe(false)
    })

    it('should allow submitting draft indicators for approval', () => {
      expect(canSubmitForApproval({ ...mockIndicator, status: 'DRAFT' })).toBe(true)
      expect(canSubmitForApproval({ ...mockIndicator, status: 'DISTRIBUTED' })).toBe(false)
    })
  })
})
  describe('validateIndicatorCreate', () => {
    it('should validate correct indicator data', () => {
      const validData = {
        name: 'Test Indicator',
        taskId: 1,
        ownerOrgId: 1,
        targetOrgId: 2,
        type: 'QUANTITATIVE',
        targetValue: 100,
        unit: 'units',
        weight: 0.5
      }
      
      const result = validateIndicatorCreate(validData)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject missing required fields', () => {
      const invalidData = {}
      
      const result = validateIndicatorCreate(invalidData)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('指标名称不能为空')
      expect(result.errors).toContain('请选择所属任务')
      expect(result.errors).toContain('请选择责任组织')
      expect(result.errors).toContain('请选择目标组织')
    })

    it('should validate quantitative indicator requirements', () => {
      const quantitativeData = {
        name: 'Test',
        taskId: 1,
        ownerOrgId: 1,
        targetOrgId: 2,
        type: 'QUANTITATIVE'
        // missing targetValue and unit
      }
      
      const result = validateIndicatorCreate(quantitativeData)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('定量指标必须设置目标值')
      expect(result.errors).toContain('定量指标必须设置单位')
    })

    it('should validate qualitative indicator requirements', () => {
      const qualitativeData = {
        name: 'Test',
        taskId: 1,
        ownerOrgId: 1,
        targetOrgId: 2,
        type: 'QUALITATIVE'
        // missing qualitativeOptions
      }
      
      const result = validateIndicatorCreate(qualitativeData)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('定性指标必须设置评价选项')
    })

    it('should validate weight range', () => {
      const invalidWeightData = {
        name: 'Test',
        taskId: 1,
        ownerOrgId: 1,
        targetOrgId: 2,
        weight: 1.5 // invalid weight
      }
      
      const result = validateIndicatorCreate(invalidWeightData)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('权重必须在0-1之间')
    })
  })

  describe('validateIndicatorUpdate', () => {
    it('should validate update for draft indicator', () => {
      const draftIndicator = { ...mockIndicator, status: 'DRAFT' }
      const updateData = { name: 'Updated Name' }
      
      const result = validateIndicatorUpdate(draftIndicator, updateData)
      expect(result.valid).toBe(true)
    })

    it('should reject update for non-draft indicator', () => {
      const distributedIndicator = { ...mockIndicator, status: 'DISTRIBUTED' }
      const updateData = { name: 'Updated Name' }
      
      const result = validateIndicatorUpdate(distributedIndicator, updateData)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('只能编辑草稿状态的指标')
    })

    it('should validate empty name', () => {
      const draftIndicator = { ...mockIndicator, status: 'DRAFT' }
      const updateData = { name: '' }
      
      const result = validateIndicatorUpdate(draftIndicator, updateData)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('指标名称不能为空')
    })
  })

  describe('validateIndicatorDistribution', () => {
    it('should validate correct distribution', () => {
      const distributedIndicator = { ...mockIndicator, status: 'DISTRIBUTED' }
      const targetOrgIds = [2, 3, 4]
      
      const result = validateIndicatorDistribution(distributedIndicator, targetOrgIds)
      expect(result.valid).toBe(true)
    })

    it('should reject distribution of non-approved indicator', () => {
      const draftIndicator = { ...mockIndicator, status: 'DRAFT' }
      const targetOrgIds = [2, 3]
      
      const result = validateIndicatorDistribution(draftIndicator, targetOrgIds)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('只能下发已批准的指标')
    })

    it('should require target organizations', () => {
      const distributedIndicator = { ...mockIndicator, status: 'DISTRIBUTED' }
      const targetOrgIds: number[] = []
      
      const result = validateIndicatorDistribution(distributedIndicator, targetOrgIds)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('请至少选择一个目标组织')
    })
  })

  describe('validateIndicatorWeights', () => {
    it('should validate correct weight sum', () => {
      const indicators = [
        { ...mockIndicator, weight: 0.6 },
        { ...mockIndicator, weight: 0.4 }
      ]
      
      const result = validateIndicatorWeights(indicators)
      expect(result.valid).toBe(true)
    })

    it('should reject incorrect weight sum', () => {
      const indicators = [
        { ...mockIndicator, weight: 0.7 },
        { ...mockIndicator, weight: 0.5 }
      ]
      
      const result = validateIndicatorWeights(indicators)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('指标权重总和必须为1（或100%）')
    })

    it('should validate individual weight ranges', () => {
      const indicators = [
        { ...mockIndicator, name: 'Test 1', weight: 1.5 },
        { ...mockIndicator, name: 'Test 2', weight: -0.5 }
      ]
      
      const result = validateIndicatorWeights(indicators)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('指标"Test 1"的权重必须在0-1之间')
      expect(result.errors).toContain('指标"Test 2"的权重必须在0-1之间')
    })
  })

  describe('validateProgressSubmission', () => {
    it('should validate correct progress submission', () => {
      const distributedIndicator = { ...mockIndicator, status: 'DISTRIBUTED', targetValue: 100 }
      
      const result = validateProgressSubmission(distributedIndicator, 80)
      expect(result.valid).toBe(true)
    })

    it('should reject progress for non-distributed indicator', () => {
      const draftIndicator = { ...mockIndicator, status: 'DRAFT' }
      
      const result = validateProgressSubmission(draftIndicator, 80)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('只能为已下发的指标提交进度')
    })

    it('should reject negative progress values', () => {
      const distributedIndicator = { ...mockIndicator, status: 'DISTRIBUTED' }
      
      const result = validateProgressSubmission(distributedIndicator, -10)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('进度值不能为负数')
    })

    it('should reject progress exceeding target', () => {
      const distributedIndicator = { ...mockIndicator, status: 'DISTRIBUTED', targetValue: 100 }
      
      const result = validateProgressSubmission(distributedIndicator, 150)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('进度值不能超过目标值')
    })
  })

  describe('getAvailableActions', () => {
    it('should return correct actions for draft indicator', () => {
      const draftIndicator = { ...mockIndicator, status: 'DRAFT' }
      
      const actions = getAvailableActions(draftIndicator)
      expect(actions).toContain('edit')
      expect(actions).toContain('delete')
      expect(actions).toContain('submit')
      expect(actions).toContain('view')
      expect(actions).not.toContain('distribute')
      expect(actions).not.toContain('withdraw')
    })

    it('should return correct actions for distributed indicator', () => {
      const distributedIndicator = { 
        ...mockIndicator, 
        status: 'DISTRIBUTED',
        canWithdraw: true 
      }
      
      const actions = getAvailableActions(distributedIndicator)
      expect(actions).toContain('distribute')
      expect(actions).toContain('withdraw')
      expect(actions).toContain('view')
      expect(actions).not.toContain('edit')
      expect(actions).not.toContain('delete')
      expect(actions).not.toContain('submit')
    })

    it('should always include view action', () => {
      const actions = getAvailableActions(mockIndicator)
      expect(actions).toContain('view')
    })
  })
})