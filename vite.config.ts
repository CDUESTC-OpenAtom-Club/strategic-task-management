import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { fileURLToPath, URL } from 'node:url'
import { mockApiPlugin } from './src/shared/api/mocks/mockApiPlugin'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set third parameter to '' to load all env variables including those without VITE_ prefix
  const env = loadEnv(mode, process.cwd(), '')

  // 检查是否启用Mock模式
  const useMock = env.VITE_USE_MOCK === 'true'

  console.log('🔧 Vite Config:', {
    mode,
    useMock,
    viteUseMock: env.VITE_USE_MOCK,
    apiTarget: env.VITE_API_TARGET || 'http://localhost:8080'
  })

  if (!useMock) {
    console.log(
      '🔗 [Proxy Enabled] API requests will be forwarded to:',
      env.VITE_API_TARGET || 'http://localhost:8080'
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
        '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
        '@views': fileURLToPath(new URL('./src/views', import.meta.url)),
        '@stores': fileURLToPath(new URL('./src/stores', import.meta.url)),
        '@types': fileURLToPath(new URL('./src/types', import.meta.url)),
        '@utils': fileURLToPath(new URL('./src/utils', import.meta.url)),
        '@api': fileURLToPath(new URL('./src/api', import.meta.url)),
        '@/features': fileURLToPath(new URL('./src/features', import.meta.url)),
        '@/shared': fileURLToPath(new URL('./src/shared', import.meta.url))
      }
    },
    server: {
      port: Number(env.VITE_DEV_SERVER_PORT) || 3500,
      open: env.VITE_DEV_AUTO_OPEN === 'true',
// 只在非Mock模式下配置代理
        proxy: useMock
          ? undefined
          : {
              '/api/v1': {
                target: env.VITE_API_TARGET || 'http://localhost:8080',
                changeOrigin: true,
                secure: false,
                // 保持 /api/v1 前缀，不进行路径重写
                // 前端: /api/v1/indicators → 后端: /api/v1/indicators
                configure: (proxy, options) => {
                proxy.on('error', (err, _req, _res) => {
                  console.error('⚠️ [Proxy Error]', err.message)
                })
                proxy.on('proxyReq', (_proxyReq, req, _res) => {
                  const targetUrl = options.target ? options.target + (req.url || '') : req.url
                  console.log('📤 [Proxy Request]', req.method, req.url, '→', targetUrl)
                })
                proxy.on('proxyRes', (proxyRes, req, _res) => {
                  console.log('📥 [Proxy Response]', proxyRes.statusCode, req.url)
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
            if (id.includes('/src/shared/ui/')) {
              return 'shared-ui'
            }
            // shared/lib 工具
            if (id.includes('/src/shared/lib/')) {
              return 'shared-lib'
            }
            // features 模块
            if (id.includes('/src/features/')) {
              // features 按功能分组
              if (id.includes('/features/dashboard/')) {
                return 'feature-dashboard'
              }
              if (id.includes('/features/admin/')) {
                return 'feature-admin'
              }
              if (id.includes('/features/auth/')) {
                return 'feature-auth'
              }
              if (id.includes('/features/plan/')) {
                return 'feature-plan'
              }
              if (id.includes('/features/task/')) {
                return 'feature-task'
              }
              if (id.includes('/features/strategic-indicator/')) {
                return 'feature-indicator'
              }
              if (id.includes('/features/approval/')) {
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
          drop_console: true, // 生产环境移除 console
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info', 'console.debug']
        }
      }
    }
  }
})
