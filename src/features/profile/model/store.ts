import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useProfileStore = defineStore('profile', () => {
  const profile = ref(null)
  return { profile }
})
