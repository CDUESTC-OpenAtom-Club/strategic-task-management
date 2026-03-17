/**
 * API Configuration
 * 
 * API endpoints and configuration
 */

/**
 * API base URL
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

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
    userInfo: '/auth/me',
    register: '/auth/register'
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
    distribute: (id: string) => `/indicators/${id}/distribute`,
    distributeBatch: (id: string) => `/indicators/${id}/distribute/batch`,
    distributionEligibility: (id: string) => `/indicators/${id}/distribution-eligibility`,
    distributed: (id: string) => `/indicators/${id}/distributed`,
    search: '/indicators/search',
    byTask: (taskId: string) => `/indicators/task/${taskId}`,
    rootByTask: (taskId: string) => `/indicators/task/${taskId}/root`,
    byOwnerOrg: (orgId: string) => `/indicators/owner/${orgId}`,
    byTargetOrg: (orgId: string) => `/indicators/target/${orgId}`
  },

  // Plans
  plans: {
    list: '/plans',
    detail: (id: string) => `/plans/${id}`,
    create: '/plans',
    update: (id: string) => `/plans/${id}`,
    delete: (id: string) => `/plans/${id}`,
    submitApproval: (id: string) => `/plans/${id}/submit-approval`
  },

  // Tasks
  tasks: {
    list: '/tasks',
    detail: (id: string) => `/tasks/${id}`,
    create: '/tasks',
    update: (id: string) => `/tasks/${id}`,
    delete: (id: string) => `/tasks/${id}`
  },

  // Reports
  reports: {
    list: '/reports',
    detail: (id: string) => `/reports/${id}`,
    create: '/reports',
    submit: (id: string) => `/reports/${id}/submit`
  },

  // Approval - Workflow Engine
  approval: {
    // Flow definitions
    flows: '/approval/flows',
    flowDetail: (id: string) => `/approval/flows/${id}`,
    flowByCode: (code: string) => `/approval/flows/code/${code}`,
    flowByEntityType: (entityType: string) => `/approval/flows/entity-type/${entityType}`,
    flowStatus: (id: string) => `/approval/flows/${id}/status`,

    // Instances
    instances: '/approval/instances',
    instanceDetail: (id: string) => `/approval/instances/${id}`,
    myPending: '/approval/instances/my-pending',
    approve: (id: string) => `/approval/instances/${id}/approve`,
    reject: (id: string) => `/approval/instances/${id}/reject`,
    cancel: (id: string) => `/approval/instances/${id}/cancel`
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
