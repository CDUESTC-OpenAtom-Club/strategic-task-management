import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useMilestoneStore = defineStore('milestone', () => {
  const milestones = ref([])
  return { milestones }
})
