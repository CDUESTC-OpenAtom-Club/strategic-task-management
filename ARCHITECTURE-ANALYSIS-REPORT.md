# 前端架构分析报告

> 生成时间：2026-03-12
> 分析范围：strategic-task-management/src

## 1. 架构概览

### 1.1 目录结构统计

| 目录 | 文件数 | 子目录数 | 状态 |
|------|--------|----------|------|
| **FSD 核心层** | | | |
| shared/ | 89 | 26 | ✅ 完整 |
| entities/ | 21 | 13 | ✅ 完整 |
| features/ | 95 | 44 | ⚠️ 结构不统一 |
| pages/ | 39 | 21 | ✅ 完整 |
| **旧架构残留** | | | |
| api/ | 1 | 4 | ✅ 仅保留兼容层 |
| stores/ | 4 | 0 | ⚠️ 未完全迁移 |
| components/ | 0 | 10 | ⚠️ 空目录未删除 |
| views/ | 0 | 0 | ⚠️ 空目录未删除 |
| **其他** | | | |
| composables/ | 13 | 2 | ✅ 正常 |
| utils/ | 19 | 2 | ✅ 正常 |
| router/ | 3 | 0 | ✅ 正常 |
| types/ | 6 | 0 | ✅ 正常 |

### 1.2 FSD 架构符合度

**符合 FSD 标准的层级**：
- ✅ shared/ - 共享资源层
- ✅ entities/ - 实体层
- ✅ features/ - 特性层（但结构不统一）
- ✅ pages/ - 页面层

**缺失的 FSD 层级**：
- ❌ app/ - 应用配置层（使用根目录的 App.vue 和 main.ts）
- ❌ widgets/ - 组件层（功能分散在 features 中）
- ❌ processes/ - 流程编排层

## 2. 详细分析

### 2.1 Shared 层分析

```
shared/
├── api/          (7 files)  - HTTP 客户端和拦截器
├── components/   (10 files) - 通用组件（应该在 ui/ 下）
├── config/       (3 files)  - 配置文件
├── lib/          (29 files) - 工具函数
├── services/     (1 file)   - 服务（应该在 api/ 下）
├── types/        (3 files)  - 类型定义
└── ui/           (34 files) - UI 组件
```

**问题**：
1. ⚠️ `shared/components/` 和 `shared/ui/` 重复，应该合并
2. ⚠️ `shared/services/` 应该移到 `shared/api/`

### 2.2 Entities 层分析

```
entities/
├── indicator/     ✅ 完整 (model/types.ts)
├── milestone/     ✅ 完整 (model/types.ts, api/)
├── organization/  ✅ 完整 (model/types.ts)
├── plan/          ✅ 完整 (model/types.ts)
├── task/          ✅ 完整 (model/types.ts)
└── user/          ✅ 完整 (model/types.ts)
```

**评价**：✅ 实体层结构清晰，符合 FSD 规范

### 2.3 Features 层分析

```
features/
├── admin/                  ❌ 只有 ui/
├── approval/               ✅ api, model, ui, lib
├── auth/                   ✅ api, model, ui
├── dashboard/              ⚠️ model, stores, views (旧结构)
├── indicator/              ⚠️ api, components, ui, views (混合结构)
├── milestone/              ❌ 只有 ui/
├── organization/           ⚠️ api, model (缺少 ui)
├── plan/                   ⚠️ api, model, components, views (混合结构)
├── profile/                ❌ 只有 ui/
├── strategic-indicator/    ✅ api, model, ui, lib (标准结构)
└── task/                   ✅ api, model, ui, lib
```

**问题**：
1. ⚠️ 结构不统一：有的用 `components/`，有的用 `ui/`
2. ⚠️ 有的还保留 `views/` 和 `stores/`（应该是 `ui/` 和 `model/`）
3. ❌ 部分 feature 不完整（只有 ui 层）

**标准 Feature 结构应该是**：
```
features/xxx/
├── model/     - 状态管理和业务逻辑
├── api/       - API 调用
├── lib/       - 工具函数
└── ui/        - UI 组件
```

### 2.4 Pages 层分析

```
pages/
├── admin/      ✅
├── approval/   ✅
├── auth/       ✅
├── dashboard/  ✅
├── error/      ✅
├── messages/   ✅
├── profile/    ✅
└── strategy/   ✅
```

**评价**：✅ 页面层结构清晰

### 2.5 旧架构残留分析

**api/ 目录**：
- ✅ 只保留 `index.ts` 作为兼容层
- ✅ 其他文件已删除
- ✅ 符合重构要求

**stores/ 目录**：
- ⚠️ 还有 4 个文件：
  - `auditLog.ts`
  - `message.ts`
  - `strategic.ts`
  - `timeContext.ts`
- ❌ 这些应该迁移到对应的 features/*/model/

**components/ 目录**：
- ⚠️ 空目录但有 10 个子目录
- ❌ 应该完全删除

**views/ 目录**：
- ✅ 已清空
- ⚠️ 空目录应该删除

## 3. 架构问题总结

### 3.1 高优先级问题

1. **Features 结构不统一** ⚠️
   - 有的用 `components/`，有的用 `ui/`
   - 有的用 `stores/`，有的用 `model/`
   - 有的还有 `views/`

2. **Stores 未完全迁移** ❌
   - `stores/auditLog.ts` → 应该在 `features/admin/model/`
   - `stores/message.ts` → 应该在 `features/messages/model/`
   - `stores/strategic.ts` → 应该在 `features/task/model/`
   - `stores/timeContext.ts` → 应该在 `shared/lib/` 或 `features/dashboard/model/`

3. **空目录未清理** ⚠️
   - `src/components/` 有 10 个空子目录
   - `src/views/` 空目录

### 3.2 中优先级问题

4. **Shared 层结构混乱** ⚠️
   - `shared/components/` 和 `shared/ui/` 重复
   - `shared/services/` 应该在 `shared/api/`

5. **部分 Features 不完整** ⚠️
   - `features/admin/` 只有 ui
   - `features/milestone/` 只有 ui
   - `features/profile/` 只有 ui
   - `features/organization/` 缺少 ui

### 3.3 低优先级问题

6. **缺少 FSD 高级层** ℹ️
   - 没有 `app/` 层（应用配置）
   - 没有 `widgets/` 层（复合组件）
   - 没有 `processes/` 层（流程编排）

7. **其他目录位置** ℹ️
   - `composables/` 应该考虑迁移到 `shared/lib/composables/`
   - `utils/` 应该考虑迁移到 `shared/lib/utils/`
   - `types/` 应该考虑迁移到 `shared/types/`

## 4. 改进建议

### 4.1 立即执行（高优先级）

1. **统一 Features 结构**
   ```bash
   # 将所有 features/*/components/ 重命名为 ui/
   # 将所有 features/*/stores/ 重命名为 model/
   # 将所有 features/*/views/ 内容移到 ui/
   ```

2. **迁移剩余 Stores**
   ```bash
   # 迁移 stores/auditLog.ts → features/admin/model/auditLog.ts
   # 迁移 stores/message.ts → features/messages/model/message.ts
   # 迁移 stores/strategic.ts → features/task/model/strategic.ts
   # 迁移 stores/timeContext.ts → shared/lib/timeContext.ts
   ```

3. **删除空目录**
   ```bash
   # 删除 src/components/ 及其子目录
   # 删除 src/views/
   # 删除 src/stores/
   ```

### 4.2 后续优化（中优先级）

4. **整理 Shared 层**
   ```bash
   # 合并 shared/components/ 到 shared/ui/
   # 移动 shared/services/ 到 shared/api/
   ```

5. **补全不完整的 Features**
   - 为 `features/admin/` 添加 model 和 api
   - 为 `features/milestone/` 添加 model 和 api
   - 为 `features/profile/` 添加 model 和 api
   - 为 `features/organization/` 添加 ui

### 4.3 长期规划（低优先级）

6. **引入高级 FSD 层**
   - 创建 `app/` 层管理应用配置
   - 创建 `widgets/` 层管理复合组件
   - 创建 `processes/` 层管理跨特性流程

7. **整合根目录文件**
   - 将 `composables/` 迁移到 `shared/lib/composables/`
   - 将 `utils/` 迁移到 `shared/lib/utils/`
   - 将 `types/` 迁移到 `shared/types/`

## 5. 架构评分

| 维度 | 评分 | 说明 |
|------|------|------|
| **FSD 符合度** | 6/10 | 基本层级已建立，但结构不统一 |
| **代码组织** | 7/10 | 大部分代码已迁移，但有残留 |
| **可维护性** | 7/10 | 新架构清晰，但旧代码影响 |
| **一致性** | 5/10 | Features 结构不统一 |
| **完整性** | 6/10 | 部分 features 不完整 |
| **总体评分** | **6.2/10** | 重构进行中，需要继续优化 |

## 6. 下一步行动

### 立即执行
1. ✅ 统一所有 features 的目录结构（components → ui, stores → model）
2. ✅ 迁移剩余的 4 个 stores 文件
3. ✅ 删除所有空目录（components/, views/, stores/）

### 本周完成
4. ⬜ 整理 shared 层结构
5. ⬜ 补全不完整的 features

### 本月完成
6. ⬜ 引入 app/ 层
7. ⬜ 整合根目录的 composables/, utils/, types/

---

**报告结论**：
前端架构重构已完成 60%，FSD 基本层级已建立，但存在结构不统一和旧代码残留问题。建议优先统一 features 结构和清理残留代码，然后再进行深度优化。
