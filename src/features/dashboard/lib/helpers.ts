/**
 * Dashboard Feature - Helper Functions
 *
 * Internal helper functions for dashboard feature.
 */

import type { ComparisonItem } from '@/types'
import { getProgressStatus } from '@/shared/lib/utils/colors'
import { ALERT_THRESHOLDS, COLLEGE_SUFFIXES } from '../model/constants'

/**
 * Get alert level based on progress
 */
export function getAlertLevel(progress: number): 'severe' | 'moderate' | 'normal' {
  if (progress < ALERT_THRESHOLDS.SEVERE) {
    return 'severe'
  }
  if (progress < ALERT_THRESHOLDS.MODERATE) {
    return 'moderate'
  }
  return 'normal'
}

/**
 * Check if department name is a secondary college
 */
export function isSecondaryCollege(deptName?: string): boolean {
  if (!deptName) {
    return false
  }
  return COLLEGE_SUFFIXES.some(suffix => deptName.endsWith(suffix))
}

/**
 * Get indicator progress at specific date
 */
export function getIndicatorProgressAtDate(
  indicator: StrategicIndicator,
  targetDate: Date
): number {
  // If no audit records, return current progress
  if (!indicator.statusAudit || indicator.statusAudit.length === 0) {
    return indicator.progress
  }

  // Find the most recent audit record before target date
  const targetTime = targetDate.getTime()
  let latestProgress = 0 // Default to 0

  // Sort audit records by time
  const sortedAudits = [...indicator.statusAudit].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  // Find the last progress update before target time
  for (const audit of sortedAudits) {
    const auditTime = new Date(audit.timestamp).getTime()
    if (auditTime <= targetTime) {
      // If approval passed, use newProgress
      if (audit.action === 'approve' && audit.newProgress !== undefined) {
        latestProgress = audit.newProgress
      }
    } else {
      break // Already passed target time, stop searching
    }
  }

  return latestProgress
}

/**
 * Aggregate indicators by department
 */
export function aggregateByDepartment(
  indicators: StrategicIndicator[],
  groupField: keyof StrategicIndicator = 'responsibleDept'
): ComparisonItem[] {
  const deptMap = new Map<
    string,
    {
      totalProgress: number
      totalWeight: number
      count: number
      completed: number
      alerts: number
    }
  >()

  indicators.forEach(indicator => {
    const deptName = indicator[groupField] as string
    if (!deptName) {
      return
    } // Skip indicators without department

    if (!deptMap.has(deptName)) {
      deptMap.set(deptName, {
        totalProgress: 0,
        totalWeight: 0,
        count: 0,
        completed: 0,
        alerts: 0
      })
    }

    const data = deptMap.get(deptName)
    if (!data) {
      return
    }
    data.totalProgress += indicator.progress * indicator.weight
    data.totalWeight += indicator.weight
    data.count += 1
    if (indicator.progress >= 100) {
      data.completed += 1
    }
    if (indicator.progress < 60) {
      data.alerts += 1
    }
  })

  const result: ComparisonItem[] = []
  deptMap.forEach((data, deptName) => {
    const avgProgress = data.totalWeight > 0 ? Math.round(data.totalProgress / data.totalWeight) : 0
    const completionRate = data.count > 0 ? Math.round((data.completed / data.count) * 100) : 0

    result.push({
      dept: deptName,
      progress: avgProgress,
      score: Math.round(avgProgress * 1.2),
      completionRate,
      totalIndicators: data.count,
      completedIndicators: data.completed,
      alertCount: data.alerts,
      status: getProgressStatus(avgProgress),
      rank: 0 // To be filled after sorting
    })
  })

  // Sort by progress and add ranking
  result.sort((a, b) => b.progress - a.progress)
  result.forEach((item, index) => {
    item.rank = index + 1
  })

  return result
}

/**
 * Calculate alert distribution
 */
export function calculateAlertDistribution(indicators: StrategicIndicator[]) {
  const severe = indicators.filter(i => i.progress < 30).length
  const moderate = indicators.filter(i => i.progress >= 30 && i.progress < 60).length
  const normal = indicators.filter(i => i.progress >= 60).length

  return {
    severe,
    moderate,
    normal,
    total: indicators.length
  }
}

/**
 * Generate Sankey data from indicators
 */
export function generateSankeyData(indicators: StrategicIndicator[]) {
  const nodes = new Set<string>()
  const linkMap = new Map<string, number>()

  // Count actual task flows
  indicators.forEach(indicator => {
    const source = indicator.ownerDept || '战略发展部'
    const target = indicator.responsibleDept

    if (!source || !target) {
      return
    } // Skip indicators without complete department info

    nodes.add(source)
    nodes.add(target)

    const key = `${source}->${target}`
    linkMap.set(key, (linkMap.get(key) || 0) + 1)
  })

  const links = Array.from(linkMap.entries()).map(([key, count]) => {
    const [source, target] = key.split('->')
    return { source, target, value: count }
  })

  // Assign explicit levels to nodes to ensure proper layering
  const nodeList = Array.from(nodes).map(name => {
    let depth: number | undefined

    // Strategic Development at leftmost (level 0)
    if (name === '战略发展部') {
      depth = 0
    }
    // Secondary colleges at rightmost (level 2)
    else if (isSecondaryCollege(name)) {
      depth = 2
    }
    // Functional departments in middle (level 1)
    else {
      depth = 1
    }

    return { name, depth }
  })

  return {
    nodes: nodeList,
    links
  }
}

/**
 * Calculate task source distribution (for college view)
 */
export function calculateTaskSourceDistribution(
  indicators: StrategicIndicator[],
  userDepartment: string
): Array<{ name: string; value: number; percentage: number }> {
  const deptIndicators = indicators.filter(i => i.responsibleDept === userDepartment)

  if (deptIndicators.length === 0) {
    return []
  }

  const sourceMap = new Map<string, number>()
  deptIndicators.forEach(i => {
    const source = i.ownerDept || '其他'
    sourceMap.set(source, (sourceMap.get(source) || 0) + 1)
  })

  return Array.from(sourceMap.entries()).map(([name, value]) => ({
    name,
    value,
    percentage: (value / deptIndicators.length) * 100
  }))
}
