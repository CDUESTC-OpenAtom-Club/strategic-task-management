/**
 * Organization Feature Store
 * 
 * Migrated from stores/org.ts
 * Organization and department management
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { logger } from '@/utils/logger'

export interface Department {
  id: number
  name: string
  type: 'strategic_dept' | 'functional_dept' | 'secondary_college'
  sortOrder: number
  parentId?: number
}

export const useOrganizationStore = defineStore('organization', () => {
  // ============ State ============
  const departments = ref<Department[]>([])
  const loading = ref(false)
  const loaded = ref(false)

  // ============ Getters ============
  const strategicDept = computed(() => 
    departments.value.find(d => d.type === 'strategic_dept')
  )

  const functionalDepartments = computed(() => 
    departments.value.filter(d => d.type === 'functional_dept')
      .sort((a, b) => a.sortOrder - b.sortOrder)
  )

  const colleges = computed(() => 
    departments.value.filter(d => d.type === 'secondary_college')
      .sort((a, b) => a.sortOrder - b.sortOrder)
  )

  const allDepartments = computed(() => 
    departments.value.sort((a, b) => {
      const typeOrder = { strategic_dept: 1, functional_dept: 2, secondary_college: 3 }
      const typeCompare = typeOrder[a.type] - typeOrder[b.type]
      if (typeCompare !== 0) {return typeCompare}
      return a.sortOrder - b.sortOrder
    })
  )

  // ============ Actions ============
  const loadDepartments = async (retryCount = 0, maxRetries = 2) => {
    if (loaded.value && departments.value.length > 0) {
      return
    }

    loading.value = true

    try {
      // 动态导入 API
      const { orgApi } = await import('@/api')
      const depts = await orgApi.getAllDepartments()

      if (depts.length === 0 && retryCount < maxRetries) {
        loading.value = false
        await new Promise(resolve => setTimeout(resolve, 1000))
        return loadDepartments(retryCount + 1, maxRetries)
      }

      departments.value = depts
      loaded.value = true
      logger.info(`[Organization Store] Loaded ${depts.length} departments`)
    } catch (error) {
      if (retryCount < maxRetries) {
        loading.value = false
        await new Promise(resolve => setTimeout(resolve, 1000))
        return loadDepartments(retryCount + 1, maxRetries)
      }

      logger.error('[Organization Store] Failed to load departments:', error)
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  // 工具函数
  const isStrategicDept = (deptName: string): boolean => {
    return departments.value.some(d => d.name === deptName && d.type === 'strategic_dept')
  }

  const isFunctionalDept = (deptName: string): boolean => {
    return departments.value.some(d => d.name === deptName && d.type === 'functional_dept')
  }

  const isCollege = (deptName: string): boolean => {
    return departments.value.some(d => d.name === deptName && d.type === 'secondary_college')
  }

  const getDepartmentByName = (name: string): Department | undefined => {
    return departments.value.find(d => d.name === name)
  }

  const getStrategicDeptName = (): string => {
    return strategicDept.value?.name || '战略发展部'
  }

  const getAllFunctionalDepartmentNames = (): string[] => {
    return functionalDepartments.value.map(d => d.name)
  }

  const getAllCollegeNames = (): string[] => {
    return colleges.value.map(d => d.name)
  }

  const getAllDepartmentNames = (): string[] => {
    return allDepartments.value.map(d => d.name)
  }

  return {
    // State
    departments,
    loading,
    loaded,

    // Getters
    strategicDept,
    functionalDepartments,
    colleges,
    allDepartments,

    // Actions
    loadDepartments,
    isStrategicDept,
    isFunctionalDept,
    isCollege,
    getDepartmentByName,
    getStrategicDeptName,
    getAllFunctionalDepartmentNames,
    getAllCollegeNames,
    getAllDepartmentNames
  }
})

// Backward compatibility alias
export const useOrgStore = useOrganizationStore
