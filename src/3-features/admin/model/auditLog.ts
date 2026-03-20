/**
 * Audit Log Store
 * 
 * Manages audit logs for tracking changes and actions.
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface AuditLog {
  id?: string
  entityType: string
  entityId: string
  entityName?: string
  action: string
  userId?: string
  userName?: string
  operator?: string
  operatorName?: string
  timestamp: string
  details?: Record<string, unknown>
  dataBefore?: Record<string, unknown>
  dataAfter?: Record<string, unknown>
}

export const useAuditLogStore = defineStore('auditLog', () => {
  // ============ State ============
  
  const logs = ref<AuditLog[]>([])
  const loading = ref(false)
  
  // ============ Actions ============
  
  async function fetchLogs(_entityType?: string, _entityId?: string) {
    loading.value = true
    try {
      // TODO: Implement API call when backend is ready
      // const response = await auditLogApi.getLogs({ entityType, entityId })
      // logs.value = response.data
      logs.value = []
    } finally {
      loading.value = false
    }
  }

  async function logAction(entry: Omit<AuditLog, 'timestamp'> & { timestamp?: string }) {
    logs.value.unshift({
      ...entry,
      timestamp: entry.timestamp ?? new Date().toISOString()
    })
  }
  
  function clearLogs() {
    logs.value = []
  }
  
  return {
    logs,
    loading,
    fetchLogs,
    logAction,
    clearLogs
  }
})
