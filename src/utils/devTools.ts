/**
 * 开发环境数据检查工具
 * 
 * 在开发环境下提供数据检查入口，支持控制台输出检查报告
 * 
 * Requirements: 8.4
 */
import { pageDataChecker } from '@/services/pageDataChecker'
import { useStrategicStore } from '@/stores/strategic'

/**
 * 运行页面数据检查
 * 
 * 在浏览器控制台中调用: window.__checkPageData()
 */
export function runPageDataCheck(): void {
  if (import.meta.env.PROD) {
    console.warn('页面数据检查仅在开发环境可用')
    return
  }

  const strategicStore = useStrategicStore()
  const indicators = strategicStore.indicators
  const dataSource = strategicStore.dataSource

  console.log('🔍 开始页面数据检查...')

  const results = [
    pageDataChecker.checkDashboardData(indicators, dataSource),
    pageDataChecker.checkIndicatorListData(indicators, dataSource),
    pageDataChecker.checkStrategicTaskData(indicators, dataSource)
  ]

  const report = pageDataChecker.generateReport(results)
  pageDataChecker.printReport(report)

  return
}

/**
 * 初始化开发工具
 * 
 * 在 main.ts 中调用以注册全局开发工具
 */
export function initDevTools(): void {
  if (import.meta.env.DEV) {
    // 注册到 window 对象，方便在控制台调用
    (window as any).__checkPageData = runPageDataCheck
    
    console.log('🛠️ 开发工具已加载')
    console.log('   - window.__checkPageData() - 运行页面数据检查')
  }
}
