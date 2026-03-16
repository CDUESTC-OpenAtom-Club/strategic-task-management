# Pages重构协作方案 - 详细任务说明

> **分发对象**: 3个程序员
> **阶段**: 阶段二（续）
> **模式**: 并行开发 + 代码审查

---

## 📋 每个程序员的详细任务

## Programmer A - 高优级Pages（Indicator系列）

### Task 2.1: IndicatorDistributePage重构

**文件**: `src/pages/strategy/indicators/ui/IndicatorDistributePage.vue`

**重构前状态**:

- 行数: 3,686行
- 包含: 组织树选择、批量下发、确认弹窗、历史记录
- 业务逻辑密度: 高

**重构目标**:

```vue
<template>
  <div class="indicator-distribute-page">
    <PageHeader title="指标下发管理">
      <template #actions>
        <ElButton v-if="canBatchDistribute" type="primary" @click="handleBatchDistribute">
          批量下发
        </ElButton>
      </template>
    </PageHeader>

    <IndicatorDistributeView />
  </div>
</template>

<script setup lang="ts">
import { PageHeader } from '@/shared/ui/layout'
import { IndicatorDistributeView } from '@/features/strategic-indicator'
</script>
```

**验收标准**:

- [ ] 页面 < 50行
- [ ] 仅包含路由逻辑
- [ ] 业务逻辑在 `features/strategic-indicator`
- [ ] `npm run build` 成功
- [ ] 提交代码

---

### Task 2.2: IndicatorDetailPage重构

**文件**: `src/pages/strategy/indicators/ui/IndicatorDetailPage.vue`

**重构目标**: 调用 `IndicatorDetailView` 组件

**验收标准**:

- [ ] 页面 < 50行
- [ ] 仅包含路由逻辑
- [ ] 提交代码

---

### Task 2.3: IndicatorEditPage重构

**文件**: `src/pages/strategy/indicators/ui/IndicatorEditPage.vue`

**重构目标**: 调用 `IndicatorEditView` 组件

**验收标准**:

- [ ] 页面 < 50行
- [ ] 仅包含路由逻辑
- [ ] 提交代码

---

### Task 2.4: IndicatorFillPage重构

**文件**: `src/pages/strategy/indicators/ui/IndicatorFillPage.vue`

**重构目标**: 调用 `IndicatorFillView` 组件

**验收标准**:

- [ ] 页面 < 50行
- [ ] 仅包含路由逻辑
- [ ] 提交代码

---

## Programmer B - Dashboard + Plan系列

### Task 2.5: DashboardPage重构

**状态**: 已在之前的智能体中完成

**验证**:

- [ ] 当前行数: 30行
- [ ] 功能正常
- [ ] 需要进一步优化时处理

---

### Task 2.6- LoginPage重构

**文件**: `src/pages/auth/ui/LoginPage.vue`

**重构步骤**:

1. 提取认证逻辑到 `features/auth/ui/LoginForm.vue`
2. 简化Page为薄包装

**验收标准**:

- [ ] 页面 < 60行（登录页可能稍大）
- [ ] 仅包含布局和导航逻辑
- [ ] 提交代码

---

### Task 2.7 ~ 2.10: Plan系列Pages

**要重构的Pages**:

- PendingAuditPage
- PlanAuditPage
- PlanEditPage
- PlanDetailPage

**模式**: 统一重构，使用通用计划模板

---

## Programmer C - 其他Pages

### Task 2.11 ~ 2.16: 中低优先级Pages

**Pages列表**:

- ProfilePage
- ChangePasswordPage
- AdminConsolePage
- MessageCenterPage
- StrategicTaskPage
- PlanListPage
- Organization相关Pages

**重构策略**:

1. 优先重构使用频率高的Pages
2. 检查是否已有对应的View组件
3. 统一应用薄包装模式

---

## 🔀 工作流程

### Step 1: 分支创建

```bash
# 主分支
git checkout main
git pull origin main

# 创建工作分支
git checkout -b refactor/phase2-pages-continue

# 每个程序员创建个人分支
git checkout -b refactor/phase2-pages-continue-programmer-a
git checkout -b refactor/phase2-pages-continue-programmer-b
git checkout -b refactor/phase2-pages-continue-programmer-c
```

### Step 2: 并行开发

```bash
# Programmer A - 高优级Pages
git checkout refactor/phase2-pages-continue-programmer-a
# 完成 T2-01 ~ T2-04

# Programmer B - Dashboard + Plan系列
git checkout refactor/phase2-pages-continue-programmer-b
# 完成 T2-05 ~ T2-10

# Programmer C - 其他Pages
git checkout refactor/phase2-pages-continue-programmer-c
# 完成 T2-11 ~ T2-16
```

### Step 3: 代码审查流程

**审查时机**: 每个PR创建后立即开始

**审查清单**:

- [ ] 代码符合规范
- [ ] TypeScript类型安全
- [ ] 无 ESLint 错误
- [ ] 遵循薄包装模式
- [ ] 权限检查正确
- [ ] 注释清晰完整

### Step 4: 验收流程

**QA检查项目**:

- [ ] 所有Pages < 50行（除Login外）
- [ ] 无业务逻辑残留
- [ ] 路由导航正常
- [ ] 权限验证正确
- [ ] 无控制台错误

**构建验证**:

- [ ] `npm run build` 成功
- [ ] `npm run type-check` 通过
- [ ] 包体积合理

---

## 📊 每日站会

### Daily Standup (每天9:30)

**每个人汇报**:

1. 昨天完成的任务
2. 遇到的问题
3. 明天计划
4. 需要的帮助

**Tech Lead 决策**:

- 风险识别和应对
- 资源调配
- 问题解决

---

## 🚨 验收标准总结

### 代码质量

- [x] 所有Pages < 100行（除登录外）
- [x] Pages仅包含路由逻辑
- [x] 业务逻辑在Features层
- [x] TypeScript类型安全
      `npm run type-check` 通过

### 构建验证

- [x] `npm run build` 成功
- [x] 无构建错误
- [x] 包体积优化

### 功能验证

- [x] 所有页面功能正常
- [x] 路由导航正常
- [x] 权限验证正确
- [x] 无控制台错误

### Git规范

- [x] PR遵循提交规范
- [x] 包含Co-Authored-By
- [x] 通过代码审查

---

## 📞 后续支持

### 技术支持

- [ ] Tech Lead - 技术决策
- [ ] Code Reviewer - 审查指南
- [ ] QA Engineer - 测试框架

### 文档支持

- [ ] 重构方案文档
      `docs/前端渐进式重构方案.md`
- [ ] 架构文档
      `docs/前端架构-v3.md`
- [ ] 开发指南
      `docs/开发指南.md`

### 沟通支持

- [ ] 每日站会
- [ ] 代码评审流程
- [ ] 技术评审流程

---

**创建时间**: 2025-03-15
**版本**: v1.0
