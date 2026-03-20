import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { fileURLToPath, URL } from 'node:url'
import { mockApiPlugin } from './src/5-shared/api/mocks/mockApiPlugin'

const prebundleEntries = [
  'index.html',
  'src/1-app/layouts/AppLayout.vue',
  'src/3-features/auth/ui/LoginView.vue',
  'src/3-features/task/ui/StrategicTaskView.vue'
]

const prebundleIncludes = [
  'vue',
  'vue-router',
  'pinia',
  '@element-plus/icons-vue',
  'element-plus/es',
  'element-plus/es/components/base/style/css',
  'element-plus/es/components/alert/style/css',
  'element-plus/es/components/avatar/style/css',
  'element-plus/es/components/badge/style/css',
  'element-plus/es/components/breadcrumb/style/css',
  'element-plus/es/components/breadcrumb-item/style/css',
  'element-plus/es/components/button/style/css',
  'element-plus/es/components/button-group/style/css',
  'element-plus/es/components/card/style/css',
  'element-plus/es/components/checkbox/style/css',
  'element-plus/es/components/col/style/css',
  'element-plus/es/components/date-picker/style/css',
  'element-plus/es/components/descriptions/style/css',
  'element-plus/es/components/descriptions-item/style/css',
  'element-plus/es/components/dialog/style/css',
  'element-plus/es/components/divider/style/css',
  'element-plus/es/components/drawer/style/css',
  'element-plus/es/components/dropdown/style/css',
  'element-plus/es/components/dropdown-item/style/css',
  'element-plus/es/components/dropdown-menu/style/css',
  'element-plus/es/components/empty/style/css',
  'element-plus/es/components/form/style/css',
  'element-plus/es/components/form-item/style/css',
  'element-plus/es/components/icon/style/css',
  'element-plus/es/components/input/style/css',
  'element-plus/es/components/input-number/style/css',
  'element-plus/es/components/loading/style/css',
  'element-plus/es/components/option/style/css',
  'element-plus/es/components/pagination/style/css',
  'element-plus/es/components/popover/style/css',
  'element-plus/es/components/progress/style/css',
  'element-plus/es/components/radio/style/css',
  'element-plus/es/components/radio-group/style/css',
  'element-plus/es/components/row/style/css',
  'element-plus/es/components/select/style/css',
  'element-plus/es/components/skeleton/style/css',
  'element-plus/es/components/skeleton-item/style/css',
  'element-plus/es/components/step/style/css',
  'element-plus/es/components/steps/style/css',
  'element-plus/es/components/table/style/css',
  'element-plus/es/components/table-column/style/css',
  'element-plus/es/components/tag/style/css',
  'element-plus/es/components/timeline/style/css',
  'element-plus/es/components/timeline-item/style/css',
  'element-plus/es/components/tooltip/style/css'
]

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
      alias: [
        { find: /^@\/app\//, replacement: `${fileURLToPath(new URL('./src/1-app', import.meta.url))}/` },
        { find: /^@\/features\//, replacement: `${fileURLToPath(new URL('./src/3-features', import.meta.url))}/` },
        { find: /^@\/entities\//, replacement: `${fileURLToPath(new URL('./src/4-entities', import.meta.url))}/` },
        { find: /^@\/shared\//, replacement: `${fileURLToPath(new URL('./src/5-shared', import.meta.url))}/` },
        { find: /^@\/processes\//, replacement: `${fileURLToPath(new URL('./src/6-processes', import.meta.url))}/` },
        { find: /^@\//, replacement: `${fileURLToPath(new URL('./src', import.meta.url))}/` }
      ]
    },
    optimizeDeps: {
      entries: prebundleEntries,
      include: prebundleIncludes
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
                  const targetOrigin = options.target ? String(options.target) : ''
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
