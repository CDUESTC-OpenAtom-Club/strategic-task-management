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
import { showBackendConnectionStatus } from './utils/apiHealth'
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
console.log(`%c🚀 战略指标管理系统 SISM v${version}`, 'color: #409EFF; font-size: 16px; font-weight: bold')
console.log(`%c📅 构建时间: ${buildTime}`, 'color: #67C23A; font-size: 12px')
console.log(`%c🌍 环境: ${import.meta.env.MODE}`, 'color: #E6A23C; font-size: 12px')

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
console.log('🚀 [Main] 应用已启动')
showBackendConnectionStatus()
