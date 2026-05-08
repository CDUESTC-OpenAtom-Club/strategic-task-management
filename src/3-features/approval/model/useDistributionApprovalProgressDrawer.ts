import type {
  DistributionApprovalProgressDrawerEmit,
  DistributionApprovalProgressDrawerProps
} from '@/features/approval/model/types'
import { useApprovalProgressState } from './useApprovalProgressState'
import { useApprovalProgressWorkflow } from './useApprovalProgressWorkflow'

export type {
  DistributionApprovalProgressDrawerEmit,
  DistributionApprovalProgressDrawerProps
} from '@/features/approval/model/types'

export function useDistributionApprovalProgressDrawer(
  props: DistributionApprovalProgressDrawerProps,
  emit: DistributionApprovalProgressDrawerEmit
) {
  const state = useApprovalProgressState(props, emit)
  const workflow = useApprovalProgressWorkflow({ props, emit, state })

  return {
    ...state,
    ...workflow
  }
}
