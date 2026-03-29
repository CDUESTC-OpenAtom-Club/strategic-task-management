import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Bell } from '@element-plus/icons-vue'
import { useMessageStore } from '@/features/messages/model/message'

export function useNotificationCenter() {
  const router = useRouter()
  const messageStore = useMessageStore()

  const unreadCount = computed(() => messageStore.unreadCount.all)

  const handleNotificationClick = () => {
    router.push('/messages')
  }

  return {
    unreadCount,
    handleNotificationClick,
    Bell
  }
}
