# Type Definitions Documentation

This directory contains TypeScript type definitions for the SISM frontend application.

## 核心原则

> **后端叫什么,前端就叫什么**

消除"翻译层",消除认知负荷。前后端使用统一的术语和命名。

## Files

### `entities.ts` ⭐ 核心

**统一的实体类型定义,与后端完全对齐。**

所有新代码都应该使用这里的类型定义。

**包含:**

- `StrategicTask` - 对应后端 `strategic_task` 表
- `Indicator` - 对应后端 `indicator` 表
- `Milestone` - 对应后端 `milestone` 表
- `User` - 对应后端 `app_user` 表
- `AssessmentCycle` - 对应后端 `assessment_cycle` 表
- `ProgressReport` - 对应后端 `progress_report` 表
- 完整的枚举类型定义
- 请求/响应类型定义
- 实用工具类型

**示例:**

```typescript
import { StrategicTask, Indicator, Milestone } from '@/shared/types/entities'

const task: StrategicTask = {
  taskId: 1,
  taskName: '提升教学质量',
  taskDesc: '战略任务描述',
  taskType: TaskType.DEVELOPMENT
  // ...
}
```

### `schemas.ts`

Zod 运行时验证 Schema。

提供运行时类型验证,用于 API 响应验证和表单验证。

**使用场景:**

- API 响应验证
- 表单数据验证
- 运行时类型检查

**示例:**

```typescript
import { validateIndicator } from '@/shared/types'

const isValid = validateIndicator(apiResponse.data)
```

### `index.ts`

统一导出入口。

**重新导出:**

- `entities.ts` 的所有类型
- `schemas.ts` 的所有 Schema

**使用方式:**

```typescript
// 推荐: 直接从 @/shared/types 导入
import { StrategicTask, Indicator } from '@/shared/types'

// 等价于:
import { StrategicTask, Indicator } from '@/shared/types/entities'
```

## 命名规范

### 实体类型命名

| 后端表名         | 前端类型名      | 字段命名                                        |
| ---------------- | --------------- | ----------------------------------------------- |
| `strategic_task` | `StrategicTask` | `taskId`, `taskName`, `taskDesc`                |
| `indicator`      | `Indicator`     | `indicatorId`, `indicatorName`, `indicatorDesc` |
| `milestone`      | `Milestone`     | `milestoneId`, `milestoneName`, `milestoneDesc` |
| `app_user`       | `User`          | `userId`, `username`, `passwordHash`            |

**规则:**

- ✅ 类型名: PascalCase,去掉下划线,首字母大写
- ✅ 字段名: camelCase,与后端 VO 完全一致
- ❌ 不要创建"翻译层" (如 Plan, Task 等别名)

### 枚举类型命名

```typescript
// ✅ 正确: 使用后端枚举值
enum TaskType {
  BASIC = 'BASIC',
  DEVELOPMENT = 'DEVELOPMENT',
  KEY = 'KEY'
}

// ❌ 错误: 创建中文别名
enum TaskType {
  BASIC = '基础性', // 不要这样做!
  DEVELOPMENT = '发展性'
}
```

## 使用指南

### API 调用

```typescript
import { planApi } from '@/features/plan/api/planApi'
import type { StrategicTask, ApiResponse } from '@/shared/types'

async function loadStrategicTasks(): Promise<StrategicTask[]> {
  const response = await planApi.getPlans()

  if (response.success && response.data) {
    return response.data
  }

  return []
}
```

### Store 定义

```typescript
import { defineStore } from 'pinia'
import type { StrategicTask } from '@/types'

export const useStrategicTaskStore = defineStore('strategicTask', () => {
  const strategicTasks = ref<StrategicTask[]>([])
  const currentTask = ref<StrategicTask | null>(null)

  async function loadTask(taskId: number) {
    // ...
  }

  return { strategicTasks, currentTask, loadTask }
})
```

### View 组件

```vue
<script setup lang="ts">
import type { StrategicTask } from '@/types'

interface Props {
  task: StrategicTask
}

const props = defineProps<Props>()
</script>

<template>
  <div>
    <h3>{{ task.taskName }}</h3>
    <p>{{ task.taskDesc }}</p>
  </div>
</template>
```

## 迁移指南

如果你需要将旧代码迁移到新的类型系统:

### 1. 识别需要修改的文件

搜索以下模式:

- `from '@/types/backend-aligned'` → 改为 `from '@/types/entities'`
- `: Plan` → 改为 `: StrategicTask`
- `: Task` → 改为 `: Milestone` (如果是里程碑) 或 `: Indicator` (如果是指標)

### 2. 更新导入

```typescript
// ❌ 旧代码
import { Plan, Task } from '@/types/backend-aligned'

// ✅ 新代码
import { StrategicTask, Milestone, Indicator } from '@/types/entities'
```

### 3. 更新类型引用

```typescript
// ❌ 旧代码
const plans = ref<Plan[]>([])
const currentPlan = ref<Plan | null>(null)

// ✅ 新代码
const strategicTasks = ref<StrategicTask[]>([])
const currentTask = ref<StrategicTask | null>(null)
```

### 4. 更新字段名

```typescript
// ❌ 旧代码 (如果有字段名不一致)
plan.id
plan.title

// ✅ 新代码 (与后端 VO 对齐)
task.taskId
task.taskName
```

## 类型安全最佳实践

### 1. 使用类型推导

```typescript
// ✅ 好: TypeScript 自动推导类型
const task: StrategicTask = {
  taskId: 1,
  taskName: '任务名称'
  // ...
}

// ❌ 差: 使用 any
const task: any = fetchData()
```

### 2. 使用类型守卫

```typescript
import { isApiError } from '@/types/entities'

const response = await fetchData()

if (isApiError(response)) {
  // TypeScript 知道这是 ApiError
  console.error(response.message)
} else {
  // TypeScript 知道这是 ApiResponse<T>
  console.log(response.data)
}
```

### 3. 避免类型断言

```typescript
// ❌ 差: 强制类型断言
const task = data as StrategicTask

// ✅ 好: 类型守卫或验证
if (isStrategicTask(data)) {
  // TypeScript 知道这是 StrategicTask
  const task = data
}
```

## 测试

### 单元测试

```typescript
import { describe, it, expect } from 'vitest'
import { validateStrategicTask } from '@/types'

describe('StrategicTask Validation', () => {
  it('should validate valid strategic task', () => {
    const task = {
      taskId: 1,
      taskName: '任务名称',
      taskType: TaskType.DEVELOPMENT
      // ...
    }

    expect(validateStrategicTask(task)).toBe(true)
  })
})
```

## 贡献指南

当添加新类型时:

1. **确定类型类别**
   - 实体类型 → 添加到 `entities.ts`
   - UI 特定类型 → 添加到 `index.ts`
   - 验证 Schema → 添加到 `schemas.ts`

2. **遵循命名规范**
   - 与后端完全对齐
   - 使用后端字段名
   - 添加 JSDoc 注释

3. **运行类型检查**

   ```bash
   npm run type-check
   ```

4. **更新此文档**
   - 在"实体类型命名"表格中添加新类型
   - 提供使用示例

## 参考资料

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Vue 3 TypeScript Guide](https://vuejs.org/guide/typescript/overview.html)
- 后端 API 文档: `sism-backend/src/main/java/com/sism/controller/`
- 重构规范: `.kiro/specs/frontend-refactor/`

---

**最后更新:** 2025-02-17
**维护者:** Claude Code
**相关规范:** Phase 2 - 统一领域语言
