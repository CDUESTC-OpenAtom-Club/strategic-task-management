import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { 
  AuditLogItem, 
  AuditLogFilters, 
  AuditAction, 
  EntityType,
  FieldChange 
} from '@/types'

export const useAuditLogStore = defineStore('auditLog', () => {
  // State
  const logs = ref<AuditLogItem[]>([])
  const loading = ref(false)

  // 记录操作日志
  const logAction = (params: {
    entityType: EntityType
    entityId: string
    entityName: string
    action: AuditAction
    operator: string
    operatorName: string
    dataBefore?: Record<string, any>
    dataAfter?: Record<string, any>
  }) => {
    const changes = calculateChanges(params.dataBefore, params.dataAfter)
    
    const logItem: AuditLogItem = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      entityType: params.entityType,
      entityId: params.entityId,
      entityName: params.entityName,
      action: params.action,
      operator: params.operator,
      operatorName: params.operatorName,
      operateTime: new Date(),
      ...(params.dataBefore && { dataBefore: params.dataBefore }),
      ...(params.dataAfter && { dataAfter: params.dataAfter }),
      ...(changes.length > 0 && { changes })
    }
    
    logs.value.unshift(logItem)
    return logItem
  }

  // 计算数据变更
  const calculateChanges = (
    before?: Record<string, any>, 
    after?: Record<string, any>
  ): FieldChange[] => {
    if (!before || !after) return []
    
    const changes: FieldChange[] = []
    const fieldLabels: Record<string, string> = {
      name: '名称',
      progress: '进度',
      status: '状态',
      weight: '权重',
      remark: '备注',
      targetValue: '目标值',
      actualValue: '实际值',
      responsibleDept: '责任部门',
      responsiblePerson: '责任人'
    }
    
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])
    
    allKeys.forEach(key => {
      const oldVal = before[key]
      const newVal = after[key]
      
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({
          field: key,
          fieldLabel: fieldLabels[key] || key,
          oldValue: oldVal,
          newValue: newVal
        })
      }
    })
    
    return changes
  }

  // 查询日志
  const queryLogs = (filters: AuditLogFilters): AuditLogItem[] => {
    let result = [...logs.value]
    
    if (filters.operator) {
      result = result.filter(log => log.operator === filters.operator)
    }
    
    if (filters.entityType) {
      result = result.filter(log => log.entityType === filters.entityType)
    }
    
    if (filters.action) {
      result = result.filter(log => log.action === filters.action)
    }
    
    if (filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) {
      const [start, end] = filters.dateRange
      result = result.filter(log => {
        const time = new Date(log.operateTime)
        return time >= start && time <= end
      })
    }
    
    return result
  }

  // 获取实体历史
  const getEntityHistory = (entityType: EntityType, entityId: string): AuditLogItem[] => {
    return logs.value.filter(
      log => log.entityType === entityType && log.entityId === entityId
    )
  }

  // 获取操作人列表
  const operators = computed(() => {
    const set = new Set(logs.value.map(log => log.operatorName))
    return Array.from(set)
  })

  // 清空日志（仅用于测试）
  const clearLogs = () => {
    logs.value = []
  }

  return {
    // State
    logs,
    loading,

    // Getters
    operators,

    // Actions
    logAction,
    queryLogs,
    getEntityHistory,
    calculateChanges,
    clearLogs
  }
})
