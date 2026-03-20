/**
 * Strategic Indicator Feature - Business Types
 *
 * Business-specific types for the strategic indicator feature.
 * These extend the entity types with feature-specific concerns.
 */

import type { Indicator, IndicatorFilters } from '@/entities/indicator/model/types'

/**
 * Indicator list state
 */
export interface IndicatorListState {
  items: Indicator[]
  total: number
  loading: boolean
  error: string | null
}

/**
 * Indicator form state
 */
export interface IndicatorFormState {
  data: Partial<Indicator>
  loading: boolean
  errors: Record<string, string>
}

/**
 * Distribution state
 */
export interface DistributionState {
  selectedIndicators: number[]
  targetOrgs: number[]
  loading: boolean
  error: string | null
}

/**
 * Indicator statistics
 */
export interface IndicatorStatistics {
  total: number
  byStatus: Record<string, number>
  byLevel: Record<string, number>
  completionRate: number
}

/**
 * Extended filters with UI state
 */
export interface IndicatorFilterState extends IndicatorFilters {
  showAdvanced: boolean
  savedFilters: SavedFilter[]
}

/**
 * Saved filter preset
 */
export interface SavedFilter {
  id: string
  name: string
  filters: IndicatorFilters
}
