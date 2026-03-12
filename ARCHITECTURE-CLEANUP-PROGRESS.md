# 架构清理任务进度报告

> 更新时间：2026-03-12
> 任务来源：ARCHITECTURE-ANALYSIS-REPORT.md

## ✅ 已完成的任务

### 高优先级任务 - Stores 迁移

1. ✅ **迁移 stores/auditLog.ts**
   - 源位置：`src/stores/auditLog.ts`
   - 目标位置：`src/features/admin/model/auditLog.ts`
   - 状态：已完成
   - 说明：创建了 features/admin/model/ 目录

2. ✅ **迁移 stores/message.ts**
   - 源位置：`src/stores/message.ts`
   - 目标位置：`src/features/messages/model/message.ts`
   - 状态：已完成
   - 说明：创建了 features/messages/ 和 features/messages/model/ 目录

3. ✅ **迁移 stores/strategic.ts**
   - 源位置：`src/stores/strategic.ts`
   - 目标位置：`src/features/task/model/strategic.ts`
   - 状态：已完成

4. ✅ **迁移 stores/timeContext.ts**
   - 源位置：`src/stores/timeContext.ts`
   - 目标位置：`src/shared/lib/timeContext.ts`
   - 状态：已完成

**结果**：`src/stores/` 目录已清空，所有 4 个 store 文件已迁移到新位置

---

## ⬜ 待执行的任务

### 高优先级任务

#### 1. 删除空的 Features 子目录
需要删除以下空目录（如果确认为空）：
- `features/approval/components/`
- `features/approval/services/`
- `features/indicator/components/`
- `features/plan/components/`
- 其他 features 中的 `components/`, `stores/`, `views/`, `services/` 空目录

#### 2. 删除根目录的旧架构目录
- ⬜ 删除 `src/components/` 及其所有子目录
- ⬜ 删除 `src/views/`
- ⬜ 删除 `src/stores/`

### 中优先级任务

#### 3. 整理 Shared 层
- ⬜ 合并 `shared/components/` 到 `shared/ui/`
- ⬜ 移动 `shared/services/` 到 `shared/api/`

#### 4. 更新导入路径
需要更新以下文件中的导入路径：
- 所有引用 `@/stores/auditLog` 的文件 → `@/features/admin/model/auditLog`
- 所有引用 `@/stores/message` 的文件 → `@/features/messages/model/message`
- 所有引用 `@/stores/strategic` 的文件 → `@/features/task/model/strategic`
- 所有引用 `@/stores/timeContext` 的文件 → `@/shared/lib/timeContext`

#### 5. 补全不完整的 Features
- ⬜ 为 `features/admin/` 添加 `api/` 和完善 `model/`
- ⬜ 为 `features/milestone/` 添加 `model/` 和 `api/`
- ⬜ 为 `features/profile/` 添加 `model/` 和 `api/`
- ⬜ 为 `features/messages/` 添加 `ui/` 和 `api/`

---

## 🔍 当前架构状态

### Stores 目录
- ✅ `src/stores/` - 已清空，可以删除

### Components 目录
- ⚠️ `src/components/` - 有子目录但无文件，可以删除

### Views 目录
- ✅ `src/views/` - 已清空，可以删除

### Features 非标准目录
需要检查并清理以下 features 中的非标准目录：
- `approval/` - components, services
- `indicator/` - components
- `plan/` - components
- `dashboard/` - stores, views (如果还存在)

### Shared 层
- ⚠️ `shared/components/` - 存在，应合并到 `shared/ui/`
- ⚠️ `shared/services/` - 存在，应移到 `shared/api/`

---

## 📋 下一步行动计划

### 立即执行（需要更新导入路径）

1. **更新导入路径**
   - 搜索并替换所有对已迁移 stores 的引用
   - 使用 VSCode 的全局搜索替换功能
   - 或使用 `semanticRename` 工具

2. **验证构建**
   - 运行 `npm run type-check`
   - 运行 `npm run build`
   - 确保无错误

### 后续执行（清理空目录）

3. **删除空目录**
   - 删除 features 中的空 components/, stores/, views/, services/
   - 删除 src/components/, src/views/, src/stores/

4. **整理 Shared 层**
   - 合并 shared/components/ 到 shared/ui/
   - 移动 shared/services/ 到 shared/api/

---

## ⚠️ 注意事项

1. **导入路径更新是关键**
   - 必须先更新所有导入路径，否则应用会报错
   - 建议使用自动化工具（如 semanticRename）而不是手动替换

2. **保持功能完整**
   - 只改架构，不改 UI 界面
   - 每个步骤后都要验证应用能正常运行

3. **渐进式执行**
   - 先更新导入路径并验证
   - 再删除空目录
   - 最后整理 shared 层

---

## 📊 完成度统计

- **高优先级任务**：4/7 完成 (57%)
  - ✅ Stores 迁移：4/4
  - ⬜ 导入路径更新：0/1
  - ⬜ 空目录清理：0/2

- **中优先级任务**：0/3 完成 (0%)
  - ⬜ Shared 层整理：0/2
  - ⬜ Features 补全：0/1

- **总体进度**：4/10 完成 (40%)

---

**下一步**：更新所有导入路径，然后运行类型检查和构建验证
