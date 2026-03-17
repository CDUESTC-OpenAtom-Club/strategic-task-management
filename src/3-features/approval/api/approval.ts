/**
 * Multi-Level Approval API Service
 * 
 * This service handles the multi-level approval workflow:
 * 1. Direct supervisor approval (Step 1)
 * 2. Level-2 supervisor approval (Step 2)
 * 3. Superior department joint approval (Step 3)
 */

import { apiClient } from '@/5-shared/api/client'
import type { ApiResponse } from '@/5-shared/types'

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
  requesterOrgId?: number
  entityType: string
  entityId: number
  workflowCode?: string
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
   * FIXED: Backend path is /approval/instances
   */
  async startApprovalFlow(request: ApprovalStartRequest): Promise<ApiResponse<ApprovalDetail>> {
    if (!request.requesterOrgId) {
      throw new Error('Missing requesterOrgId for approval instance start')
    }
    return apiClient.post<ApiResponse<ApprovalDetail>>(
      `/approval/instances?requesterId=${request.submitterId}&requesterOrgId=${request.requesterOrgId}`,
      {
        entityType: request.entityType,
        entityId: request.entityId,
        workflowCode: request.workflowCode
      }
    )
  },

  /**
   * Get pending approvals for a user
   * FIXED: Backend path is /approval/instances/my-pending
   */
  async getPendingApprovals(userId: number): Promise<ApiResponse<ApprovalDetail[]>> {
    return apiClient.get<ApiResponse<ApprovalDetail[]>>('/approval/instances/my-pending', { userId })
  },

  /**
   * Get approval instance details
   * FIXED: Backend uses instanceId parameter
   */
  async getApprovalInstance(instanceId: number): Promise<ApiResponse<ApprovalDetail>> {
    return apiClient.get<ApiResponse<ApprovalDetail>>(`/approval/instances/${instanceId}`)
  },

  /**
   * Approve an approval instance
   * FIXED: Backend uses instanceId parameter
   */
  async approve(instanceId: number, request: ApprovalActionRequest): Promise<ApiResponse<ApprovalDetail>> {
    const instanceResponse = await approvalApi.getApprovalInstance(instanceId)
    const instanceBody = instanceResponse?.data || { id: instanceId }

    return apiClient.post<ApiResponse<ApprovalDetail>>(
      `/approval/instances/${instanceId}/approve?userId=${request.userId}${
        request.comment ? `&comment=${encodeURIComponent(request.comment)}` : ''
      }`,
      instanceBody
    )
  },

  /**
   * Reject an approval instance
   * FIXED: Backend uses instanceId parameter
   */
  async reject(instanceId: number, request: ApprovalActionRequest): Promise<ApiResponse<ApprovalDetail>> {
    const instanceResponse = await approvalApi.getApprovalInstance(instanceId)
    const instanceBody = instanceResponse?.data || { id: instanceId }

    return apiClient.post<ApiResponse<ApprovalDetail>>(
      `/approval/instances/${instanceId}/reject?userId=${request.userId}${
        request.comment ? `&comment=${encodeURIComponent(request.comment)}` : ''
      }`,
      instanceBody
    )
  },

  /**
   * Get approval history for an instance
   * FIXED: Backend uses instanceId parameter
   */
  async getApprovalHistory(instanceId: number): Promise<ApiResponse<ApprovalHistory>> {
    return apiClient.get<ApiResponse<ApprovalHistory>>(`/approval/instances/${instanceId}/history`)
  }
}

export default approvalApi
