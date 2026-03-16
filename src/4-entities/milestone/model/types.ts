/**
 * Milestone Entity Types
 * 
 * Domain types for milestone management
 */

export interface Milestone {
  milestoneId: number
  indicatorId: number
  indicatorDesc: string
  milestoneName: string
  milestoneDesc?: string
  dueDate: string
  weightPercent: number
  status: MilestoneStatus
  sortOrder: number
  inheritedFromId?: number
  createdAt: string
  updatedAt: string
}

export type MilestoneStatus = 
  | 'NOT_STARTED' 
  | 'IN_PROGRESS' 
  | 'COMPLETED' 
  | 'DELAYED' 
  | 'CANCELED'

export interface MilestoneCreateRequest {
  indicatorId: number
  milestoneName: string
  milestoneDesc?: string
  dueDate: string
  weightPercent: number
  sortOrder: number
}

export interface MilestoneUpdateRequest {
  milestoneName?: string
  milestoneDesc?: string
  dueDate?: string
  weightPercent?: number
  status?: MilestoneStatus
  sortOrder?: number
}