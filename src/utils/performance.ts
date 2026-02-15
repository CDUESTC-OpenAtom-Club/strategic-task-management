/**
 * 前端性能监控工具
 * 
 * 功能:
 * - 收集 Core Web Vitals 指标 (LCP, FID, CLS)
 * - 收集 API 请求耗时统计
 * - 提供性能数据上报接口
 * - 开发环境可在控制台查看性能报告
 * 
 * **Validates: Requirements 4.1.1, 4.1.2, 4.1.3, 4.1.4, 4.1.5**
 */

import { logger } from './logger'

// ============================================================================
// 类型定义
// ============================================================================

/**
 * Core Web Vitals 指标类型
 */
export interface WebVitalsMetrics {
  /** Largest Contentful Paint - 最大内容绘制时间 (ms) */
  lcp: number | null
  /** First Input Delay - 首次输入延迟 (ms) */
  fid: number | null
  /** Cumulative Layout Shift - 累积布局偏移 (无单位) */
  cls: number | null
  /** First Contentful Paint - 首次内容绘制时间 (ms) */
  fcp: number | null
  /** Time to First Byte - 首字节时间 (ms) */
  ttfb: number | null
}

/**
 * API 请求耗时记录
 */
export interface ApiLatencyRecord {
  /** 请求 URL */
  url: string
  /** HTTP 方法 */
  method: string
  /** 请求耗时 (ms) */
  duration: number
  /** 请求时间戳 */
  timestamp: number
  /** HTTP 状态码 */
  status?: number
  /** 是否成功 */
  success: boolean
}

/**
 * 性能指标汇总
 */
export interface PerformanceMetrics {
  /** Core Web Vitals */
  webVitals: WebVitalsMetrics
  /** API 请求耗时统计 */
  apiLatency: {
    /** 按 URL 分组的耗时记录 */
    byUrl: Map<string, number[]>
    /** 所有请求的平均耗时 */
    averageMs: number
    /** P50 耗时 */
    p50Ms: number
    /** P95 耗时 */
    p95Ms: number
    /** P99 耗时 */
    p99Ms: number
    /** 总请求数 */
    totalRequests: number
    /** 失败请求数 */
    failedRequests: number
  }
  /** 页面加载时间 (ms) */
  pageLoadTime: number | null
  /** 资源加载时间 (ms) */
  resourceLoadTime: number | null
  /** 收集时间戳 */
  collectedAt: string
}

/**
 * 性能上报配置
 */
export interface PerformanceReportConfig {
  /** 上报端点 URL */
  endpoint?: string
  /** 是否启用上报 */
  enabled: boolean
  /** 上报间隔 (ms) */
  reportInterval: number
  /** 是否在控制台输出 */
  consoleOutput: boolean
  /** 采样率 (0-1) */
  sampleRate: number
}

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_CONFIG: PerformanceReportConfig = {
  enabled: true,
  reportInterval: 60000, // 1 分钟
  consoleOutput: import.meta.env?.DEV === true,
  sampleRate: 1.0, // 100% 采样
}


// ============================================================================
// 内部状态
// ============================================================================

/** 当前配置 */
let config: PerformanceReportConfig = { ...DEFAULT_CONFIG }

/** Web Vitals 指标存储 */
const webVitals: WebVitalsMetrics = {
  lcp: null,
  fid: null,
  cls: null,
  fcp: null,
  ttfb: null,
}

/** API 请求耗时记录 */
const apiLatencyRecords: ApiLatencyRecord[] = []

/** 最大记录数量 (防止内存泄漏) */
const MAX_RECORDS = 1000

/** 是否已初始化 */
let isInitialized = false

/** 定时上报定时器 */
let reportTimer: ReturnType<typeof setInterval> | null = null

// ============================================================================
// Core Web Vitals 收集 (Task 9.1.1)
// ============================================================================

/**
 * 初始化 Core Web Vitals 收集
 * 使用 PerformanceObserver API 收集 LCP, FID, CLS 等指标
 * 
 * **Validates: Requirements 4.1.1**
 */
function initWebVitalsCollection(): void {
  // 检查浏览器是否支持 PerformanceObserver
  if (typeof PerformanceObserver === 'undefined') {
    logger.warn('[Performance] PerformanceObserver not supported')
    return
  }

  // 收集 LCP (Largest Contentful Paint)
  try {
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries()
      const lastEntry = entries[entries.length - 1] as PerformanceEntry & { startTime: number }
      if (lastEntry) {
        webVitals.lcp = lastEntry.startTime
        logger.debug('[Performance] LCP:', webVitals.lcp, 'ms')
      }
    })
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })
  } catch (e) {
    logger.debug('[Performance] LCP observer not supported')
  }

  // 收集 FID (First Input Delay)
  try {
    const fidObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries()
      const firstEntry = entries[0] as PerformanceEntry & { processingStart: number; startTime: number }
      if (firstEntry) {
        webVitals.fid = firstEntry.processingStart - firstEntry.startTime
        logger.debug('[Performance] FID:', webVitals.fid, 'ms')
      }
    })
    fidObserver.observe({ type: 'first-input', buffered: true })
  } catch (e) {
    logger.debug('[Performance] FID observer not supported')
  }

  // 收集 CLS (Cumulative Layout Shift)
  try {
    let clsValue = 0
    const clsObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        const layoutShiftEntry = entry as PerformanceEntry & { hadRecentInput: boolean; value: number }
        if (!layoutShiftEntry.hadRecentInput) {
          clsValue += layoutShiftEntry.value
          webVitals.cls = clsValue
          logger.debug('[Performance] CLS:', webVitals.cls)
        }
      }
    })
    clsObserver.observe({ type: 'layout-shift', buffered: true })
  } catch (e) {
    logger.debug('[Performance] CLS observer not supported')
  }

  // 收集 FCP (First Contentful Paint)
  try {
    const fcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries()
      const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint')
      if (fcpEntry) {
        webVitals.fcp = fcpEntry.startTime
        logger.debug('[Performance] FCP:', webVitals.fcp, 'ms')
      }
    })
    fcpObserver.observe({ type: 'paint', buffered: true })
  } catch (e) {
    logger.debug('[Performance] FCP observer not supported')
  }

  // 收集 TTFB (Time to First Byte)
  try {
    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
    if (navEntries.length > 0) {
      webVitals.ttfb = navEntries[0].responseStart - navEntries[0].requestStart
      logger.debug('[Performance] TTFB:', webVitals.ttfb, 'ms')
    }
  } catch (e) {
    logger.debug('[Performance] TTFB collection failed')
  }
}


// ============================================================================
// API 请求耗时统计 (Task 9.1.2)
// ============================================================================

/**
 * 记录 API 请求耗时
 * 
 * @param url 请求 URL
 * @param method HTTP 方法
 * @param duration 请求耗时 (ms)
 * @param status HTTP 状态码
 * @param success 是否成功
 * 
 * **Validates: Requirements 4.1.2**
 */
export function recordApiLatency(
  url: string,
  method: string,
  duration: number,
  status?: number,
  success: boolean = true
): void {
  // 规范化 URL (移除查询参数和动态 ID)
  const normalizedUrl = normalizeUrl(url)

  const record: ApiLatencyRecord = {
    url: normalizedUrl,
    method: method.toUpperCase(),
    duration,
    timestamp: Date.now(),
    status,
    success,
  }

  // 添加记录
  apiLatencyRecords.push(record)

  // 防止内存泄漏，保留最近的记录
  if (apiLatencyRecords.length > MAX_RECORDS) {
    apiLatencyRecords.splice(0, apiLatencyRecords.length - MAX_RECORDS)
  }

  logger.debug('[Performance] API Latency:', {
    url: normalizedUrl,
    method,
    duration: `${duration}ms`,
    success,
  })
}

/**
 * 规范化 URL
 * - 移除查询参数
 * - 将动态 ID 替换为占位符
 */
function normalizeUrl(url: string): string {
  // 移除查询参数
  let normalized = url.split('?')[0]
  
  // 将数字 ID 替换为 :id 占位符
  normalized = normalized.replace(/\/\d+/g, '/:id')
  
  // 将 UUID 替换为 :uuid 占位符
  normalized = normalized.replace(
    /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    '/:uuid'
  )
  
  return normalized
}

/**
 * 计算百分位数
 */
function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0
  
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((percentile / 100) * sorted.length) - 1
  return sorted[Math.max(0, index)]
}

/**
 * 获取 API 耗时统计
 */
function getApiLatencyStats(): PerformanceMetrics['apiLatency'] {
  const byUrl = new Map<string, number[]>()
  const allDurations: number[] = []
  let failedCount = 0

  for (const record of apiLatencyRecords) {
    // 按 URL 分组
    const key = `${record.method} ${record.url}`
    if (!byUrl.has(key)) {
      byUrl.set(key, [])
    }
    byUrl.get(key)!.push(record.duration)
    
    // 收集所有耗时
    allDurations.push(record.duration)
    
    // 统计失败数
    if (!record.success) {
      failedCount++
    }
  }

  const totalRequests = apiLatencyRecords.length
  const averageMs = totalRequests > 0
    ? allDurations.reduce((sum, d) => sum + d, 0) / totalRequests
    : 0

  return {
    byUrl,
    averageMs: Math.round(averageMs * 100) / 100,
    p50Ms: calculatePercentile(allDurations, 50),
    p95Ms: calculatePercentile(allDurations, 95),
    p99Ms: calculatePercentile(allDurations, 99),
    totalRequests,
    failedRequests: failedCount,
  }
}


// ============================================================================
// 性能数据上报接口 (Task 9.1.3)
// ============================================================================

/**
 * 获取页面加载时间
 */
function getPageLoadTime(): number | null {
  try {
    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
    if (navEntries.length > 0) {
      return navEntries[0].loadEventEnd - navEntries[0].startTime
    }
  } catch (e) {
    logger.debug('[Performance] Page load time collection failed')
  }
  return null
}

/**
 * 获取资源加载时间
 */
function getResourceLoadTime(): number | null {
  try {
    const resourceEntries = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
    if (resourceEntries.length > 0) {
      const totalDuration = resourceEntries.reduce((sum, entry) => sum + entry.duration, 0)
      return totalDuration
    }
  } catch (e) {
    logger.debug('[Performance] Resource load time collection failed')
  }
  return null
}

/**
 * 收集所有性能指标
 * 
 * **Validates: Requirements 4.1.3, 4.1.4**
 */
export function collectMetrics(): PerformanceMetrics {
  return {
    webVitals: { ...webVitals },
    apiLatency: getApiLatencyStats(),
    pageLoadTime: getPageLoadTime(),
    resourceLoadTime: getResourceLoadTime(),
    collectedAt: new Date().toISOString(),
  }
}

/**
 * 上报性能数据到后端
 * 
 * @param metrics 性能指标
 * @param endpoint 上报端点 (可选，使用配置中的端点)
 * 
 * **Validates: Requirements 4.1.4**
 */
export async function reportMetrics(
  metrics?: PerformanceMetrics,
  endpoint?: string
): Promise<boolean> {
  // 检查是否启用上报
  if (!config.enabled) {
    logger.debug('[Performance] Reporting disabled')
    return false
  }

  // 采样检查
  if (Math.random() > config.sampleRate) {
    logger.debug('[Performance] Skipped by sampling')
    return false
  }

  const data = metrics || collectMetrics()
  const reportEndpoint = endpoint || config.endpoint

  // 控制台输出 (开发环境)
  if (config.consoleOutput) {
    printPerformanceReport(data)
  }

  // 如果没有配置上报端点，只输出到控制台
  if (!reportEndpoint) {
    logger.debug('[Performance] No endpoint configured, skipping remote report')
    return true
  }

  try {
    // 使用 sendBeacon 进行非阻塞上报
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
      const success = navigator.sendBeacon(reportEndpoint, blob)
      if (success) {
        logger.debug('[Performance] Metrics reported via sendBeacon')
        return true
      }
    }

    // 降级到 fetch
    const response = await fetch(reportEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      keepalive: true,
    })

    if (response.ok) {
      logger.debug('[Performance] Metrics reported via fetch')
      return true
    } else {
      logger.warn('[Performance] Report failed:', response.status)
      return false
    }
  } catch (error) {
    logger.warn('[Performance] Report error:', error)
    return false
  }
}

/**
 * 在控制台打印性能报告
 * 
 * **Validates: Requirements 4.1.5**
 */
export function printPerformanceReport(metrics?: PerformanceMetrics): void {
  const data = metrics || collectMetrics()

  console.group('📊 Performance Report')
  
  // Web Vitals
  console.group('🌐 Core Web Vitals')
  console.table({
    'LCP (Largest Contentful Paint)': {
      value: data.webVitals.lcp !== null ? `${data.webVitals.lcp.toFixed(2)} ms` : 'N/A',
      status: getVitalStatus('lcp', data.webVitals.lcp),
    },
    'FID (First Input Delay)': {
      value: data.webVitals.fid !== null ? `${data.webVitals.fid.toFixed(2)} ms` : 'N/A',
      status: getVitalStatus('fid', data.webVitals.fid),
    },
    'CLS (Cumulative Layout Shift)': {
      value: data.webVitals.cls !== null ? data.webVitals.cls.toFixed(4) : 'N/A',
      status: getVitalStatus('cls', data.webVitals.cls),
    },
    'FCP (First Contentful Paint)': {
      value: data.webVitals.fcp !== null ? `${data.webVitals.fcp.toFixed(2)} ms` : 'N/A',
      status: getVitalStatus('fcp', data.webVitals.fcp),
    },
    'TTFB (Time to First Byte)': {
      value: data.webVitals.ttfb !== null ? `${data.webVitals.ttfb.toFixed(2)} ms` : 'N/A',
      status: getVitalStatus('ttfb', data.webVitals.ttfb),
    },
  })
  console.groupEnd()

  // API Latency
  console.group('🔗 API Latency')
  console.log(`Total Requests: ${data.apiLatency.totalRequests}`)
  console.log(`Failed Requests: ${data.apiLatency.failedRequests}`)
  console.log(`Average: ${data.apiLatency.averageMs.toFixed(2)} ms`)
  console.log(`P50: ${data.apiLatency.p50Ms} ms`)
  console.log(`P95: ${data.apiLatency.p95Ms} ms`)
  console.log(`P99: ${data.apiLatency.p99Ms} ms`)
  
  if (data.apiLatency.byUrl.size > 0) {
    console.group('By Endpoint')
    for (const [url, durations] of data.apiLatency.byUrl) {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length
      console.log(`${url}: avg ${avg.toFixed(2)} ms (${durations.length} requests)`)
    }
    console.groupEnd()
  }
  console.groupEnd()

  // Page Load
  console.group('📄 Page Load')
  console.log(`Page Load Time: ${data.pageLoadTime !== null ? `${data.pageLoadTime.toFixed(2)} ms` : 'N/A'}`)
  console.log(`Resource Load Time: ${data.resourceLoadTime !== null ? `${data.resourceLoadTime.toFixed(2)} ms` : 'N/A'}`)
  console.groupEnd()

  console.log(`Collected at: ${data.collectedAt}`)
  console.groupEnd()
}

/**
 * 获取 Web Vital 指标状态
 */
function getVitalStatus(metric: string, value: number | null): string {
  if (value === null) return '⚪ N/A'

  // 阈值参考: https://web.dev/vitals/
  const thresholds: Record<string, { good: number; needsImprovement: number }> = {
    lcp: { good: 2500, needsImprovement: 4000 },
    fid: { good: 100, needsImprovement: 300 },
    cls: { good: 0.1, needsImprovement: 0.25 },
    fcp: { good: 1800, needsImprovement: 3000 },
    ttfb: { good: 800, needsImprovement: 1800 },
  }

  const threshold = thresholds[metric]
  if (!threshold) return '⚪ Unknown'

  if (value <= threshold.good) return '🟢 Good'
  if (value <= threshold.needsImprovement) return '🟡 Needs Improvement'
  return '🔴 Poor'
}


// ============================================================================
// 初始化和配置
// ============================================================================

/**
 * 初始化性能监控
 * 
 * @param customConfig 自定义配置
 */
export function initPerformanceMonitor(customConfig?: Partial<PerformanceReportConfig>): void {
  if (isInitialized) {
    logger.warn('[Performance] Already initialized')
    return
  }

  // 合并配置
  config = { ...DEFAULT_CONFIG, ...customConfig }

  logger.info('[Performance] Initializing performance monitor', {
    enabled: config.enabled,
    consoleOutput: config.consoleOutput,
    sampleRate: config.sampleRate,
  })

  // 初始化 Web Vitals 收集
  initWebVitalsCollection()

  // 设置定时上报
  if (config.enabled && config.reportInterval > 0) {
    reportTimer = setInterval(() => {
      reportMetrics()
    }, config.reportInterval)
  }

  // 页面卸载时上报
  if (typeof window !== 'undefined') {
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        reportMetrics()
      }
    })

    window.addEventListener('beforeunload', () => {
      reportMetrics()
    })
  }

  isInitialized = true
  logger.info('[Performance] Performance monitor initialized')
}

/**
 * 更新配置
 */
export function updateConfig(newConfig: Partial<PerformanceReportConfig>): void {
  config = { ...config, ...newConfig }
  logger.debug('[Performance] Config updated:', config)
}

/**
 * 获取当前配置
 */
export function getConfig(): PerformanceReportConfig {
  return { ...config }
}

/**
 * 停止性能监控
 */
export function stopPerformanceMonitor(): void {
  if (reportTimer) {
    clearInterval(reportTimer)
    reportTimer = null
  }
  isInitialized = false
  logger.info('[Performance] Performance monitor stopped')
}

/**
 * 清除所有记录
 */
export function clearRecords(): void {
  apiLatencyRecords.length = 0
  logger.debug('[Performance] Records cleared')
}

/**
 * 获取原始 API 耗时记录
 */
export function getApiLatencyRecords(): ApiLatencyRecord[] {
  return [...apiLatencyRecords]
}

/**
 * 获取 Web Vitals 指标
 */
export function getWebVitals(): WebVitalsMetrics {
  return { ...webVitals }
}

// ============================================================================
// 导出性能监控单例
// ============================================================================

export const performanceMonitor = {
  init: initPerformanceMonitor,
  stop: stopPerformanceMonitor,
  collect: collectMetrics,
  report: reportMetrics,
  print: printPerformanceReport,
  recordApiLatency,
  getWebVitals,
  getApiLatencyRecords,
  clearRecords,
  updateConfig,
  getConfig,
}

export default performanceMonitor
