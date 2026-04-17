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
import { ENABLE_WEBSOCKET_NOTIFICATIONS } from '@/shared/config/api'

export const APPROVAL_STATE_REFRESH_EVENT = 'approval-state-refresh'

export interface ApprovalStateRefreshDetail {
  source?: string
}

export interface ApprovalRoutePayload {
  approvalInstanceId?: number | string | null
  entityType?: string | null
  entityId?: number | string | null
  actionUrl?: string | null
}

let approvalNotificationListener: EventListener | null = null

export function requiresApprovalCenterFallback(payload: ApprovalRoutePayload): boolean {
  const entityType = String(payload.entityType || '')
    .trim()
    .toUpperCase()

  return entityType === 'PLAN' || entityType === 'PLAN_REPORT'
}

function normalizeApprovalQueryValue(value?: number | string | null): string | null {
  const normalized = String(value ?? '').trim()
  return normalized ? normalized : null
}

function normalizeApprovalRoute(path?: string | null): string | null {
  const normalized = String(path || '').trim()
  if (!normalized || normalized === '/messages' || normalized === '/workflow-tasks') {
    return null
  }
  return normalized
}

function appendApprovalContext(path: string, payload: ApprovalRoutePayload): string {
  const [pathname, search = ''] = path.split('?')
  const params = new URLSearchParams(search)

  params.set('openApproval', '1')

  const entityType = normalizeApprovalQueryValue(payload.entityType)?.toUpperCase()
  const entityId = normalizeApprovalQueryValue(payload.entityId)
  const approvalInstanceId = normalizeApprovalQueryValue(payload.approvalInstanceId)

  if (entityType) {
    params.set('approvalEntityType', entityType)
  }

  if (entityId) {
    params.set('approvalEntityId', entityId)
  }

  if (approvalInstanceId) {
    params.set('approvalInstanceId', approvalInstanceId)
  }

  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

export function resolveApprovalRoute(payload: ApprovalRoutePayload): string | null {
  const explicitRoute = normalizeApprovalRoute(payload.actionUrl)
  if (explicitRoute) {
    return appendApprovalContext(explicitRoute, payload)
  }

  const entityType = String(payload.entityType || '')
    .trim()
    .toUpperCase()

  switch (entityType) {
    case 'PLAN':
    case 'PLAN_REPORT':
    case 'TASK':
      return appendApprovalContext('/strategic-tasks', payload)
    case 'INDICATOR':
      return appendApprovalContext('/indicators', payload)
    case 'INDICATOR_DISTRIBUTION':
      return appendApprovalContext('/distribution', payload)
    default:
      return explicitRoute ? appendApprovalContext(explicitRoute, payload) : null
  }
}

export function notifyApprovalStateRefresh(detail: ApprovalStateRefreshDetail = {}): void {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent<ApprovalStateRefreshDetail>(APPROVAL_STATE_REFRESH_EVENT, {
      detail
    })
  )
}

/**
 * Get icon and notification type based on notification type
 */
function getNotificationConfig(type: NotificationType): {
  icon: string
  type: 'success' | 'warning' | 'info' | 'error'
} {
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
      const route = navigateToApproval(message)
      if (route) {
        window.location.hash = route
      }
    }
  })
}

/**
 * Initialize approval notification listener
 */
export function initApprovalNotifications(): void {
  if (!ENABLE_WEBSOCKET_NOTIFICATIONS) {
    return
  }

  const { connect, requestNotificationPermission } = useWebSocketNotifications()

  // Request browser notification permission
  requestNotificationPermission()

  // Connect to WebSocket
  connect()

  if (typeof window === 'undefined') {
    return
  }

  if (approvalNotificationListener) {
    window.removeEventListener('approval-notification', approvalNotificationListener)
  }

  approvalNotificationListener = ((event: CustomEvent<NotificationMessage>) => {
    const message = event.detail
    showElNotification(message)
  }) as EventListener

  window.addEventListener('approval-notification', approvalNotificationListener)
}

export function destroyApprovalNotifications(): void {
  if (typeof window === 'undefined' || !approvalNotificationListener) {
    return
  }

  window.removeEventListener('approval-notification', approvalNotificationListener)
  approvalNotificationListener = null
}

/**
 * Handle notification click - navigate to approval page
 */
export function navigateToApproval(message: NotificationMessage): string | null {
  return resolveApprovalRoute({
    approvalInstanceId: message.approvalInstanceId,
    entityType: message.entityType,
    entityId: message.entityId
  })
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
    return wsNotifications.notifications.value.filter(n => n.type !== NotificationType.SYSTEM)
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
    destroyApprovalNotifications,
    navigateToApproval,
    formatNotification
  }
}

export default {
  initApprovalNotifications,
  destroyApprovalNotifications,
  navigateToApproval,
  formatNotification,
  useApprovalNotifications
}
