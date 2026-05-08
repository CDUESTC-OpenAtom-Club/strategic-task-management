# API 使用指南

## 配置

```bash
# .env
VITE_API_BASE_URL=/api/v1
VITE_API_SECRET=your-32-char-secret-key
```

## 基本用法

```ts
import api from '@/shared/api'

// GET
const data = await api.get('/indicators', { year: 2024 })

// POST
const result = await api.post('/indicators', { name: '新指标' })

// PUT
await api.put('/indicators/id', { status: 'completed' })

// DELETE
await api.delete('/indicators/id')
```

## 错误处理

```ts
import { useErrorHandler } from '@/shared/lib/error-handling/useErrorHandler'

const { handleError, isRetryable } = useErrorHandler()

try {
  await api.createIndicator(data)
} catch (error) {
  handleError(error) // 自动显示友好消息
  if (isRetryable(error)) {
    // 可重试
  }
}
```

## 敏感操作（需要签名）

`/auth/password`, `/indicators`, `/tasks`, `/milestones` - 自动添加签名

## 主要 API

| 方法                         | 说明         |
| ---------------------------- | ------------ |
| `login(credentials)`         | 登录         |
| `getIndicators({ year })`    | 获取指标列表 |
| `createIndicator(data)`      | 创建指标     |
| `updateIndicator(id, data)`  | 更新指标     |
| `submitForApproval(id)`      | 提交审核     |
| `getMilestones(indicatorId)` | 获取里程碑   |
| `getDepartments()`           | 获取部门列表 |
