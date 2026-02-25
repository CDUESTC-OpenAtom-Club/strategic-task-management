import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set third parameter to '' to load all env variables, including those without VITE_ prefix
  const env = loadEnv(mode, process.cwd(), '')

  // 检查是否启用 Mock 模式
  const useMock = env.VITE_USE_MOCK === 'true'

  console.log('🔧 Vite Config:', {
    mode,
    useMock,
    viteUseMock: env.VITE_USE_MOCK,
    apiTarget: env.VITE_API_TARGET || 'http://localhost:8080'
  })

  if (!useMock) {
    console.log(
      '🌐 [Proxy Enabled] API requests will be forwarded to:',
      env.VITE_API_TARGET || 'http://localhost:8080'
    )
  } else {
    console.log('🎭 [Mock Mode] Using local mock data')
  }

  return {
    plugins: [
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
      // 只在非 Mock 模式下配置代理
      proxy: useMock
        ? undefined
        : {
            '/api': {
              target: env.VITE_API_TARGET || 'http://localhost:8080',
              changeOrigin: true,
              secure: false,
              rewrite: path => path,
              configure: (proxy, _options) => {
                proxy.on('error', (err, _req, _res) => {
                  console.error('❌ [Proxy Error]', err.message)
                })
                proxy.on('proxyReq', (_proxyReq, req, _res) => {
                  console.log('📤 [Proxy Request]', req.method, req.url, '→', _options.target)
                })
                proxy.on('proxyRes', (proxyRes, req, _res) => {
                  console.log('📥 [Proxy Response]', proxyRes.statusCode, req.url)
                })
              }
            }
          }
    },
    build: {
      // Production build optimizations
      target: 'es2020',
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: mode !== 'production', // Disable sourcemaps in production
      minify: 'esbuild', // Use esbuild for minification (built-in, faster than terser)
      rollupOptions: {
        output: {
          // Chunk splitting for better caching
          manualChunks: {
            'vue-vendor': ['vue', 'vue-router', 'pinia'],
            'element-plus': ['element-plus'],
            echarts: ['echarts'],
            utils: ['axios', 'dayjs']
          },
          // Asset file naming
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: assetInfo => {
            const info = assetInfo.name?.split('.') || []
            const ext = info[info.length - 1]
            if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(assetInfo.name || '')) {
              return 'assets/images/[name]-[hash][extname]'
            }
            if (/\.(woff2?|eot|ttf|otf)$/i.test(assetInfo.name || '')) {
              return 'assets/fonts/[name]-[hash][extname]'
            }
            if (ext === 'css') {
              return 'assets/css/[name]-[hash][extname]'
            }
            return 'assets/[name]-[hash][extname]'
          }
        }
      },
      // Chunk size warning limit
      chunkSizeWarningLimit: 1000
    },
    // Define global constants
    define: {
      __APP_VERSION__: JSON.stringify(env.VITE_APP_VERSION || '1.0.0')
    }
  }
})
