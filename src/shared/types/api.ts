/**
 * API Types
 * 
 * Common types for API requests and responses
 */

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
  timestamp?: number
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number
  pageSize: number
}

/**
 * Sort parameters
 */
export interface SortParams {
  field: string
  order: 'asc' | 'desc'
}

/**
 * Filter parameters
 */
export interface FilterParams {
  [key: string]: unknown
}

/**
 * Query parameters
 */
export interface QueryParams extends PaginationParams {
  sort?: SortParams
  filters?: FilterParams
}

/**
 * API error response
 */
export interface ApiErrorResponse {
  code: number
  message: string
  details?: unknown
  timestamp?: number
}

/**
 * File upload response
 */
export interface FileUploadResponse {
  id: string
  filename: string
  url: string
  size: number
  mimeType: string
}
