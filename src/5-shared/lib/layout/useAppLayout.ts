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
import { useAuthStore } from '@/features/auth/model/store'
import { useOrgStore } from '@/features/organization/model/store'
import { useMessageStore } from '@/features/messages/model/message'
import { invalidateQueries } from '@/shared/lib/utils/cache'
import { USE_MOCK } from '@/shared/config/api'

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
      if (!USE_MOCK) {
        invalidateQueries(['dashboard.overview', 'org.list', 'indicator.list', 'task.list'])
      }

      await orgStore.loadDepartments(0, 2, { force: !USE_MOCK })
    }
  })

  // 监听登录状态变化，登录后加载部门数据和消息
  watch(
    () => authStore.isAuthenticated,
    async isAuth => {
      if (isAuth && !orgStore.loaded) {
        if (!USE_MOCK) {
          invalidateQueries(['dashboard.overview', 'org.list', 'indicator.list', 'task.list'])
        }

        await orgStore.loadDepartments(0, 2, { force: !USE_MOCK })

        // 获取消息数据
        await messageStore.refreshMessageCenter()
      } else if (isAuth && orgStore.loaded) {
        // 确保消息已加载
        if (messageStore.messages.length === 0) {
          await messageStore.refreshMessageCenter()
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
