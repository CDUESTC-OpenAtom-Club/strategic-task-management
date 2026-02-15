/**
 * Plan Store
 * 新数据结构: Plan -> Task -> Indicator -> IndicatorFill
 *
 * 管理 Plan（计划）相关的状态和操作
 * Plan 是顶层容器，包含多个 Task，Task 包含多个 Indicator
 */
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type {
  Plan,
  PlanStatus,
  PlanFill,
  PlanFillStatus,
  Indicator,
  IndicatorFill,
  IndicatorFillForm,
  PlanSubmitForm,
  AuditForm
} from '@/types'
import { planApi, indicatorFillApi, planFillApi } from '@/api/plan'
import { useAuthStore } from './auth'
import { useTimeContextStore } from './timeContext'
import { logger } from '@/utils/logger'
import { ElMessage } from 'element-plus'

export const usePlanStore = defineStore('plan', () => {
  // ============ State ============
  const plans = ref<Plan[]>([])
  const currentPlan = ref<Plan | null>(null)

  // PlanFill 状态（提交记录）
  const planFills = ref<PlanFill[]>([])
  const currentPlanFill = ref<PlanFill | null>(null)

  // 当前正在编辑的指标填报记录
  const currentIndicatorFill = ref<IndicatorFill | null>(null)

  // Loading 状态
  const loading = ref(false)
  const submitting = ref(false)
  const error = ref<string | null>(null)

  // 筛选状态
  const filterStatus = ref<PlanStatus | 'all'>('all')
  const filterOrgId = ref<number | string | null>(null)

  // ============ Getters ============

  // 根据状态筛选的 Plan
  const filteredPlans = computed(() => {
    let result = plans.value

    if (filterStatus.value !== 'all') {
      result = result.filter(p => p.status === filterStatus.value)
    }

    if (filterOrgId.value) {
      result = result.filter(p => p.org_id === filterOrgId.value)
    }

    return result
  })

  // 根据用户权限可见的 Plan
  const visiblePlans = computed(() => {
    const authStore = useAuthStore()
    const userOrgId = authStore.user?.orgId || authStore.user?.department

    // 战略部门可以看到所有 Plan
    if (authStore.user?.role === 'strategic_dept') {
      return filteredPlans.value
    }

    // 其他部门只能看到自己的 Plan
    return filteredPlans.value.filter(p => p.org_id === userOrgId)
  })

  // 获取指定 ID 的 Plan
  const getPlanById = (id: number | string) => {
    return plans.value.find(p => p.id === id)
  }

  // 获取 Plan 的所有提交记录
  const getPlanFillsByPlanId = (planId: number | string) => {
    return planFills.value.filter(pf => pf.plan_id === planId)
  }

  // 获取待审核的提交记录
  const pendingPlanFills = computed(() => {
    return planFills.value.filter(pf => pf.status === 'submitted')
  })

  // 根据筛选器获取可见的待审核记录
  const visiblePendingFills = computed(() => {
    const authStore = useAuthStore()

    // 战略部门可以看到所有待审核记录
    if (authStore.user?.role === 'strategic_dept') {
      return pendingPlanFills.value
    }

    // 职能部门只能看到下级学院提交的记录
    // 这里需要根据业务逻辑进一步筛选
    return pendingPlanFills.value
  })

  // 获取指定指标的所有填报历史
  const getIndicatorFillsByIndicatorId = (indicatorId: number | string) => {
    const fills: IndicatorFill[] = []

    planFills.value.forEach(planFill => {
      planFill.fills.forEach(fill => {
        if (fill.indicator_id === indicatorId) {
          fills.push(fill)
        }
      })
    })

    return fills.sort((a, b) => {
      return new Date(b.fill_date).getTime() - new Date(a.fill_date).getTime()
    })
  }

  // 获取指定指标的最新填报记录
  const getLatestIndicatorFill = (indicatorId: number | string) => {
    const fills = getIndicatorFillsByIndicatorId(indicatorId)
    return fills.length > 0 ? fills[0] : null
  }

  // 检查 Plan 是否可以提交
  const canSubmitPlan = (planId: number | string) => {
    const plan = getPlanById(planId)
    if (!plan) return false

    // 检查状态：只有 draft 或 pending 状态可以提交
    if (plan.status !== 'draft' && plan.status !== 'pending') {
      return false
    }

    // TODO: 检查所有指标是否都已填报
    // 这里需要根据业务规则实现

    return true
  }

  // ============ Actions ============

  /**
   * 加载所有 Plan
   */
  const loadPlans = async () => {
    loading.value = true
    error.value = null

    try {
      logger.info('[Plan Store] Loading plans...')
      const response = await planApi.getAllPlans()

      if (response.success && response.data) {
        plans.value = response.data
        logger.info(`[Plan Store] Loaded ${response.data.length} plans`)
      } else {
        plans.value = []
        logger.warn('[Plan Store] No plans loaded')
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载计划失败'
      logger.error('[Plan Store] Failed to load plans:', err)
      ElMessage.error('加载计划失败')
    } finally {
      loading.value = false
    }
  }

  /**
   * 根据 org_id 加载 Plan
   */
  const loadPlansByOrg = async (orgId: number | string) => {
    loading.value = true
    error.value = null

    try {
      logger.info(`[Plan Store] Loading plans for org ${orgId}...`)
      const response = await planApi.getPlansByOrg(orgId)

      if (response.success && response.data) {
        plans.value = response.data
        logger.info(`[Plan Store] Loaded ${response.data.length} plans for org ${orgId}`)
      } else {
        plans.value = []
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载计划失败'
      logger.error('[Plan Store] Failed to load plans by org:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 加载单个 Plan 详情
   */
  const loadPlan = async (planId: number | string) => {
    loading.value = true
    error.value = null

    try {
      logger.info(`[Plan Store] Loading plan ${planId}...`)
      const response = await planApi.getPlanById(planId)

      if (response.success && response.data) {
        currentPlan.value = response.data

        // 更新 plans 列表中的对应项
        const index = plans.value.findIndex(p => p.id === planId)
        if (index !== -1) {
          plans.value[index] = response.data
        } else {
          plans.value.push(response.data)
        }

        logger.info(`[Plan Store] Loaded plan ${planId}`)
      } else {
        currentPlan.value = null
        error.value = '计划不存在'
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载计划失败'
      logger.error('[Plan Store] Failed to load plan:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 创建 Plan
   */
  const createPlan = async (data: Partial<Plan>) => {
    loading.value = true
    error.value = null

    try {
      logger.info('[Plan Store] Creating plan...', data)
      const response = await planApi.createPlan(data)

      if (response.success && response.data) {
        plans.value.push(response.data)
        ElMessage.success('创建成功')
        return response.data
      } else {
        throw new Error(response.message || '创建失败')
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '创建计划失败'
      logger.error('[Plan Store] Failed to create plan:', err)
      ElMessage.error(error.value)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 更新 Plan
   */
  const updatePlan = async (planId: number | string, data: Partial<Plan>) => {
    loading.value = true
    error.value = null

    try {
      logger.info(`[Plan Store] Updating plan ${planId}...`, data)
      const response = await planApi.updatePlan(planId, data)

      if (response.success && response.data) {
        // 更新 plans 列表
        const index = plans.value.findIndex(p => p.id === planId)
        if (index !== -1) {
          plans.value[index] = response.data
        }
        // 更新 currentPlan
        if (currentPlan.value?.id === planId) {
          currentPlan.value = response.data
        }
        ElMessage.success('更新成功')
        return response.data
      } else {
        throw new Error(response.message || '更新失败')
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '更新计划失败'
      logger.error('[Plan Store] Failed to update plan:', err)
      ElMessage.error(error.value)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 删除 Plan
   */
  const deletePlan = async (planId: number | string) => {
    loading.value = true
    error.value = null

    try {
      logger.info(`[Plan Store] Deleting plan ${planId}...`)
      const response = await planApi.deletePlan(planId)

      if (response.success) {
        // 从 plans 列表中移除
        const index = plans.value.findIndex(p => p.id === planId)
        if (index !== -1) {
          plans.value.splice(index, 1)
        }
        // 清除 currentPlan
        if (currentPlan.value?.id === planId) {
          currentPlan.value = null
        }
        ElMessage.success('删除成功')
      } else {
        throw new Error(response.message || '删除失败')
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '删除计划失败'
      logger.error('[Plan Store] Failed to delete plan:', err)
      ElMessage.error(error.value)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 提交 Plan（整包提交）
   */
  const submitPlan = async (form: PlanSubmitForm) => {
    submitting.value = true
    error.value = null

    try {
      logger.info(`[Plan Store] Submitting plan ${form.plan_id}...`)
      const response = await planApi.submitPlan(form)

      if (response.success && response.data) {
        // 更新 Plan 状态为 pending
        await updatePlan(form.plan_id, { status: 'pending' })

        // 添加到 planFills 列表
        planFills.value.push(response.data)

        ElMessage.success('提交成功')
        return response.data
      } else {
        throw new Error(response.message || '提交失败')
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '提交计划失败'
      logger.error('[Plan Store] Failed to submit plan:', err)
      ElMessage.error(error.value)
      throw err
    } finally {
      submitting.value = false
    }
  }

  /**
   * 加载 Plan 的提交记录
   */
  const loadPlanFills = async (planId: number | string) => {
    loading.value = true
    error.value = null

    try {
      logger.info(`[Plan Store] Loading fills for plan ${planId}...`)
      const response = await planFillApi.getPlanFills(planId)

      if (response.success && response.data) {
        // 更新或添加到 planFills 列表
        response.data.forEach(planFill => {
          const index = planFills.value.findIndex(pf => pf.id === planFill.id)
          if (index !== -1) {
            planFills.value[index] = planFill
          } else {
            planFills.value.push(planFill)
          }
        })

        logger.info(`[Plan Store] Loaded ${response.data.length} fills for plan ${planId}`)
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载提交记录失败'
      logger.error('[Plan Store] Failed to load plan fills:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 加载待审核的提交记录
   */
  const loadPendingFills = async () => {
    loading.value = true
    error.value = null

    try {
      logger.info('[Plan Store] Loading pending fills...')
      const authStore = useAuthStore()
      const response = await planFillApi.getPendingPlanFills(authStore.user?.orgId)

      if (response.success && response.data) {
        planFills.value = response.data
        logger.info(`[Plan Store] Loaded ${response.data.length} pending fills`)
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载待审核记录失败'
      logger.error('[Plan Store] Failed to load pending fills:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 审核 PlanFill
   */
  const auditPlanFill = async (fillId: number | string, form: AuditForm) => {
    submitting.value = true
    error.value = null

    try {
      logger.info(`[Plan Store] Auditing fill ${fillId}...`, form)
      const response = await planFillApi.auditPlanFill(fillId, form)

      if (response.success && response.data) {
        // 更新 planFills 列表
        const index = planFills.value.findIndex(pf => pf.id === fillId)
        if (index !== -1) {
          planFills.value[index] = response.data
        }

        const actionText = form.action === 'approve' ? '审核通过' : '已驳回'
        ElMessage.success(actionText)
        return response.data
      } else {
        throw new Error(response.message || '审核失败')
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '审核失败'
      logger.error('[Plan Store] Failed to audit fill:', err)
      ElMessage.error(error.value)
      throw err
    } finally {
      submitting.value = false
    }
  }

  /**
   * 保存指标填报记录
   */
  const saveIndicatorFill = async (form: IndicatorFillForm) => {
    submitting.value = true
    error.value = null

    try {
      logger.info(`[Plan Store] Saving fill for indicator ${form.indicator_id}...`)
      const response = await indicatorFillApi.saveFill(form)

      if (response.success && response.data) {
        currentIndicatorFill.value = response.data
        ElMessage.success('保存成功')
        return response.data
      } else {
        throw new Error(response.message || '保存失败')
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '保存失败'
      logger.error('[Plan Store] Failed to save fill:', err)
      ElMessage.error(error.value)
      throw err
    } finally {
      submitting.value = false
    }
  }

  /**
   * 加载指标的填报历史
   */
  const loadIndicatorFillHistory = async (indicatorId: number | string) => {
    loading.value = true
    error.value = null

    try {
      logger.info(`[Plan Store] Loading fill history for indicator ${indicatorId}...`)
      const response = await indicatorFillApi.getIndicatorFillHistory(indicatorId)

      if (response.success && response.data) {
        return response.data
      }
      return []
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载填报历史失败'
      logger.error('[Plan Store] Failed to load fill history:', err)
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * 设置筛选条件
   */
  const setFilter = (status: PlanStatus | 'all', orgId?: number | string | null) => {
    filterStatus.value = status
    if (orgId !== undefined) {
      filterOrgId.value = orgId
    }
  }

  /**
   * 重置筛选条件
   */
  const resetFilter = () => {
    filterStatus.value = 'all'
    filterOrgId.value = null
  }

  /**
   * 清空当前 Plan
   */
  const clearCurrentPlan = () => {
    currentPlan.value = null
  }

  /**
   * 清空当前填报记录
   */
  const clearCurrentIndicatorFill = () => {
    currentIndicatorFill.value = null
  }

  // ============ 时间上下文监听 ============
  // 当年份变化时，重新加载数据
  const timeContext = useTimeContextStore()
  watch(
    () => timeContext.currentYear,
    (newYear) => {
      logger.info(`[Plan Store] Year changed to ${newYear}, reloading plans...`)
      loadPlans()
    }
  )

  // 初始化：加载 Plan 数据
  loadPlans()

  return {
    // State
    plans,
    currentPlan,
    planFills,
    currentPlanFill,
    currentIndicatorFill,
    loading,
    submitting,
    error,
    filterStatus,
    filterOrgId,

    // Getters
    filteredPlans,
    visiblePlans,
    pendingPlanFills,
    visiblePendingFills,
    getPlanById,
    getPlanFillsByPlanId,
    getIndicatorFillsByIndicatorId,
    getLatestIndicatorFill,
    canSubmitPlan,

    // Actions
    loadPlans,
    loadPlansByOrg,
    loadPlan,
    createPlan,
    updatePlan,
    deletePlan,
    submitPlan,
    loadPlanFills,
    loadPendingFills,
    auditPlanFill,
    saveIndicatorFill,
    loadIndicatorFillHistory,
    setFilter,
    resetFilter,
    clearCurrentPlan,
    clearCurrentIndicatorFill
  }
})
