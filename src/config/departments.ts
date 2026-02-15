/**
 * 部门配置文件 - 兼容层
 * 
 * ⚠️ 已废弃：此文件仅作为兼容层保留
 * 新代码请使用 @/stores/org 从数据库动态获取部门数据
 * 
 * 系统三级权限结构：
 * 1. 战略发展部 (strategic_dept) - 系统管理员，最高权限
 * 2. 职能部门 (functional_dept) - 中层管理，指标发布与审批
 * 3. 二级学院 (secondary_college) - 基层单位，进度填报
 * 
 * 迁移指南：
 * - 使用 useOrgStore() 替代此文件的函数
 * - getAllColleges() → useOrgStore().getAllCollegeNames()
 * - getAllFunctionalDepartments() → useOrgStore().getAllFunctionalDepartmentNames()
 * - getAllDepartments() → useOrgStore().getAllDepartmentNames()
 * - isCollege(name) → useOrgStore().isCollege(name)
 */

import { useOrgStore } from '@/stores/org'

// 战略发展部（系统管理员，不属于职能部门）
export const STRATEGIC_DEPT = '战略发展部' as const

// 类型定义（保留用于类型兼容）
export type College = string
export type FunctionalDepartment = string
export type Department = string

// 导出常量（用于向后兼容，但数据来自数据库）
export const COLLEGES: readonly string[] = []
export const FUNCTIONAL_DEPARTMENTS: readonly string[] = []
export const ALL_DEPARTMENTS: readonly string[] = []

/**
 * 获取战略发展部名称
 * @deprecated 使用 useOrgStore().getStrategicDeptName()
 */
export function getStrategicDept(): string {
  const orgStore = useOrgStore()
  return orgStore.getStrategicDeptName()
}

/**
 * 获取所有二级学院
 * @deprecated 使用 useOrgStore().getAllCollegeNames()
 */
export function getAllColleges(): string[] {
  const orgStore = useOrgStore()
  return orgStore.getAllCollegeNames()
}

/**
 * 获取所有职能部门（不含战略发展部）
 * @deprecated 使用 useOrgStore().getAllFunctionalDepartmentNames()
 */
export function getAllFunctionalDepartments(): string[] {
  const orgStore = useOrgStore()
  return orgStore.getAllFunctionalDepartmentNames()
}

/**
 * 获取所有部门（含战略发展部）
 * @deprecated 使用 useOrgStore().getAllDepartmentNames()
 */
export function getAllDepartments(): string[] {
  const orgStore = useOrgStore()
  return orgStore.getAllDepartmentNames()
}

/**
 * 判断是否为战略发展部
 * @deprecated 使用 useOrgStore().isStrategicDept(dept)
 */
export function isStrategicDept(dept: string): boolean {
  const orgStore = useOrgStore()
  return orgStore.isStrategicDept(dept)
}

/**
 * 判断是否为职能部门
 * @deprecated 使用 useOrgStore().isFunctionalDept(dept)
 */
export function isFunctionalDept(dept: string): boolean {
  const orgStore = useOrgStore()
  return orgStore.isFunctionalDept(dept)
}

/**
 * 判断是否为二级学院
 * @deprecated 使用 useOrgStore().isCollege(dept)
 */
export function isCollege(dept: string): boolean {
  const orgStore = useOrgStore()
  return orgStore.isCollege(dept)
}

/**
 * 判断是否为有效的部门
 * @deprecated 使用 useOrgStore().getDepartmentByName(dept)
 */
export function isValidDepartment(dept: string): boolean {
  const orgStore = useOrgStore()
  return orgStore.getDepartmentByName(dept) !== undefined
}
