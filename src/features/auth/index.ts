/**
 * Auth Feature
 * 
 * Authentication and authorization functionality
 * Follows FSD (Feature-Sliced Design) architecture
 */

// Store
export { useAuthStore } from './model/store'

// Types
export type * from './model/types'
export type { User, UserRole } from '@/entities/user/model/types'

// Constants
export * from './model/constants'

// API
export { authApi, userApi } from './api'

// UI Components
export { default as LoginForm } from './ui/LoginForm.vue'
export { default as UserProfile } from './ui/UserProfile.vue'
