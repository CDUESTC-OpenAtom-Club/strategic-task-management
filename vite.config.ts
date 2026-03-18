import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { fileURLToPath, URL } from 'node:url'
import { mockApiPlugin } from './src/5-shared/api/mocks/mockApiPlugin'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set third parameter to '' to load all env variables including those without VITE_ prefix
  const env = loadEnv(mode, process.cwd(), '')

  // 检查是否启用Mock模式
  const useMock = env.VITE_USE_MOCK === 'true'
  const apiTarget = env.VITE_API_TARGET || 'http://localhost:8080'
  const wsTarget =
    env.VITE_WS_BASE_URL ||
    (apiTarget.startsWith('https://')
      ? apiTarget.replace(/^https:/, 'wss:')
      : apiTarget.replace(/^http:/, 'ws:'))

  console.log('🔧 Vite Config:', {
    mode,
    useMock,
    viteUseMock: env.VITE_USE_MOCK,
    apiTarget,
    wsTarget
  })

  if (!useMock) {
    console.log(
      '🔗 [Proxy Enabled] API requests will be forwarded to:',
      apiTarget
    )
  } else {
    console.log('🎭 [Mock Mode] Using local mock data')
  }

  return {
    plugins: [
      // 在Mock模式下添加Mock API插件
      ...(useMock ? [mockApiPlugin()] : []),
      vue(),
      AutoImport({
        // Element Plus自动导入
        resolvers: [ElementPlusResolver()],
        // Vue相关API自动导入
        imports: ['vue', 'vue-router', 'pinia'],
        dts: 'src/auto-imports.d.ts',
        eslintrc: {
          enabled: true
        }
      }),
      Components({
        // Element Plus组件自动导入
        resolvers: [ElementPlusResolver()],
        dts: 'src/components.d.ts'
      })
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@/1-app': fileURLToPath(new URL('./src/1-app', import.meta.url)),
        '@/2-pages': fileURLToPath(new URL('./src/2-pages', import.meta.url)),
        '@/3-features': fileURLToPath(new URL('./src/3-features', import.meta.url)),
        '@/4-entities': fileURLToPath(new URL('./src/4-entities', import.meta.url)),
        '@/5-shared': fileURLToPath(new URL('./src/5-shared', import.meta.url)),
        '@/6-processes': fileURLToPath(new URL('./src/6-processes', import.meta.url))
      }
    },
    server: {
      port: Number(env.VITE_DEV_SERVER_PORT) || 3500,
      open: env.VITE_DEV_AUTO_OPEN === 'true',
      // 只在非 Mock 模式下配置代理
      proxy: useMock
        ? undefined
        : {
            '/api/v1': {
              target: apiTarget,
              changeOrigin: true,
              secure: false,
              // 保持 /api/v1 前缀，不进行路径重写
              // 前端: /api/v1/indicators → 后端: /api/v1/indicators
              configure: (proxy, options) => {
                proxy.on('error', (err, _req, _res) => {
                  console.error('⚠️ [Proxy Error]', err.message)
                })
                proxy.on('proxyReq', (proxyReq, req, _res) => {
                  // 防止后端将本地开发域名(如 127.0.0.1:3500)判定为非法 CORS Origin 导致 403。
                  // 统一将 Origin 重写为后端目标域名，保证本地联调稳定。
                  const targetOrigin = options.target
                  if (targetOrigin) {
                    proxyReq.setHeader('origin', targetOrigin)
                  } else {
                    proxyReq.removeHeader('origin')
                  }

                  const targetUrl = options.target ? options.target + (req.url || '') : req.url
                  console.log('📤 [Proxy Request]', req.method, req.url, '→', targetUrl)
                })
                proxy.on('proxyRes', (proxyRes, req, _res) => {
                  console.log('📥 [Proxy Response]', proxyRes.statusCode, req.url)
                })
              }
            },
            '/ws/notifications': {
              target: wsTarget,
              changeOrigin: true,
              secure: false,
              ws: true,
              configure: (proxy, options) => {
                proxy.on('error', (err, _req, _res) => {
                  console.error('⚠️ [WS Proxy Error]', err.message)
                })
                proxy.on('proxyReqWs', (_proxyReq, req) => {
                  const targetUrl = options.target ? options.target + (req.url || '') : req.url
                  console.log('📡 [WS Proxy Request]', req.url, '→', targetUrl)
                })
                proxy.on('open', () => {
                  console.log('✅ [WS Proxy] Tunnel opened')
                })
                proxy.on('close', () => {
                  console.log('🔌 [WS Proxy] Tunnel closed')
                })
              }
            }
          }
    },
    build: {
      // 生产环境构建优化
      sourcemap: false,
      minify: 'terser',
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          // 优化代码分割策略
          manualChunks(id) {
            // node_modules 包分组
            if (id.includes('node_modules')) {
              // Vue 核心库
              if (id.includes('vue') || id.includes('pinia') || id.includes('@vue')) {
                return 'vue-core'
              }
              // Vue Router
              if (id.includes('vue-router')) {
                return 'vue-router'
              }
              // Element Plus
              if (id.includes('element-plus') || id.includes('@element-plus')) {
                return 'element-plus'
              }
              // ECharts 相关
              if (id.includes('echarts') || id.includes('vue-echarts')) {
                return 'echarts'
              }
              // 工具库
              if (id.includes('axios') || id.includes('lodash-es') || id.includes('dayjs')) {
                return 'utils'
              }
              // Excel 处理
              if (id.includes('xlsx')) {
                return 'xlsx'
              }
              // PDF 生成
              if (id.includes('jspdf') || id.includes('html2canvas')) {
                return 'pdf'
              }
              // 其他第三方库
              return 'vendor'
            }

            // 业务代码分组
            // shared/ui 组件
            if (id.includes('/src/5-shared/ui/')) {
              return 'shared-ui'
            }
            // shared/lib 工具
            if (id.includes('/src/5-shared/lib/')) {
              return 'shared-lib'
            }
            // features 模块
            if (id.includes('/src/3-features/')) {
              if (id.includes('/3-features/dashboard/')) {
                return 'feature-dashboard'
              }
              if (id.includes('/3-features/admin/')) {
                return 'feature-admin'
              }
              if (id.includes('/3-features/auth/')) {
                return 'feature-auth'
              }
              if (id.includes('/3-features/plan/')) {
                return 'feature-plan'
              }
              if (id.includes('/3-features/task/')) {
                return 'feature-task'
              }
              if (id.includes('/3-features/indicator/')) {
                return 'feature-indicator'
              }
              if (id.includes('/3-features/approval/')) {
                return 'feature-approval'
              }
              return 'features'
            }
          },
          // 文件命名策略
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
        }
      },
      // Terser 压缩配置
      terserOptions: {
        compress: {
          drop_console: false, // 保留 console 用于错误追踪
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info', 'console.debug'] // 只移除日志类输出
        }
      }
    }
  }
})
