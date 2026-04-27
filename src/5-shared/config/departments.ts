/**
 * 部门配置文件
 *
 * 为静态配置消费者和测试提供稳定契约。
 * 运行时业务查询仍优先使用 org store 的动态数据。
 */

// 战略发展部（系统管理员，不属于职能部门）
export const STRATEGIC_DEPT = '战略发展部' as const

export const COLLEGES = [
  '马克思主义学院',
  '工学院',
  '计算机学院',
  '商学院',
  '文理学院',
  '艺术与科技学院',
  '航空学院',
  '国际教育学院'
] as const

export const FUNCTIONAL_DEPARTMENTS = [
  '党委办公室 | 党委统战部',
  '纪委办公室',
  '党委组织部 | 党委教师工作部 | 人力资源部',
  '党委宣传部 | 党委网络工作部',
  '党委学生工作部 | 学生工作处',
  '校团委',
  '教务处',
  '科技处',
  '招生工作处',
  '就业创业指导中心',
  '财务部',
  '审计处',
  '保卫处',
  '国有资产与实验室管理处',
  '后勤管理处',
  '信息技术中心',
  '对外交流合作处',
  '图书馆 | 档案馆',
  '发展规划处'
] as const

export const ALL_DEPARTMENTS = [STRATEGIC_DEPT, ...FUNCTIONAL_DEPARTMENTS, ...COLLEGES] as const

export type College = (typeof COLLEGES)[number]
export type FunctionalDepartment = (typeof FUNCTIONAL_DEPARTMENTS)[number]
export type Department = (typeof ALL_DEPARTMENTS)[number]

/**
 * 获取战略发展部名称
 * @deprecated 使用 useOrgStore().getStrategicDeptName()
 */
export function getStrategicDept(): string {
  return STRATEGIC_DEPT
}

/**
 * 获取所有二级学院
 * @deprecated 使用 useOrgStore().getAllCollegeNames()
 */
export function getAllColleges(): string[] {
  return [...COLLEGES]
}

/**
 * 获取所有职能部门（不含战略发展部）
 * @deprecated 使用 useOrgStore().getAllFunctionalDepartmentNames()
 */
export function getAllFunctionalDepartments(): string[] {
  return [...FUNCTIONAL_DEPARTMENTS]
}

/**
 * 获取所有部门（含战略发展部）
 * @deprecated 使用 useOrgStore().getAllDepartmentNames()
 */
export function getAllDepartments(): string[] {
  return [...ALL_DEPARTMENTS]
}

/**
 * 判断是否为战略发展部
 * @deprecated 使用 useOrgStore().isStrategicDept(dept)
 */
export function isStrategicDept(dept: string): boolean {
  return dept === STRATEGIC_DEPT
}

/**
 * 判断是否为职能部门
 * @deprecated 使用 useOrgStore().isFunctionalDept(dept)
 */
export function isFunctionalDept(dept: string): boolean {
  return FUNCTIONAL_DEPARTMENTS.includes(dept as FunctionalDepartment)
}

/**
 * 判断是否为二级学院
 * @deprecated 使用 useOrgStore().isCollege(dept)
 */
export function isCollege(dept: string): boolean {
  return COLLEGES.includes(dept as College)
}

/**
 * 判断是否为有效的部门
 * @deprecated 使用 useOrgStore().getDepartmentByName(dept)
 */
export function isValidDepartment(dept: string): boolean {
  return ALL_DEPARTMENTS.includes(dept as Department)
}
