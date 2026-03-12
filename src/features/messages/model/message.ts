/**
 * Message Store
 * 
 * Manages system messages and notifications.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface Message {
  id: string
  title: string
  content: string
  type: 'info' | 'warning' | 'error' | 'success'
  read: boolean
  createdAt: string
}

export const useMessageStore = defineStore('message', () => {
  // ============ State ============
  
  const messages = ref<Message[]>([])
  const loading = ref(false)
  
  // ============ Getters ============
  
  const unreadCount = computed(() => messages.value.filter(m => !m.read).length)
  
  const unreadMessages = computed(() => messages.value.filter(m => !m.read))
  
  // ============ Actions ============
  
  async function fetchMessages() {
    loading.value = true
    try {
      // TODO: Implement API call when backend is ready
      // const response = await messageApi.getMessages()
      // messages.value = response.data
      messages.value = []
    } finally {
      loading.value = false
    }
  }
  
  function markAsRead(messageId: string) {
    const message = messages.value.find(m => m.id === messageId)
    if (message) {
      message.read = true
    }
  }
  
  function markAllAsRead() {
    messages.value.forEach(m => {
      m.read = true
    })
  }
  
  function deleteMessage(messageId: string) {
    const index = messages.value.findIndex(m => m.id === messageId)
    if (index !== -1) {
      messages.value.splice(index, 1)
    }
  }
  
  return {
    messages,
    loading,
    unreadCount,
    unreadMessages,
    fetchMessages,
    markAsRead,
    markAllAsRead,
    deleteMessage
  }
})
