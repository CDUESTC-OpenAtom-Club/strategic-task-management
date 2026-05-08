/**
 * User Feature Store
 *
 * User management state and operations.
 * Note: Authentication state is managed in @/features/auth/model/store
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, UserRole } from '@/shared/types'
import type { UserListParams } from '../api'
import * as userApi from '../api'
import { logger } from '@/shared/lib/utils/logger'

export const useUserStore = defineStore('user', () => {
  // ============ State ============
  const users = ref<User[]>([])
  const currentUser = ref<User | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)

  // Pagination state
  const currentPage = ref(1)
  const pageSize = ref(10)
  const total = ref(0)

  // ============ Getters ============
  const activeUsers = computed(() => users.value.filter(user => user.status !== 'inactive'))

  const usersByRole = computed(() => {
    const grouped: Record<UserRole, User[]> = {
      strategic_dept: [],
      functional_dept: [],
      secondary_college: []
    }
    users.value.forEach(user => {
      if (user.role) {
        grouped[user.role].push(user)
      }
    })
    return grouped
  })

  const hasMore = computed(() => currentPage.value * pageSize.value < total.value)

  // ============ Actions ============
  const fetchUsers = async (params?: UserListParams) => {
    loading.value = true
    error.value = null

    try {
      const response = await userApi.getUserList({
        page: currentPage.value,
        pageSize: pageSize.value,
        ...params
      })

      users.value = response.list
      total.value = response.total
      currentPage.value = response.page
      pageSize.value = response.pageSize
    } catch (err) {
      error.value = err as Error
      logger.error('Failed to fetch users:', err)
    } finally {
      loading.value = false
    }
  }

  const fetchUserById = async (userId: string | number) => {
    loading.value = true
    error.value = null

    try {
      const user = await userApi.getUserById(userId)
      currentUser.value = user
      return user
    } catch (err) {
      error.value = err as Error
      logger.error('Failed to fetch user:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const createUser = async (userData: userApi.CreateUserInput) => {
    loading.value = true
    error.value = null

    try {
      const newUser = await userApi.createUser(userData)
      users.value.push(newUser)
      total.value += 1
      return newUser
    } catch (err) {
      error.value = err as Error
      logger.error('Failed to create user:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateUser = async (userId: string | number, userData: userApi.UpdateUserInput) => {
    loading.value = true
    error.value = null

    try {
      const updatedUser = await userApi.updateUser(userId, userData)
      const index = users.value.findIndex(u => u.id === userId)
      if (index !== -1) {
        users.value[index] = updatedUser
      }
      if (currentUser.value?.id === userId) {
        currentUser.value = updatedUser
      }
      return updatedUser
    } catch (err) {
      error.value = err as Error
      logger.error('Failed to update user:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteUser = async (userId: string | number) => {
    loading.value = true
    error.value = null

    try {
      await userApi.deleteUser(userId)
      users.value = users.value.filter(u => u.id !== userId)
      total.value -= 1
      if (currentUser.value?.id === userId) {
        currentUser.value = null
      }
    } catch (err) {
      error.value = err as Error
      logger.error('Failed to delete user:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const searchUsers = async (keyword: string) => {
    loading.value = true
    error.value = null

    try {
      const results = await userApi.searchUsers(keyword)
      return results
    } catch (err) {
      error.value = err as Error
      logger.error('Failed to search users:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const setPage = (page: number) => {
    currentPage.value = page
  }

  const setPageSize = (size: number) => {
    pageSize.value = size
    currentPage.value = 1 // Reset to first page
  }

  const clearUsers = () => {
    users.value = []
    currentPage.value = 1
    total.value = 0
  }

  return {
    // State
    users,
    currentUser,
    loading,
    error,
    currentPage,
    pageSize,
    total,

    // Getters
    activeUsers,
    usersByRole,
    hasMore,

    // Actions
    fetchUsers,
    fetchUserById,
    createUser,
    updateUser,
    deleteUser,
    searchUsers,
    setPage,
    setPageSize,
    clearUsers
  }
})
