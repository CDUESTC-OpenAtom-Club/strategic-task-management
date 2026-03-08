import { createApp } from 'vue'
// Element Plus样式（自动按需导入组件时仍需样式）
import 'element-plus/dist/index.css'
// Element Plus Icons样式
import '@element-plus/icons-vue'
import { createPinia } from 'pinia'
import router from './router'
import './style.css'
import './unified-styles.css'
import './colors.css'
import App from './App.vue'
import { autoHealthCheck } from './utils/apiHealth'
import { performanceMonitor } from './utils/performance'

const app = createApp(App)
const pinia = createPinia()

// Use plugins
app.use(pinia)
app.use(router)

// Global error handling
app.config.errorHandler = (err, vm, info) => {
  console.error('Global error:', err)
  console.error('Error info:', info)
}

// Mount app
app.mount('#app')

// 打印应用版本信息
const version = import.meta.env.VITE_APP_VERSION || '1.0.1'
const buildTime = new Date().toISOString()
if (import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.log(`%c🚀 战略指标管理系统 SISM v${version}`, 'color: #409EFF; font-size: 16px; font-weight: bold')
  // eslint-disable-next-line no-console
  console.log(`%c📅 构建时间: ${buildTime}`, 'color: #67C23A; font-size: 12px')
  // eslint-disable-next-line no-console
  console.log(`%c🌍 环境: ${import.meta.env.MODE}`, 'color: #E6A23C; font-size: 12px')
}

// 初始化性能监控
// **Validates: Requirements 4.1.1, 4.1.2, 4.1.3, 4.1.4, 4.1.5**
performanceMonitor.init({
  enabled: true,
  consoleOutput: import.meta.env.DEV, // 开发环境在控制台输出
  reportInterval: 60000, // 每分钟上报一次
  sampleRate: 1.0, // 100% 采样
  // endpoint: '/api/v1/metrics/performance', // 可配置上报端点
})

// 开发环境下自动运行API健康检查
if (import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.log('🚀 [Main] 应用已启动')
}
autoHealthCheck()

// 开发环境下暴露调试工具到全局
if (import.meta.env.DEV) {
  // 暴露 stores 到全局，方便在控制台调试
  import('./stores/auth').then(({ useAuthStore }) => {
    const authStore = useAuthStore()
    interface DebugTools {
      authStore: ReturnType<typeof useAuthStore>
      tokenManager: unknown
      pinia: typeof pinia
    }
    ;(window as Window & { __DEBUG__: DebugTools }).__DEBUG__ = {
      authStore,
      tokenManager: null,
      pinia,
    }
    
    // 延迟加载 tokenManager
    import('./utils/tokenManager').then(({ tokenManager }) => {
      ;(window as Window & { __DEBUG__: DebugTools }).__DEBUG__.tokenManager = tokenManager
    })
    
    // eslint-disable-next-line no-console
    console.log('%c🔧 调试工具已加载', 'color: #E6A23C; font-size: 14px; font-weight: bold')
    // eslint-disable-next-line no-console
    console.log('%c使用 window.__DEBUG__ 访问调试工具', 'color: #909399; font-size: 12px')
    // eslint-disable-next-line no-console
    console.log('%c示例: window.__DEBUG__.authStore.user', 'color: #909399; font-size: 12px')
    // eslint-disable-next-line no-console
    console.log('%c示例: window.__DEBUG__.tokenManager.getAccessToken()', 'color: #909399; font-size: 12px')
  })
}
