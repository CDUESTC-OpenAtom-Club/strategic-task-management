/**
 * Approval Notification Service
 *
 * Handles approval-related notifications with WebSocket integration.
 * Works with the notification center and approval store.
 */

import { computed } from 'vue'
import { ElNotification } from 'element-plus'
import { useWebSocketNotifications, NotificationType } from '@/shared/api/websocket'
import type { NotificationMessage } from '@/shared/api/websocket'

/**
 * Get icon and notification type based on notification type
 */
function getNotificationConfig(type: NotificationType): { icon: string; type: 'success' | 'warning' | 'info' | 'error' } {
  switch (type) {
    case NotificationType.APPROVAL_APPROVED:
      return { icon: '✅', type: 'success' }
    case NotificationType.APPROVAL_REJECTED:
      return { icon: '❌', type: 'error' }
    case NotificationType.APPROVAL_REQUIRED:
      return { icon: '📋', type: 'warning' }
    case NotificationType.APPROVAL_NEXT_STEP:
      return { icon: '➡️', type: 'info' }
    default:
      return { icon: '📢', type: 'info' }
  }
}

/**
 * Show desktop notification via Element Plus
 */
function showElNotification(message: NotificationMessage): void {
  const config = getNotificationConfig(message.type)
  
  ElNotification({
    title: `${config.icon} ${message.title}`,
    message: message.content,
    type: config.type,
    duration: 5000,
    position: 'top-right',
    onClick: () => {
      // Navigate to approval page if it's an approval notification
      if (message.approvalInstanceId) {
        window.location.hash = `/pending-approval/${message.approvalInstanceId}`
      }
    }
  })
}

/**
 * Initialize approval notification listener
 */
export function initApprovalNotifications(): void {
  const { connect, requestNotificationPermission } = useWebSocketNotifications()
  
  // Request browser notification permission
  requestNotificationPermission()
  
  // Connect to WebSocket
  connect()
  
  // Listen for approval notifications
  window.addEventListener('approval-notification', ((event: CustomEvent<NotificationMessage>) => {
    const message = event.detail
    showElNotification(message)
  }) as EventListener)
}

/**
 * Handle notification click - navigate to approval page
 */
export function navigateToApproval(message: NotificationMessage): string | null {
  if (message.approvalInstanceId) {
    return `/pending-approval/${message.approvalInstanceId}`
  }
  if (message.entityType === 'INDICATOR_DISTRIBUTION' && message.entityId) {
    return `/strategic-task?indicatorId=${message.entityId}`
  }
  return null
}

/**
 * Format notification for display
 */
export function formatNotification(message: NotificationMessage): {
  title: string
  content: string
  time: string
  type: string
} {
  const time = new Date(message.timestamp)
  const timeStr = time.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
  
  return {
    title: message.title,
    content: message.content,
    time: timeStr,
    type: message.type
  }
}

/**
 * Composable for approval notifications
 */
export function useApprovalNotifications() {
  const wsNotifications = useWebSocketNotifications()
  
  // Filter notifications for approval-related only
  const approvalNotifications = computed(() => {
    return wsNotifications.notifications.value.filter(
      n => n.type !== NotificationType.SYSTEM
    )
  })
  
  // Approval unread count
  const approvalUnreadCount = computed(() => {
    return approvalNotifications.value.length
  })
  
  return {
    ...wsNotifications,
    approvalNotifications,
    approvalUnreadCount,
    initApprovalNotifications,
    navigateToApproval,
    formatNotification
  }
}

export default {
  initApprovalNotifications,
  navigateToApproval,
  formatNotification,
  useApprovalNotifications
}
