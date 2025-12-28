import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

// 确保从 localStorage 恢复认证状态
const ensureAuthRestored = () => {
  const authStore = useAuthStore()
  
  // 如果有 token 但没有 user，尝试从 localStorage 恢复
  if (authStore.token && !authStore.user) {
    const savedUser = localStorage.getItem('currentUser')
    if (savedUser) {
      try {
        authStore.user = JSON.parse(savedUser)
      } catch (e) {
        console.error('Failed to restore user from localStorage:', e)
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
    component: () => import('@/views/LoginView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/strategic-tasks',
    name: 'StrategicTasks',
    component: () => import('@/views/StrategicTaskView.vue'),
    meta: { requiresAuth: true, roles: ['strategic_dept'] }
  },
  {
    path: '/indicators',
    name: 'Indicators',
    component: () => import('@/views/IndicatorListView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/messages',
    name: 'Messages',
    component: () => import('@/views/MessageCenterView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('@/views/ProfileView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/:pathMatch(.*)*',
    name: '404',
    component: () => import('@/views/404.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation guards
router.beforeEach((to, _from, next) => {
  // 确保认证状态已从 localStorage 恢复
  ensureAuthRestored()
  
  const authStore = useAuthStore()

  // Check if route requires authentication
  if (to.meta['requiresAuth'] && !authStore.isAuthenticated) {
    next('/login')
    return
  }

  // Check if route requires specific roles
  // 只有在用户已认证且路由需要特定角色时才检查
  if (to.meta['roles'] && Array.isArray(to.meta['roles']) && authStore.isAuthenticated) {
    const userRole = authStore.user?.role
    // 如果用户角色不在允许的角色列表中，才重定向
    if (userRole && !(to.meta['roles'] as string[]).includes(userRole)) {
      next('/dashboard')
      return
    }
    // 如果用户角色为空但已认证，允许访问（可能是数据恢复问题）
  }

  // Redirect authenticated users away from login page
  if (to.path === '/login' && authStore.isAuthenticated) {
    next('/dashboard')
    return
  }

  next()
})

export default router