/**
 * Approval Feature Store
 * 
 * Migrated from stores/approval.ts
 * Multi-level approval workflow state management
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ApprovalInstance, ApprovalHistory } from './types'
import { useAuthStore } from '@/features/auth/model/store'
import { logger } from '@/utils/logger'
import { ElMessage } from 'element-plus'

export const useApprovalStore = defineStore('approval', () => {
  // ============ State ============
  
  // Pending approvals for current user
  const pendingApprovals = ref<ApprovalInstance[]>([])
  
  // Current approval being viewed/edited
  const currentApproval = ref<ApprovalInstance | null>(null)
  
  // Approval history
  const approvalHistory = ref<ApprovalHistory[]>([])
  
  // Loading states
  const loading = ref(false)
  const submitting = ref(false)
  const error = ref<string | null>(null)

  // ============ Getters ============
  
  // Count of pending approvals
  const pendingCount = computed(() => pendingApprovals.value.length)
  
  // Pending count by status
  const pendingByStatus = computed(() => {
    const result = {
      pending: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0
    }
    
    pendingApprovals.value.forEach(approval => {
      switch (approval.status) {
        case 'PENDING':
          result.pending++
          break
        case 'APPROVED':
          result.approved++
          break
        case 'REJECTED':
          result.rejected++
          break
        case 'CANCELLED':
          result.cancelled++
          break
      }
    })
    
    return result
  })
  
  // Check if user has approvals pending
  const hasPendingForCurrentUser = computed(() => {
    const authStore = useAuthStore()
    const userId = authStore.user?.id
    
    if (!userId) {return false}
    
    return pendingApprovals.value.some(approval => 
      approval.status === 'PENDING' && approval.applicant.id === userId
    )
  })

  // ============ Actions ============

  /**
   * Load pending approvals for current user
   */
  const loadPendingApprovals = async () => {
    const authStore = useAuthStore()
    const userId = authStore.user?.id
    
    if (!userId) {
      logger.warn('[Approval Store] No user ID found')
      return
    }

    loading.value = true
    error.value = null

    try {
      logger.info('[Approval Store] Loading pending approvals for user:', userId)
      
      // 动态导入 API
      const { default: approvalApi } = await import('@/api/approval')
      const response = await approvalApi.getPendingApprovals()

      if (response.success && response.data) {
        pendingApprovals.value = response.data.content || []
        logger.info('[Approval Store] Loaded', pendingApprovals.value.length, 'pending approvals')
      } else {
        pendingApprovals.value = []
        logger.warn('[Approval Store] No pending approvals loaded')
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载待审批列表失败'
      logger.error('[Approval Store] Failed to load pending approvals:', err)
      ElMessage.error('加载待审批列表失败')
    } finally {
      loading.value = false
    }
  }

  /**
   * Load approval details
   */
  const loadApprovalDetail = async (instanceId: number) => {
    loading.value = true
    error.value = null

    try {
      logger.info('[Approval Store] Loading approval detail:', instanceId)
      
      const { default: approvalApi } = await import('@/api/approval')
      const response = await approvalApi.getApprovalInstance(instanceId)

      if (response.success && response.data) {
        currentApproval.value = response.data
        logger.info('[Approval Store] Loaded approval detail')
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载审批详情失败'
      logger.error('[Approval Store] Failed to load approval detail:', err)
      ElMessage.error('加载审批详情失败')
    } finally {
      loading.value = false
    }
  }

  /**
   * Approve an approval instance
   */
  const approve = async (instanceId: number, comment?: string) => {
    const authStore = useAuthStore()
    const userId = authStore.user?.id

    if (!userId) {
      ElMessage.error('用户未登录')
      return
    }

    submitting.value = true
    error.value = null

    try {
      logger.info('[Approval Store] Approving:', instanceId)
      
      const { default: approvalApi } = await import('@/api/approval')
      const response = await approvalApi.approve(instanceId, { comment })

      if (response.success && response.data) {
        currentApproval.value = response.data
        ElMessage.success('审批通过')
        
        // Remove from pending list
        pendingApprovals.value = pendingApprovals.value.filter(a => a.instanceId !== instanceId)
        
        logger.info('[Approval Store] Approval successful')
        return response.data
      } else {
        throw new Error(response.message || '审批失败')
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '审批失败'
      logger.error('[Approval Store] Failed to approve:', err)
      ElMessage.error(error.value)
      throw err
    } finally {
      submitting.value = false
    }
  }

  /**
   * Reject an approval instance
   */
  const reject = async (instanceId: number, reason: string) => {
    const authStore = useAuthStore()
    const userId = authStore.user?.id

    if (!userId) {
      ElMessage.error('用户未登录')
      return
    }

    if (!reason.trim()) {
      ElMessage.warning('请输入驳回原因')
      return
    }

    submitting.value = true
    error.value = null

    try {
      logger.info('[Approval Store] Rejecting:', instanceId, 'reason:', reason)
      
      const { default: approvalApi } = await import('@/api/approval')
      const response = await approvalApi.reject(instanceId, { comment: reason })

      if (response.success && response.data) {
        currentApproval.value = response.data
        ElMessage.success('已驳回')
        
        // Remove from pending list
        pendingApprovals.value = pendingApprovals.value.filter(a => a.instanceId !== instanceId)
        
        logger.info('[Approval Store] Rejection successful')
        return response.data
      } else {
        throw new Error(response.message || '驳回失败')
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '驳回失败'
      logger.error('[Approval Store] Failed to reject:', err)
      ElMessage.error(error.value)
      throw err
    } finally {
      submitting.value = false
    }
  }

  /**
   * Load approval history
   */
  const loadApprovalHistory = async (instanceId: number) => {
    loading.value = true
    error.value = null

    try {
      logger.info('[Approval Store] Loading history for:', instanceId)
      
      const { default: approvalApi } = await import('@/api/approval')
      const response = await approvalApi.getApprovalHistory(instanceId)

      if (response.success && response.data) {
        approvalHistory.value = response.data
        logger.info('[Approval Store] Loaded approval history')
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载审批历史失败'
      logger.error('[Approval Store] Failed to load history:', err)
      ElMessage.error('加载审批历史失败')
    } finally {
      loading.value = false
    }
  }

  /**
   * Clear current approval
   */
  const clearCurrentApproval = () => {
    currentApproval.value = null
    approvalHistory.value = []
  }

  /**
   * Get step name for display
   */
  const getStepName = (stepName: string): string => {
    // 根据步骤名称返回显示名称
    const stepNames: Record<string, string> = {
      'DEPT_REVIEW': '部门审核',
      'SCHOOL_REVIEW': '校级审批',
      'FINAL_REVIEW': '最终审批'
    }
    return stepNames[stepName] || stepName
  }

  return {
    // State
    pendingApprovals,
    currentApproval,
    approvalHistory,
    loading,
    submitting,
    error,

    // Getters
    pendingCount,
    pendingByStatus,
    hasPendingForCurrentUser,

    // Actions
    loadPendingApprovals,
    loadApprovalDetail,
    approve,
    reject,
    loadApprovalHistory,
    clearCurrentApproval,
    getStepName
  }
})