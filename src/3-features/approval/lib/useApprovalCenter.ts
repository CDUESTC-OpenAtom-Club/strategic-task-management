import { readonly, ref } from 'vue'

const approvalCenterVisible = ref(false)

export function useApprovalCenter() {
  const openApprovalCenter = () => {
    approvalCenterVisible.value = true
  }

  const closeApprovalCenter = () => {
    approvalCenterVisible.value = false
  }

  const toggleApprovalCenter = () => {
    approvalCenterVisible.value = !approvalCenterVisible.value
  }

  return {
    approvalCenterVisible: readonly(approvalCenterVisible),
    openApprovalCenter,
    closeApprovalCenter,
    toggleApprovalCenter
  }
}
