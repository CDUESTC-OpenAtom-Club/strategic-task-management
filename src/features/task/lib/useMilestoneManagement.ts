/**
 * Milestone Management Composable
 * Handles milestone CRUD operations
 */

import { ref } from 'vue'
import type { StrategicIndicator, Milestone } from '@/types'

export function useMilestoneManagement() {
  const dialogVisible = ref(false)
  const currentMilestone = ref<Milestone | null>(null)

  const openDialog = (milestone?: Milestone) => {
    currentMilestone.value = milestone || null
    dialogVisible.value = true
  }

  const closeDialog = () => {
    dialogVisible.value = false
    currentMilestone.value = null
  }

  return {
    dialogVisible,
    currentMilestone,
    openDialog,
    closeDialog
  }
}
