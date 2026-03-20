// Workflow Feature API - Export Module

// Types
export * from './types'

// Queries
export {
  getWorkflowDefinitions,
  getWorkflowDefinitionById,
  getWorkflowDefinitionByCode,
  getWorkflowDefinitionPreviewByCode,
  getWorkflowDefinitionsByEntityType,
  getWorkflowInstances,
  getWorkflowInstanceDetail,
  getMyPendingTasks,
  getMyApprovedInstances,
  getMyAppliedInstances,
  getWorkflowStatistics
} from './queries'

// Mutations
export {
  startWorkflow,
  decideTask,
  approveTask,
  rejectTask,
  reassignTask,
  cancelWorkflow
} from './mutations'
