/**
 * 组织机构 Store
 * 管理部门数据，从数据库动态加载
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import orgApi, { type Department } from '@/api/org'

export const useOrgStore = defineStore('org', () => {
  // State
  const departments = ref<Department[]>([])
  const loading = ref(false)
  const loaded = ref(false)

  // Getters
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
      // 排序：战略发展部 > 职能部门 > 二级学院
      const typeOrder = { strategic_dept: 1, functional_dept: 2, secondary_college: 3 }
      const typeCompare = typeOrder[a.type] - typeOrder[b.type]
      if (typeCompare !== 0) {return typeCompare}
      return a.sortOrder - b.sortOrder
    })
  )

  // Actions
  const loadDepartments = async (retryCount = 0, maxRetries = 2) => {
    if (loaded.value && departments.value.length > 0) {
      return
    }

    loading.value = true
    const attemptNum = retryCount + 1

    try {
      const depts = await orgApi.getAllDepartments()

      // 如果没有数据且还有重试次数，则重试
      if (depts.length === 0 && retryCount < maxRetries) {
        loading.value = false
        await new Promise(resolve => setTimeout(resolve, 1000))
        return loadDepartments(retryCount + 1, maxRetries)
      }

      departments.value = depts
      loaded.value = true
    } catch (error) {
      // 如果还有重试次数，则重试
      if (retryCount < maxRetries) {
        loading.value = false
        await new Promise(resolve => setTimeout(resolve, 1000))
        return loadDepartments(retryCount + 1, maxRetries)
      }

      // 所有重试都失败，标记为已尝试
      loaded.value = true
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  // 工具函数
  const isStrategicDept = (deptName: string): boolean => {
    // 如果 departments 已加载，使用精确匹配
    if (departments.value.length > 0) {
      return departments.value.some(d => d.name === deptName && d.type === 'strategic_dept')
    }
    // 降级：使用名称判断
    return deptName === '战略发展部'
  }

  const isFunctionalDept = (deptName: string): boolean => {
    // 如果 departments 已加载，使用精确匹配
    if (departments.value.length > 0) {
      return departments.value.some(d => d.name === deptName && d.type === 'functional_dept')
    }
    // 降级：职能部门通常包含"处"、"部"、"办公室"、"中心"、"馆"等后缀
    const functionalSuffixes = ['处', '部', '办公室', '中心', '馆']
    return deptName ? functionalSuffixes.some(suffix => deptName.includes(suffix)) && !deptName.includes('学院') : false
  }

  const isCollege = (deptName: string): boolean => {
    // 如果 departments 已加载，使用精确匹配
    if (departments.value.length > 0) {
      return departments.value.some(d => d.name === deptName && d.type === 'secondary_college')
    }
    // 降级：如果 departments 未加载，使用名称判断
    return deptName ? deptName.includes('学院') : false
  }

  const getDepartmentByName = (name: string): Department | undefined => {
    return departments.value.find(d => d.name === name)
  }

  // 获取部门名称列表（用于兼容旧代码）
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

    // 兼容旧代码的辅助函数
    getStrategicDeptName,
    getAllFunctionalDepartmentNames,
    getAllCollegeNames,
    getAllDepartmentNames
  }
})
