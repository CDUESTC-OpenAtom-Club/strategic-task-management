/**
 * 前端配置验证测试
 * 验证前端端口、API配置、Mock模式等
 */

import { describe, it, expect } from 'vitest'
import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFileSync } from 'node:fs'

// 加载环境变量
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const env = config({ path: join(__dirname, '..', '.env.example') })

describe('前端配置验证', () => {
  it('应该正确加载环境变量', () => {
    expect(env.parsed).toBeDefined()
    expect(env.parsed.VITE_API_BASE_URL).toBeDefined()
    expect(env.parsed.VITE_DEV_SERVER_PORT).toBeDefined()
    expect(env.parsed.VITE_USE_MOCK).toBeDefined()
    expect(env.parsed.VITE_WS_BASE_URL).toBeDefined()
  })

  it('API基础URL应该是 /api/v1', () => {
    expect(env.parsed.VITE_API_BASE_URL).toBe('/api/v1')
  })

  it('开发服务器端口应该是 3500', () => {
    expect(env.parsed.VITE_DEV_SERVER_PORT).toBe('3500')
  })

  it('Mock模式在模板中应该默认关闭', () => {
    expect(env.parsed.VITE_USE_MOCK).toBe('false')
  })

  it('API目标地址应该是 localhost:8080', () => {
    expect(env.parsed.VITE_API_TARGET).toBe('http://localhost:8080')
  })

  it('WebSocket基础地址默认应留空以便自动推导', () => {
    expect(env.parsed.VITE_WS_BASE_URL).toBe('')
  })
})

describe('Vite配置验证', () => {
  it('Vite代理配置应该使用 /api/v1', () => {
    const viteConfigSource = readFileSync(join(__dirname, '..', 'vite.config.ts'), 'utf-8')

    expect(viteConfigSource).toContain("'/api/v1'")
    expect(viteConfigSource).toContain("'/ws/notifications'")
    expect(viteConfigSource).toContain("port: Number(env.VITE_DEV_SERVER_PORT) || 3500")
    expect(viteConfigSource).toContain("open: env.VITE_DEV_AUTO_OPEN === 'true'")
  })
})
