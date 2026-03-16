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
   * Available years for selection (current year and historical years)
   */
  const availableYears = computed(() => {
    const current = realCurrentYear.value
    const years: number[] = []
    // Include current year
    years.push(current)
    // Include past years (up to 5 years back)
    for (let i = 1; i <= 5; i++) {
      const year = current - i
      if (year >= 2020) {
        // Start from 2020
        years.push(year)
      }
    }
    return years
  })

  /**
   * Whether we're viewing historical data
   */
  const isHistoricalMode = computed(() => currentYear.value !== realCurrentYear.value)

  /**
   * Whether we're viewing current year
   */
  const isCurrentYear = computed(() => currentYear.value === realCurrentYear.value)

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

  /**
   * Get status of a year (history, current, or future)
   */
  function getYearStatus(year: number): 'history' | 'current' | 'future' {
    if (year === realCurrentYear.value) {
      return 'current'
    }
    if (year > realCurrentYear.value) {
      return 'future'
    }
    return 'history'
  }

  /**
   * Switch to a specific year
   */
  async function switchYear(year: number) {
    currentYear.value = year
  }

  return {
    currentYear,
    realCurrentYear,
    availableYears,
    isHistoricalMode,
    isCurrentYear,
    setYear,
    resetToCurrentYear,
    getYearStatus,
    switchYear
  }
})
