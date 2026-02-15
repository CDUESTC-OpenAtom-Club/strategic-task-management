/**
 * 时间上下文状态管理
 * 控制全局时间轴，实现历史快照模式和工作模式切换
 * 
 * 核心概念：
 * - realCurrentYear: 真实年份（实时动态捕捉，如 2026）
 * - currentYear: 当前选中的工作年份（默认为真实年份，用户可切换）
 * 
 * 设计说明：
 * 1. 系统默认工作在真实年份（动态获取电脑当前年份）
 * 2. 用户切换年份后，选择会持久化到 localStorage
 * 3. 刷新页面后，会恢复到用户上次选择的年份
 * 4. 如果跨年（真实年份变化），自动切换到新的真实年份
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useTimeContextStore = defineStore('timeContext', () => {
  // 计算当前真实年份（实时动态捕捉）
  const realCurrentYear = computed(() => new Date().getFullYear())

  // 获取当前真实年份
  const currentRealYear = new Date().getFullYear()
  
  // 从 localStorage 读取上次选择的年份
  const savedYear = localStorage.getItem('strategic-current-year')
  const savedRealYear = localStorage.getItem('strategic-real-year')
  
  // 初始年份逻辑：
  // 1. 如果没有保存过真实年份（首次使用或旧版本升级），使用当前真实年份
  // 2. 如果跨年了（保存的真实年份 !== 当前真实年份），自动切换到当前真实年份
  // 3. 如果保存的年份不在合理范围内（比当前年份小太多或大太多），重置为当前真实年份
  // 4. 否则使用保存的年份
  let initialYear: number
  const savedYearNum = savedYear ? parseInt(savedYear, 10) : null
  const savedRealYearNum = savedRealYear ? parseInt(savedRealYear, 10) : null
  
  // 检查是否需要重置到当前真实年份
  const needReset = 
    !savedRealYearNum || // 没有保存过真实年份（旧版本升级）
    savedRealYearNum !== currentRealYear || // 跨年了
    !savedYearNum || // 没有保存过选择的年份
    savedYearNum < currentRealYear - 5 || // 保存的年份太旧
    savedYearNum > currentRealYear + 1 // 保存的年份太新
  
  if (needReset) {
    // 重置到当前真实年份
    initialYear = currentRealYear
    localStorage.setItem('strategic-current-year', currentRealYear.toString())
  } else {
    initialYear = savedYearNum!
  }
  
  // 始终保存当前真实年份，用于下次检测是否跨年
  localStorage.setItem('strategic-real-year', currentRealYear.toString())

  // 当前选中的年份（默认为当前真实年份，或用户上次选择的年份）
  const currentYear = ref<number>(initialYear)

  // 可用年份列表（从后端获取或本地生成）
  const availableYears = ref<number[]>([])

  // 是否正在加载数据
  const loading = ref(false)

  // 加载错误信息
  const error = ref<string | null>(null)

  // 是否为只读模式（历史年份）
  const isReadOnly = computed(() => currentYear.value < realCurrentYear.value)

  // 是否为当前年份
  const isCurrentYear = computed(() => currentYear.value === realCurrentYear.value)

  // 是否为未来年份
  const isFutureYear = computed(() => currentYear.value > realCurrentYear.value)

  // 年份显示标签
  const yearLabel = computed(() => {
    if (isReadOnly.value) {
      return `${currentYear.value}年度（历史快照）`
    }
    if (isFutureYear.value) {
      return `${currentYear.value}年度（规划中）`
    }
    return `${currentYear.value}年度`
  })

  /**
   * 初始化可用年份列表
   * 动态基于真实年份生成：真实年份前 5 年 + 真实年份 + 真实年份后 1 年
   * 例如：真实年份 2026，则生成 [2021, 2022, 2023, 2024, 2025, 2026, 2027]
   */
  function initAvailableYears() {
    const current = realCurrentYear.value // 实时获取真实年份
    const years: number[] = []

    // 往前5年 + 当前真实年 + 往后1年
    for (let i = current - 5; i <= current + 1; i++) {
      years.push(i)
    }

    availableYears.value = years
  }

  /**
   * 切换年份
   * @param year 目标年份
   * @returns 是否切换成功
   */
  async function switchYear(year: number): Promise<boolean> {
    if (year === currentYear.value) {
      return true
    }

    if (!availableYears.value.includes(year)) {
      error.value = '无效的年份'
      return false
    }

    loading.value = true
    error.value = null

    try {
      // 更新当前年份
      currentYear.value = year

      // 持久化到 localStorage，刷新页面后能恢复
      localStorage.setItem('strategic-current-year', year.toString())

      // TODO: 触发数据重新加载
      // 这里会触发其他 Store 的 watch 监听器重新加载数据

      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : '切换年份失败'
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取年份的显示状态
   */
  function getYearStatus(year: number): 'history' | 'current' | 'future' {
    const current = realCurrentYear.value
    if (year < current) return 'history'
    if (year > current) return 'future'
    return 'current'
  }

  /**
   * 重置到当前年份
   */
  function resetToCurrentYear() {
    switchYear(realCurrentYear.value)
  }

  // 初始化
  initAvailableYears()

  return {
    // State
    currentYear,
    availableYears,
    loading,
    error,

    // Computed
    realCurrentYear,
    isReadOnly,
    isCurrentYear,
    isFutureYear,
    yearLabel,

    // Actions
    initAvailableYears,
    switchYear,
    getYearStatus,
    resetToCurrentYear
  }
})
