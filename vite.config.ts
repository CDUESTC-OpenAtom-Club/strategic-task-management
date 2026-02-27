import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { fileURLToPath, URL } from 'node:url'
import { mockApiPlugin } from './src/mock/mockApiPlugin'

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
      port: 3500,
      // 只在非Mock模式下配置代理
      proxy: useMock
        ? undefined
        : {
            '/api': {
              target: env.VITE_API_TARGET || 'http://localhost:8080',
              changeOrigin: true,
              secure: false,
              rewrite: path => path,
              configure: (proxy, options) => {
                proxy.on('error', (err, req, res) => {
                  console.error('⚠️ [Proxy Error]', err.message)
                })
                proxy.on('proxyReq', (proxyReq, req, res) => {
                  console.log('📤 [Proxy Request]', req.method, req.url, '→', options.target)
                })
                proxy.on('proxyRes', (proxyRes, req, res) => {
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
      rollupOptions: {
        output: {
          manualChunks: {
            vue: ['vue', 'vue-router', 'pinia'],
            'element-plus': ['element-plus']
          }
        }
      }
    }
  }
})