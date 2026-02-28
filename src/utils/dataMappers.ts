/**
 * 数据映射工具
 * 用于前端数据结构和后端API之间的转换
 */

import type { StrategicIndicator } from '@/types'

/**
 * 检查更新对象中是否包含需要同步到后端的字段
 */
export function hasBackendUpdates(updates: Partial<StrategicIndicator>): boolean {
  // 需要同步到后端的字段列表
  const backendFields = [
    'name',
    'type1',
    'type2',
    'weight',
    'responsibleDept',
    'ownerDept',
    'taskId',
    'taskContent',
    'description',
    'milestones',
    'progress',
    'status',
    'year',
    'statusAudit'
  ]

  // 检查是否有任何需要同步的字段
  return Object.keys(updates).some(key => backendFields.includes(key))
}

/**
 * 将前端更新对象转换为后端API请求格式
 */
export function convertToUpdateRequest(updates: Partial<StrategicIndicator>): any {
  const request: any = {}

  // 直接映射的字段
  const directFields = [
    'name',
    'type1',
    'type2',
    'weight',
    'responsibleDept',
    'ownerDept',
    'taskId',
    'taskContent',
    'description',
    'progress',
    'status',
    'year'
  ]

  directFields.forEach(field => {
    if (field in updates) {
      request[field] = updates[field as keyof StrategicIndicator]
    }
  })

  // statusAudit 需要序列化为 JSON 字符串
  if ('statusAudit' in updates && updates.statusAudit) {
    request.statusAudit = JSON.stringify(updates.statusAudit)
  }

  // 里程碑需要特殊处理 - 转换字段名以匹配后端API
  // 前端使用: id, name, targetProgress, deadline, status
  // 后端期望: milestoneId, milestoneName, targetProgress, dueDate, status, weightPercent, sortOrder
  if ('milestones' in updates && updates.milestones) {
    request.milestones = updates.milestones.map((ms: any, index: number) => {
      // 处理 milestoneId：如果是字符串ID（临时ID），传 null 让后端创建新记录
      let milestoneId: number | null = null
      if (ms.milestoneId) {
        const parsed = typeof ms.milestoneId === 'number' ? ms.milestoneId : parseInt(ms.milestoneId, 10)
        milestoneId = isNaN(parsed) ? null : parsed
      } else if (ms.id) {
        const parsed = typeof ms.id === 'number' ? ms.id : parseInt(ms.id, 10)
        milestoneId = isNaN(parsed) ? null : parsed
      }
      
      console.log('[dataMappers] 转换里程碑:', {
        原始id: ms.id,
        原始milestoneId: ms.milestoneId,
        转换后milestoneId: milestoneId,
        name: ms.name,
        milestoneName: ms.milestoneName
      })
      
      // 转换前端状态到后端枚举值
      // 前端: pending, completed, overdue
      // 后端: NOT_STARTED, IN_PROGRESS, COMPLETED, DELAYED, CANCELED
      let backendStatus = 'NOT_STARTED'
      if (ms.status) {
        const statusMap: Record<string, string> = {
          'pending': 'NOT_STARTED',
          'completed': 'COMPLETED',
          'overdue': 'DELAYED'
        }
        backendStatus = statusMap[ms.status] || ms.status
      }
      
      return {
        milestoneId,
        milestoneName: ms.milestoneName || ms.name || '',
        targetProgress: ms.targetProgress || 0,
        dueDate: ms.dueDate || ms.deadline || '',
        status: backendStatus,
        weightPercent: ms.weightPercent || 0,
        sortOrder: ms.sortOrder !== undefined ? ms.sortOrder : index
      }
    })
  }

  return request
}

