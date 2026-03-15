/**
 * Mock API 插件（简化版）
 * 提供基础的 mock 服务框架，确保应用能够正常启动
 * 在开发过程中提供简单的模拟数据支持
 */

import type { Plugin } from 'vite'

interface MockApiPluginOptions {
  /**
   * 是否启用 mock 服务
   */
  enable?: boolean
}

/**
 * 创建一个简单的 mock API 插件
 */
export function mockApiPlugin(options: MockApiPluginOptions = {}): Plugin {
  const { enable = true } = options

  return {
    name: 'mock-api-plugin',
    configureServer(server) {
      if (!enable) {
        return
      }

      console.log('🎭 [Mock API Plugin] 已启用基础 mock 服务')

      // 添加简单的 mock 服务中间件
      server.middlewares.use((req, res, next) => {
        // CORS 处理
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

        if (req.method === 'OPTIONS') {
          res.writeHead(200)
          res.end()
          return
        }

        // 这里可以添加简单的 mock 路由
        // 对于复杂的 mock 数据，建议使用其他方式

        next()
      })
    },
    buildEnd() {
      if (!enable) {
        return
      }

      console.log('🎭 [Mock API Plugin] 构建完成，mock 服务已停止')
    }
  }
}

/**
 * 导出默认配置
 */
export default mockApiPlugin
