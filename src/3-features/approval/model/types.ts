/**
 * Approval Feature Types
 * 
 * Types for approval workflow management
 */

export interface ApprovalInstance {
  instanceId: number
  instanceNo: string
  flowName: string
  entityType: string
  entityId: string
  entityTitle: string
  currentStep: string
  status: ApprovalStatus
  applicant: {
    id: number
    name: string
    orgName?: string
  }
  createdAt: string
  updatedAt?: string
}

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export interface ApprovalFlow {
  id: number
  name: string
  code: string
  description: string
  entityType: string
  enabled: boolean
  version: number
  stepCount: number
  createdAt: string
}

export interface ApprovalStep {
  stepOrder: number
  stepCode: string
  stepName: string
  status: ApprovalStepStatus
  approvers: ApprovalUser[]
}

export type ApprovalStepStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED'

export interface ApprovalUser {
  id: number
  name: string
  approved: boolean
}

export interface ApprovalHistory {
  action: string
  operator: {
    id: number
    name: string
  }
  comment?: string
  operatedAt: string
}

export interface ApprovalSubmissionRequest {
  comment?: string
  flowCode: string
}

export interface ApprovalActionRequest {
  comment?: string
  decision: 'APPROVE' | 'REJECT'
}

export interface ApprovalFilters {
  page?: number
  size?: number
  instanceNo?: string
  entityType?: string
  entityId?: string
  status?: ApprovalStatus
  applicantId?: number
}