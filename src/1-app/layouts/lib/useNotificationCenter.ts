import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Bell } from '@element-plus/icons-vue'
import { useMessageStore } from '@/features/messages/model/message'
import { useApprovalStore } from '@/features/approval/model/store'

export function useNotificationCenter() {
  const router = useRouter()
  const messageStore = useMessageStore()
  const approvalStore = useApprovalStore()

  const unreadCount = computed(() =>
    Math.max(messageStore.unreadCount.all, approvalStore.pendingCount)
  )

  const handleNotificationClick = () => {
    router.push('/messages')
  }

  return {
    unreadCount,
    handleNotificationClick,
    Bell
  }
}
