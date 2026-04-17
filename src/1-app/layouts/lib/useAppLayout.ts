import { computed, watch, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/features/auth/model/store'
import { useOrgStore } from '@/features/organization/model/store'
import { useMessageStore } from '@/features/messages/model/message'
import { useApprovalStore } from '@/features/approval/model/store'
import { APPROVAL_STATE_REFRESH_EVENT } from '@/features/approval/lib'

export function useAppLayout() {
  const authStore = useAuthStore()
  const orgStore = useOrgStore()
  const messageStore = useMessageStore()
  const approvalStore = useApprovalStore()

  const isLoggedIn = computed(() => authStore.isAuthenticated)
  const currentUser = computed(() => authStore.user)
  const isStrategicDept = computed(() => authStore.userRole === 'strategic_dept')
  const strategicDeptName = computed(() => orgStore.getStrategicDeptName())

  const syncPendingApprovalMessages = () => {
    messageStore.syncPendingApprovals(approvalStore.pendingApprovals)
  }

  const refreshNotificationState = async () => {
    await Promise.all([messageStore.fetchMessages(), approvalStore.loadPendingApprovals()])
    syncPendingApprovalMessages()
  }

  const refreshPendingApprovalState = async () => {
    await approvalStore.loadPendingApprovals()
    syncPendingApprovalMessages()
  }

  const handleApprovalStateRefresh = () => {
    void refreshPendingApprovalState()
  }

  onMounted(async () => {
    if (typeof window !== 'undefined') {
      window.addEventListener(
        APPROVAL_STATE_REFRESH_EVENT,
        handleApprovalStateRefresh as EventListener
      )
    }

    if (authStore.isAuthenticated) {
      await orgStore.loadDepartments()
    }
  })

  onUnmounted(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener(
        APPROVAL_STATE_REFRESH_EVENT,
        handleApprovalStateRefresh as EventListener
      )
    }
  })

  watch(
    () => authStore.isAuthenticated,
    async isAuth => {
      if (isAuth && !orgStore.loaded) {
        await orgStore.loadDepartments()
        void refreshNotificationState()
      } else if (isAuth && orgStore.loaded && messageStore.messages.length === 0) {
        void refreshNotificationState()
      } else if (isAuth) {
        void refreshPendingApprovalState()
      }
    },
    { immediate: true }
  )

  // Keep synthetic approval messages aligned with the globally refreshed approval store.
  watch(
    () => approvalStore.pendingApprovals,
    pendingApprovals => {
      messageStore.syncPendingApprovals(pendingApprovals)
    },
    { deep: true }
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
