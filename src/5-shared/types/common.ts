/**
 * Common Types
 * 
 * Shared type definitions used across the application
 */

/**
 * Generic ID type
 */
export type ID = string | number

/**
 * Status types
 */
export type Status = 'active' | 'inactive' | 'pending' | 'archived'

/**
 * Base entity interface
 */
export interface BaseEntity {
  id: ID
  createdAt?: Date | string
  updatedAt?: Date | string
  createdBy?: string
  updatedBy?: string
}

/**
 * Option type for select components
 */
export interface Option<T = unknown> {
  label: string
  value: T
  disabled?: boolean
  children?: Option<T>[]
}

/**
 * Tree node type
 */
export interface TreeNode<T = unknown> {
  id: ID
  label: string
  data?: T
  children?: TreeNode<T>[]
  parent?: TreeNode<T>
}

/**
 * Key-value pair
 */
export interface KeyValue<K = string, V = unknown> {
  key: K
  value: V
}

/**
 * Nullable type
 */
export type Nullable<T> = T | null

/**
 * Optional type
 */
export type Optional<T> = T | undefined

/**
 * Deep partial type
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

/**
 * Readonly deep type
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P]
}

/**
 * Extract keys of specific type
 */
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never
}[keyof T]

/**
 * Make specific properties required
 */
export type RequireProps<T, K extends keyof T> = T & Required<Pick<T, K>>

/**
 * Make specific properties optional
 */
export type OptionalProps<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
