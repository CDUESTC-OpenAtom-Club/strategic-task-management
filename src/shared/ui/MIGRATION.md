# UI Components Migration Summary

## 迁移日期
2026-03-12

## 任务概述
将通用 UI 组件从 `src/components/common/` 迁移到新的 FSD 架构 `src/shared/ui/` 目录结构。

## 已完成的迁移

### 1. DataTable.vue → shared/ui/table/
- **源路径**: `src/components/common/DataTable.vue`
- **目标路径**: `src/shared/ui/table/DataTable.vue`
- **状态**: ✅ 已完成
- **说明**: 使用 smartRelocate 工具迁移，自动更新了所有引用

### 2. StatusBadge.vue → shared/ui/display/
- **目标路径**: `src/shared/ui/display/StatusBadge.vue`
- **状态**: ✅ 已创建
- **功能**:
  - 支持多种状态类型 (success, info, warning, danger, primary, default)
  - 支持不同尺寸 (small, default, large)
  - 支持自定义颜色
  - 支持圆点样式
  - 完整的 TypeScript 类型定义

### 3. ConfirmDialog.vue → shared/ui/feedback/
- **目标路径**: `src/shared/ui/feedback/ConfirmDialog.vue`
- **状态**: ✅ 已创建
- **功能**:
  - 提供函数式 API (showConfirm, showDeleteConfirm, showSubmitConfirm, showApprovalConfirm)
  - 提供组合式函数 API (useConfirmDialog)
  - 支持输入验证
  - 支持异步操作
  - 预设常用确认对话框类型

### 4. PageHeader.vue → shared/ui/layout/
- **目标路径**: `src/shared/ui/layout/PageHeader.vue`
- **状态**: ✅ 已创建
- **功能**:
  - 显示页面标题和描述
  - 面包屑导航
  - 返回按钮
  - 操作按钮区域 (插槽)
  - 标题额外内容 (插槽)
  - 底部扩展区域 (插槽)

### 5. 统一导出文件
- **文件**: `src/shared/ui/index.ts`
- **状态**: ✅ 已更新
- **说明**: 统一导出所有 UI 组件和类型定义

## 目录结构

```
src/shared/ui/
├── table/
│   ├── DataTable.vue          ✅ 已迁移
│   └── index.ts               ✅ 已更新
├── display/
│   ├── StatusBadge.vue        ✅ 新建
│   └── index.ts               ✅ 已更新
├── feedback/
│   ├── ConfirmDialog.vue      ✅ 新建
│   └── index.ts               ✅ 已更新
├── layout/
│   ├── PageHeader.vue         ✅ 新建
│   └── index.ts               ✅ 已更新
├── form/
│   └── index.ts               (待后续迁移)
├── index.ts                   ✅ 已更新
├── README.md                  ✅ 已创建
└── MIGRATION.md               ✅ 本文件
```

## 向后兼容性

为了保持向后兼容，更新了 `src/components/common/index.ts`：

```typescript
// 从新位置重新导出 DataTable
export { DataTable } from '@/shared/ui/table'
export type { TableColumn, PaginationConfig } from '@/shared/ui/table'
```

这样，现有代码仍然可以使用旧的导入路径：
```typescript
import { DataTable } from '@/components/common'
```

但建议逐步迁移到新的导入路径：
```typescript
import { DataTable } from '@/shared/ui'
```

## 类型定义

所有组件都提供了完整的 TypeScript 类型定义：

- `TableColumn` - 表格列配置
- `PaginationConfig` - 分页配置
- `DataTableProps` - DataTable 组件属性
- `StatusType` - 状态类型
- `StatusBadgeProps` - StatusBadge 组件属性
- `DialogType` - 对话框类型
- `ConfirmDialogOptions` - 确认对话框配置
- `BreadcrumbItem` - 面包屑项
- `PageHeaderProps` - PageHeader 组件属性

## 测试状态

- ✅ TypeScript 类型检查通过
- ✅ 无编译错误
- ✅ 向后兼容性保持
- ⏳ 单元测试待添加

## 使用示例

### DataTable
```vue
<script setup lang="ts">
import { DataTable } from '@/shared/ui'

const columns = [
  { prop: 'name', label: '名称' },
  { prop: 'status', label: '状态' }
]
</script>

<template>
  <DataTable :data="data" :columns="columns" />
</template>
```

### StatusBadge
```vue
<script setup lang="ts">
import { StatusBadge } from '@/shared/ui'
</script>

<template>
  <StatusBadge text="已完成" type="success" />
</template>
```

### ConfirmDialog
```vue
<script setup lang="ts">
import { showDeleteConfirm } from '@/shared/ui'

async function handleDelete() {
  try {
    await showDeleteConfirm('指标A')
    // 执行删除
  } catch {
    // 用户取消
  }
}
</script>
```

### PageHeader
```vue
<script setup lang="ts">
import { PageHeader } from '@/shared/ui'
</script>

<template>
  <PageHeader title="指标管理" description="管理战略指标">
    <template #actions>
      <el-button type="primary">新建</el-button>
    </template>
  </PageHeader>
</template>
```

## 后续工作

1. **单元测试**: 为新创建的组件添加单元测试
2. **文档完善**: 补充更多使用示例和最佳实践
3. **逐步迁移**: 将现有代码中的导入路径更新为新路径
4. **其他组件**: 继续迁移其他通用组件 (DataForm, EmptyState 等)

## 注意事项

1. **导入路径**: 推荐使用 `@/shared/ui` 而不是 `@/components/common`
2. **类型导入**: 使用 `import type` 导入类型定义
3. **组件命名**: 遵循 PascalCase 命名规范
4. **样式隔离**: 所有组件使用 scoped 样式

## 相关文档

- [Shared UI README](./README.md)
- [架构重构设计文档](../../../.kiro/specs/architecture-refactoring/design.md)
- [任务清单](../../../.kiro/specs/architecture-refactoring/tasks.md)

## 验证清单

- [x] DataTable 迁移到 shared/ui/table/
- [x] StatusBadge 创建在 shared/ui/display/
- [x] ConfirmDialog 创建在 shared/ui/feedback/
- [x] PageHeader 创建在 shared/ui/layout/
- [x] 创建统一的 shared/ui/index.ts 导出文件
- [x] 更新各子目录的 index.ts
- [x] 保持向后兼容性
- [x] TypeScript 类型检查通过
- [x] 创建文档 (README.md)
- [x] 创建迁移记录 (MIGRATION.md)

## 迁移完成 ✅

所有计划的组件迁移已完成，系统保持向后兼容，可以安全使用。
