/**
 * Router Provider
 *
 * Vue Router configuration for application-level routing
 * Migrated from src/router/index.ts
 *
 * **Validates: Requirements 3.2 - Application Providers**
 * **Updated**: 2026-03-15 - Migrated from Pages to Features layer
 */

import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/3-features/auth/model/store'
import { startProgress, doneProgress } from './router-progress'
import './router-progress.css'

// 确保从 localStorage 恢复认证状态
const ensureAuthRestored = () => {
  const authStore = useAuthStore()

  // 如果有 token 但没有 user 或 user 没有 id，尝试从 localStorage 恢复
  if (authStore.token && (!authStore.user || !authStore.user.id)) {
    const savedUser = localStorage.getItem('currentUser')
    if (savedUser) {
      try {
        authStore.user = JSON.parse(savedUser)
      } catch (e) {
        // Failed to restore user from localStorage
        authStore.logout()
      }
    }
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/3-features/auth/ui/LoginView.vue'),
    meta: { requiresAuth: false, title: '登录 - 战略指标管理系统' }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/3-features/dashboard/ui/DashboardView.vue'),
    meta: { requiresAuth: true, title: '仪表盘 - 战略指标管理系统' }
  },
  {
    path: '/strategic-tasks',
    name: 'StrategicTasks',
    component: () => import('@/3-features/task/ui/StrategicTaskView.vue'),
    meta: { requiresAuth: true, roles: ['strategic_dept'], title: '战略任务 - 战略指标管理系统' }
  },
  {
    path: '/indicators',
    name: 'Indicators',
    component: () => import('@/3-features/indicator/ui/IndicatorListView.vue'),
    meta: { requiresAuth: true, title: '指标列表 - 战略指标管理系统' }
  },
  {
    path: '/distribution',
    name: 'Distribution',
    component: () => import('@/3-features/indicator/ui/IndicatorDistributeView.vue'),
    meta: { requiresAuth: true, roles: ['functional_dept'], title: '指标分配 - 战略指标管理系统' }
  },
  {
    path: '/messages',
    name: 'Messages',
    component: () => import('@/3-features/messages/ui/MessageCenterView.vue'),
    meta: { requiresAuth: true, title: '消息中心 - 战略指标管理系统' }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('@/3-features/profile/ui/ProfileView.vue'),
    meta: { requiresAuth: true, title: '个人资料 - 战略指标管理系统' }
  },
  {
    path: '/admin/console',
    name: 'AdminConsole',
    component: () => import('@/3-features/admin/ui/AdminConsoleView.vue'),
    meta: {
      requiresAuth: true,
      roles: ['strategic_dept'],
      title: '管理控制台 - 战略指标管理系统'
    }
  },
  {
    path: '/403',
    name: 'Forbidden',
    component: () => import('@/5-shared/ui/error/ForbiddenView.vue'),
    meta: { requiresAuth: false, title: '禁止访问 - 战略指标管理系统' }
  },

  // ============================================================
  // 新数据结构路由 (Plan -> Task -> Indicator -> IndicatorFill)
  // ============================================================

  /**
   * Plan 列表页
   * 展示所有 Plan，支持筛选、创建、提交
   */
  {
    path: '/plans',
    name: 'PlanList',
    component: () => import('@/3-features/plan/ui/PlanListView.vue'),
    meta: { requiresAuth: true, title: '计划列表 - 战略指标管理系统' }
  },

  /**
   * Plan 详情页
   * 查看 Plan 详情，包含 Task 和 Indicator 列表
   */
  {
    path: '/plans/:id',
    name: 'plan-detail',
    component: () => import('@/3-features/plan/ui/PlanDetailView.vue'),
    meta: { requiresAuth: true, title: '计划详情 - 战略指标管理系统' }
  },

  /**
   * Plan 编辑页
   * 创建或编辑 Plan
   */
  {
    path: '/plans/:id/edit',
    name: 'plan-edit',
    component: () => import('@/3-features/plan/ui/PlanEditView.vue'),
    meta: { requiresAuth: true, roles: ['strategic_dept'], title: '编辑计划 - 战略指标管理系统' }
  },

  /**
   * Plan 创建页
   */
  {
    path: '/plans/create',
    name: 'plan-create',
    component: () => import('@/3-features/plan/ui/PlanEditView.vue'),
    meta: { requiresAuth: true, roles: ['strategic_dept'], title: '创建计划 - 战略指标管理系统' }
  },

  /**
   * 填报页面
   * 填报指标进度
   */
  {
    path: '/fills/indicator/:indicatorId',
    name: 'indicator-fill',
    component: () => import('@/3-features/indicator/ui/IndicatorFillView.vue'),
    meta: { requiresAuth: true, title: '指标填报 - 战略指标管理系统' }
  },

  /**
   * 审核页面
   * 审核 Plan 提交
   */
  {
    path: '/audit/plan/:fillId',
    name: 'plan-audit',
    component: () => import('@/3-features/plan/ui/PlanAuditView.vue'),
    meta: {
      requiresAuth: true,
      roles: ['strategic_dept', 'functional_dept'],
      title: '计划审核 - 战略指标管理系统'
    }
  },

  /**
   * 待审核列表
   */
  {
    path: '/audit/pending',
    name: 'pending-audit',
    component: () => import('@/3-features/approval/ui/PendingAuditView.vue'),
    meta: {
      requiresAuth: true,
      roles: ['strategic_dept', 'functional_dept'],
      title: '待审核列表 - 战略指标管理系统'
    }
  },

  {
    path: '/:pathMatch(.*)*',
    name: '404',
    component: () => import('@/5-shared/ui/error/NotFoundView.vue'),
    meta: { title: '页面未找到 - 战略指标管理系统' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation guards
router.beforeEach((to, _from, next) => {
  // 开始进度进度条（如果是页面导航）
  if (_from.name !== undefined) {
    startProgress()
  }

  // 设置页面标题
  if (to.meta['title']) {
    document.title = to.meta['title'] as string
  } else {
    document.title = '战略指标管理系统'
  }

  // 确保认证状态已从 localStorage 恢复
  ensureAuthRestored()

  const authStore = useAuthStore()

  // Check if route requires authentication
  if (to.meta['requiresAuth'] && !authStore.isAuthenticated) {
    next('/login')
    return
  }

  // Check if route requires specific roles
  // 使用 effectiveRole 来支持战略发展部的视角切换功能
  if (to.meta['roles'] && Array.isArray(to.meta['roles']) && authStore.isAuthenticated) {
    const currentRole = authStore.effectiveRole
    const userRole = authStore.userRole

    // 战略发展部用户可以访问所有页面（通过视角切换）
    if (userRole === 'strategic_dept') {
      // 战略发展部用户始终允许访问，不做角色限制
      next()
      return
    }

    // 如果当前有效角色不在允许的角色列表中，才重定向
    if (currentRole && !(to.meta['roles'] as string[]).includes(currentRole)) {
      // 对于管理员页面，显示403
      if (to.path.startsWith('/admin')) {
        next('/403')
        return
      }
      next('/dashboard')
      return
    }
    // 如果角色为空但已认证，允许访问（可能是数据恢复问题）
  }

  // Redirect authenticated users away from login page
  if (to.path === '/login' && authStore.isAuthenticated) {
    next('/dashboard')
    return
  }

  next()
})

// 路由切换完成后结束进度条
router.afterEach(() => {
  doneProgress()
})

// 路由切换失败时也要结束进度条
router.onError(() => {
  doneProgress()
})

export default router