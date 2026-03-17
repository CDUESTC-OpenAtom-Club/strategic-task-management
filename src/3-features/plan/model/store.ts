/**
 * Plan Feature Store
 *
 * Migrated from stores/plan.ts
 * Plan management state (Plan -> Task -> Indicator -> IndicatorFill)
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Plan, PlanStatus, PlanFill, IndicatorFill } from '@/5-shared/types'
import { useAuthStore } from '@/3-features/auth/model/store'
import { useTimeContextStore } from '@/5-shared/lib/timeContext'
import { logger } from '@/5-shared/lib/utils/logger'
import { ElMessage } from 'element-plus'

function hasApiData<T>(response: { success?: boolean; code?: number; data?: T | null }) {
  return (
    (response.success ?? response.code === 200) &&
    response.data !== undefined &&
    response.data !== null
  )
}

export const usePlanStore = defineStore('plan', () => {
  // ============ State ============
  const plans = ref<Plan[]>([])
  const currentPlan = ref<Plan | null>(null)
  const planFills = ref<PlanFill[]>([])
  const currentPlanFill = ref<PlanFill | null>(null)
  const currentIndicatorFill = ref<IndicatorFill | null>(null)

  const loading = ref(false)
  const submitting = ref(false)
  const error = ref<string | null>(null)

  const filterStatus = ref<PlanStatus | 'all'>('all')
  const filterOrgId = ref<number | string | null>(null)

  // ============ Getters ============
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

  const visiblePlans = computed(() => {
    const authStore = useAuthStore()
    const userOrgId = authStore.user?.orgId || authStore.user?.department

    if (authStore.user?.role === 'strategic_dept') {
      return filteredPlans.value
    }

    return filteredPlans.value.filter(p => p.org_id === userOrgId)
  })

  const getPlanById = (id: number | string) => {
    return plans.value.find(p => p.id === id)
  }

  const pendingPlanFills = computed(() => {
    return planFills.value.filter(pf => pf.status === 'submitted')
  })

  const visiblePendingFills = computed(() => {
    const authStore = useAuthStore()
    const userId = authStore.user?.id

    if (!userId || authStore.user?.role === 'strategic_dept') {
      return pendingPlanFills.value
    }

    return pendingPlanFills.value.filter(fill => fill.submitted_by !== userId)
  })

  // ============ Actions ============
  const loadPlans = async () => {
    loading.value = true
    error.value = null

    try {
      logger.info('[Plan Store] Loading plans...')
      const { planApi } = await import('@/3-features/plan/api/planApi')
      const response = await planApi.getAllPlans()

      if (hasApiData(response)) {
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

  const loadPlan = async (planId: number | string) => {
    loading.value = true
    error.value = null

    try {
      logger.info(`[Plan Store] Loading plan ${planId}...`)
      const { planApi } = await import('@/3-features/plan/api/planApi')
      const response = await planApi.getPlanById(planId)

      if (hasApiData(response)) {
        currentPlan.value = response.data
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

  const createPlan = async (data: Partial<Plan>) => {
    loading.value = true
    error.value = null

    try {
      logger.info('[Plan Store] Creating plan...', data)
      const { planApi } = await import('@/3-features/plan/api/planApi')
      const response = await planApi.createPlan(data)

      if (hasApiData(response)) {
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

  const updatePlan = async (planId: number | string, data: Partial<Plan>) => {
    loading.value = true
    error.value = null

    try {
      logger.info(`[Plan Store] Updating plan ${planId}...`, data)
      const { planApi } = await import('@/3-features/plan/api/planApi')
      const response = await planApi.updatePlan(planId, data)

      if (hasApiData(response)) {
        const index = plans.value.findIndex(p => p.id === planId)
        if (index !== -1) {
          plans.value[index] = response.data
        }
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

  const deletePlan = async (planId: number | string) => {
    loading.value = true
    error.value = null

    try {
      logger.info(`[Plan Store] Deleting plan ${planId}...`)
      const { planApi } = await import('@/3-features/plan/api/planApi')
      const response = await planApi.deletePlan(planId)

      if (response.success ?? response.code === 200) {
        const index = plans.value.findIndex(p => p.id === planId)
        if (index !== -1) {
          plans.value.splice(index, 1)
        }
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

  const setFilter = (status: PlanStatus | 'all', orgId?: number | string | null) => {
    filterStatus.value = status
    if (orgId !== undefined) {
      filterOrgId.value = orgId
    }
  }

  const resetFilter = () => {
    filterStatus.value = 'all'
    filterOrgId.value = null
  }

  const clearCurrentPlan = () => {
    currentPlan.value = null
  }

  const submitPlan = async (form: { plan_id: number | string; comment?: string }) => {
    submitting.value = true
    error.value = null

    try {
      logger.info('[Plan Store] Submitting plan...', form)
      const { planApi } = await import('@/3-features/plan/api/planApi')
      const response = await planApi.submitPlan(form)

      if (hasApiData(response)) {
        planFills.value.unshift(response.data)
        await loadPlans()
        ElMessage.success('提交成功')
        return response.data
      }

      throw new Error(response.message || '提交失败')
    } catch (err) {
      error.value = err instanceof Error ? err.message : '提交计划失败'
      logger.error('[Plan Store] Failed to submit plan:', err)
      ElMessage.error(error.value)
      throw err
    } finally {
      submitting.value = false
    }
  }

  const loadPendingFills = async () => {
    loading.value = true
    error.value = null

    try {
      logger.info('[Plan Store] Loading pending plan fills...')
      const { planFillApi } = await import('@/3-features/plan/api/planApi')
      const authStore = useAuthStore()
      const response = await planFillApi.getPendingPlanFills(authStore.user?.id)

      if (hasApiData(response)) {
        planFills.value = response.data
        logger.info(`[Plan Store] Loaded ${response.data.length} pending fills`)
      } else {
        planFills.value = []
        logger.warn('[Plan Store] No pending fills loaded')
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载待审核列表失败'
      planFills.value = []
      logger.error('[Plan Store] Failed to load pending plan fills:', err)
      ElMessage.error('加载待审核列表失败')
    } finally {
      loading.value = false
    }
  }

  // 审核计划填报
  const auditPlanFill = async (
    fillId: number | string,
    form: {
      action: 'approve' | 'reject' | 'return'
      comment?: string
      userId?: number
    }
  ) => {
    submitting.value = true
    error.value = null

    try {
      logger.info(`[Plan Store] Auditing plan fill ${fillId}...`, form)
      const { planFillApi } = await import('@/3-features/plan/api/planApi')
      const authStore = useAuthStore()
      const response = await planFillApi.auditPlanFill(fillId, {
        ...form,
        userId: form.userId ?? Number(authStore.user?.id ?? 0)
      })

      if (hasApiData(response)) {
        // 更新本地状态
        const index = planFills.value.findIndex(pf => pf.id === fillId)
        if (index !== -1) {
          planFills.value[index] = response.data
        }
        if (currentPlanFill.value?.id === fillId) {
          currentPlanFill.value = response.data
        }

        ElMessage.success(form.action === 'approve' ? '审核通过' : '已驳回')
        return response.data
      } else {
        throw new Error(response.message || '审核失败')
      }
    } catch (err) {
      const errObj = err as { message?: string; code?: number; details?: unknown }
      const errMessage = err instanceof Error ? err.message : errObj?.message || '审核失败'
      error.value = errMessage
      logger.error('[Plan Store] Failed to audit plan fill:', {
        message: errMessage,
        code: errObj?.code,
        details: errObj?.details
      })
      ElMessage.error(error.value)
      throw err
    } finally {
      submitting.value = false
    }
  }

  // 监听年份变化
  const timeContext = useTimeContextStore()
  watch(
    () => timeContext.currentYear,
    newYear => {
      logger.info(`[Plan Store] Year changed to ${newYear}, reloading plans...`)
      loadPlans()
    }
  )

  // 初始加载
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
    getPlanById,
    pendingPlanFills,
    visiblePendingFills,

    // Actions
    loadPlans,
    loadPlan,
    loadPendingFills,
    createPlan,
    updatePlan,
    deletePlan,
    submitPlan,
    auditPlanFill,
    setFilter,
    resetFilter,
    clearCurrentPlan
  }
})
