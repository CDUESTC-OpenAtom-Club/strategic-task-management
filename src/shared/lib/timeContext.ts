/**
 * Time Context Store
 * 
 * Manages the current year context for the application.
 * Supports viewing historical data by switching years.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useTimeContextStore = defineStore('timeContext', () => {
  // ============ State ============
  
  /**
   * Current year being viewed (can be historical)
   */
  const currentYear = ref<number>(new Date().getFullYear())
  
  /**
   * Real current year (always the actual current year)
   */
  const realCurrentYear = computed(() => new Date().getFullYear())
  
  /**
   * Whether we're viewing historical data
   */
  const isHistoricalMode = computed(() => currentYear.value !== realCurrentYear.value)
  
  // ============ Actions ============
  
  /**
   * Set the current year context
   */
  function setYear(year: number) {
    currentYear.value = year
  }
  
  /**
   * Reset to current year
   */
  function resetToCurrentYear() {
    currentYear.value = realCurrentYear.value
  }
  
  return {
    currentYear,
    realCurrentYear,
    isHistoricalMode,
    setYear,
    resetToCurrentYear
  }
})
