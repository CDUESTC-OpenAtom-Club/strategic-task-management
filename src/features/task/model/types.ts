/**
 * Task Feature Types
 * 
 * Types for strategic task management
 */

export interface StrategicTask {
  id: number
  name: string
  code: string
  description: string
  status: TaskStatus
  strategic: boolean
  year: number
  weight: number
  startDate: string
  endDate: string
  ownerOrgId: number
  ownerOrgName: string
  indicatorCount: number
  createdAt: string
  updatedAt: string
}

export type TaskStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'DRAFT'

export interface TaskCreateRequest {
  name: string
  code: string
  description: string
  strategic: boolean
  year: number
  weight: number
  startDate: string
  endDate: string
  ownerOrgId: number
}

export interface TaskUpdateRequest {
  name?: string
  description?: string
  status?: TaskStatus
  weight?: number
  startDate?: string
  endDate?: string
}

export interface TaskFilters {
  page?: number
  size?: number
  name?: string
  status?: TaskStatus
  strategic?: boolean
  year?: number
  ownerOrgId?: number
}