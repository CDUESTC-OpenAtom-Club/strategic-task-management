/**
 * useAppLayout - 应用布局状态管?Composable
 *
 * 职责:
 * - 管理用户认证状?
 * - 管理部门数据初始?
 * - 处理登录状态变?
 *
 * @module composables/layout
 */

import { computed, watch, onMounted } from 'vue'
import { useAuthStore } from '@/3-features/auth/model/store'
import { useOrgStore } from '@/3-features/organization/model/store'
import { useMessageStore } from '@/3-features/messages/model/message'

export function useAppLayout() {
  // Stores
  const authStore = useAuthStore()
  const orgStore = useOrgStore()
  const messageStore = useMessageStore()

  // 计算属?
  const isLoggedIn = computed(() => authStore.isAuthenticated)
  const currentUser = computed(() => authStore.user)
  const isStrategicDept = computed(() => authStore.userRole === 'strategic_dept')
  const strategicDeptName = computed(() => orgStore.getStrategicDeptName())

  // 初始化部门数?- 在用户登录后加载
  onMounted(async () => {
    if (authStore.isAuthenticated) {
      await orgStore.loadDepartments()
    }
  })

  // 监听登录状态变化，登录后加载部门数据和消息
  watch(
    () => authStore.isAuthenticated,
    async isAuth => {
      if (isAuth && !orgStore.loaded) {
        await orgStore.loadDepartments()

        // 获取消息数据
        await messageStore.fetchMessages()
      } else if (isAuth && orgStore.loaded) {
        // 确保消息已加载
        if (messageStore.messages.length === 0) {
          await messageStore.fetchMessages()
        }
      }
    },
    { immediate: true }
  )

  // 处理退出登?
  const handleLogout = () => {
    authStore.logout()
    // 导航到登录页由调用方处理
  }

  return {
    // 状?
    isLoggedIn,
    currentUser,
    isStrategicDept,
    strategicDeptName,

    // 方法
    handleLogout
  }
}
