# Day 2: Composables 重组分析与计划

**日期**: 2026-03-16
**目标**: 分析并重组 `composables/` 目录
**方案**: 将纯工具函数移至 `shared/lib/`，保留真正的 Vue composables

---

## 一、当前状态分析

### 1.1 目录结构

```
src/composables/
├── dashboard/                        # ✅ 领域特定 composables
│   ├── index.ts                     # 26 行
│   ├── useDashboardState.ts         # 161 行 - Vue composable
│   └── useIndicatorStatus.ts        # 151 行 - Vue composable
│
├── layout/                           # ✅ 领域特定 composables
│   ├── index.ts                     # 17 行
│   ├── useAppLayout.ts              # 67 行 - Vue composable
│   ├── useDepartmentSwitcher.ts     # 127 行 - Vue composable
│   ├── useNavigation.ts             # 75 行 - Vue composable
│   └── useNotificationCenter.ts     # 34 行 - Vue composable
│
├── index.ts                          # 40 行 - 主导出文件
│
└── [root]                             # ❌ 混合的通用工具（非 Vue composables）
    ├── useDataValidator.ts          # 789 行 - ❌ 纯工具函数（应该移至 shared/lib/）
    ├── useErrorHandler.ts           # 686 行 - ✅ Vue composable（保留）
    ├── useLoadingState.ts           # 369 行 - ✅ Vue composable（保留）
    ├── usePermission.ts             # 423 行 - ✅ Vue composable（保留）
    ├── useTimeoutManager.ts         # 103 行 - ❌ 纯工具函数（应该移至 shared/lib/）
    └── useECharts.ts                # 361 行 - ✅ Vue composable（保留）
```

### 1.2 使用情况统计

| 文件                        | 行数 | 使用次数 | 是否 Vue Composable | 操作     |
| --------------------------- | ---- | -------- | ------------------- | -------- |
| `useDataValidator.ts`       | 789  | **2次**  | ❌ 纯工具函数       | **移动** |
| `useErrorHandler.ts`        | 686  | 0次      | ✅ Vue composable   | **保留** |
| `useLoadingState.ts`        | 369  | 0次      | ✅ Vue composable   | **保留** |
| `usePermission.ts`          | 423  | 0次      | ✅ Vue composable   | **保留** |
| `useECharts.ts`             | 361  | 0次      | ✅ Vue composable   | **保留** |
| `useTimeoutManager.ts`      | 103  | 0次      | ❌ 纯工具函数       | **移动** |
| Dashboard composables (3个) | 338  | -        | ✅ Vue composables  | **保留** |
| Layout composables (5个)    | 320  | -        | ✅ Vue composables  | **保留** |

**总计**: 3,429 行代码
**需要移动**: 892 行（26%）
**保留在 composables**: 2,537 行（74%）

### 1.3 关键发现

#### ✅ 好消息

1. **使用率极低**: 只有 **2个导入** 从 `@/composables`
   - `useDataValidator` 被 2 个文件使用
   - 其他所有 composables **完全未使用**

2. **已经模块化**: Dashboard 和 Layout composables 已经按领域分组

3. **真正的 Vue composables**: 大部分文件确实使用了 Vue reactivity

#### ⚠️ 问题

1. **命名误导**: 根目录的文件都以 `use` 开头，暗示是 composables，但实际不都是

2. **职责混乱**: `composables/` 根目录混合了：
   - 真正的 Vue composables（使用 ref, computed, onMounted 等）
   - 纯工具函数（完全不使用 Vue reactivity）

3. **未使用的代码**: 10 个 composables 中，只有 1 个被使用

---

## 二、重组方案

### 2.1 原则

**Vue Composable 判断标准**:

- ✅ 使用 Vue reactivity API（ref, computed, reactive, watch, onMounted 等）
- ❌ 只是普通 JavaScript 函数/类/工具

**分类规则**:

- **真正的 Vue composables** → 保留在 `composables/`
- **纯工具函数** → 移至 `shared/lib/`

### 2.2 具体操作

#### 操作1: 移动纯工具函数到 `shared/lib/`

**文件1**: `composables/useDataValidator.ts` (789行)

**目标位置**: `shared/lib/validation/dataValidator.ts`

**理由**:

- ❌ 不使用 Vue reactivity API
- ✅ 纯验证逻辑
- ✅ 可以在任何地方使用（不依赖 Vue）

**当前使用**:

```typescript
// src/features/legacy-indicator/ui/IndicatorListView.vue
import { useDataValidator } from '@/composables/useDataValidator'

// src/services/pageDataChecker.ts
import { useDataValidator } from '@/composables/useDataValidator'
```

**更新后**:

```typescript
import { validateMilestone, safeGet, validateEnum } from '@/shared/lib/validation/dataValidator'
```

---

**文件2**: `composables/useTimeoutManager.ts` (103行)

**目标位置**: `shared/lib/utils/timeoutManager.ts`

**理由**:

- ❌ 不使用 Vue reactivity API
- ✅ 纯超时管理逻辑
- ✅ 可以在任何地方使用

**当前使用**: 无（0次）

**注意**: 既然未被使用，可以考虑删除或保留以备将来使用

---

#### 操作2: 保留真正的 Vue Composables

**保留在 `composables/` 的文件**:

```
composables/
├── dashboard/                        # ✅ 保留
│   ├── useDashboardState.ts
│   └── useIndicatorStatus.ts
│
├── layout/                           # ✅ 保留
│   ├── useAppLayout.ts
│   ├── useDepartmentSwitcher.ts
│   ├── useNavigation.ts
│   └── useNotificationCenter.ts
│
└── [root]                             # ✅ 保留（真正的 Vue composables）
    ├── useErrorHandler.ts            # 使用 ref, Ref
    ├── useLoadingState.ts            # 使用 ref
    ├── usePermission.ts              # 使用 ref, computed
    └── useECharts.ts                 # 使用 ref, onMounted, watch
```

---

#### 操作3: 更新主导出文件

**当前**: `composables/index.ts`

**修改后**:

```typescript
// Dashboard composables
export * from './dashboard'

// Layout composables
export * from './layout'

// General composables
export { useErrorHandler } from './useErrorHandler'
export { useLoadingState } from './useLoadingState'
export { usePermission } from './usePermission'
export { useECharts } from './useECharts'

// 注意: useDataValidator 和 useTimeoutManager 已移至 shared/lib/
```

---

### 2.3 最终目录结构

```
src/
├── composables/                      # ✅ 只保留真正的 Vue composables
│   ├── dashboard/                    # 领域特定
│   │   ├── index.ts
│   │   ├── useDashboardState.ts
│   │   └── useIndicatorStatus.ts
│   │
│   ├── layout/                       # 领域特定
│   │   ├── index.ts
│   │   ├── useAppLayout.ts
│   │   ├── useDepartmentSwitcher.ts
│   │   ├── useNavigation.ts
│   │   └── useNotificationCenter.ts
│   │
│   ├── index.ts                      # 主导出文件
│   ├── useErrorHandler.ts
│   ├── useLoadingState.ts
│   ├── usePermission.ts
│   └── useECharts.ts
│
└── shared/
    └── lib/
        ├── validation/               # ✅ 新增
        │   ├── index.ts
        │   └── dataValidator.ts      # 从 composables 移动
        │
        └── utils/                    # ✅ 新增
            ├── index.ts
            └── timeoutManager.ts     # 从 composables 移动
```

---

## 三、实施步骤

### 步骤1: 创建 Git 备份

```bash
git stash push -m "backup-before-day2-composables-$(date +%Y%m%d-%H%M%S)"
```

---

### 步骤2: 创建目标目录结构

```bash
mkdir -p src/shared/lib/validation
mkdir -p src/shared/lib/utils
```

---

### 步骤3: 移动文件并修改

#### 3.1 移动 useDataValidator

```bash
# 移动文件
git mv src/composables/useDataValidator.ts src/shared/lib/validation/dataValidator.ts
```

**修改内容**:

- 移除 "use" 前缀（因为不是 composable）
- 更新导出
- 添加 JSDoc 说明

#### 3.2 移动 useTimeoutManager

```bash
git mv src/composables/useTimeoutManager.ts src/shared/lib/utils/timeoutManager.ts
```

**修改内容**:

- 移除 "use" 前缀
- 导出类而非 composable 函数
- 添加使用示例

---

### 步骤4: 创建新的 index.ts 文件

#### 4.1 `shared/lib/validation/index.ts`

```typescript
export * from './dataValidator'
```

#### 4.2 `shared/lib/utils/index.ts`

```typescript
export * from './timeoutManager'
```

#### 4.3 更新 `shared/lib/index.ts`

添加对新模块的导出。

---

### 步骤5: 更新 `composables/index.ts`

移除已移动文件的导出。

---

### 步骤6: 更新导入引用

**需要更新的文件** (2个):

1. `src/features/legacy-indicator/ui/IndicatorListView.vue`

   ```typescript
   // 修改前
   import { useDataValidator } from '@/composables/useDataValidator'

   // 修改后
   import { validateMilestone, safeGet, validateEnum } from '@/shared/lib/validation/dataValidator'
   ```

2. `src/services/pageDataChecker.ts`

   ```typescript
   // 修改前
   import { useDataValidator } from '@/composables/useDataValidator'

   // 修改后
   import { validateMilestone, safeGet, validateEnum } from '@/shared/lib/validation/dataValidator'
   ```

---

### 步骤7: 更新使用方式

**修改前** (作为 composable):

```typescript
const { validateMilestone, safeGet } = useDataValidator({ logErrors: true })
const result = validateMilestone(data)
```

**修改后** (直接导入函数):

```typescript
import { validateMilestone, safeGet } from '@/shared/lib/validation/dataValidator'
const result = validateMilestone(data, { logErrors: true })
```

**注意**: 需要修改函数签名，将 options 从构造函数移到各个函数参数中。

---

### 步骤8: 测试验证

```bash
# 1. 检查导入
npm run build

# 2. 运行开发服务器
npm run dev

# 3. 手动测试
```

---

## 四、风险评估

### 低风险 ✅

1. **移动 useTimeoutManager**
   - 0次使用
   - 只是移动位置
   - 可以安全执行

2. **移动 useDataValidator**
   - 只有2个使用点
   - 纯函数移动
   - 容易测试和修复

### 中风险 ⚠️

1. **更新 useDataValidator 的使用方式**
   - 需要修改函数签名
   - 从 composable 模式改为直接导入
   - 2个文件需要更新

**缓解措施**:

- 逐步修改，先移动文件，再更新使用方式
- 保留向后兼容性（暂时导出包装函数）
- 完整的构建和运行时测试

---

## 五、决策点

**需要您确认**:

1. ✅ 同意移动 `useDataValidator.ts` 到 `shared/lib/validation/`?
2. ✅ 同意移动 `useTimeoutManager.ts` 到 `shared/lib/utils/`?
3. ✅ 同意更新这些文件的函数签名（从 composable 模式改为直接导入）?
4. ✅ 同意删除 `use` 前缀（因为它们不是 composables）?

**或者**，您可以选择：

- **选项 A**: 只移动文件，保持函数签名不变（向后兼容）
- **选项 B**: 完全重构为纯工具函数模式（推荐）

---

## 六、预期成果

### 量化指标

| 指标                      | 当前 | 重组后 | 改善  |
| ------------------------- | ---- | ------ | ----- |
| Composables 文件数        | 15个 | 13个   | -2    |
| 纯工具函数在 composables/ | 2个  | 0个    | -100% |
| 目录结构清晰度            | 中   | 高     | ⬆️    |
| 命名准确性                | 60%  | 100%   | ⬆️    |

### 质量改善

1. **架构清晰**: `composables/` 只包含真正的 Vue composables
2. **职责明确**: 纯工具函数移至 `shared/lib/`
3. **命名准确**: 移除 `use` 前缀（非 composables）
4. **易于理解**: 新开发者可以快速找到需要的代码

---

## 七、后续工作

完成 Composables 重组后：

1. **Day 3-4**: 分析其他模块（如 `pages/`，`shared/`）
2. **Week 2**: 开始提取 `legacy-indicator` 的业务逻辑
3. **Week 3-4**: 集成到新的 `features/indicator` 模块

---

## 八、时间估算

| 步骤         | 预计时间    |
| ------------ | ----------- |
| 移动文件     | 15分钟      |
| 更新导入     | 30分钟      |
| 修改函数签名 | 45分钟      |
| 测试验证     | 30分钟      |
| **总计**     | **约2小时** |
