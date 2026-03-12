/**
 * API Configuration
 * 
 * API endpoints and configuration
 */

/**
 * API base URL
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

/**
 * API timeout (ms)
 */
export const API_TIMEOUT = 30000

/**
 * API endpoints
 */
export const API_ENDPOINTS = {
  // Authentication
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    refresh: '/auth/refresh',
    userInfo: '/auth/userinfo'
  },

  // Users
  users: {
    list: '/users',
    detail: (id: string) => `/users/${id}`,
    create: '/users',
    update: (id: string) => `/users/${id}`,
    delete: (id: string) => `/users/${id}`
  },

  // Organizations
  organizations: {
    list: '/organizations',
    tree: '/organizations/tree',
    detail: (id: string) => `/organizations/${id}`
  },

  // Indicators
  indicators: {
    list: '/indicators',
    detail: (id: string) => `/indicators/${id}`,
    create: '/indicators',
    update: (id: string) => `/indicators/${id}`,
    delete: (id: string) => `/indicators/${id}`,
    distribute: (id: string) => `/indicators/${id}/distribute`
  },

  // Plans
  plans: {
    list: '/plans',
    detail: (id: string) => `/plans/${id}`,
    create: '/plans',
    update: (id: string) => `/plans/${id}`
  },

  // Tasks
  tasks: {
    list: '/tasks',
    detail: (id: string) => `/tasks/${id}`,
    create: '/tasks',
    update: (id: string) => `/tasks/${id}`
  },

  // Reports
  reports: {
    list: '/reports',
    detail: (id: string) => `/reports/${id}`,
    create: '/reports',
    submit: (id: string) => `/reports/${id}/submit`
  },

  // Approval
  approval: {
    flows: '/approval/flows',
    instances: '/approval/instances',
    myPending: '/approval/instances/my-pending',
    approve: (id: string) => `/approval/instances/${id}/approve`,
    reject: (id: string) => `/approval/instances/${id}/reject`
  },

  // Analytics
  analytics: {
    dashboard: '/analytics/dashboard',
    performanceReport: '/analytics/performance-report'
  },

  // File upload
  files: {
    upload: '/files/upload',
    download: (id: string) => `/files/${id}/download`
  }
} as const
