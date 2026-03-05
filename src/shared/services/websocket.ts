/**
 * WebSocket Service for Real-time Notifications
 *
 * Provides WebSocket connection management for real-time approval notifications.
 */

import { ref, computed } from 'vue'

// Notification types matching backend
export enum NotificationType {
  APPROVAL_REQUIRED = 'APPROVAL_REQUIRED',
  APPROVAL_APPROVED = 'APPROVAL_APPROVED',
  APPROVAL_REJECTED = 'APPROVAL_REJECTED',
  APPROVAL_NEXT_STEP = 'APPROVAL_NEXT_STEP',
  SYSTEM = 'SYSTEM'
}

// Notification message interface
export interface NotificationMessage {
  type: NotificationType
  title: string
  content: string
  entityType?: string
  entityId?: number
  approvalInstanceId?: number
  stepName?: string
  timestamp: string
}

// WebSocket connection state
type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

// Global state
const ws = ref<WebSocket | null>(null)
const connectionState = ref<ConnectionState>('disconnected')
const notifications = ref<NotificationMessage[]>([])
const unreadCount = ref(0)

// Reconnection settings
const RECONNECT_INTERVAL = 5000
const MAX_RECONNECT_ATTEMPTS = 5
let reconnectAttempts = 0
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Get WebSocket URL based on current location
 */
function getWebSocketUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  const userId = getUserId()
  return `${protocol}//${host}/ws/notifications?userId=${userId}`
}

/**
 * Get current user ID from localStorage or auth store
 */
function getUserId(): string {
  const userStr = localStorage.getItem('user')
  if (userStr) {
    try {
      const user = JSON.parse(userStr)
      return user.id || ''
    } catch {
      return ''
    }
  }
  return ''
}

/**
 * Handle incoming WebSocket message
 */
function handleMessage(event: MessageEvent): void {
  try {
    const message: NotificationMessage = JSON.parse(event.data)
    
    // Add to notifications list
    notifications.value.unshift(message)
    
    // Increment unread count
    unreadCount.value++
    
    // Show browser notification if supported
    showBrowserNotification(message)
    
    // Dispatch custom event for other components to listen
    window.dispatchEvent(new CustomEvent('approval-notification', { detail: message }))
    
    console.log('[WebSocket] Received notification:', message)
  } catch (error) {
    console.error('[WebSocket] Failed to parse message:', error)
  }
}

/**
 * Show browser notification
 */
function showBrowserNotification(message: NotificationMessage): void {
  if (!('Notification' in window)) {
    return
  }
  
  if (Notification.permission === 'granted') {
    new Notification(message.title, {
      body: message.content,
      icon: '/favicon.ico'
    })
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification(message.title, {
          body: message.content,
          icon: '/favicon.ico'
        })
      }
    })
  }
}

/**
 * Handle WebSocket open
 */
function handleOpen(): void {
  connectionState.value = 'connected'
  reconnectAttempts = 0
  console.log('[WebSocket] Connected')
}

/**
 * Handle WebSocket close
 */
function handleClose(): void {
  connectionState.value = 'disconnected'
  ws.value = null
  
  // Attempt reconnection
  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    console.log(`[WebSocket] Reconnecting in ${RECONNECT_INTERVAL}ms (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`)
    reconnectTimer = setTimeout(() => {
      reconnectAttempts++
      connectWebSocket()
    }, RECONNECT_INTERVAL)
  } else {
    console.error('[WebSocket] Max reconnection attempts reached')
  }
}

/**
 * Handle WebSocket error
 */
function handleError(error: Event): void {
  connectionState.value = 'error'
  console.error('[WebSocket] Error:', error)
}

/**
 * Connect to WebSocket server
 */
export function connectWebSocket(): void {
  if (ws.value?.readyState === WebSocket.OPEN) {
    console.log('[WebSocket] Already connected')
    return
  }
  
  const userId = getUserId()
  if (!userId) {
    console.warn('[WebSocket] No user ID, skipping connection')
    return
  }
  
  connectionState.value = 'connecting'
  
  try {
    const url = getWebSocketUrl()
    ws.value = new WebSocket(url)
    
    ws.value.onopen = handleOpen
    ws.value.onmessage = handleMessage
    ws.value.onclose = handleClose
    ws.value.onerror = handleError
    
    console.log('[WebSocket] Connecting to:', url)
  } catch (error) {
    connectionState.value = 'error'
    console.error('[WebSocket] Connection failed:', error)
  }
}

/**
 * Disconnect WebSocket
 */
export function disconnectWebSocket(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  
  if (ws.value) {
    ws.value.close()
    ws.value = null
  }
  
  connectionState.value = 'disconnected'
  console.log('[WebSocket] Disconnected')
}

/**
 * Mark notification as read
 */
export function markAsRead(index: number): void {
  if (index >= 0 && index < notifications.value.length) {
    notifications.value.splice(index, 1)
    if (unreadCount.value > 0) {
      unreadCount.value--
    }
  }
}

/**
 * Mark all notifications as read
 */
export function markAllAsRead(): void {
  notifications.value = []
  unreadCount.value = 0
}

/**
 * Clear all notifications
 */
export function clearNotifications(): void {
  notifications.value = []
  unreadCount.value = 0
}

/**
 * Request browser notification permission
 */
export function requestNotificationPermission(): void {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }
}

/**
 * Composable for using WebSocket notifications
 */
export function useWebSocketNotifications() {
  return {
    // State
    connectionState: computed(() => connectionState.value),
    notifications: computed(() => notifications.value),
    unreadCount: computed(() => unreadCount.value),
    isConnected: computed(() => connectionState.value === 'connected'),
    
    // Actions
    connect: connectWebSocket,
    disconnect: disconnectWebSocket,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    requestNotificationPermission
  }
}

export default {
  connectWebSocket,
  disconnectWebSocket,
  useWebSocketNotifications,
  NotificationType
}
