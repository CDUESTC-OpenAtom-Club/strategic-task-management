/**
 * Multi-Level Approval API Service
 * 
 * This service handles the multi-level approval workflow:
 * 1. Direct supervisor approval (Step 1)
 * 2. Level-2 supervisor approval (Step 2)
 * 3. Superior department joint approval (Step 3)
 */

import { apiClient } from '@/shared/api/client'
import type { ApiResponse } from '@/types'

// ============================================================
// Types
// ============================================================

export interface ApprovalDetail {
  id: number
  entityType: string
  entityId: number
  status: 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED'
  currentStepOrder: number
  currentStepName: string
  currentStepDescription: string
  
  // Approval context
  submitterDeptId: number
  directSupervisorId: number
  level2SupervisorId: number
  superiorDeptId: number
  
  // Approval tracking
  pendingApprovers: number[]
  approvedApprovers: number[]
  rejectedApprovers: number[]
  
  // Timestamps
  initiatedBy: number
  initiatedAt: string
  completedAt?: string
}

export interface ApprovalHistoryItem {
  action: string
  actor: string
  comment: string
  timestamp: string
}

export interface ApprovalHistory {
  instanceId: number
  entityType: string
  entityId: number
  status: string
  currentStepOrder: number
  logs: ApprovalHistoryItem[]
}

export interface ApprovalStartRequest {
  submitterId: number
  entityType: string
  entityId: number
}

export interface ApprovalActionRequest {
  userId: number
  comment?: string
  reason?: string
}

// ============================================================
// API Service
// ============================================================

export const approvalApi = {
  /**
   * Start a new approval flow
   * FIXED: Backend path is /plans/approval/instances
   */
  async startApprovalFlow(request: ApprovalStartRequest): Promise<ApiResponse<ApprovalDetail>> {
    return apiClient.post<ApiResponse<ApprovalDetail>>('/plans/approval/instances', request)
  },

  /**
   * Get pending approvals for a user
   * FIXED: Backend path is /plans/approval/instances/pending
   */
  async getPendingApprovals(userId: number): Promise<ApiResponse<ApprovalDetail[]>> {
    return apiClient.get<ApiResponse<ApprovalDetail[]>>('/plans/approval/instances/pending', { userId })
  },

  /**
   * Get approval instance details
   * FIXED: Backend uses instanceId parameter and /plans/approval prefix
   */
  async getApprovalInstance(instanceId: number): Promise<ApiResponse<ApprovalDetail>> {
    return apiClient.get<ApiResponse<ApprovalDetail>>(`/plans/approval/instances/${instanceId}`)
  },

  /**
   * Approve an approval instance
   * FIXED: Backend uses instanceId parameter and /plans/approval prefix
   */
  async approve(instanceId: number, request: ApprovalActionRequest): Promise<ApiResponse<ApprovalDetail>> {
    return apiClient.post<ApiResponse<ApprovalDetail>>(`/plans/approval/instances/${instanceId}/approve`, request)
  },

  /**
   * Reject an approval instance
   * FIXED: Backend uses instanceId parameter and /plans/approval prefix
   */
  async reject(instanceId: number, request: ApprovalActionRequest): Promise<ApiResponse<ApprovalDetail>> {
    return apiClient.post<ApiResponse<ApprovalDetail>>(`/plans/approval/instances/${instanceId}/reject`, request)
  },

  /**
   * Get approval history for an instance
   * FIXED: Backend uses instanceId parameter and /plans/approval prefix
   */
  async getApprovalHistory(instanceId: number): Promise<ApiResponse<ApprovalHistory>> {
    return apiClient.get<ApiResponse<ApprovalHistory>>(`/plans/approval/instances/${instanceId}/history`)
  }
}

export default approvalApi
