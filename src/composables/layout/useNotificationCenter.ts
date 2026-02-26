/**
 * useNotificationCenter - 通知中心 Composable
 *
 * 职责:
 * - 管理未读消息计数
 * - 提供消息导航
 * - 处理消息通知交互
 *
 * @module composables/layout
 */

import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useMessageStore } from '@/stores/message'
import { Bell } from '@element-plus/icons-vue'

export function useNotificationCenter() {
  const router = useRouter()
  const messageStore = useMessageStore()

  // 未读消息计数
  const unreadCount = computed(() => messageStore.unreadCount.all)

  // 处理通知点击
  const handleNotificationClick = () => {
    router.push('/messages')
  }

  return {
    unreadCount,
    handleNotificationClick,
    Bell
  }
}
