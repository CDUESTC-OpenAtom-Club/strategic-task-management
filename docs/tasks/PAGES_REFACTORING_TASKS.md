# Pages重构任务分配

> **阶段**: 阶段二（续）
> **模式**: 并行协作
> **创建时间**: 2025-03-15

---

## 📋 任务清单

### Priority 1 - 高优级Pages

| 任务ID | 页面                    | 原行数 | 复杂度 | 优先级 | 预计时间 |
| ------ | ----------------------- | ------ | ------ | ------ | -------- |
| T-P-01 | IndicatorDistributePage | 3,686  | 高     | P0     | 4小时    |
| T-P-02 | LoginPage               | 918    | 中     | P0     | 2小时    |
| T-P-03 | PendingAuditPage        | 2,822  | 中     | P0     | 3小时    |
| T-P-04 | PlanAuditPage           | 396    | 中     | P0     | 3小时    |
| T-P-05 | PlanEditPage            | 462    | 中     | P1     | 4小时    |
| T-P-06 | StrategicTaskPage       | 5,727  | 高     | P1     | 5小时    |
| T-P-07 | ProfilePage             | 325    | 中     | P1     | 2小时    |
| T-P-08 | AdminConsolePage        | 1,800  | 中     | P2     | 2小时    |
| T-P-09 | MessageCenterPage       | 293    | 中     | P2     | 2小时    |
| T-P-10 | PlanListPage            | 677    | 中     | P2     | 1.5小时  |
| T-P-11 | Organization相关        | -      | 中     | P2     | 3小时    |

### Priority 2 - 待创建新组件的Pages

| 任务ID | 页面           | 说明                   | 优先级 | 预计时间 |
| ------ | -------------- | ---------------------- | ------ | -------- |
| T-P-12 | TaskDetailPage | 需要创建TaskDetailView | P1     | 3小时    |
| T-P-13 | TaskEditPage   | 需要创建TaskEditView   | P1     | 3小时    |
| T-P-14 | TaskFillPage   | 需要创建TaskFillView   | P1     | 3小时    |

---

## 🎯 重构模板（所有Pages统一）

### 薄包装模式

```vue
<template>
  <div class="{page-name}-page">
    <PageHeader title="页面标题">
      <template #actions>
        <ElButton v-if="canCreate" type="primary" @click="handleCreate"> 新建按钮 </ElButton>
      </template>
    </PageHeader>

    <PageLayout>
      <FeatureComponent :id="route.params.id" :query="route.query" @event="handleEvent" />
    </PageLayout>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PageHeader } from '@/shared/ui/layout'
import { useAuthStore } from '@/features/auth'
import type { FeatureComponent } from '../types'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// 权限检查
const canCreate = computed(() => authStore.hasPermission('create-permission'))

// 导航处理
function handleCreate() {
  router.push({ name: '{CreateRouteName}' })
}

function handleView(item: any) {
  router.push({
    name: '{DetailRouteName}',
    params: { id: item.id }
  })
}

function handleEdit(item: any) {
  router.push({
    name: '{EditRouteName}',
    params: { id: item.id }
  })
}

function handleEvent(event: EventName, payload: any) {
  // 处理Feature组件的事件
}
</script>

<style scoped>
.{page-name}-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>
```

---

## 📝 任务详细规格

### Task T-P-01: IndicatorDistributePage重构

**负责人**: Programmer A
**工期**: 4小时

**重构前**:

```vue
<!-- 当前文件: src/pages/strategy/indicators/ui/IndicatorDistributePage.vue -->
<!-- 行数: 3686行 -->
```

**重构后**:

```vue
<!-- 目标文件: src/pages/strategy/indicators/ui/IndicatorDistributePage.vue -->
<!-- 目标行数: < 50行 -->
<template>
  <div class="indicator-distribute-page">
    <PageHeader title="指标下发管理">
      <template #actions>
        <ElButton type="primary" @click="handleBatchDistribute"> 批量下发 </ElButton>
      </template>
    </PageHeader>

    <IndicatorDistributeView />
  </div>
</template>

<script setup lang="ts">
import { PageHeader } from '@/shared/ui/layout'
import { IndicatorDistributeView } from
src/features/strategic-indicator'
</script>
```

**任务步骤**:

1. 验证 `IndicatorDistributeView` 组件已创建
2. 重写Page为薄包装模式
3. 保留必要的权限检查逻辑
4. 确保路由参数正确传递
5. 测试：批量下发、选择组织、确认下发

**验收标准**:

- [ ] 页面 < 50行
- [ ] 仅包含路由逻辑
- [ ] 无业务逻辑
- [ ] 批量下发功能正常
- [ ] 提交到分支

---

### Task T-P-02: LoginPage重构

**负责人**: Programmer B
**工期**: 2小时

**任务步骤**:

1. 分析当前LoginPage的复杂性
2. 提取认证逻辑到 `LoginPageForm.vue`（如需创建）
3. 简化Page为薄包装
4. 测试：登录、登出、记住密码、第三方登录

**验收**:

- [ ] LoginPage < 50行
- [ ] 认证功能正常
- [ ] 样式正确

---

### Task T-P-03 ~ T-P-11: 其他Pages重构

**共同步骤**（所有Pages）:

1. 分析当前文件结构
2. 识别业务逻辑位置
3. 创建/验证对应的View组件
4. 重写Page为薄包装
5. 运行ESLint修复
6. 运行构建验证
7. 手动功能测试
8. 提交代码

---

## 🔄 工作流程

### 1. 创建工作分支

```bash
git checkout -b refactor/phase2-pages-continue

# 每个程序员创建个人分支
git checkout -b refactor/phase2-pages-continue-programmer-a
git checkout -b refactor/phase2-pages-continue-programmer-b
git checkout -b refactor/phase2-pages-continue-programmer-c
```

### 2. 并行开发

**并行策略**:

- Programmer A: T-P-01, T-P-04, T-P-06 (高复杂度）
- Programmer B: T-P-02, T-P-03, T-P-07 (中复杂度）
- Programmer C: T-P-08 ~ T-P-11 (低复杂度)

### 3. 代码审查流程

**审查检查清单**:

- [ ] 代码符合规范（ESLint 0错误）
- [ ] 类型安全（TypeScript无警告）
- [ ] 遵循薄包装模式（< 50行）
- [ ] 命名符合规范
- [ ] 注释清晰完整
- [ ] 测试覆盖充分

**审查时机**:

- 每个PR提交后立即审查
- 最多2小时内完成审查
- 审查通过后合并到主分支

### 4. 验收流程

**验收检查清单**:

- [ ] 所有Pages < 50行
- [ ] 无业务逻辑残留
- [ ] 功能测试通过
- [ ] 构建成功无错误
- [ ] 无性能退化

**验收时机**:

- 所有任务完成后统一验收
- QA团队执行回归测试
- 验收通过后合并到main

---

## 📊 交付物

### 每个程序员交付

**代码交付**:

```
refactor/phase2-pages-continue/
└── programmer-a/
│   ├── commits/
│   └── indicator-distribute-page.ts
└
```

**文档交付**:

- 重构说明文档
- 新组件设计文档（如需要）
- 测试用例文档

---

## ⏰ 风险管理

### 技术风险

1. **路由参数丢失** - Page重构后参数传递错误
   - **缓解**: 仔细测试所有路由导航

2. **功能缺失** - 业务逻辑迁移不完整
   - **缓解**: 对比重构前后功能清单

3. **类型错误** - TypeScript类型定义错误
   - **缓解**: 运行 `npm run type-check`

### 协作风险

1. **合并冲突** - 多个程序员同时修改同一文件
   - **缓解**: 分配不重叠的Pages
2. **代码审查阻塞** - 审查不及时影响进度
   - **缓解**: Code Reviewer及时响应

---

## 📈 成功标准

### 阶段完成标准

- ✅ 所有Pages行数 < 50行
- ✅ Pages仅包含路由逻辑
- ✅ 业务逻辑在Features层
- ✅ 无构建错误
- ✅ 功能测试通过
- ✅ Code Review通过

### 最终验收

- ✅ TypeScript类型检查通过
- ✅ ESLint 0错误
- ✅ 构建成功
- ✅ 单元测试覆盖率 > 60%
- ✅ 回归测试通过

---

## 📚 相关资源

- **重构方案**: `docs/前端渐进式重构方案.md`
- **阶段二任务卡**: `docs/tasks/phase2-pages-refactoring.md` (待创建)
- **架构文档**: `docs/前端架构-v3.md`
- **开发指南**: `docs/开发指南.md`
- **代码规范**: `docs/代码规范.md` (待创建）

---

**创建时间**: 2025-03-15
**预计完成**: 2025-03-16（根据团队大小）
**版本**: v1.0
