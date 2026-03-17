import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/3-features/auth/model/store'
import { startProgress, doneProgress } from './nprogress'
import './nprogress.css'

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
    component: () => import('@/2-pages/auth/ui/LoginPage.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/2-pages/dashboard/ui/DashboardPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/strategic-tasks',
    name: 'StrategicTasks',
    component: () => import('@/2-pages/strategy/tasks/ui/StrategicTaskPage.vue'),
    meta: { requiresAuth: true, roles: ['strategic_dept'] }
  },
  {
    path: '/indicators',
    name: 'Indicators',
    component: () => import('@/2-pages/strategy/indicators/ui/IndicatorListPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/distribution',
    name: 'Distribution',
    component: () => import('@/2-pages/strategy/indicators/ui/IndicatorDistributePage.vue'),
    meta: { requiresAuth: true, roles: ['functional_dept'] }
  },
  {
    path: '/messages',
    name: 'Messages',
    component: () => import('@/2-pages/messages/ui/MessageCenterPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('@/2-pages/profile/ui/ProfilePage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/admin/console',
    name: 'AdminConsole',
    component: () => import('@/2-pages/admin/ui/AdminConsolePage.vue'),
    meta: {
      requiresAuth: true,
      roles: ['strategic_dept']
    }
  },
  {
    path: '/403',
    name: 'Forbidden',
    component: () => import('@/2-pages/error/ui/ForbiddenPage.vue'),
    meta: { requiresAuth: false }
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
    component: () => import('@/2-pages/strategy/plans/ui/PlanListPage.vue'),
    meta: { requiresAuth: true }
  },

  /**
   * Plan 详情页
   * 查看 Plan 详情，包含 Task 和 Indicator 列表
   */
  {
    path: '/plans/:id',
    name: 'plan-detail',
    component: () => import('@/2-pages/strategy/plans/ui/PlanDetailPage.vue'),
    meta: { requiresAuth: true }
  },

  /**
   * Plan 编辑页
   * 创建或编辑 Plan
   */
  {
    path: '/plans/:id/edit',
    name: 'plan-edit',
    component: () => import('@/2-pages/strategy/plans/ui/PlanEditPage.vue'),
    meta: { requiresAuth: true, roles: ['strategic_dept'] }
  },

  /**
   * Plan 创建页
   */
  {
    path: '/plans/create',
    name: 'plan-create',
    component: () => import('@/2-pages/strategy/plans/ui/PlanEditPage.vue'),
    meta: { requiresAuth: true, roles: ['strategic_dept'] }
  },

  /**
   * 填报页面
   * 填报指标进度
   */
  {
    path: '/fills/indicator/:indicatorId',
    name: 'indicator-fill',
    component: () => import('@/2-pages/strategy/indicators/ui/IndicatorFillPage.vue'),
    meta: { requiresAuth: true }
  },

  /**
   * 审核页面
   * 审核 Plan 提交
   */
  {
    path: '/audit/plan/:fillId',
    name: 'plan-audit',
    component: () => import('@/2-pages/strategy/plans/ui/PlanAuditPage.vue'),
    meta: { requiresAuth: true, roles: ['strategic_dept', 'functional_dept'] }
  },

  /**
   * 待审核列表
   */
  {
    path: '/audit/pending',
    name: 'pending-audit',
    component: () => import('@/2-pages/approval/ui/PendingAuditPage.vue'),
    meta: { requiresAuth: true, roles: ['strategic_dept', 'functional_dept'] }
  },

  {
    path: '/:pathMatch(.*)*',
    name: '404',
    component: () => import('@/2-pages/error/ui/NotFoundPage.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation guards
router.beforeEach((to, _from, next) => {
  // 开始进度条（如果是页面导航）
  if (_from.name !== undefined) {
    startProgress()
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
