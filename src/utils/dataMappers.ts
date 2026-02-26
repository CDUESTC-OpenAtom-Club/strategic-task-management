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
    'year'
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

  // 里程碑需要特殊处理 - 转换字段名以匹配后端API
  // 前端使用: id, name, targetProgress, deadline, status
  // 后端期望: milestoneId, milestoneName, targetProgress, dueDate, status, weightPercent, sortOrder
  if ('milestones' in updates && updates.milestones) {
    request.milestones = updates.milestones.map((ms: any, index: number) => ({
      milestoneId: ms.milestoneId || ms.id || 0,
      milestoneName: ms.milestoneName || ms.name || '',
      targetProgress: ms.targetProgress || 0,
      dueDate: ms.dueDate || ms.deadline || '',
      status: ms.status || 'NOT_STARTED',
      weightPercent: ms.weightPercent || 0,
      sortOrder: ms.sortOrder !== undefined ? ms.sortOrder : index
    }))
  }

  return request
}

