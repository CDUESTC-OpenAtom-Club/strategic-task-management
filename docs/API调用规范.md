# API 调用规范

## 目录

1. [API 架构](#api-架构)
2. [请求封装](#请求封装)
3. [调用方式](#调用方式)
4. [错误处理](#错误处理)
5. [性能优化](#性能优化)
6. [最佳实践](#最佳实践)

## API 架构

### 分层设计

```
src/shared/api/
├── client/              # Axios 客户端配置
│   ├── index.ts         # 基础客户端
│   └── interceptors/    # 拦截器
│       ├── auth.ts      # 认证拦截器
│       ├── error.ts     # 错误处理拦截器
│       ├── logging.ts   # 日志拦截器
│       └── performance.ts # 性能监控拦截器
├── types/               # API 类型定义
│   ├── common.ts        # 通用类型
│   └── endpoints.ts     # 端点定义
└── mocks/               # Mock 数据
    └── mockApiPlugin.ts
```

### Feature 模块 API

每个功能模块有自己的 API 层：

```
src/features/{module}/api/
├── index.ts             # API 函数
├── types.ts             # 类型定义
└── fixtures.ts          # 测试数据（可选）
```

示例：

```
src/features/auth/api/
├── index.ts             # 登录、登出等 API
├── types.ts             # LoginRequest, LoginResponse
└── fixtures.ts          # 测试用户数据
```

## 请求封装

### 基础客户端

**src/shared/api/client/index.ts**

```typescript
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import { setupInterceptors } from './interceptors'

export interface ApiClientConfig {
  baseURL: string
  timeout?: number
  useAuth?: boolean
  useMock?: boolean
}

/**
 * 创建 API 客户端
 */
export function createApiClient(config: ApiClientConfig): AxiosInstance {
  const client = axios.create({
    baseURL: config.baseURL,
    timeout: config.timeout || 30000,
    headers: {
      'Content-Type': 'application/json'
    }
  })

  // 设置拦截器
  setupInterceptors(client, config)

  return client
}
```

### 拦截器配置

**src/shared/api/client/interceptors/index.ts**

```typescript
import type { AxiosInstance } from 'axios'
import { setupAuthInterceptor } from './auth'
import { setupErrorInterceptor } from './error'
import { setupLoggingInterceptor } from './logging'
import { setupPerformanceInterceptor } from './performance'

export interface InterceptorConfig {
  useAuth?: boolean
  enableLogging?: boolean
  enablePerformance?: boolean
}

export function setupInterceptors(client: AxiosInstance, config: InterceptorConfig = {}) {
  // 认证拦截器
  if (config.useAuth !== false) {
    setupAuthInterceptor(client)
  }

  // 错误处理拦截器
  setupErrorInterceptor(client)

  // 日志拦截器（开发环境）
  if (config.enableLogging && import.meta.env.DEV) {
    setupLoggingInterceptor(client)
  }

  // 性能监控拦截器
  if (config.enablePerformance) {
    setupPerformanceInterceptor(client)
  }
}
```

### 认证拦截器

**src/shared/api/client/interceptors/auth.ts**

```typescript
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/features/auth/model/store'
import { logger } from '@/shared/lib/utils/logger'

/**
 * 设置认证拦截器
 * - 自动添加 JWT Token
 * - 处理 Token 过期
 */
export function setupAuthInterceptor(client: AxiosInstance) {
  client.interceptors.request.use(
    config => {
      const authStore = useAuthStore()

      // 添加 Token
      if (authStore.token) {
        config.headers['Authorization'] = `Bearer ${authStore.token}`
      }

      return config
    },
    error => {
      return Promise.reject(error)
    }
  )

  // 响应拦截：处理 401 错误
  client.interceptors.response.use(
    response => response,
    async error => {
      const originalRequest = error.config

      // Token 过期，尝试刷新
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true

        const authStore = useAuthStore()
        try {
          await authStore.refreshToken()

          // 重试原请求
          if (authStore.token) {
            originalRequest.headers['Authorization'] = `Bearer ${authStore.token}`
            return client(originalRequest)
          }
        } catch (refreshError) {
          // 刷新失败，跳转登录
          authStore.logout()
          window.location.href = '/login'
          return Promise.reject(refreshError)
        }
      }

      return Promise.reject(error)
    }
  )
}
```

### 错误处理拦截器

**src/shared/api/client/interceptors/error.ts**

```typescript
import type { AxiosInstance, AxiosError } from 'axios'
import { ElMessage } from 'element-plus'
import { logger } from '@/shared/lib/utils/logger'

/**
 * 设置错误处理拦截器
 * - 统一错误处理
 * - 友好错误提示
 */
export function setupErrorInterceptor(client: AxiosInstance) {
  client.interceptors.response.use(
    response => response,
    (error: AxiosError) => {
      const { response, message } = error

      // 网络错误
      if (!response) {
        handleNetworkError(message)
        return Promise.reject(error)
      }

      // HTTP 错误
      handleHttpError(response.status, response.data)

      return Promise.reject(error)
    }
  )
}

function handleNetworkError(message: string) {
  logger.error('[API] 网络错误:', message)

  ElMessage.error({
    message: '网络连接失败，请检查网络设置',
    duration: 5000
  })
}

function handleHttpError(status: number, data: any) {
  let message = '请求失败'

  switch (status) {
    case 400:
      message = data?.message || '请求参数错误'
      break
    case 401:
      message = '未授权，请重新登录'
      break
    case 403:
      message = '没有权限访问'
      break
    case 404:
      message = '请求的资源不存在'
      break
    case 500:
      message = '服务器错误，请稍后重试'
      break
    case 502:
      message = '网关错误'
      break
    case 503:
      message = '服务暂时不可用'
      break
    default:
      message = data?.message || `请求失败 (${status})`
  }

  logger.error('[API] HTTP错误:', { status, message, data })

  ElMessage.error({
    message,
    duration: 5000
  })
}
```

## 调用方式

### 方式一：使用 Feature API（推荐）

**优点**: 类型安全、易于维护、支持 Mock

```typescript
// src/features/auth/api/index.ts
import { apiClient } from '@/shared/api/client'
import type { LoginRequest, LoginResponse } from './types'

export const authApi = {
  /**
   * 用户登录
   */
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/auth/login', data)
    return response.data
  },

  /**
   * 用户登出
   */
  async logout(): Promise<void> {
    await apiClient.post('/auth/logout')
  },

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<User>('/auth/me')
    return response.data
  }
}
```

**使用**:

```typescript
// 在组件或 Store 中使用
import { authApi } from '@/features/auth/api'

const handleLogin = async () => {
  try {
    const result = await authApi.login({
      username: 'admin',
      password: 'admin123'
    })
    console.log('登录成功:', result)
  } catch (error) {
    console.error('登录失败:', error)
  }
}
```

### 方式二：使用共享 API 适配器

用于跨模块共享的 API：

```typescript
// src/shared/api/adapters/organizationApi.ts
import { apiClient } from '../client'
import type { Organization, Department } from '../types/organizations'

export const organizationApi = {
  /**
   * 获取组织列表
   */
  async getOrganizations(): Promise<Organization[]> {
    const response = await apiClient.get<Organization[]>('/organizations')
    return response.data
  },

  /**
   * 获取部门列表
   */
  async getDepartments(orgId: string): Promise<Department[]> {
    const response = await apiClient.get<Department[]>(`/organizations/${orgId}/departments`)
    return response.data
  }
}
```

### 方式三：直接使用 apiClient（不推荐）

仅在特殊情况下使用：

```typescript
import { apiClient } from '@/shared/api/client'

const fetchData = async () => {
  try {
    const response = await apiClient.get('/custom-endpoint')
    return response.data
  } catch (error) {
    // 手动处理错误
    console.error(error)
  }
}
```

## 错误处理

### 统一错误类型

**src/shared/api/types/errors.ts**

```typescript
export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
    public details?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class NetworkError extends ApiError {
  constructor(message: string = '网络错误') {
    super(message, 'NETWORK_ERROR')
    this.name = 'NetworkError'
  }
}

export class ValidationError extends ApiError {
  constructor(fields: Record<string, string[]>) {
    super('数据验证失败', 'VALIDATION_ERROR', 400, fields)
    this.name = 'ValidationError'
  }
}

export class AuthError extends ApiError {
  constructor(message: string = '认证失败') {
    super(message, 'AUTH_ERROR', 401)
    this.name = 'AuthError'
  }
}

export class PermissionError extends ApiError {
  constructor(message: string = '没有权限') {
    super(message, 'PERMISSION_ERROR', 403)
    this.name = 'PermissionError'
  }
}
```

### 错误处理最佳实践

```typescript
import { ApiError, NetworkError, AuthError } from '@/shared/api/types/errors'

// 在组件中处理错误
const loadData = async () => {
  loading.value = true
  try {
    const data = await authApi.getCurrentUser()
    user.value = data
  } catch (error) {
    if (error instanceof AuthError) {
      // 认证错误
      ElMessage.error('请重新登录')
      router.push('/login')
    } else if (error instanceof NetworkError) {
      // 网络错误
      ElMessage.error('网络连接失败')
    } else if (error instanceof ApiError) {
      // 其他 API 错误
      ElMessage.error(error.message)
    } else {
      // 未知错误
      ElMessage.error('发生未知错误')
    }
  } finally {
    loading.value = false
  }
}
```

### 全局错误处理

**src/shared/api/errorHandler.ts**

```typescript
import { ElMessage } from 'element-plus'
import { logger } from '@/shared/lib/utils/logger'
import type { ApiError } from './types/errors'

/**
 * 全局错误处理器
 */
export function handleApiError(error: unknown): void {
  logger.error('[API Error]', error)

  if (error instanceof ApiError) {
    ElMessage.error({
      message: error.message,
      duration: 5000
    })
  } else if (error instanceof Error) {
    ElMessage.error({
      message: error.message || '发生错误',
      duration: 5000
    })
  } else {
    ElMessage.error({
      message: '发生未知错误',
      duration: 5000
    })
  }
}
```

## 性能优化

### 请求去重

**src/shared/api/utils/requestDeduplication.ts**

```typescript
const pendingRequests = new Map<string, Promise<any>>()

/**
 * 请求去重
 * 防止短时间内重复请求相同接口
 */
export function deduplicateRequest<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
  // 检查是否有相同请求正在进行
  const existingRequest = pendingRequests.get(key)
  if (existingRequest) {
    logger.debug(`[API] 请求去重: ${key}`)
    return existingRequest
  }

  // 创建新请求
  const request = requestFn().finally(() => {
    // 请求完成后移除
    pendingRequests.delete(key)
  })

  pendingRequests.set(key, request)
  return request
}
```

**使用**:

```typescript
import { deduplicateRequest } from '@/shared/api/utils/requestDeduplication'

export const indicatorApi = {
  async getIndicators(): Promise<Indicator[]> {
    return deduplicateRequest('indicators:list', async () => {
      const response = await apiClient.get<Indicator[]>('/indicators')
      return response.data
    })
  }
}
```

### 请求缓存

**src/shared/api/utils/requestCache.ts**

```typescript
const cache = new Map<string, { data: any; timestamp: number }>()

interface CacheOptions {
  ttl?: number // 缓存时间（毫秒）
}

/**
 * 请求缓存
 */
export function cacheRequest<T>(
  key: string,
  requestFn: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const { ttl = 60000 } = options // 默认缓存 1 分钟

  // 检查缓存
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < ttl) {
    logger.debug(`[API] 缓存命中: ${key}`)
    return Promise.resolve(cached.data)
  }

  // 发起请求
  return requestFn().then(data => {
    // 更新缓存
    cache.set(key, { data, timestamp: Date.now() })
    return data
  })
}

/**
 * 清除缓存
 */
export function clearCache(pattern?: string): void {
  if (pattern) {
    // 按模式清除
    for (const key of cache.keys()) {
      if (key.includes(pattern)) {
        cache.delete(key)
      }
    }
  } else {
    // 清除全部
    cache.clear()
  }
}
```

**使用**:

```typescript
import { cacheRequest, clearCache } from '@/shared/api/utils/requestCache'

export const organizationApi = {
  async getOrganizations(): Promise<Organization[]> {
    return cacheRequest(
      'organizations:list',
      async () => {
        const response = await apiClient.get<Organization[]>('/organizations')
        return response.data
      },
      { ttl: 300000 } // 缓存 5 分钟
    )
  }
}

// 更新组织后清除缓存
const updateOrganization = async (id: string, data: any) => {
  await apiClient.put(`/organizations/${id}`, data)
  clearCache('organizations')
}
```

### 并发请求控制

**src/shared/api/utils/requestConcurrency.ts**

```typescript
let activeRequests = 0
const MAX_CONCURRENT_REQUESTS = 10

/**
 * 并发请求控制
 */
export async function withConcurrencyControl<T>(requestFn: () => Promise<T>): Promise<T> {
  // 等待直到有可用槽位
  while (activeRequests >= MAX_CONCURRENT_REQUESTS) {
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  activeRequests++
  try {
    return await requestFn()
  } finally {
    activeRequests--
  }
}
```

## 最佳实践

### 1. 类型安全

```typescript
// ✅ 推荐：使用 TypeScript 类型
export interface User {
  id: string
  name: string
  email: string
}

async function getUser(id: string): Promise<User> {
  const response = await apiClient.get<User>(`/users/${id}`)
  return response.data
}

// ❌ 不推荐：使用 any
async function getUser(id: string): Promise<any> {
  const response = await apiClient.get(`/users/${id}`)
  return response.data
}
```

### 2. 错误处理

```typescript
// ✅ 推荐：使用 try-catch 并处理不同错误
async function loadData() {
  try {
    const data = await api.getData()
    return data
  } catch (error) {
    if (error instanceof NetworkError) {
      // 处理网络错误
    } else if (error instanceof AuthError) {
      // 处理认证错误
    } else {
      // 处理其他错误
    }
  }
}

// ❌ 不推荐：忽略错误
async function loadData() {
  const data = await api.getData() // 可能抛出未处理的错误
  return data
}
```

### 3. 加载状态

```typescript
// ✅ 推荐：使用 loading 状态
const loading = ref(false)
const data = ref<T[]>([])

async function loadData() {
  loading.value = true
  try {
    data.value = await api.getData()
  } finally {
    loading.value = false
  }
}

// ❌ 不推荐：不显示加载状态
async function loadData() {
  data.value = await api.getData() // 用户不知道是否正在加载
}
```

### 4. 取消请求

```typescript
// ✅ 推荐：组件卸载时取消请求
import { onUnmounted } from 'vue'

let abortController: AbortController | null = null

async function loadData() {
  abortController?.abort()
  abortController = new AbortController()

  try {
    data.value = await api.getData({
      signal: abortController.signal
    })
  } catch (error) {
    if (error.name !== 'CanceledError') {
      // 处理其他错误
    }
  }
}

onUnmounted(() => {
  abortController?.abort()
})
```

### 5. 请求重试

```typescript
// ✅ 推荐：网络错误自动重试
async function fetchWithRetry<T>(requestFn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: Error

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await requestFn()
    } catch (error) {
      lastError = error as Error
      if (i < maxRetries - 1) {
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
      }
    }
  }

  throw lastError!
}
```

### 6. 批量请求

```typescript
// ✅ 推荐：使用 Promise.all 并行请求
async function loadDashboardData() {
  const [indicators, tasks, plans] = await Promise.all([
    indicatorApi.getIndicators(),
    taskApi.getTasks(),
    planApi.getPlans()
  ])

  return { indicators, tasks, plans }
}

// ❌ 不推荐：串行请求
async function loadDashboardData() {
  const indicators = await indicatorApi.getIndicators()
  const tasks = await taskApi.getTasks()
  const plans = await planApi.getPlans()

  return { indicators, tasks, plans }
}
```

## Mock 数据

### Mock API 插件

**src/shared/api/mocks/mockApiPlugin.ts**

```typescript
import type { Plugin } from 'vite'

export function mockApiPlugin(): Plugin {
  return {
    name: 'mock-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/api/')) {
          // Mock 响应
          handleMockRequest(req, res)
        } else {
          next()
        }
      })
    }
  }
}

function handleMockRequest(req: any, res: any) {
  // Mock 逻辑
  const mockData = getMockData(req.url, req.method)
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(mockData))
}
```

### 使用 Mock 模式

```bash
# .env.development
VITE_USE_MOCK=true
VITE_API_TARGET=http://localhost:8080
```

## 监控和日志

### 请求日志

**src/shared/api/client/interceptors/logging.ts**

```typescript
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'

export function setupLoggingInterceptor(client: AxiosInstance) {
  client.interceptors.request.use(config => {
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`)
    console.log('[API Request Headers]', config.headers)
    console.log('[API Request Data]', config.data)
    return config
  })

  client.interceptors.response.use(response => {
    console.log(`[API Response] ${response.status} ${response.config.url}`)
    console.log('[API Response Data]', response.data)
    return response
  })
}
```

### 性能监控

**src/shared/api/client/interceptors/performance.ts**

```typescript
export function setupPerformanceInterceptor(client: AxiosInstance) {
  client.interceptors.request.use(config => {
    config.metadata = { startTime: performance.now() }
    return config
  })

  client.interceptors.response.use(response => {
    const duration = performance.now() - response.config.metadata.startTime
    if (duration > 3000) {
      console.warn(`[API] 慢请求: ${response.config.url} (${duration.toFixed(2)}ms)`)
    }
    return response
  })
}
```

## 相关文档

- [前端架构 v3](./前端架构-v3.md)
- [组件使用指南](./组件使用指南.md)
- [开发指南](./开发指南.md)
- [前端 API 指南](./frontend-api-guide.md)
