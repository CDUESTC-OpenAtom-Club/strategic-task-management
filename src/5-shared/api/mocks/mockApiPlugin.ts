import type { Plugin } from 'vite'
import { mockApiMiddleware } from './mockApiMiddleware'

// 创建一个Vite插件，用于在Mock模式下处理API请求
export function mockApiPlugin(): Plugin {
  return {
    name: 'mock-api-plugin',
    configureServer(server) {
      // 在Mock模式下，添加中间件处理API请求
      server.middlewares.use(mockApiMiddleware)
    }
  }
}
