# Pages Layer

## 概述

Pages 层是 FSD 架构中的最顶层，代表应用的路由级页面。每个页面对应一个路由，负责组合 features 和 widgets 来构建完整的用户界面。

## 设计原则

1. **薄组合层** - Pages 应该是薄的组合层，主要负责布局和组合，不包含业务逻辑
2. **路由对应** - 每个 page 对应一个路由路径
3. **特性组合** - 通过组合 features 和 widgets 来构建页面功能
4. **响应式布局** - 处理页面级的布局和响应式设计

## 目录结构

```
pages/
├── auth/                   # 认证相关页面
├── dashboard/              # 仪表盘页面
├── strategy/               # 战略管理页面
│   ├── indicators/         # 指标管理页面
│   ├── plans/              # 计划管理页面
│   └── tasks/              # 任务管理页面
├── approval/               # 审批流程页面
└── admin/                  # 系统管理页面
```

## 使用示例

```vue
<script setup lang="ts">
import { IndicatorList } from '@/features/indicator'
import { IndicatorStats } from '@/widgets/indicator-stats'

const currentYear = ref(new Date().getFullYear())
</script>

<template>
  <div class="indicator-list-page">
    <PageHeader title="指标管理" />
    <IndicatorStats :year="currentYear" />
    <IndicatorList :year="currentYear" />
  </div>
</template>
```

## 开发规范

### 1. 保持页面简洁

✅ 使用 feature 组件，让它处理业务逻辑
❌ 不要在页面中直接调用 API 或包含复杂业务逻辑

### 2. 命名规范

- 页面组件以 `Page` 结尾：`LoginPage.vue`, `DashboardPage.vue`
- 文件放在 `ui/` 子目录中
- 通过 `index.ts` 导出

### 3. 依赖规则

Pages 可以依赖：widgets, features, entities, shared
Pages 不能依赖：其他 pages
