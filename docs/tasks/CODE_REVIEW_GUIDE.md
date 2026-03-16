# 代码审查指南 - Pages重构

> **审查对象**: Phase 2 Pages重构
> **审查者**: Code Reviewer
> **模式**: 基于PR的代码审查

---

## 📋 审查清单

### 1. 架构检查

#### [ ] Pages层职责清晰

**检查项**:

- Pages层文件仅包含路由逻辑
- 不包含业务逻辑
- 不包含数据处理
- 不包含状态管理

**通过标准**:

```vue
<!-- ✅ 正确示例 -->
<template>
  <PageHeader title="...">
    <template #actions>...</template>
  </PageHeader>
  <FeatureComponent />
</template>

<script setup lang="ts">
import { PageHeader } from '@/shared/ui/layout'
import { FeatureComponent } from '@/features/...'
</script>

<!-- ❌ 错误示例 -->
<template>
  <div>
    <!-- ❌ 业务逻辑不应在这里 -->
    <div v-if="showDialog">
      <!-- ❌ 复杂的弹窗逻辑 -->
    </div>
  </div>
</template>

<script setup lang="ts">
// ❌ 业务状态管理
const data = ref([])

// ❌ API调用
const fetchData = async () => {...}
</script>
```

#### [ ] 依赖关系正确

**依赖规则**:

```
pages/ → features/ → entities/ → shared/
pages/ ❌ shared/  (避免循环依赖)
```

**通过标准**:

```typescript
// ✅ 正确
import { PageHeader } from '@/shared/ui/layout'
import { FeatureComponent } from '@/features/...'
import type { User } from '@/entities/user'

// ❌ 错误
import { PageHeader } from '@/shared/ui/layout'
import { someUtil } from '@/shared/lib/utils' // 应该从feature导入
```

### 2. 代码质量检查

#### [ ] TypeScript类型安全

**检查项**:

- 无 `any` 类型（特殊情况除外）
- 正确的类型定义
- Props和Events类型完整

**通过标准**:

```typescript
// ✅ 正确
interface Props {
  id: string
  name: string
}

// ❌ 错误
interface Props {
  id: any // 避免
  name: any
}
```

#### [ ] ESLint规范

**检查项**:

- 无 ESLint 错误
- 符合 Prettier 格式
- 无未使用的导入
- 正确的命名规范

**通过标准**:

- ESLint 错误数: 0
- ESLint 警告数可接受（主要在测试文件中）

#### [ ] 组件命名规范

**检查项**:

- Page组件以Page结尾
- Vue 组件使用 PascalCase

**通过标准**:

- ✅ IndicatorListPage.vue
- ❌ indicatorList.vue

### 3. 功能正确性

#### [ ] 路由参数传递

**检查项**:

- 路由参数通过 `route.params` 传递
- 查询参数通过 `route.query` 传递
- 必需参数都有类型定义

**通过标准**:

```typescript
// ✅ 正确
const id = route.params.id as string
const params = route.query as PageParams

// ❌ 错误
const id = route.params.id // 类型不安全
```

#### [ ] 权限检查

**检查项**:

- 页面级权限检查在Page层
- 功能级权限检查在Feature层
- 使用统一的权限检查函数

**通过标准**:

```typescript
// ✅ 正确
const canCreate = computed(() => authStore.hasPermission('indicator:create'))

// ❌ 错误
// 权限检查逻辑不应该分散
```

### 4. 性能考虑

#### [ ] 组件懒加载

**检查项**:

- 路由使用动态导入
- 大型组件使用异步加载

**通过标准**:

```typescript
// ✅ 正确
const routes = [
  {
    path: '/indicators/:id',
    component: () => import('./IndicatorDetailPage.vue')
  }
]

// ❌ 错误
import IndicatorDetailPage from './IndicatorDetailPage.vue' // 同步加载
```

#### [ ] 避免不必要的重渲染

**检查项**:

- 使用 `computed` 缓存计算结果
- 使用 `v-once` 避免频繁更新

---

## 🔄 审查流程

### Step 1: 查看PR文件

```bash
# 查看修改的文件列表
git diff --name-only origin/main HEAD~1
```

### Step 2: 逐个文件审查

**重点文件**:

- `src/pages/**/ui/*.vue` - 新建/修改的Pages
- `src/features/**/*.vue` - 相关的View组件

### Step 3: 记录问题

**问题格式**:

```markdown
### 文件: src/pages/strategy/indicators/ui/IndicatorDistributePage.vue

#### 问题

**类型**: [架构] 中等

**描述**:
Page组件包含了业务逻辑，应提取到Feature层。
当前在402-421行发现组织树逻辑（约100行），应该移到`IndicatorDistributeView`组件。

**建议**:

1. 将组织树逻辑移到 `src/features/strategic-indicator/ui/IndicatorDistributeView.vue`
2. Page简化为薄包装模式（目标<50行）

**代码位置**:

- 第124-224行

**优先级**: 高
```

### Step 4: 整理检查清单

**检查清单**:

- [ ] Pages层职责清晰
- [ ] 依赖关系正确
- [ ] TypeScript类型安全
- [ ] ESLint规范通过
- [ ] 功能正确性
- [ ] 性能考虑合理

---

## ✅ 审查决定

### 通过条件

所有以下条件满足时通过审查：

1. **架构清晰**
   - Pages层是薄包装（< 50-100行）
   - 仅包含路由逻辑
   - 不包含业务逻辑

2. **类型安全**
   - TypeScript编译无错误
   - Props和Events类型完整
   - 无不必要的 `any` 类型

3. **代码质量**
   - ESLint 0错误
   - 命名规范正确
   - 无未使用的导入

4. **功能完整**
   - 路由参数正确传递
   - 权限检查正确
   - 无明显功能缺失

### 需要修改的条件

任一条件不满足时，需要在PR中请求修改：

1. **架构问题**
   - 指出职责混乱
   - 依赖关系不正确
   - 违反依赖规则

2. **类型问题**
   - TypeScript编译错误
   - 类型定义不完整
   - 滥用 `any` 类型

3. **代码规范**
   - ESLint错误
   - 命名不规范
   - 代码格式问题

4. **功能问题**
   - 路由参数传递错误
   - 权限检查缺失
   - 明显功能缺失

---

## 📝 审查报告模板

```markdown
# 代码审查报告

## 审查概述

**PR标题**: Pages重构
**审查者**: Code Reviewer
**审查日期**: 2025-03-15

## 审查文件统计

- 新增文件: 12个
- 修改文件: 18个
- 删除文件: 5个
- 总变更: 30个文件

## 问题汇总

### 架构问题

| 文件                        | 问题                  | 优先级 |
| --------------------------- | --------------------- | ------ |
| IndicatorDistributePage.vue | 业务逻辑应在Feature层 | 高     |

### 类型问题

| 文件 | 问题 | 优先级 |
| ---- | ---- | ------ |
| 无   | 无   | -      |

### 代码规范问题

| 文件 | 问题 | 优先级 |
| ---- | ---- | ------ |
| 无   | 无   | -      |

## 审查结论

### 总体评价: 通过 ✅

**审查意见**:
代码架构清晰，Pages层正确实现了薄包装模式。业务逻辑已正确迁移到Features层，类型定义完整，无明显的代码质量问题。建议合并到主分支。

### 后续建议

1. 合并后进行集成测试
2. 监控页面功能在实际环境中的表现
3. 根据需要优化文档进行更新

---

**报告生成时间**: 2025-03-15
**下次审查**: 合并后进行
```

---

**创建时间**: 2025-03-15
**版本**: v1.0
