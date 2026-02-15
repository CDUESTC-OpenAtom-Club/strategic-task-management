/**
 * 消息管理 Store
 * 
 * 功能：
 * 1. 管理系统消息（预警、审批、系统通知等）
 * 2. 根据用户角色和部门过滤消息
 * 3. 提供未读消息计数
 * 4. 支持消息分类和权限控制
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'
import { useStrategicStore } from './strategic'
import type { UserRole } from '@/types'

export interface Message {
  id: string
  type: 'alert' | 'approval' | 'system' | 'task'
  title: string
  content: string
  severity?: 'severe' | 'moderate' | 'normal'
  recipientRole?: UserRole | UserRole[] // 接收者角色
  recipientDept?: string | string[] // 接收者部门
  recipientId?: string // 特定接收者ID
  isRead: boolean
  createdAt: Date
  relatedId?: string
  actionUrl?: string // 操作链接
}

export const useMessageStore = defineStore('message', () => {
  const authStore = useAuthStore()
  const strategicStore = useStrategicStore()
  
  const messages = ref<Message[]>([])
  
  /**
   * 检查消息是否对当前用户可见
   */
  const isMessageVisibleToUser = (message: Message): boolean => {
    const user = authStore.user
    if (!user) return false
    
    // 如果指定了特定接收者ID，只有该用户可见
    if (message.recipientId && message.recipientId !== user.id) {
      return false
    }
    
    // 检查角色权限
    if (message.recipientRole) {
      const roles = Array.isArray(message.recipientRole) 
        ? message.recipientRole 
        : [message.recipientRole]
      
      if (!roles.includes(user.role as UserRole)) {
        return false
      }
    }
    
    // 检查部门权限
    if (message.recipientDept) {
      const depts = Array.isArray(message.recipientDept)
        ? message.recipientDept
        : [message.recipientDept]
      
      if (!depts.includes(user.department)) {
        return false
      }
    }
    
    return true
  }
  
  /**
   * 获取当前用户可见的所有消息
   */
  const visibleMessages = computed(() => {
    return messages.value.filter(isMessageVisibleToUser)
  })
  
  /**
   * 按类型分类的消息
   */
  const alertMessages = computed(() => 
    visibleMessages.value.filter(msg => msg.type === 'alert')
  )
  
  const approvalMessages = computed(() => 
    visibleMessages.value.filter(msg => msg.type === 'approval')
  )
  
  const systemMessages = computed(() => 
    visibleMessages.value.filter(msg => msg.type === 'system')
  )
  
  const taskMessages = computed(() => 
    visibleMessages.value.filter(msg => msg.type === 'task')
  )
  
  /**
   * 未读消息计数
   */
  const unreadCount = computed(() => ({
    all: visibleMessages.value.filter(msg => !msg.isRead).length,
    alerts: alertMessages.value.filter(msg => !msg.isRead).length,
    approvals: approvalMessages.value.filter(msg => !msg.isRead).length,
    system: systemMessages.value.filter(msg => !msg.isRead).length,
    tasks: taskMessages.value.filter(msg => !msg.isRead).length
  }))
  
  /**
   * 生成预警消息
   * 根据指标进度和里程碑状态自动生成预警
   */
  const generateAlertMessages = (): Message[] => {
    const alerts: Message[] = []
    const user = authStore.user
    if (!user) return alerts
    
    // 获取当前用户相关的指标
    const userIndicators = strategicStore.indicators.filter(indicator => {
      // 战略发展部可以看所有指标
      if (user.role === 'strategic_dept') return true
      
      // 职能部门看自己下发的和接收的
      if (user.role === 'functional_dept') {
        return indicator.ownerDept === user.department || 
               indicator.responsibleDept === user.department
      }
      
      // 二级学院只看自己接收的
      return indicator.responsibleDept === user.department
    })
    
    // 1. 进度严重滞后预警（进度 < 30%）
    userIndicators
      .filter(i => i.progress < 30)
      .forEach((indicator, index) => {
        alerts.push({
          id: `alert-severe-${indicator.id}-${index}`,
          type: 'alert',
          title: '严重预警：指标进度严重滞后',
          content: `指标"${indicator.indicator}"完成率仅${indicator.progress}%，严重低于预期，请立即采取措施`,
          severity: 'severe',
          recipientDept: indicator.responsibleDept,
          isRead: false,
          createdAt: new Date(),
          relatedId: indicator.id,
          actionUrl: `/indicators?id=${indicator.id}`
        })
      })
    
    // 2. 进度预警（30% <= 进度 < 50%）
    userIndicators
      .filter(i => i.progress >= 30 && i.progress < 50)
      .forEach((indicator, index) => {
        alerts.push({
          id: `alert-moderate-${indicator.id}-${index}`,
          type: 'alert',
          title: '预警：指标进度偏低',
          content: `指标"${indicator.indicator}"完成率${indicator.progress}%，低于预期进度，请关注`,
          severity: 'moderate',
          recipientDept: indicator.responsibleDept,
          isRead: false,
          createdAt: new Date(),
          relatedId: indicator.id,
          actionUrl: `/indicators?id=${indicator.id}`
        })
      })
    
    // 3. 里程碑逾期预警
    strategicStore.getOverdueMilestones
      .filter(item => {
        const indicator = item.indicator
        if (user.role === 'strategic_dept') return true
        if (user.role === 'functional_dept') {
          return indicator.ownerDept === user.department || 
                 indicator.responsibleDept === user.department
        }
        return indicator.responsibleDept === user.department
      })
      .forEach((item, index) => {
        alerts.push({
          id: `alert-overdue-${item.indicator.id}-${item.milestone.id}-${index}`,
          type: 'alert',
          title: '里程碑逾期预警',
          content: `指标"${item.indicator.indicator}"的里程碑"${item.milestone.name}"已逾期，请及时处理`,
          severity: 'severe',
          recipientDept: item.indicator.responsibleDept,
          isRead: false,
          createdAt: new Date(item.milestone.deadline),
          relatedId: item.indicator.id,
          actionUrl: `/indicators?id=${item.indicator.id}`
        })
      })
    
    // 4. 里程碑即将到期提醒
    strategicStore.getUpcomingMilestones
      .filter(item => {
        const indicator = item.indicator
        if (user.role === 'strategic_dept') return true
        if (user.role === 'functional_dept') {
          return indicator.ownerDept === user.department || 
                 indicator.responsibleDept === user.department
        }
        return indicator.responsibleDept === user.department
      })
      .forEach((item, index) => {
        alerts.push({
          id: `alert-upcoming-${item.indicator.id}-${item.milestone.id}-${index}`,
          type: 'alert',
          title: '里程碑即将到期',
          content: `指标"${item.indicator.indicator}"的里程碑"${item.milestone.name}"将在${item.daysUntil}天后到期，请注意进度`,
          severity: 'moderate',
          recipientDept: item.indicator.responsibleDept,
          isRead: false,
          createdAt: new Date(),
          relatedId: item.indicator.id,
          actionUrl: `/indicators?id=${item.indicator.id}`
        })
      })
    
    return alerts
  }
  
  /**
   * 生成审批消息
   * 根据待审批的报告生成消息
   */
  const generateApprovalMessages = (): Message[] => {
    const approvals: Message[] = []
    const user = authStore.user
    if (!user) return approvals
    
    // 只有战略发展部和职能部门有审批权限
    if (user.role === 'secondary_college') return approvals
    
    // 获取待审批的指标（这里简化处理，实际应该从报告数据中获取）
    const pendingApprovals = strategicStore.indicators.filter(indicator => {
      // 战略发展部审批职能部门的报告
      if (user.role === 'strategic_dept') {
        return indicator.approvalStatus === 'pending' && 
               indicator.ownerDept !== '战略发展部'
      }
      
      // 职能部门审批二级学院的报告
      if (user.role === 'functional_dept') {
        return indicator.approvalStatus === 'pending' && 
               indicator.ownerDept === user.department
      }
      
      return false
    })
    
    pendingApprovals.forEach((indicator, index) => {
      approvals.push({
        id: `approval-${indicator.id}-${index}`,
        type: 'approval',
        title: '待审批：进度报告',
        content: `${indicator.responsibleDept}提交的"${indicator.indicator}"进度报告待您审批`,
        recipientRole: user.role as UserRole,
        recipientDept: user.department,
        isRead: false,
        createdAt: new Date(),
        relatedId: indicator.id,
        actionUrl: `/strategic-tasks?action=approve&id=${indicator.id}`
      })
    })
    
    return approvals
  }
  
  /**
   * 生成系统消息
   */
  const generateSystemMessages = (): Message[] => {
    return [
      {
        id: 'system-1',
        type: 'system',
        title: '系统通知：年度考核周期开始',
        content: '2026年度战略指标考核周期已开始，请各部门及时填报进度',
        recipientRole: ['strategic_dept', 'functional_dept', 'secondary_college'],
        isRead: false,
        createdAt: new Date('2026-01-01T09:00:00')
      },
      {
        id: 'system-2',
        type: 'system',
        title: '系统维护通知',
        content: '系统将于本周六22:00-23:00进行维护升级，期间可能无法访问',
        recipientRole: ['strategic_dept', 'functional_dept', 'secondary_college'],
        isRead: true,
        createdAt: new Date('2026-01-20T16:00:00')
      }
    ]
  }
  
  /**
   * 初始化消息
   * 从各个数据源生成消息
   */
  const initializeMessages = () => {
    const alerts = generateAlertMessages()
    const approvals = generateApprovalMessages()
    const systemMsgs = generateSystemMessages()
    
    messages.value = [
      ...alerts,
      ...approvals,
      ...systemMsgs
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }
  
  /**
   * 标记消息为已读
   */
  const markAsRead = (messageId: string) => {
    const message = messages.value.find(msg => msg.id === messageId)
    if (message) {
      message.isRead = true
    }
  }
  
  /**
   * 标记所有消息为已读
   */
  const markAllAsRead = () => {
    visibleMessages.value.forEach(msg => {
      msg.isRead = true
    })
  }
  
  /**
   * 清除已读消息
   */
  const clearReadMessages = () => {
    messages.value = messages.value.filter(msg => !msg.isRead || !isMessageVisibleToUser(msg))
  }
  
  /**
   * 添加新消息
   */
  const addMessage = (message: Omit<Message, 'id' | 'createdAt'>) => {
    messages.value.unshift({
      ...message,
      id: `msg-${Date.now()}-${Math.random()}`,
      createdAt: new Date()
    })
  }
  
  return {
    messages,
    visibleMessages,
    alertMessages,
    approvalMessages,
    systemMessages,
    taskMessages,
    unreadCount,
    initializeMessages,
    markAsRead,
    markAllAsRead,
    clearReadMessages,
    addMessage
  }
})
