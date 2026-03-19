// Approval Feature
export { approvalApi, type ApprovalDetail, type ApprovalHistory as ApprovalInstanceHistory, type ApprovalHistoryItem, type ApprovalStartRequest, type ApprovalActionRequest as ApprovalApiActionRequest } from './api/approval'
export * from './lib'
export {
  type ApprovalInstance,
  type ApprovalStatus,
  type ApprovalFlow,
  type ApprovalStep,
  type ApprovalUser,
  type ApprovalHistory as ApprovalRecord,
  type ApprovalSubmissionRequest,
  type ApprovalActionRequest,
  type ApprovalFilters
} from './model/types'
export { default as ApprovalWorkflow } from './ui/ApprovalWorkflow.vue'
export { default as ApprovalHistoryView } from './ui/ApprovalHistory.vue'
export { default as CustomApprovalFlow } from './ui/CustomApprovalFlow.vue'
export { default as ApprovalProgressDrawer } from './ui/ApprovalProgressDrawer.vue'
export { default as PlanApprovalDrawer } from './ui/PlanApprovalDrawer.vue'
