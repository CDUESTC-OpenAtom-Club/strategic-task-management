# 前端架构审查整改执行清单

## 1. 文档定位

本文档把前端架构审查结论转为可排期、可验收、可追踪的执行清单。

适用范围：

- `strategic-task-management/src`
- 前端架构治理、类型治理、超大文件拆分、兼容层清理
- Sprint 排期、Issue 拆分、质量门禁建设

不替代文档：

- [src-directory-governance-plan.md](./src-directory-governance-plan.md)
- [src-directory-governance-todo.md](./src-directory-governance-todo.md)

本文档补齐的是：优先级、负责人类型、预估工时、验收标准、质量闸门和阶段计划。

## 2. 基线证据

截至 2026-04-27 本轮清零收尾，仓内可量化证据如下：

| 指标                 |  当前值 | 风险判断 | 证据                                                                                                                         |
| -------------------- | ------: | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `@ts-nocheck` 文件数 |       0 | 已清零   | `npm run arch:check`                                                                                                         |
| 顶层旧入口文件数     |      23 | 中       | `src/api`、`src/utils`、`src/types`、`src/composables`、`src/router`                                                         |
| 最大 Vue 文件        | 1624 行 | 中       | `src/3-features/task/ui/StrategicTaskView.vue`                                                                               |
| 第二大 Vue 文件      | 1397 行 | 中       | `src/3-features/indicator/ui/IndicatorDistributeView.vue`                                                                    |
| 第三大 Vue 文件      | 1374 行 | 中       | `src/3-features/dashboard/ui/DashboardView.vue`                                                                              |
| ESLint 类型规则      |    关闭 | 高       | `.eslintrc.cjs:21-23`                                                                                                        |
| TS 隐式 any          |    允许 | 高       | `tsconfig.app.json:18-24`                                                                                                    |
| 权限 hook 实现/入口  |    4 个 | 中       | `authorization/usePermission.ts`、`hooks/usePermission.ts`、`permissions/usePermission.ts`、`permissions/usePermission 2.ts` |

当前最主要的治理目标不是“目录看起来更整齐”，而是降低三类风险：

1. 类型系统无法稳定暴露问题。
2. 超大页面导致任何改动都高成本、高回归风险。
3. 兼容层和旧入口长期并行，团队无法判断 canonical path。

## 3. 执行原则

1. 先建质量闸门，再大规模迁移。
2. 先收敛入口，再删除兼容层。
3. 先拆高风险页面，再做目录美化。
4. 每个任务必须有可运行验收命令。
5. 兼容层允许短期存在，但必须标注替代入口、删除日期和 owner。

## 4. 角色定义

| 角色            | 责任                                         |
| --------------- | -------------------------------------------- |
| FE 架构负责人   | 排序、验收架构边界、审批 canonical path 变更 |
| Shared 维护者   | 共享 API、权限、工具、通用组件、兼容壳收敛   |
| Feature 维护者  | 业务模块拆分、业务 import 迁移、页面回归     |
| QA / 测试负责人 | 补齐关键回归用例、维护验收脚本               |
| 发布负责人      | 控制合并节奏、发布窗口、回滚方案             |

## 5. 里程碑计划

| Phase   | 建议周期 | 目标                        | 退出标准                                                    |
| ------- | -------- | --------------------------- | ----------------------------------------------------------- |
| Phase 0 | 1 周     | 建立质量基线和新增债务闸门  | 新增 `@ts-nocheck`、旧入口 import、超大文件增长能被 CI 检测 |
| Phase 1 | 2 周     | 收敛类型债和 canonical path | `@ts-nocheck` 文件数为 0，旧入口新增依赖为 0                |
| Phase 2 | 3-4 周   | 拆分 Top 3 超大页面         | 最大 Vue 文件低于 2500 行，关键页面有 smoke test            |
| Phase 3 | 2-3 周   | 清理兼容层和历史目录        | 兼容壳数量下降 70%，`legacy-indicator` 不再承载新需求       |
| Phase 4 | 持续     | 固化架构治理                | CI 输出趋势报表，架构债进入常规 Sprint 管理                 |

## 6. P0 执行清单

### P0-01. 建立前端架构债基线扫描脚本

| 字段     | 内容                                                           |
| -------- | -------------------------------------------------------------- |
| 目标     | 将 `@ts-nocheck`、超大文件、旧入口、重复权限入口纳入可重复扫描 |
| 负责人   | FE 架构负责人                                                  |
| 预估     | 1 人日                                                         |
| 依赖     | 无                                                             |
| 涉及文件 | `scripts/`、`package.json`、`docs/architecture/`               |

实施动作：

- 新增 `scripts/check-frontend-architecture-debt.cjs`。
- 输出 `@ts-nocheck` 数量、Top 20 大文件、旧入口引用、重复权限文件。
- 在 `package.json` 增加 `arch:check`。
- 首版只做报告，不阻断 CI。

验收标准：

- `npm run arch:check` 可以稳定输出当前基线。
- 输出包含当前基线值和阈值。
- 脚本运行失败时能明确指出失败类别。

建议阈值：

| 指标                  | 初始阈值 |          后续目标 |
| --------------------- | -------: | ----------------: |
| `@ts-nocheck` 文件数  |        0 |            保持 0 |
| Vue 单文件行数        |     1624 | 持续保持低于 2500 |
| 顶层旧入口新增 import |        0 |        永久保持 0 |
| 权限真实实现数        |        1 |        永久保持 1 |

### P0-02. 冻结新增 `@ts-nocheck`

| 字段     | 内容                                 |
| -------- | ------------------------------------ |
| 目标     | 不再让类型债继续扩散                 |
| 负责人   | FE 架构负责人 + 全体 Feature 维护者  |
| 预估     | 0.5 人日                             |
| 依赖     | P0-01                                |
| 涉及文件 | `.eslintrc.cjs`、`scripts/`、CI 配置 |

实施动作：

- 用脚本记录当前 `@ts-nocheck` 白名单。
- 对新增 `@ts-nocheck` 直接失败。
- 对历史 `@ts-nocheck` 只允许减少，不允许增加。
- 为确需保留的文件补充原因注释和 owner。

验收标准：

- 新增一个 `@ts-nocheck` 文件时，`npm run arch:check` 失败。
- 删除历史 `@ts-nocheck` 后，基线可以更新。
- 白名单文件可追踪到 owner 和删除计划。

### P0-03. 恢复关键 TypeScript / ESLint 质量门禁

| 字段     | 内容                                 |
| -------- | ------------------------------------ |
| 目标     | 让类型系统重新参与质量控制           |
| 负责人   | FE 架构负责人                        |
| 预估     | 2 人日                               |
| 依赖     | P0-02                                |
| 涉及文件 | `.eslintrc.cjs`、`tsconfig.app.json` |

实施动作：

- 第一阶段将 `@typescript-eslint/no-explicit-any` 从 `off` 调整为 `warn`。
- 第一阶段将 `@typescript-eslint/ban-ts-comment` 从 `off` 调整为 `warn`。
- 保留 `noUnusedLocals`、`noUnusedParameters` 暂不强开，避免一次性噪音过大。
- 新增 `lint:check` 到合并前检查。

验收标准：

- `npm run lint:check` 可以输出明确警告。
- 新增代码不允许引入裸 `any`，确需使用时必须带理由。
- `npm run type-check` 仍可运行。

阶段目标：

| 阶段    | 规则             | 目标                                         |
| ------- | ---------------- | -------------------------------------------- |
| 第 1 周 | `warn`           | 暴露新增问题                                 |
| 第 3 周 | 核心目录 `error` | `1-app`、`3-features`、`5-shared/api` 先收紧 |
| 第 6 周 | 全仓 `error`     | 进入常规质量门禁                             |

### P0-04. 拆分 `StrategicTaskView.vue`

| 字段     | 内容                                           |
| -------- | ---------------------------------------------- |
| 目标     | 降低最大页面单点风险                           |
| 负责人   | Task Feature 维护者                            |
| 预估     | 5-8 人日                                       |
| 依赖     | P0-01、P0-02                                   |
| 涉及文件 | `src/3-features/task/ui/StrategicTaskView.vue` |

实施动作：

- 先提取页面内纯展示组件，不改变行为。
- 再提取筛选、列表、审批、导出、弹窗等 composable。
- 将状态编排沉入 `model` 或页面专属 composable。
- 每次拆分保持可运行，不做大爆炸式重写。

建议拆分结构：

```text
src/3-features/task/
├── ui/
│   ├── StrategicTaskView.vue
│   ├── StrategicTaskToolbar.vue
│   ├── StrategicTaskTable.vue
│   ├── StrategicTaskDialogs.vue
│   └── StrategicTaskStats.vue
├── model/
│   ├── useStrategicTaskFilters.ts
│   ├── useStrategicTaskActions.ts
│   └── useStrategicTaskApproval.ts
└── lib/
    └── strategicTaskMappers.ts
```

验收标准：

- `StrategicTaskView.vue` 降到 2500 行以下。
- 页面核心交互行为保持一致。
- 至少补 1 个 smoke test 覆盖页面渲染。
- `npm run build`、`npm run type-check` 通过或明确记录剩余历史问题。

### P0-05. 拆分指标下发与指标列表页面

| 字段     | 内容                                                   |
| -------- | ------------------------------------------------------ |
| 目标     | 降低指标模块核心页面维护成本                           |
| 负责人   | Indicator Feature 维护者                               |
| 预估     | 8-12 人日                                              |
| 依赖     | P0-01、P0-02                                           |
| 涉及文件 | `IndicatorDistributeView.vue`、`IndicatorListView.vue` |

实施动作：

- 将查询条件、表格、批量操作、下发弹窗、审批状态展示拆成独立组件。
- 抽离 indicator-specific mapper、formatter、status helper。
- 与 `legacy-indicator` 做边界确认，避免拆分时继续复制旧逻辑。
- 拆分后冻结 `legacy-indicator` 新增需求。

验收标准：

- 两个页面均降到 2500 行以下。
- 主线代码只进入 `src/3-features/indicator`。
- `legacy-indicator` 只保留兼容或归档用途。
- 指标列表、指标下发、审批入口完成手工回归记录。

## 7. P1 执行清单

### P1-01. 权限能力唯一化

| 字段     | 内容                                                                      |
| -------- | ------------------------------------------------------------------------- |
| 目标     | `usePermission` 只保留一份真实实现                                        |
| 负责人   | Shared 维护者                                                             |
| 预估     | 2-3 人日                                                                  |
| 依赖     | P0-01                                                                     |
| 涉及文件 | `src/5-shared/lib/permissions`、`authorization`、`hooks/usePermission.ts` |

实施动作：

- 对比 4 个权限入口的导出 API 和行为差异。
- 选定 `src/5-shared/lib/permissions` 为唯一真实实现。
- 其他入口改为 `@deprecated` re-export。
- 删除带空格命名的 `usePermission 2.ts` 或合并其差异。
- 增加权限判断单元测试。

验收标准：

- 真实实现文件数量为 1。
- 新代码只允许从 `@/5-shared/lib/permissions` 导入。
- `rg -n "usePermission 2|5-shared/lib/authorization|5-shared/lib/hooks/usePermission" src` 不再出现业务引用。

### P1-02. 顶层旧入口冻结与迁移

| 字段     | 内容                                                                           |
| -------- | ------------------------------------------------------------------------------ |
| 目标     | 停止 `src/api`、`src/utils`、`src/types`、`src/composables`、`src/router` 扩散 |
| 负责人   | FE 架构负责人 + Shared 维护者                                                  |
| 预估     | 3-5 人日                                                                       |
| 依赖     | P0-01                                                                          |
| 涉及文件 | 顶层旧入口目录                                                                 |

实施动作：

- 为每个旧入口标注 canonical path。
- 对纯转发壳增加 `@deprecated`、owner、删除日期。
- 业务代码分批改用 `@/5-shared/*` 或 `@/1-app/*`。
- 禁止新增顶层旧入口文件。

验收标准：

- 顶层旧入口文件数不再增加。
- 业务代码不再新增旧入口 import。
- 每个旧入口都有明确替代路径。

### P1-03. Shared API 入口收敛

| 字段     | 内容                                                  |
| -------- | ----------------------------------------------------- |
| 目标     | 统一 HTTP/API canonical path                          |
| 负责人   | Shared 维护者                                         |
| 预估     | 3 人日                                                |
| 依赖     | P1-02                                                 |
| 涉及文件 | `src/5-shared/api`、`src/5-shared/lib/api`、`src/api` |

实施动作：

- 确认 `src/5-shared/api` 为正式实现目录。
- `src/5-shared/lib/api` 只保留过渡导出。
- `src/api` 只保留短期兼容壳或删除。
- 修改文档和示例 import。

验收标准：

- 新业务代码只从 `@/5-shared/api` 或 feature 自身 `api` 导入。
- `src/5-shared/lib/api` 不再承载真实实现。
- API client、error handler、retry 等核心文件边界清晰。

### P1-04. Dashboard 性能与类型治理

| 字段     | 内容                                                                             |
| -------- | -------------------------------------------------------------------------------- |
| 目标     | 降低 Dashboard 大文件和服务层类型债                                              |
| 负责人   | Dashboard Feature 维护者                                                         |
| 预估     | 4-6 人日                                                                         |
| 依赖     | P0-02                                                                            |
| 涉及文件 | `DashboardView.vue`、`DashboardDataService.ts`、`DashboardCalculationService.ts` |

实施动作：

- 拆分 `DashboardView.vue` 为视图壳、图表区、统计卡片、筛选区。
- 移除 dashboard service 的 `@ts-nocheck`。
- 将计算逻辑补类型和单元测试。
- 对图表渲染做懒加载或按需渲染评估。

验收标准：

- `DashboardView.vue` 降到 2500 行以下。
- Dashboard 相关 service 不再使用 `@ts-nocheck`。
- 关键计算逻辑有单元测试。

### P1-05. `legacy-indicator` 下线计划

| 字段     | 内容                                     |
| -------- | ---------------------------------------- |
| 目标     | 将遗留指标模块从并行主线降级为归档模块   |
| 负责人   | FE 架构负责人 + Indicator Feature 维护者 |
| 预估     | 3-5 人日                                 |
| 依赖     | P0-05                                    |
| 涉及文件 | `src/3-features/legacy-indicator`        |

实施动作：

- 列出当前路由是否仍引用 `legacy-indicator`。
- 对比 `indicator` 与 `legacy-indicator` 的功能差异。
- 明确保留、迁移、删除三类文件。
- 写入下线日期。

验收标准：

- 新需求不再进入 `legacy-indicator`。
- 路由层不再默认指向遗留模块。
- 遗留模块剩余价值和删除计划可追踪。

## 8. P2 执行清单

### P2-01. 移除过期兼容壳

| 字段     | 内容                              |
| -------- | --------------------------------- |
| 目标     | 降低无业务价值的转发层            |
| 负责人   | Shared 维护者                     |
| 预估     | 2-4 人日                          |
| 依赖     | P1-02、P1-03                      |
| 涉及文件 | 所有 `@deprecated` re-export 文件 |

实施动作：

- 扫描只包含 re-export 的文件。
- 按删除日期分批移除。
- 更新所有 import。
- 删除后运行构建和类型检查。

验收标准：

- 兼容壳数量下降 70%。
- 全仓不存在过期删除日期的兼容壳。
- `npm run build` 通过。

### P2-02. 顶层目录语义改名评估

| 字段     | 内容                                                  |
| -------- | ----------------------------------------------------- |
| 目标     | 评估是否从 `1-app/3-features` 迁移到 `app/features`   |
| 负责人   | FE 架构负责人                                         |
| 预估     | 1-2 人日评估，实施另排                                |
| 依赖     | P1-02                                                 |
| 涉及文件 | `src` 顶层目录、`tsconfig.app.json`、`vite.config.ts` |

实施动作：

- 先确认所有 canonical path 已收敛。
- 评估改名对 IDE、自动导入、测试、构建和文档的影响。
- 如实施，必须一次性迁移 alias 和 import。

验收标准：

- 产出 go/no-go 结论。
- 如果 go，必须有回滚方案和迁移脚本。

### P2-03. 补齐关键页面 smoke test

| 字段     | 内容                               |
| -------- | ---------------------------------- |
| 目标     | 为拆分后的核心页面提供最低回归保障 |
| 负责人   | QA / 测试负责人 + Feature 维护者   |
| 预估     | 4-6 人日                           |
| 依赖     | P0-04、P0-05、P1-04                |
| 涉及文件 | `tests/`、核心页面                 |

实施动作：

- 为任务、指标、Dashboard、审批中心补 smoke test。
- 重点覆盖页面渲染、关键按钮存在、基础数据流。
- 不追求一次性高覆盖率，先覆盖高风险路径。

验收标准：

- `npm run test` 覆盖核心页面 smoke case。
- 拆分页面时至少有失败保护。

## 9. 建议 Issue 切分

| Issue         | 标题                               | 优先级 | 负责人类型               | 预估 |
| ------------- | ---------------------------------- | ------ | ------------------------ | ---- |
| FE-ARCH-001   | 新增前端架构债扫描脚本             | P0     | FE 架构负责人            | 1d   |
| FE-ARCH-002   | 冻结新增 `@ts-nocheck`             | P0     | FE 架构负责人            | 0.5d |
| FE-ARCH-003   | 恢复 TypeScript / ESLint 关键规则  | P0     | FE 架构负责人            | 2d   |
| FE-TASK-001   | 拆分 `StrategicTaskView.vue`       | P0     | Task Feature 维护者      | 5-8d |
| FE-IND-001    | 拆分 `IndicatorDistributeView.vue` | P0     | Indicator Feature 维护者 | 4-6d |
| FE-IND-002    | 拆分 `IndicatorListView.vue`       | P0     | Indicator Feature 维护者 | 4-6d |
| FE-SHARED-001 | 权限能力唯一化                     | P1     | Shared 维护者            | 2-3d |
| FE-SHARED-002 | 顶层旧入口冻结与迁移               | P1     | Shared 维护者            | 3-5d |
| FE-SHARED-003 | Shared API 入口收敛                | P1     | Shared 维护者            | 3d   |
| FE-DASH-001   | Dashboard 页面与服务层治理         | P1     | Dashboard Feature 维护者 | 4-6d |
| FE-IND-003    | `legacy-indicator` 下线计划        | P1     | Indicator Feature 维护者 | 3-5d |
| FE-ARCH-004   | 移除过期兼容壳                     | P2     | Shared 维护者            | 2-4d |
| FE-ARCH-005   | 顶层目录语义改名评估               | P2     | FE 架构负责人            | 1-2d |
| FE-QA-001     | 核心页面 smoke test                | P2     | QA / 测试负责人          | 4-6d |

## 10. 每周验收命令

建议每周治理例会前固定运行：

```bash
npm run arch:check
npm run lint:check
npm run type-check
npm run test
npm run build
```

当前如果某些命令因历史问题失败，应记录为基线，不应阻塞 P0-01 和 P0-02；但新增问题必须阻断。

## 11. Definition of Done

单个治理任务完成必须满足：

1. 有明确 owner 和 reviewer。
2. 有变更前后基线对比。
3. 有至少一个可运行验收命令。
4. 不新增 `@ts-nocheck`。
5. 不新增旧入口 import。
6. 涉及 UI 拆分时必须有手工回归说明或 smoke test。
7. 涉及兼容层时必须写明删除日期。

## 12. 推荐执行顺序

第一周：

1. FE-ARCH-001
2. FE-ARCH-002
3. FE-ARCH-003 第一阶段

第二到第三周：

1. FE-TASK-001
2. FE-SHARED-001
3. FE-SHARED-002

第四到第六周：

1. FE-IND-001
2. FE-IND-002
3. FE-SHARED-003
4. FE-DASH-001

第七周以后：

1. FE-IND-003
2. FE-ARCH-004
3. FE-ARCH-005
4. FE-QA-001

执行重点：先让新增债务无法进入主干，再逐步偿还历史债务。否则目录迁移和大文件拆分都会被新增问题抵消。
