# Features 模块审计报告

> 生成时间：2026-03-12
> 审计范围：src/features/ 目录下所有模块

## 📊 审计总结

### ✅ 完整的 Features
- `strategic-indicator/` - 结构完整，符合 FSD 规范

### ⚠️ 需要整改的 Features
- `approval/` - 缺少标准层级结构
- `dashboard/` - 缺少标准层级结构  
- `indicator/` - 与 strategic-indicator 功能重复
- `plan/` - 缺少标准层级结构
- `task/` - 结构不完整

---

## 📋 详细审计结果

### 1. features/strategic-indicator/ ✅
**状态**: 完整符合 FSD 规范

**结构**:
```
strategic-indicator/
├── api/           ✅ 完整 (mutations.ts, query.ts, types.ts)
├── lib/           ✅ 完整 (calculations.ts, validations.ts)
├── model/         ✅ 完整 (constants.ts, schema.ts, store.ts, types.ts)
├── ui/            ✅ 完整 (4个组件)
├── index.ts       ✅ 存在
└── README.md      ✅ 存在
```

**评价**: 这是标准的 FSD feature 结构，可作为其他 feature 的参考模板。

---

### 2. features/approval/ ⚠️
**状态**: 结构不规范，需要重构

**当前结构**:
```
approval/
├── components/    ❌ 应该是 ui/
│   └── PlanApprovalDrawer.vue
└── services/      ❌ 应该是 api/ 或 lib/
    └── approvalNotifications.ts
```

**缺失层级**:
- ❌ `model/` - 缺少状态管理和类型定义
- ❌ `api/` - 缺少 API 调用层
- ❌ `lib/` - 缺少业务逻辑层
- ❌ `index.ts` - 缺少导出文件

**整改建议**:
1. 重命名 `components/` → `ui/`
2. 重命名 `services/` → `lib/` 或 `api/`
3. 添加 `model/store.ts` (迁移 `stores/approval.ts`)
4. 添加 `api/` 层 (迁移 `src/api/approval.ts`)
5. 添加 `index.ts` 和 `README.md`

---

### 3. features/dashboard/ ⚠️
**状态**: 结构不规范，需要重构

**当前结构**:
```
dashboard/
├── stores/        ❌ 应该是 model/
│   └── dashboardStore.ts
├── views/         ❌ 应该是 ui/
│   └── DashboardView.vue
└── index.ts       ✅ 存在
```

**缺失层级**:
- ❌ `api/` - 缺少 API 调用层
- ❌ `lib/` - 缺少业务逻辑层

**整改建议**:
1. 重命名 `stores/` → `model/`
2. 重命名 `views/` → `ui/`
3. 添加 `api/` 层
4. 添加 `lib/` 层
5. 添加 `README.md`

---

### 4. features/indicator/ ⚠️
**状态**: 与 strategic-indicator 功能重复

**当前结构**:
```
indicator/
├── api/           ⚠️ 与 strategic-indicator/api 重复
│   ├── indicatorApi.ts
│   └── milestoneApi.ts
├── components/    ❌ 应该是 ui/
│   ├── IndicatorDetailDialog.vue
│   ├── IndicatorFillForm.vue
│   ├── IndicatorFillHistory.vue
│   └── MilestoneTimeline.vue
├── views/         ❌ 应该是 ui/
│   ├── IndicatorDistributionView.vue
│   ├── IndicatorFillView.vue
│   └── IndicatorListView.vue
└── index.ts       ✅ 存在
```

**问题分析**:
1. **功能重复**: 与 `strategic-indicator/` 都处理指标相关功能
2. **职责不清**: 两个 feature 的边界不明确
3. **代码分散**: 指标相关代码分布在两个地方

**整改建议**:
1. **合并策略**: 将 `indicator/` 合并到 `strategic-indicator/`
2. **功能划分**: 
   - `strategic-indicator/` 负责指标管理（CRUD、下发、审批）
   - 如需保留 `indicator/`，则专注于指标填报和查看
3. **迁移计划**:
   - 将 `indicator/api/milestoneApi.ts` → `entities/milestone/api/`
   - 将 `indicator/components/*` → `strategic-indicator/ui/`
   - 将 `indicator/views/*` → `pages/strategy/indicators/ui/`

---

### 5. features/plan/ ⚠️
**状态**: 结构不规范，需要重构

**当前结构**:
```
plan/
├── api/           ✅ 正确
│   └── planApi.ts
├── components/    ❌ 应该是 ui/
│   ├── PlanAuditPanel.vue
│   └── PlanFillWorkspace.vue
├── views/         ❌ 应该是 ui/
│   ├── PlanAuditView.vue
│   ├── PlanDetailView.vue
│   ├── PlanEditView.vue
│   └── PlanListView.vue
└── index.ts       ✅ 存在
```

**缺失层级**:
- ❌ `model/` - 缺少状态管理 (需迁移 `stores/plan.ts`)
- ❌ `lib/` - 缺少业务逻辑层

**整改建议**:
1. 重命名 `components/` → `ui/`
2. 将 `views/` 内容迁移到 `pages/strategy/plans/ui/`
3. 添加 `model/store.ts` (迁移 `stores/plan.ts`)
4. 添加 `lib/` 层
5. 添加 `README.md`

---

### 6. features/task/ ⚠️
**状态**: 结构严重不完整

**当前结构**:
```
task/
├── api/           ⚠️ 只有一个文件
│   └── strategicApi.ts
└── index.ts       ✅ 存在
```

**缺失层级**:
- ❌ `model/` - 缺少状态管理 (需迁移 `stores/strategic.ts`)
- ❌ `lib/` - 缺少业务逻辑层
- ❌ `ui/` - 缺少 UI 组件

**整改建议**:
1. 添加 `model/store.ts` (迁移 `stores/strategic.ts`)
2. 添加 `lib/` 层
3. 添加 `ui/` 层 (迁移 `components/task/*`)
4. 完善 `api/` 层
5. 添加 `README.md`

---

## 🎯 整改优先级

### 高优先级 (立即处理)
1. **indicator/ 与 strategic-indicator/ 重复** - 需要合并或明确职责划分
2. **task/ 结构不完整** - 需要补充完整的层级结构

### 中优先级 (本周处理)
3. **approval/ 结构不规范** - 需要重构为标准结构
4. **dashboard/ 结构不规范** - 需要重构为标准结构
5. **plan/ 结构不规范** - 需要重构为标准结构

---

## 📝 标准 Feature 结构模板

基于 `strategic-indicator/` 的完整结构，标准 feature 应包含：

```
feature-name/
├── api/              # API 调用层
│   ├── mutations.ts  # 变更操作 (POST, PUT, DELETE)
│   ├── query.ts      # 查询操作 (GET)
│   └── types.ts      # API 类型定义
├── lib/              # 业务逻辑层
│   ├── calculations.ts  # 计算逻辑
│   ├── validations.ts   # 验证逻辑
│   └── utils.ts         # 工具函数
├── model/            # 数据模型层
│   ├── constants.ts  # 常量定义
│   ├── schema.ts     # 数据验证模式
│   ├── store.ts      # Pinia 状态管理
│   └── types.ts      # 类型定义
├── ui/               # UI 组件层
│   ├── FeatureCard.vue
│   ├── FeatureForm.vue
│   ├── FeatureList.vue
│   └── FeatureDialog.vue
├── index.ts          # 导出文件
└── README.md         # 文档说明
```

---

**审计完成时间**: 2026-03-12
**下一步**: 开始执行整改计划