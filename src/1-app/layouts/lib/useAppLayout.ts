import { computed, watch, onMounted } from 'vue'
import { useAuthStore } from '@/features/auth/model/store'
import { useOrgStore } from '@/features/organization/model/store'
import { useMessageStore } from '@/features/messages/model/message'

export function useAppLayout() {
  const authStore = useAuthStore()
  const orgStore = useOrgStore()
  const messageStore = useMessageStore()

  const isLoggedIn = computed(() => authStore.isAuthenticated)
  const currentUser = computed(() => authStore.user)
  const isStrategicDept = computed(() => authStore.userRole === 'strategic_dept')
  const strategicDeptName = computed(() => orgStore.getStrategicDeptName())

  onMounted(async () => {
    if (authStore.isAuthenticated) {
      await orgStore.loadDepartments()
    }
  })

  watch(
    () => authStore.isAuthenticated,
    async isAuth => {
      if (isAuth && !orgStore.loaded) {
        await orgStore.loadDepartments()
        void messageStore.fetchMessages()
      } else if (isAuth && orgStore.loaded && messageStore.messages.length === 0) {
        void messageStore.fetchMessages()
      }
    },
    { immediate: true }
  )

  const handleLogout = () => {
    authStore.logout()
  }

  return {
    isLoggedIn,
    currentUser,
    isStrategicDept,
    strategicDeptName,
    handleLogout
  }
}
