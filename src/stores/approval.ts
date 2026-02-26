/**
 * Approval Store
 * 
 * Multi-level approval workflow state management
 * Handles: direct supervisor → level-2 supervisor → superior department (joint approval)
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { approvalApi, type ApprovalDetail, type ApprovalHistory } from '@/api/approval'
import { useAuthStore } from './auth'
import { logger } from '@/utils/logger'
import { ElMessage } from 'element-plus'

export const useApprovalStore = defineStore('approval', () => {
  // ============ State ============
  
  // Pending approvals for current user
  const pendingApprovals = ref<ApprovalDetail[]>([])
  
  // Current approval being viewed/edited
  const currentApproval = ref<ApprovalDetail | null>(null)
  
  // Approval history
  const approvalHistory = ref<ApprovalHistory | null>(null)
  
  // Loading states
  const loading = ref(false)
  const submitting = ref(false)
  const error = ref<string | null>(null)

  // ============ Getters ============
  
  // Count of pending approvals
  const pendingCount = computed(() => pendingApprovals.value.length)
  
  // Pending count by step
  const pendingByStep = computed(() => {
    const result = {
      directSupervisor: 0,   // Step 1
      level2Supervisor: 0,  // Step 2
      superiorDept: 0       // Step 3
    }
    
    pendingApprovals.value.forEach(approval => {
      const step = approval.currentStepOrder
      if (step === 1) {result.directSupervisor++}
      else if (step === 2) {result.level2Supervisor++}
      else if (step === 3) {result.superiorDept++}
    })
    
    return result
  })
  
  // Check if user has approvals pending at current step
  const hasPendingForCurrentUser = computed(() => {
    const authStore = useAuthStore()
    const userId = authStore.user?.id
    
    if (!userId) {return false}
    
    return pendingApprovals.value.some(approval => {
      if (approval.currentStepOrder === 1) {
        return approval.directSupervisorId === userId
      } else if (approval.currentStepOrder === 2) {
        return approval.level2SupervisorId === userId
      } else if (approval.currentStepOrder === 3) {
        return approval.pendingApprovers?.includes(userId)
      }
      return false
    })
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
      const response = await approvalApi.getPendingApprovals(userId)

      if (response.success && response.data) {
        pendingApprovals.value = response.data
        logger.info('[Approval Store] Loaded', response.data.length, 'pending approvals')
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
  const loadApprovalDetail = async (approvalId: number) => {
    loading.value = true
    error.value = null

    try {
      logger.info('[Approval Store] Loading approval detail:', approvalId)
      const response = await approvalApi.getApprovalInstance(approvalId)

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
  const approve = async (approvalId: number, comment?: string) => {
    const authStore = useAuthStore()
    const userId = authStore.user?.id

    if (!userId) {
      ElMessage.error('用户未登录')
      return
    }

    submitting.value = true
    error.value = null

    try {
      logger.info('[Approval Store] Approving:', approvalId)
      const response = await approvalApi.approve(approvalId, { userId, comment })

      if (response.success && response.data) {
        currentApproval.value = response.data
        ElMessage.success('审批通过')
        
        // Remove from pending list
        pendingApprovals.value = pendingApprovals.value.filter(a => a.id !== approvalId)
        
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
  const reject = async (approvalId: number, reason: string) => {
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
      logger.info('[Approval Store] Rejecting:', approvalId, 'reason:', reason)
      const response = await approvalApi.reject(approvalId, { userId, reason })

      if (response.success && response.data) {
        currentApproval.value = response.data
        ElMessage.success('已驳回')
        
        // Remove from pending list
        pendingApprovals.value = pendingApprovals.value.filter(a => a.id !== approvalId)
        
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
  const loadApprovalHistory = async (approvalId: number) => {
    loading.value = true
    error.value = null

    try {
      logger.info('[Approval Store] Loading history for:', approvalId)
      const response = await approvalApi.getApprovalHistory(approvalId)

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
    approvalHistory.value = null
  }

  /**
   * Get step name for display
   */
  const getStepName = (stepOrder: number): string => {
    switch (stepOrder) {
      case 1: return '直接主管审批'
      case 2: return '二级主管审批'
      case 3: return '上级部门审批'
      default: return '未知步骤'
    }
  }

  /**
   * Get step description for display
   */
  const getStepDescription = (stepOrder: number): string => {
    switch (stepOrder) {
      case 1: return '提交人所在部门的直接主管审批'
      case 2: return '提交人所在部门的二级主管审批'
      case 3: return '上级主管部门的审批（会签）'
      default: return ''
    }
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
    pendingByStep,
    hasPendingForCurrentUser,

    // Actions
    loadPendingApprovals,
    loadApprovalDetail,
    approve,
    reject,
    loadApprovalHistory,
    clearCurrentApproval,
    getStepName,
    getStepDescription
  }
})
