# Indicator Management Pages

战略指标管理页面层，提供完整的指标管理用户界面。

## 概述

本目录包含战略指标管理的所有页面组件，遵循 FSD（Feature-Sliced Design）架构的 Pages 层规范。每个页面负责：
- 路由级别的页面布局
- 组合多个 features 和 widgets
- 处理页面级别的状态和导航
- 提供完整的用户交互流程

## 页面列表

### 1. IndicatorListPage.vue
**指标列表页面**

- **路由**: `/strategy/indicators`
- **功能**:
  - 显示指标列表（使用 IndicatorList 组件）
  - 支持分页和筛选
  - 提供查看、编辑、删除、下发等操作
  - 批量操作支持
- **使用的 Features**:
  - `features/strategic-indicator` - 指标列表组件和状态管理
- **使用的 Shared 组件**:
  - `PageHeader` - 页面头部
  - `IndicatorDistributionDialog` - 下发对话框

### 2. IndicatorDetailPage.vue
**指标详情页面**

- **路由**: `/strategy/indicators/:id`
- **功能**:
  - 显示指标完整信息
  - 基本信息、组织信息、进度信息
  - 提供编辑和下发入口
- **使用的 Features**:
  - `features/strategic-indicator` - 指标数据和业务逻辑
- **使用的 Shared 组件**:
  - `PageHeader` - 页面头部
  - `StatusBadge` - 状态标签

### 3. IndicatorEditPage.vue
**指标编辑页面**

- **路由**: 
  - 新建: `/strategy/indicators/create`
  - 编辑: `/strategy/indicators/:id/edit`
- **功能**:
  - 创建新指标
  - 编辑现有指标
  - 表单验证和提交
- **使用的 Features**:
  - `features/strategic-indicator` - 指标表单组件
- **使用的 Shared 组件**:
  - `PageHeader` - 页面头部

### 4. IndicatorDistributePage.vue
**指标下发页面**

- **路由**: `/strategy/indicators/:id/distribute`
- **功能**:
  - 显示指标信息
  - 选择目标组织
  - 配置下发参数（说明、截止日期）
  - 提供下发说明和注意事项
- **使用的 Features**:
  - `features/strategic-indicator` - 指标数据和下发逻辑
- **使用的 Shared 组件**:
  - `PageHeader` - 页面头部
  - `StatusBadge` - 状态标签

## 使用方式

### 路由配置

```typescript
// router/index.ts
import { 
  IndicatorListPage, 
  IndicatorDetailPage, 
  IndicatorEditPage,
  IndicatorDistributePage 
} from '@/pages/strategy/indicators'

const routes = [
  {
    path: '/strategy/indicators',
    name: 'IndicatorList',
    component: IndicatorListPage,
    meta: { title: '指标管理' }
  },
  {
    path: '/strategy/indicators/create',
    name: 'IndicatorCreate',
    component: IndicatorEditPage,
    meta: { title: '新建指标' }
  },
  {
    path: '/strategy/indicators/:id',
    name: 'IndicatorDetail',
    component: IndicatorDetailPage,
    meta: { title: '指标详情' }
  },
  {
    path: '/strategy/indicators/:id/edit',
    name: 'IndicatorEdit',
    component: IndicatorEditPage,
    meta: { title: '编辑指标' }
  },
  {
    path: '/strategy/indicators/:id/distribute',
    name: 'IndicatorDistribute',
    component: IndicatorDistributePage,
    meta: { title: '下发指标' }
  }
]
```

### 导航示例

```typescript
// 跳转到列表页
router.push({ name: 'IndicatorList' })

// 跳转到详情页
router.push({ 
  name: 'IndicatorDetail', 
  params: { id: 123 } 
})

// 跳转到编辑页
router.push({ 
  name: 'IndicatorEdit', 
  params: { id: 123 } 
})

// 跳转到下发页
router.push({ 
  name: 'IndicatorDistribute', 
  params: { id: 123 } 
})
```

## 架构说明

### FSD 层级关系

```
pages/strategy/indicators/     # 页面层（当前）
  ↓ 使用
features/strategic-indicator/  # 特性层
  ↓ 使用
entities/indicator/            # 实体层
  ↓ 使用
shared/                        # 共享层
```

### 依赖规则

- **Pages 层可以使用**:
  - Features 层的所有组件和逻辑
  - Widgets 层的组合组件
  - Entities 层的类型定义
  - Shared 层的通用组件和工具

- **Pages 层不应该**:
  - 包含复杂的业务逻辑（应在 Features 层）
  - 直接调用 API（应通过 Features 层的 store）
  - 被其他层导入使用

## 状态管理

页面使用 `features/strategic-indicator` 提供的 Pinia store：

```typescript
import { useIndicatorStore } from '@/features/strategic-indicator'

const indicatorStore = useIndicatorStore()

// 获取指标列表
await indicatorStore.fetchIndicators(params)

// 获取指标详情
const indicator = await indicatorStore.fetchIndicatorById(id)

// 创建指标
await indicatorStore.createIndicator(data)

// 更新指标
await indicatorStore.updateIndicator(id, data)

// 删除指标
await indicatorStore.deleteIndicator(id)

// 下发指标
await indicatorStore.distributeIndicator(id, data)
```

## 样式规范

所有页面遵循统一的布局结构：

```vue
<template>
  <div class="[page-name]-page">
    <PageHeader />
    <div class="page-content">
      <!-- 页面内容 -->
    </div>
  </div>
</template>

<style scoped>
.[page-name]-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.page-content {
  flex: 1;
  padding: 24px;
  background-color: #f5f7fa;
  overflow: auto;
}
</style>
```

## 待完善功能

1. **组织数据加载**: 当前使用 mock 数据，需要从 API 加载真实的组织架构
2. **任务数据加载**: 表单中的任务选项需要从 API 加载
3. **权限控制**: 根据用户权限显示/隐藏操作按钮
4. **高级筛选**: 列表页面的筛选功能需要完善
5. **批量操作**: 支持批量下发、批量删除等操作
6. **导出功能**: 支持导出指标数据

## 相关文档

- [FSD 架构文档](../../../.kiro/specs/architecture-refactoring/design.md)
- [Feature 层文档](../../../features/strategic-indicator/README.md)
- [Entity 层文档](../../../entities/indicator/README.md)
- [Shared UI 组件](../../../shared/ui/README.md)
