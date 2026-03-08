/**
 * useDepartmentSwitcher - 部门视角切换 Composable
 *
 * 职责:
 * - 管理当前查看的部门视角
 * - 提供部门选项列表
 * - 处理视角切换逻辑
 * - 更新 authStore 的视角状态
 *
 * @module composables/layout
 */

import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useOrgStore } from '@/stores/org'
import type { UserRole } from '@/types'

/** 部门选项接口 */
export interface DepartmentOption {
  value: string
  label: string
  role: UserRole
}

export function useDepartmentSwitcher() {
  const _router = useRouter()
  const authStore = useAuthStore()
  const orgStore = useOrgStore()

  // 当前查看的视角（战略发展部可以切换，其他部门固定为自己的部门）
  const viewingDept = ref<string>('')

  // 战略发展部名称
  const strategicDeptName = computed(() => orgStore.getStrategicDeptName())

  // 部门选项（战略发展部用户可以切换查看其他部门视角）
  // 从数据库动态获取：战略发展部 + 职能部门 + 二级学院
  const deptOptions = computed<DepartmentOption[]>(() => {
    const options: DepartmentOption[] = []

    // 1. 战略发展部（系统管理员）
    if (orgStore.strategicDept) {
      options.push({
        value: orgStore.strategicDept.name,
        label: orgStore.strategicDept.name,
        role: 'strategic_dept'
      })
    }

    // 2. 职能部门
    orgStore.functionalDepartments.forEach(dept => {
      options.push({
        value: dept.name,
        label: dept.name,
        role: 'functional_dept'
      })
    })

    // 3. 二级学院
    orgStore.colleges.forEach(college => {
      options.push({
        value: college.name,
        label: college.name,
        role: 'secondary_college'
      })
    })

    return options
  })

  // 当前视角对应的角色类型
  const viewingRole = computed<UserRole>(() => {
    // 非战略发展部用户直接返回自己的角色
    if (authStore.userRole !== 'strategic_dept') {
      return authStore.userRole || 'secondary_college'
    }
    const dept = deptOptions.value.find(d => d.value === viewingDept.value)
    return dept?.role || 'strategic_dept'
  })

  // 当前视角对应的部门名称
  const viewingDeptName = computed(() => {
    const dept = deptOptions.value.find(d => d.value === viewingDept.value)
    return dept?.label || strategicDeptName.value
  })

  // 初始化 viewingDept
  watch([() => authStore.user, () => orgStore.loaded], ([user, loaded]) => {
    if (user && loaded && !viewingDept.value) {
      if (authStore.userRole === 'strategic_dept') {
        viewingDept.value = strategicDeptName.value
      } else {
        viewingDept.value = user.department || strategicDeptName.value
      }
    }
  }, { immediate: true })

  // 切换视角时重置到第一个标签页，并更新 authStore 的视角状态
  watch(viewingDept, (newDept) => {
    if (!newDept) {return}

    // 更新 authStore 的视角状态
    if (newDept === strategicDeptName.value) {
      // 切换回战略发展部，重置视角
      authStore.resetViewingAs()
    } else {
      // 切换到其他部门视角
      const dept = deptOptions.value.find(d => d.value === newDept)
      if (dept) {
        authStore.setViewingAs(dept.role, newDept)
      }
    }

    // 导航到第一个可用的tab（由外部传入 tabs）
    // 这里不能直接导入 tabs，会造成循环依赖
    // 由 App.vue 处理导航逻辑
  })

  return {
    viewingDept,
    viewingRole,
    viewingDeptName,
    deptOptions,
    strategicDeptName
  }
}
