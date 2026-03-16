# 架构迁移映射表

## 项目当前状态分析

通过对源代码的详细分析，发现项目架构已有一定基础，但仍需调整以完全符合目标规范。

### 当前架构特点

✅ **已规范的部分：**
- `src/features/`：功能模块按业务领域划分，包含 ui/model/api/lib 子目录
- `src/pages/`：页面组件按路由结构组织
- `src/shared/`：共享 UI 组件、图表、工具函数
- `src/entities/`：核心业务实体
- `src/app/`：应用配置与入口

❌ **需要调整的部分：**
- 顶级文件位置：`src/App.vue`、`src/main.ts` 应移到 `1-app/` 目录
- 目录命名：缺少数字前缀（如 `1-app/`、`2-pages/` 等）
- 部分文件组织：composables、utils、types 等需要重新组织
- 测试结构：tests 目录与源代码结构不匹配

---

## 详细迁移映射表

### 1. 应用入口与配置

| 当前位置 | 目标位置 | 说明 |
|----------|----------|------|
| src/App.vue | src/1-app/App.vue | 主应用组件 |
| src/main.ts | src/1-app/main.ts | 应用入口文件 |
| src/app/ | src/1-app/ | 应用配置与提供者 |
| src/app/providers/router.ts | src/1-app/providers/with-router.ts | 路由配置 |
| src/app/providers/router-progress.ts | src/1-app/providers/with-router-progress.ts | 路由进度条 |
| src/app/layout/AppLayout.vue | src/1-app/layouts/MainLayout.vue | 主要布局组件 |

### 2. 页面组件

| 当前位置 | 目标位置 | 说明 |
|----------|----------|------|
| src/pages/ | src/2-pages/ | 页面组件目录 |
| src/pages/auth/ui/LoginPage.vue | src/2-pages/auth/ui/LoginPage.vue | 登录页面 |
| src/pages/dashboard/ui/DashboardPage.vue | src/2-pages/dashboard/ui/DashboardPage.vue | 仪表板页面 |
| src/pages/admin/ui/AdminConsolePage.vue | src/2-pages/admin/ui/UserManagementPage.vue | 用户管理页面 |
| src/pages/strategy/plans/ui/ | src/2-pages/strategy/plans/ui/ | 计划管理页面 |
| src/pages/strategy/indicators/ui/ | src/2-pages/strategy/indicators/ui/ | 指标管理页面 |
| src/pages/strategy/tasks/ui/ | src/2-pages/strategy/tasks/ui/ | 任务管理页面 |
| src/pages/approval/ui/ | src/2-pages/approval/ui/ | 审批页面 |
| src/pages/messages/ui/ | src/2-pages/messages/ui/ | 消息中心页面 |
| src/pages/profile/ui/ | src/2-pages/profile/ui/ | 个人资料页面 |
| src/pages/error/ui/ | src/2-pages/error/ui/ | 错误页面 |

### 3. 功能模块

| 当前位置 | 目标位置 | 说明 |
|----------|----------|------|
| src/features/ | src/3-features/ | 功能模块目录 |
| src/features/auth/ | src/3-features/auth/ | 认证功能模块 |
| src/features/dashboard/ | src/3-features/dashboard/ | 仪表板功能模块 |
| src/features/plan/ | src/3-features/plan/ | 计划功能模块 |
| src/features/indicator/ | src/3-features/indicator/ | 指标功能模块 |
| src/features/legacy-indicator/ | src/3-features/legacy-indicator/ | 遗留指标功能模块 |
| src/features/task/ | src/3-features/task/ | 任务功能模块 |
| src/features/milestone/ | src/3-features/milestone/ | 里程碑功能模块 |
| src/features/approval/ | src/3-features/approval/ | 审批功能模块 |
| src/features/messages/ | src/3-features/messages/ | 消息功能模块 |
| src/features/user/ | src/3-features/user/ | 用户功能模块 |
| src/features/admin/ | src/3-features/admin/ | 管理功能模块 |
| src/features/organization/ | src/3-features/organization/ | 组织功能模块 |
| src/features/profile/ | src/3-features/profile/ | 个人资料功能模块 |

### 4. 业务实体

| 当前位置 | 目标位置 | 说明 |
|----------|----------|------|
| src/entities/ | src/4-entities/ | 业务实体目录 |
| src/entities/* | src/4-entities/* | 各实体类型保持不变 |

### 5. 共享资源

| 当前位置 | 目标位置 | 说明 |
|----------|----------|------|
| src/shared/ | src/5-shared/ | 共享资源目录 |
| src/shared/ui/ | src/5-shared/ui/ | 共享 UI 组件 |
| src/shared/ui/form/ | src/5-shared/ui/form/ | 表单组件 |
| src/shared/ui/layout/ | src/5-shared/ui/layout/ | 布局组件 |
| src/shared/ui/charts/ | src/5-shared/ui/charts/ | 图表组件 |
| src/shared/ui/message/ | src/5-shared/ui/message/ | 消息组件 |
| src/shared/ui/feedback/ | src/5-shared/ui/feedback/ | 反馈组件 |
| src/shared/ui/table/ | src/5-shared/ui/table/ | 表格组件 |
| src/shared/ui/display/ | src/5-shared/ui/display/ | 显示组件 |
| src/shared/ui/error/ | src/5-shared/ui/error/ | 错误组件 |
| src/composables/ | src/5-shared/lib/hooks/ | 组合式函数 → Hooks |
| src/utils/ | src/5-shared/lib/utils/ | 工具函数 |
| src/config/ | src/5-shared/config/ | 配置文件 |
| src/constants/ | src/5-shared/constants/ | 常量定义 |
| src/types/ | src/5-shared/types/ | 类型定义 |
| src/api/ | src/5-shared/lib/api/ | API 客户端与拦截器 |
| src/assets/ | src/5-shared/assets/ | 静态资源 |
| src/colors.css | src/5-shared/styles/_colors.css | 颜色变量 |
| src/style.css | src/5-shared/styles/index.scss | 全局样式入口 |
| src/unified-styles.css | src/5-shared/styles/unified-styles.css | 统一样式 |

### 6. 跨功能流程

| 当前位置 | 目标位置 | 说明 |
|----------|----------|------|
| src/features/approval/ | src/6-processes/approval/ | 审批流程 |
| src/features/messages/ | src/6-processes/messaging/ | 消息流程 |
| src/directives/ | src/6-processes/directives/ | 自定义指令 |
| src/mock/ | src/6-processes/mock/ | 模拟数据 |

---

## 测试结构调整

| 当前位置 | 目标位置 | 说明 |
|----------|----------|------|
| tests/ | tests/ | 保持不变，但内部结构调整 |
| tests/unit/ | tests/unit/1-app/ | 应用入口测试 |
| tests/unit/ | tests/unit/2-pages/ | 页面组件测试 |
| tests/unit/ | tests/unit/3-features/ | 功能模块测试 |
| tests/unit/ | tests/unit/4-entities/ | 实体层测试 |
| tests/unit/ | tests/unit/5-shared/ | 共享资源测试 |
| tests/unit/ | tests/unit/6-processes/ | 流程测试 |

---

## 依赖关系调整

### 1. 导入路径更新

**旧：**
```typescript
import { usePermission } from '@/composables/usePermission'
import { apiClient } from '@/api/client'
import { useDashboardState } from '@/composables/dashboard/useDashboardState'
```

**新：**
```typescript
import { usePermission } from '@/5-shared/lib/hooks/usePermission'
import { apiClient } from '@/5-shared/lib/api/client'
import { useDashboardState } from '@/3-features/dashboard/model/useDashboardState'
```

### 2. 配置文件更新

**vite.config.ts：**
```typescript
// 添加路径别名
resolve: {
  alias: {
    '@/1-app': path.resolve(__dirname, 'src/1-app'),
    '@/2-pages': path.resolve(__dirname, 'src/2-pages'),
    '@/3-features': path.resolve(__dirname, 'src/3-features'),
    '@/4-entities': path.resolve(__dirname, 'src/4-entities'),
    '@/5-shared': path.resolve(__dirname, 'src/5-shared'),
    '@/6-processes': path.resolve(__dirname, 'src/6-processes')
  }
}
```

**tsconfig.json：**
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/1-app/*": ["src/1-app/*"],
      "@/2-pages/*": ["src/2-pages/*"],
      "@/3-features/*": ["src/3-features/*"],
      "@/4-entities/*": ["src/4-entities/*"],
      "@/5-shared/*": ["src/5-shared/*"],
      "@/6-processes/*": ["src/6-processes/*"]
    }
  }
}
```

---

## 分步实施计划

### 第一阶段：基础架构

1. 创建目标目录结构
2. 迁移应用入口文件
3. 更新配置文件（vite、tsconfig）
4. 测试基础功能

### 第二阶段：页面与功能模块

1. 迁移 pages 目录
2. 迁移 features 目录
3. 更新导入路径
4. 测试页面功能

### 第三阶段：共享资源

1. 迁移 shared/ui 组件
2. 迁移 composables 到 hooks
3. 迁移 utils、config、constants
4. 更新类型定义

### 第四阶段：实体与流程

1. 迁移 entities 目录
2. 迁移 processes 目录
3. 整合类型定义
4. 测试业务逻辑

### 第五阶段：测试与优化

1. 创建新的测试结构
2. 运行现有测试
3. 修复问题
4. 优化性能

---

## 风险评估

### 高风险操作

1. **顶级文件迁移**：`src/App.vue` 和 `src/main.ts` 迁移可能影响所有功能
2. **路径别名更新**：vite 与 tsconfig 配置变更可能导致构建失败
3. **类型定义调整**：types 目录重组可能影响类型安全

### 风险缓解

1. **分阶段实施**：每阶段完成后进行测试
2. **备份策略**：使用 git 分支与标签管理
3. **CI 验证**：确保每个阶段的 CI 任务通过
4. **回滚计划**：保留原始代码副本，以便快速回滚

---

## 验证检查清单

### 架构规范验证

- [ ] 所有目录使用数字前缀
- [ ] 应用入口在 1-app/ 目录
- [ ] 页面组件在 2-pages/ 目录
- [ ] 功能模块在 3-features/ 目录
- [ ] 实体层在 4-entities/ 目录
- [ ] 共享资源在 5-shared/ 目录
- [ ] 跨功能流程在 6-processes/ 目录

### 功能验证

- [ ] 应用可正常启动
- [ ] 所有页面可访问
- [ ] 所有 API 调用正常
- [ ] 路由导航正常
- [ ] 数据展示与交互正常

### 测试验证

- [ ] 现有测试通过
- [ ] 新测试结构完整
- [ ] 测试覆盖率达标
- [ ] 构建过程无错误