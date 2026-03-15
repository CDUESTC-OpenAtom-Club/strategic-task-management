# Programmer B - 阶段一任务卡

> **模块**: API客户端 + 公共工具
> **工期**: 3天
> **分支**: `refactor/phase1-emergency-fixes`
> **负责人**: Programmer B

---

## 📋 任务概述

1. 创建统一的API客户端（替代6个重复的withRetry函数）
2. 提取公共工具函数

---

## Day 1: 创建统一API客户端

### Task 1.1: 创建API基础设施

#### 1. 创建目录结构

```bash
cd /Users/blackevil/Documents/前端架构测试/strategic-task-management
mkdir -p src/shared/lib/api
```

#### 2. 创建客户端文件

**创建 `src/shared/lib/api/client.ts`**:

```typescript
import axios, { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'
import { handleError } from './error-handler'
import { withRetry } from './retry'

export interface ApiClientConfig extends AxiosRequestConfig {
  baseURL?: string
  timeout?: number
}

export function createApiClient(config?: ApiClientConfig): AxiosInstance {
  const client = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
    timeout: 30000,
    ...config
  })

  // 请求拦截器
  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = localStorage.getItem('token')
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    },
    error => Promise.reject(error)
  )

  // 响应拦截器
  client.interceptors.response.use(
    response => response.data,
    async error => {
      // 尝试重试
      if (await withRetry(error)) {
        return client.request(error.config)
      }
      // 处理错误
      handleError(error)
      return Promise.reject(error)
    }
  )

  return client
}

// 导出默认实例
export const apiClient = createApiClient()
```

**创建 `src/shared/lib/api/retry.ts`**:

```typescript
import type { AxiosError, AxiosRequestConfig } from 'axios'

export interface RetryConfig {
  maxRetries?: number
  retryDelay?: number
  retryableStatuses?: number[]
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  retryDelay: 1000,
  retryableStatuses: [408, 429, 500, 502, 503, 504]
}

// 存储重试配置
const retryMap = new WeakMap<AxiosRequestConfig, Required<RetryConfig>>()

export async function withRetry(error: AxiosError, config?: RetryConfig): Promise<boolean> {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config }
  const axiosConfig = error.config as AxiosRequestConfig & {
    _retry?: boolean
    _retryCount?: number
  }

  if (!axiosConfig) {
    return false
  }

  // 网络错误或可重试的状态码
  const shouldRetry = !error.response || cfg.retryableStatuses.includes(error.response.status)

  if (!shouldRetry) {
    return false
  }

  // 初始化重试状态
  if (!axiosConfig._retry) {
    axiosConfig._retry = true
    axiosConfig._retryCount = 0
    retryMap.set(axiosConfig, cfg)
  }

  // 检查重试次数
  if (axiosConfig._retryCount! >= cfg.maxRetries) {
    return false
  }

  // 增加重试次数
  axiosConfig._retryCount!++

  // 延迟重试
  await new Promise(resolve => setTimeout(resolve, cfg.retryDelay * axiosConfig._retryCount!))

  return true
}
```

**创建 `src/shared/lib/api/error-handler.ts`**:

```typescript
import { ElMessage } from 'element-plus'
import type { AxiosError } from 'axios'

interface ErrorResponse {
  message?: string
  error?: string
}

export function handleError(error: AxiosError): void {
  if (error.response) {
    const { status, data } = error.response
    const errorData = data as ErrorResponse

    const messageMap: Record<number, string> = {
      400: errorData.message || '请求参数错误',
      401: '未登录，请先登录',
      403: '无权限访问',
      404: '请求的资源不存在',
      500: '服务器错误，请稍后重试'
    }

    const message = messageMap[status] || errorData.message || '请求失败'
    ElMessage.error(message)

    // 401特殊处理
    if (status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
  } else if (error.request) {
    ElMessage.error('网络错误，请检查网络连接')
  } else {
    ElMessage.error('请求配置错误')
  }
}
```

**创建 `src/shared/lib/api/index.ts`**:

```typescript
export { createApiClient, apiClient } from './client'
export { withRetry } from './retry'
export { handleError } from './error-handler'
export type { ApiClientConfig, RetryConfig } from './client'
```

#### 3. 提交代码

```bash
git add src/shared/lib/api/
git commit -m "feat: 创建统一API客户端基础设施"
```

---

## Day 2: 提取公共工具函数

### Task 2.1: 创建工具函数目录

```bash
mkdir -p src/shared/lib/utils
mkdir -p src/shared/lib/format
```

### Task 2.2: 创建进度相关工具

**创建 `src/shared/lib/utils/progress.ts`**:

```typescript
export type ProgressStatus = 'normal' | 'warning' | 'danger' | 'success'

export function getProgressStatus(progress: number): ProgressStatus {
  if (progress >= 100) return 'success'
  if (progress < 30) return 'danger'
  if (progress < 60) return 'warning'
  return 'normal'
}

export function getProgressColor(status: ProgressStatus): string {
  const colorMap: Record<ProgressStatus, string> = {
    success: '#67c23a',
    normal: '#409eff',
    warning: '#e6a23c',
    danger: '#f56c6c'
  }
  return colorMap[status]
}

export function getProgressWidth(progress: number): string {
  return `${Math.min(100, Math.max(0, progress))}%`
}
```

### Task 2.3: 创建状态相关工具

**创建 `src/shared/lib/utils/status.ts`**:

```typescript
import type { ProgressStatus } from './progress'

export function getStatusTagType(status: string): ProgressStatus {
  const typeMap: Record<string, ProgressStatus> = {
    pending: 'warning',
    in_progress: 'normal',
    completed: 'success',
    failed: 'danger',
    approved: 'success',
    rejected: 'danger',
    draft: 'info',
    published: 'success'
  }
  return typeMap[status] || 'normal'
}

export function getStatusText(status: string): string {
  const textMap: Record<string, string> = {
    pending: '待处理',
    in_progress: '进行中',
    completed: '已完成',
    failed: '失败',
    approved: '已通过',
    rejected: '已拒绝',
    draft: '草稿',
    published: '已发布'
  }
  return textMap[status] || status
}
```

### Task 2.4: 创建日期格式化工具

**创建 `src/shared/lib/format/date.ts`**:

```typescript
export function formatDate(date: string | Date, format = 'YYYY-MM-DD'): string {
  const d = typeof date === 'string' ? new Date(date) : date

  if (isNaN(d.getTime())) {
    return ''
  }

  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')

  if (format === 'YYYY-MM-DD') {
    return `${year}-${month}-${day}`
  }

  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')

  if (format === 'YYYY-MM-DD HH:mm:ss') {
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }

  return `${year}-${month}-${day}`
}

export function formatDateTime(date: string | Date): string {
  return formatDate(date, 'YYYY-MM-DD HH:mm:ss')
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diff = now.getTime() - d.getTime()

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}天前`
  if (hours > 0) return `${hours}小时前`
  if (minutes > 0) return `${minutes}分钟前`
  return '刚刚'
}
```

### Task 2.5: 创建数字格式化工具

**创建 `src/shared/lib/format/number.ts`**:

```typescript
export function formatNumber(num: number, decimals = 2): string {
  if (isNaN(num)) return '-'
  return num.toFixed(decimals)
}

export function formatPercent(value: number, total: number, decimals = 1): string {
  if (total === 0) return '0%'
  const percent = (value / total) * 100
  return `${percent.toFixed(decimals)}%`
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}
```

### Task 2.6: 创建导出文件

**创建 `src/shared/lib/utils/index.ts`**:

```typescript
export * from './progress'
export * from './status'
```

**创建 `src/shared/lib/format/index.ts`**:

```typescript
export * from './date'
export * from './number'
```

### Task 2.7: 提交代码

```bash
git add src/shared/lib/
git commit -m "feat: 提取公共工具函数"
```

---

## Day 3: 迁移现有代码

### Task 3.1: 迁移API文件

查找所有包含本地withRetry的文件：

```bash
grep -r "withRetry" src/features --include="*.ts" -l
```

逐个迁移以下文件：

#### 1. strategic-indicator/api/indicator.ts

```bash
# 备份
cp src/features/strategic-indicator/api/indicator.ts src/features/strategic-indicator/api/indicator.ts.bak

# 编辑文件，将：
# import axios from 'axios'
# 改为：
# import { apiClient } from '@/shared/lib/api/client'

# 删除本地的withRetry函数

# 将axios调用改为apiClient调用
```

#### 2. 其他API文件

重复相同步骤：

- plan/api/planApi.ts
- task/api/strategicApi.ts
- milestone/api/milestoneApi.ts
- approval/api/approvalApi.ts

### Task 3.2: 迁移工具函数

查找使用重复工具函数的组件：

```bash
# 查找getProgressStatus
grep -r "getProgressStatus" src --include="*.vue" -l

# 查找getProgressColor
grep -r "getProgressColor" src --include="*.vue" -l

# 查找formatDate
grep -r "formatDate" src --include="*.vue" -l
```

逐个更新这些文件：

```typescript
// 添加导入
import { getProgressStatus, getProgressColor } from '@/shared/lib/utils'
import { formatDate } from '@/shared/lib/format'

// 删除本地函数定义
```

### Task 3.3: 测试与验证

```bash
# 1. 类型检查
npm run type-check

# 2. 单元测试
npm run test

# 3. 构建
npm run build

# 4. 开发服务器
npm run dev
```

### Task 3.4: 提交代码

```bash
git add -A
git commit -m "refactor: 迁移到统一API客户端和公共工具"
```

---

## ✅ 验收标准

### API客户端

- [ ] `shared/lib/api/` 三个文件创建完成
- [ ] 所有feature的API文件已迁移使用apiClient
- [ ] 所有本地的 `withRetry` 函数已删除
- [ ] API功能测试通过
- [ ] 错误处理正常工作

### 公共工具

- [ ] 所有工具函数已创建
- [ ] 组件中的重复函数已删除
- [ ] 单元测试覆盖所有工具函数
- [ ] 类型导出正确

### 总体验收

- [ ] npm run test 通过
- [ ] npm run build 成功无警告
- [ ] 代码已提交到 `refactor/phase1-emergency-fixes`

---

## 🚨 问题处理

### 如果类型错误

```bash
# 查看具体错误
npm run type-check 2>&1 | grep "error TS"
```

常见问题：

1. 导入路径错误 → 检查 `@/` 别名配置
2. 类型不匹配 → 检查泛型使用

### 如果功能异常

1. API调用失败 → 检查apiClient配置
2. 工具函数返回错误 → 检查函数参数

### 回滚命令

```bash
# 回滚最后一次提交
git reset --hard HEAD~1

# 回滚到指定提交
git reset --hard <commit-hash>
```

---

## 📝 每日报告模板

### Day 1 报告

```
✅ 完成：API客户端基础设施
📁 创建文件：client.ts, retry.ts, error-handler.ts
🧪 测试状态：通过/待修复
📅 明日计划：创建公共工具函数
```

### Day 2 报告

```
✅ 完成：公共工具函数
📁 创建文件：progress.ts, status.ts, date.ts, number.ts
📊 覆盖功能：进度、状态、日期、数字格式化
📅 明日计划：迁移现有代码
```

### Day 3 报告

```
✅ 完成：代码迁移和测试
🔄 迁移文件：X个API文件，Y个组件
🧪 测试结果：全部通过
🎯 验收状态：已达标
📅 后续计划：合并到主分支
```

---

## 📚 相关文档

- [重构方案总览](/Users/blackevil/Documents/前端架构测试/strategic-task-management/docs/前端渐进式重构方案.md)
- [Axios文档](https://axios-http.com/)
