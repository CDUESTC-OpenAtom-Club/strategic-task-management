# Task Feature

战略任务管理功能模块

## 功能概述

- 战略任务的增删改查
- 任务状态管理
- 任务进度跟踪
- 任务权重计算

## 目录结构

```
task/
├── api/              # API 调用层
│   └── strategicApi.ts
├── lib/              # 业务逻辑层
│   └── utils.ts
├── model/            # 数据模型层
│   ├── constants.ts
│   ├── store.ts
│   └── types.ts
├── ui/               # UI 组件层
│   └── TaskCard.vue
├── index.ts          # 导出文件
└── README.md         # 文档说明
```

## API 接口

基于 `sism-backend/docs/API接口文档.md` 中的任务管理接口：

- `GET /api/tasks` - 查询任务列表
- `GET /api/tasks/{id}` - 查询任务详情
- `POST /api/tasks` - 创建任务
- `PUT /api/tasks/{id}` - 更新任务
- `DELETE /api/tasks/{id}` - 删除任务
- `GET /api/tasks/strategic` - 查询战略级任务

## 使用示例

```typescript
import { useTaskStore } from '@/features/task'

const taskStore = useTaskStore()

// 加载任务数据
await taskStore.loadTasksByYear(2026)

// 创建任务
const newTask = await taskStore.createTask({
  name: '新战略任务',
  code: 'TASK-2026-001',
  description: '任务描述',
  strategic: true,
  year: 2026,
  weight: 0.3,
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  ownerOrgId: 1
})
```

## 组件使用

```vue
<template>
  <TaskCard 
    :task="task" 
    @view="handleView"
    @edit="handleEdit"
    @delete="handleDelete"
  />
</template>

<script setup>
import { TaskCard } from '@/features/task'
</script>
```