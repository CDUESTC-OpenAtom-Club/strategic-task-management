/**
 * User Entity Types
 *
 * Domain model types for users based on backend entity structure.
 * These types represent the core user domain and are shared across features.
 */

/**
 * User Role
 * Three-tier organizational hierarchy roles
 */
export type UserRole =
  | 'strategic_dept' // Strategic Development Department (战略发展部)
  | 'functional_dept' // Functional Department (职能部门)
  | 'secondary_college' // Secondary College (二级学院)

export const UserRole = {
  STRATEGIC_DEPT: 'strategic_dept' as const,
  FUNCTIONAL_DEPT: 'functional_dept' as const,
  SECONDARY_COLLEGE: 'secondary_college' as const
} as const

/**
 * User Status
 * Account status for user management
 */
export type UserStatus =
  | 'active' // Active user account
  | 'disabled' // Disabled/inactive account
  | 'locked' // Locked account (e.g., too many failed login attempts)

export const UserStatus = {
  ACTIVE: 'active' as const,
  DISABLED: 'disabled' as const,
  LOCKED: 'locked' as const
} as const

/**
 * User Entity
 * Core domain model for system users
 * Aligned with backend app_user table
 */
export interface User {
  // Core identification
  userId: number
  username: string
  realName: string
  name?: string // Alias for realName (for backward compatibility)

  // Organization and role
  orgId: number
  orgName?: string
  department?: string // Alias for orgName
  role: UserRole

  // Contact information
  email?: string | null
  phone?: string | null

  // Account status
  isActive: boolean
  status?: UserStatus // Derived from isActive

  // SSO integration
  ssoId?: string | null

  // Timestamps
  createdAt: string
  updatedAt: string

  // UI helper fields
  avatar?: string
}

/**
 * User Create Request
 * Data required to create a new user
 */
export interface UserCreateRequest {
  username: string
  realName: string
  password?: string
  orgId: number
  role: UserRole
  email?: string
  phone?: string
  ssoId?: string
}

/**
 * User Update Request
 * Data for updating an existing user
 */
export interface UserUpdateRequest {
  realName?: string
  orgId?: number
  role?: UserRole
  email?: string
  phone?: string
  isActive?: boolean
}

/**
 * User Filters
 * Query filters for user list
 */
export interface UserFilters {
  page?: number
  size?: number
  sort?: string
  order?: 'asc' | 'desc'
  username?: string
  realName?: string
  orgId?: number
  role?: UserRole
  isActive?: boolean
  searchTerm?: string
}

/**
 * User Profile
 * Extended user information for profile display
 */
export interface UserProfile extends User {
  permissions?: string[]
  lastLoginIp?: string
  loginCount?: number
}

/**
 * Login Credentials
 * Data for user authentication
 */
export interface LoginCredentials {
  account: string
  password: string
}

/**
 * Login Response
 * Data returned after successful login
 */
export interface LoginResponse {
  token: string
  refreshToken?: string
  user: User
  expiresIn?: number
}

/**
 * Password Change Request
 * Data for changing user password
 */
export interface PasswordChangeRequest {
  oldPassword: string
  newPassword: string
  confirmPassword: string
}

/**
 * Password Reset Request
 * Data for resetting user password (admin action)
 */
export interface PasswordResetRequest {
  userId: number
  newPassword: string
}
