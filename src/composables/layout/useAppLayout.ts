/**
 * useAppLayout - 应用布局状态管理 Composable
 *
 * 职责:
 * - 管理用户认证状态
 * - 管理部门数据初始化
 * - 处理登录状态变化
 *
 * @module composables/layout
 */

import { computed, watch, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useOrgStore } from '@/stores/org'
import { useMessageStore } from '@/stores/message'

export function useAppLayout() {
  // Stores
  const authStore = useAuthStore()
  const orgStore = useOrgStore()
  const messageStore = useMessageStore()

  // 计算属性
  const isLoggedIn = computed(() => authStore.isAuthenticated)
  const currentUser = computed(() => authStore.user)
  const isStrategicDept = computed(() => authStore.userRole === 'strategic_dept')
  const strategicDeptName = computed(() => orgStore.getStrategicDeptName())

  // 初始化部门数据 - 在用户登录后加载
  onMounted(async () => {
    if (authStore.isAuthenticated) {
      await orgStore.loadDepartments()
    }
  })

  // 监听登录状态变化，登录后加载部门数据和消息
  watch(() => authStore.isAuthenticated, async (isAuth) => {
    if (isAuth && !orgStore.loaded) {
      await orgStore.loadDepartments()

      // 初始化消息数据
      messageStore.initializeMessages()
    } else if (isAuth && orgStore.loaded) {
      // 确保消息已初始化
      if (messageStore.messages.length === 0) {
        messageStore.initializeMessages()
      }
    }
  }, { immediate: true })

  // 处理退出登录
  const handleLogout = () => {
    authStore.logout()
    // 导航到登录页由调用方处理
  }

  return {
    // 状态
    isLoggedIn,
    currentUser,
    isStrategicDept,
    strategicDeptName,

    // 方法
    handleLogout
  }
}
