import { computed } from 'vue'
import { Bell } from '@element-plus/icons-vue'
import { useMessageStore } from '@/features/messages/model/message'
import { useApprovalCenter } from '@/features/approval'

export function useNotificationCenter() {
  const messageStore = useMessageStore()
  const { openApprovalCenter } = useApprovalCenter()

  const unreadCount = computed(() => messageStore.unreadCount.all)

  const handleNotificationClick = () => {
    openApprovalCenter()
  }

  return {
    unreadCount,
    handleNotificationClick,
    Bell
  }
}
