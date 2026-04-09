/**
 * Organization Entity Types
 *
 * Domain model types for organizations based on backend sys_org table.
 * These types represent the core organization domain and are shared across features.
 */

/**
 * Organization Type (Backend Enum)
 * Maps to backend OrgType enum values
 */
export type OrgType =
  | 'STRATEGY_DEPT' // Strategic Development Department
  | 'FUNCTIONAL_DEPT' // Functional Department
  | 'FUNCTION_DEPT' // Functional Department (alternative)
  | 'COLLEGE' // College
  | 'SECONDARY_COLLEGE' // Secondary College
  | 'DIVISION' // Division
  | 'SCHOOL' // School
  | 'OTHER' // Other

export const OrgType = {
  STRATEGY_DEPT: 'STRATEGY_DEPT' as const,
  FUNCTIONAL_DEPT: 'FUNCTIONAL_DEPT' as const,
  FUNCTION_DEPT: 'FUNCTION_DEPT' as const,
  COLLEGE: 'COLLEGE' as const,
  SECONDARY_COLLEGE: 'SECONDARY_COLLEGE' as const,
  DIVISION: 'DIVISION' as const,
  SCHOOL: 'SCHOOL' as const,
  OTHER: 'OTHER' as const
} as const

/**
 * Organization Level
 * Hierarchical level in the organization structure
 */
export type OrgLevel =
  | 'university' // University level (top)
  | 'department' // Department level
  | 'college' // College level
  | 'division' // Division level

export const OrgLevel = {
  UNIVERSITY: 'university' as const,
  DEPARTMENT: 'department' as const,
  COLLEGE: 'college' as const,
  DIVISION: 'division' as const
} as const

/**
 * Frontend Department Type
 * Simplified organization type for frontend use
 */
export type DepartmentType =
  | 'strategic_dept' // Strategic Development Department (战略发展部)
  | 'functional_dept' // Functional Department (职能部门)
  | 'secondary_college' // Secondary College (二级学院)

export const DepartmentType = {
  STRATEGIC_DEPT: 'strategic_dept' as const,
  FUNCTIONAL_DEPT: 'functional_dept' as const,
  SECONDARY_COLLEGE: 'secondary_college' as const
} as const

/**
 * Organization Entity (Backend VO)
 * Core domain model for organizations
 * Aligned with backend sys_org table and OrgVO
 */
export interface Organization {
  // Core identification
  orgId: number
  orgName: string
  orgType: OrgType

  // Hierarchy
  parentOrgId?: number | null
  parentOrgName?: string | null
  level?: OrgLevel

  // Status and ordering
  isActive?: boolean
  sortOrder?: number

  // Additional information
  remark?: string | null
  typeDisplay?: string

  // Timestamps
  createdAt?: string
  updatedAt?: string
}

/**
 * Department (Frontend Model)
 * Simplified organization model for frontend use
 * Used in UI components and business logic
 */
export interface Department {
  id: string
  name: string
  type: DepartmentType
  sortOrder: number
}

/**
 * Organization Tree Node
 * Hierarchical organization structure for tree display
 */
export interface OrganizationTreeNode {
  orgId: number
  orgName: string
  orgType: OrgType
  parentOrgId?: number | null
  children?: OrganizationTreeNode[]
  level?: number
  isLeaf?: boolean
}

/**
 * Organization Create Request
 * Data required to create a new organization
 */
export interface OrganizationCreateRequest {
  orgName: string
  orgType: OrgType
  parentOrgId?: number | null
  sortOrder?: number
  remark?: string
}

/**
 * Organization Update Request
 * Data for updating an existing organization
 */
export interface OrganizationUpdateRequest {
  orgName?: string
  orgType?: OrgType
  parentOrgId?: number | null
  isActive?: boolean
  sortOrder?: number
  remark?: string
}

/**
 * Organization Filters
 * Query filters for organization list
 */
export interface OrganizationFilters {
  page?: number
  size?: number
  sort?: string
  order?: 'asc' | 'desc'
  orgName?: string
  orgType?: OrgType
  parentOrgId?: number
  isActive?: boolean
  searchTerm?: string
}

/**
 * Organization Statistics
 * Statistical information about organizations
 */
export interface OrganizationStats {
  totalCount: number
  activeCount: number
  byType: Record<OrgType, number>
  byLevel: Record<OrgLevel, number>
}
