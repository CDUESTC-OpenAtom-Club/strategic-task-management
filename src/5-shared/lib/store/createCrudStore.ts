// @ts-nocheck
/**
 * CRUD Store Factory
 *
 * A factory function for creating standardized Pinia stores with CRUD operations.
 * Reduces boilerplate and ensures consistency across features.
 *
 * @example
 * ```ts
 * import { createCrudStore } from '@/shared/lib/store/createCrudStore'
 * import type { Indicator } from './types'
 * import * as indicatorApi from '../api/query'
 * import * as indicatorMutations from '../api/mutations'
 *
 * export const useIndicatorStore = defineStore('indicator', () => {
 *   const crud = createCrudStore<Indicator>({
 *     queryFn: indicatorApi.queryIndicators,
 *     getByIdFn: indicatorApi.getIndicatorById,
 *     createFn: indicatorMutations.createIndicator,
 *     updateFn: indicatorMutations.updateIndicator,
 *     deleteFn: indicatorMutations.deleteIndicator,
 *     entityName: '指标'
 *   })
 *
 *   // Add feature-specific state/actions
 *   const selectedIndicators = ref<number[]>([])
 *
 *   return {
 *     ...crud,
 *     selectedIndicators
 *   }
 * })
 * ```
 */

import { ref, computed, type Ref } from 'vue'

/**
 * Pagination filters interface
 */
export interface PaginationFilters {
  page?: number
  size?: number
  sort?: string
  [key: string]: unknown
}

/**
 * Paginated response interface
 */
export interface PaginatedResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  size: number
  number: number
}

/**
 * List state interface
 */
export interface ListState<T> {
  items: T[]
  total: number
  loading: boolean
  error: string | null
}

/**
 * CRUD Store configuration
 */
export interface CrudStoreConfig<T, CreateDTO, UpdateDTO, Filters = PaginationFilters> {
  /**
   * Query function for fetching lists
   */
  queryFn: (filters?: Filters) => Promise<PaginatedResponse<T>>

  /**
   * Get by ID function
   */
  getByIdFn: (id: number) => Promise<T>

  /**
   * Create function
   */
  createFn: (data: CreateDTO) => Promise<T>

  /**
   * Update function
   */
  updateFn: (id: number, data: UpdateDTO) => Promise<T>

  /**
   * Delete function
   */
  deleteFn: (id: number) => Promise<void>

  /**
   * Entity name for error messages (default: '实体')
   */
  entityName?: string

  /**
   * Initial page size (default: 20)
   */
  defaultPageSize?: number

  /**
   * Auto-refresh after mutations (default: true)
   */
  autoRefresh?: boolean
}

/**
 * Create a CRUD store instance
 */
export function createCrudStore<
  T extends { id: number },
  CreateDTO = Partial<T>,
  UpdateDTO = Partial<T>,
  Filters = PaginationFilters
>(config: CrudStoreConfig<T, CreateDTO, UpdateDTO, Filters>) {
  const {
    queryFn,
    getByIdFn,
    createFn,
    updateFn,
    deleteFn,
    entityName = '实体',
    defaultPageSize = 20,
    autoRefresh = true
  } = config

  // ============ State ============
  const items = ref<T[]>([]) as Ref<T[]>
  const total = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const currentItem = ref<T | null>(null)
  const filters = ref<Filters>({} as Filters)

  // Initialize default pagination
  if (!filters.value.page) {
    filters.value.page = 0
  }
  if (!filters.value.size) {
    filters.value.size = defaultPageSize
  }

  // ============ Computed ============
  const listState = computed<ListState<T>>(() => ({
    items: items.value,
    total: total.value,
    loading: loading.value,
    error: error.value
  }))

  const isEmpty = computed(() => items.value.length === 0 && !loading.value)
  const hasError = computed(() => error.value !== null)
  const hasMore = computed(() => {
    const currentPage = (filters.value.page || 0) + 1
    return currentPage < total.value / (filters.value.size || defaultPageSize)
  })

  // ============ Query Actions ============

  /**
   * Fetch items with filters
   */
  async function fetchItems(newFilters?: Partial<Filters>) {
    loading.value = true
    error.value = null

    try {
      if (newFilters) {
        filters.value = { ...filters.value, ...newFilters }
      }

      const response = await queryFn(filters.value)
      items.value = response.content
      total.value = response.totalElements
    } catch (err) {
      error.value = err instanceof Error ? err.message : `获取${entityName}列表失败`
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch item by ID
   */
  async function fetchById(id: number): Promise<T> {
    loading.value = true
    error.value = null

    try {
      const item = await getByIdFn(id)
      currentItem.value = item
      return item
    } catch (err) {
      error.value = err instanceof Error ? err.message : `获取${entityName}详情失败`
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Refresh current list
   */
  async function refresh() {
    await fetchItems()
  }

  /**
   * Load next page
   */
  async function loadNextPage() {
    if (!hasMore.value || loading.value) {
      return
    }

    const currentPage = filters.value.page || 0
    await fetchItems({ page: currentPage + 1 } as Partial<Filters>)
  }

  /**
   * Load previous page
   */
  async function loadPrevPage() {
    const currentPage = filters.value.page || 0
    if (currentPage <= 0 || loading.value) {
      return
    }

    await fetchItems({ page: currentPage - 1 } as Partial<Filters>)
  }

  /**
   * Go to specific page
   */
  async function goToPage(page: number) {
    if (page < 0 || loading.value) {
      return
    }
    await fetchItems({ page } as Partial<Filters>)
  }

  // ============ Mutation Actions ============

  /**
   * Create new item
   */
  async function create(data: CreateDTO): Promise<T> {
    loading.value = true
    error.value = null

    try {
      const newItem = await createFn(data)
      items.value.unshift(newItem)
      total.value += 1

      if (autoRefresh) {
        await fetchItems()
      }

      return newItem
    } catch (err) {
      error.value = err instanceof Error ? err.message : `创建${entityName}失败`
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Update item
   */
  async function update(id: number, data: UpdateDTO): Promise<T> {
    loading.value = true
    error.value = null

    try {
      const updated = await updateFn(id, data)

      // Update in list
      const index = items.value.findIndex(item => item.id === id)
      if (index !== -1) {
        items.value[index] = updated
      }

      // Update current if it's the same
      if (currentItem.value?.id === id) {
        currentItem.value = updated
      }

      if (autoRefresh) {
        await fetchItems()
      }

      return updated
    } catch (err) {
      error.value = err instanceof Error ? err.message : `更新${entityName}失败`
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete item
   */
  async function remove(id: number): Promise<void> {
    loading.value = true
    error.value = null

    try {
      await deleteFn(id)

      // Remove from list
      items.value = items.value.filter(item => item.id !== id)
      total.value -= 1

      // Clear current if it's the same
      if (currentItem.value?.id === id) {
        currentItem.value = null
      }

      if (autoRefresh) {
        await fetchItems()
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : `删除${entityName}失败`
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Batch delete items
   */
  async function batchRemove(ids: number[]): Promise<void> {
    loading.value = true
    error.value = null

    try {
      await Promise.all(ids.map(id => deleteFn(id)))

      // Remove from list
      items.value = items.value.filter(item => !ids.includes(item.id))
      total.value -= ids.length

      // Clear current if deleted
      if (currentItem.value && ids.includes(currentItem.value.id)) {
        currentItem.value = null
      }

      if (autoRefresh) {
        await fetchItems()
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : `批量删除${entityName}失败`
      throw err
    } finally {
      loading.value = false
    }
  }

  // ============ Filter Actions ============

  /**
   * Apply filters
   */
  function applyFilters(newFilters: Partial<Filters>) {
    filters.value = { ...filters.value, ...newFilters }
  }

  /**
   * Reset filters to defaults
   */
  function resetFilters() {
    filters.value = {
      page: 0,
      size: defaultPageSize
    } as Filters
    items.value = []
    total.value = 0
  }

  /**
   * Clear all filters and fetch
   */
  async function clearAndFetch() {
    resetFilters()
    await fetchItems()
  }

  // ============ Error Handling ============

  /**
   * Clear error state
   */
  function clearError() {
    error.value = null
  }

  /**
   * Retry last operation
   */
  async function retry() {
    clearError()
    await fetchItems()
  }

  // ============ Selection Actions ============

  /**
   * Find item in current list
   */
  function findById(id: number): T | undefined {
    return items.value.find(item => item.id === id)
  }

  /**
   * Check if item exists in list
   */
  function hasItem(id: number): boolean {
    return items.value.some(item => item.id === id)
  }

  return {
    // State
    items,
    total,
    loading,
    error,
    currentItem,
    filters,

    // Computed
    listState,
    isEmpty,
    hasError,
    hasMore,

    // Query Actions
    fetchItems,
    fetchById,
    refresh,
    loadNextPage,
    loadPrevPage,
    goToPage,

    // Mutation Actions
    create,
    update,
    remove,
    batchRemove,

    // Filter Actions
    applyFilters,
    resetFilters,
    clearAndFetch,

    // Error Handling
    clearError,
    retry,

    // Selection Actions
    findById,
    hasItem
  }
}

/**
 * Pinia plugin for persisting CRUD store state
 */
export function persistCrudStore(): void {
  // Add persistence logic if needed
  // This is a placeholder for future enhancement
}

export default createCrudStore
