# `src` 目录治理执行 TODO 清单

## 1. 文档定位

这份文档是 [src-directory-governance-plan.md](./src-directory-governance-plan.md) 的执行版清单，用于把“治理原则”转成团队可拆分、可排期、可验收的任务。

适用对象：

- 架构负责人
- Shared 层维护者
- 业务模块维护者
- 负责合并与发布的同学

执行原则：

1. 采用“中等推进”节奏：先收敛正式入口，再推进顶层目录改名。
2. 每一类重复能力必须先确定唯一正式入口，再做 import 迁移。
3. 旧入口允许短期兼容，但必须写明下线日期。
4. 本文档用于排期与协作，不替代原始治理方案。

## 2. 已锁定的正式入口决策

以下决策在本轮治理中直接生效，不再保留开放讨论。

| 能力域 | 正式入口 | 兼容入口 | 说明 |
| --- | --- | --- | --- |
| HTTP / API | `src/5-shared/api` | `src/5-shared/lib/api` | `shared/lib/api` 仅保留过渡 re-export，最终移除 |
| 权限能力 | `src/5-shared/lib/permissions` | `src/5-shared/lib/authorization`、`src/5-shared/lib/hooks/usePermission.ts` | 权限判断、权限 hook、导出入口统一向 `permissions` 收口 |
| 布局 composables | `src/5-shared/lib/layout` | `src/5-shared/lib/hooks/layout` | `hooks/layout` 仅保留迁移壳 |
| 指标主线模块 | `src/3-features/indicator` | `src/3-features/legacy-indicator` | `legacy-indicator` 进入兼容/归档计划 |
| directives | `src/5-shared/lib/directives` | `src/directives`、`src/6-processes/directives` | 顶层游离目录停止使用 |
| 顶层目录命名 | `app / features / entities / shared / processes / archive` | `1-app / 3-features / 4-entities / 5-shared / 6-processes / _deprecated` | 顶层改名放在共享层收敛之后执行 |

### Canonical Import Path 规则

后续所有新增或迁移后的 import，按下面规则执行：

| 类别 | Canonical Import Path |
| --- | --- |
| API 入口 | `@/5-shared/api` 或 `@/5-shared/api/*` |
| 权限入口 | `@/5-shared/lib/permissions` |
| 布局 composables | `@/5-shared/lib/layout` |
| directives | `@/5-shared/lib/directives` |
| 指标主线功能 | `@/3-features/indicator` |

说明：

- 不再新增 `@/5-shared/lib/api` 的直接依赖。
- 不再新增 `@/5-shared/lib/hooks/layout` 的直接依赖。
- 不再新增 `@/5-shared/lib/authorization` 或 `@/5-shared/lib/hooks/usePermission` 的直接依赖。
- 不再新增 `@/directives`、`@/6-processes/directives` 的直接依赖。
- 不再新增 `legacy-indicator` 的业务依赖。

## 3. 当前重复入口清单

以下清单对应当前仓库中已经确认存在的重复入口或过渡目录。

### 3.1 Shared API 双入口

- 正式入口：`src/5-shared/api`
- 兼容入口：`src/5-shared/lib/api`
- 当前现象：
  - `@/5-shared/api` 与 `@/5-shared/lib/api` 在多个 feature 中混用
  - `src/5-shared/lib/api/index.ts` 已经是 re-export 壳，但 `client.ts` 等文件仍被直接引用

### 3.2 Layout composables 双入口

- 正式入口：`src/5-shared/lib/layout`
- 兼容入口：`src/5-shared/lib/hooks/layout`
- 当前现象：
  - `hooks/layout/index.ts` 已声明迁移到 `lib/layout`
  - 迁移方向已明确，但仍需要把旧入口收敛到“只留壳，不演化”

### 3.3 权限能力多入口

- 正式入口：`src/5-shared/lib/permissions`
- 兼容入口：
  - `src/5-shared/lib/authorization`
  - `src/5-shared/lib/hooks/usePermission.ts`
- 当前现象：
  - 权限能力同时分布在 `permissions`、`authorization`、`hooks`
  - `authorization/usePermission.ts` 与 `hooks/usePermission.ts` 同时存在

### 3.4 指标主线与遗留主线并存

- 正式入口：`src/3-features/indicator`
- 兼容入口：`src/3-features/legacy-indicator`
- 当前现象：
  - 两套指标功能目录并存
  - `legacy-indicator` 仍保留完整 `api/model/ui`
  - 团队难以判断新改动应该落在哪条主线

### 3.5 Directives 入口分散

- 正式入口：`src/5-shared/lib/directives`
- 兼容入口：
  - `src/directives`
  - `src/6-processes/directives`
- 当前现象：
  - `shared/lib/directives` 已存在占位入口
  - 顶层 `src/directives` 与 `6-processes/directives` 仍在目录结构中制造歧义

## 4. 角色与协作方式

后续任务按“负责人类型”指派，不在执行时再重新定义角色边界。

| 负责人类型 | 负责内容 |
| --- | --- |
| 架构负责人 | 锁定正式入口、审批目录治理规则、把控跨模块迁移顺序 |
| Shared 维护者 | 处理 `shared` 层兼容壳、导出入口、通用能力归并 |
| Feature 维护者 | 迁移 feature 内 import、删除旧依赖、补业务回归验证 |
| 发布负责人 | 负责阶段合并、回归检查、下线窗口确认 |

## 5. 分阶段排期

建议按一个 4 周窗口推进，日期使用绝对日期，便于在 issue 或看板中直接挂载。

| Phase | 时间窗口 | 目标 |
| --- | --- | --- |
| Phase 1 | 2026-03-20 至 2026-03-27 | 确认正式入口并完成 Shared 层兼容壳策略 |
| Phase 2 | 2026-03-30 至 2026-04-03 | 完成 Shared 层 import 收敛与指标主线收敛 |
| Phase 3 | 2026-04-06 至 2026-04-10 | 执行顶层目录改名与 canonical import 迁移 |
| Phase 4 | 2026-04-13 至 2026-04-17 | 归档历史目录，移除兼容壳，固化治理规则 |

说明：

- 如果实际排期后移，阶段顺序不变。
- 不允许跳过 Phase 1 直接做顶层目录改名。

## 6. TODO Backlog

以下任务已经按团队协作方式拆分，可直接转成 issue 或看板卡片。

### A 组：共享层去重

#### A1. 收敛 API 入口到 `src/5-shared/api`

- 任务标题：统一 Shared API 正式入口
- 目标状态：全仓只把 `src/5-shared/api` 视为正式实现目录，`src/5-shared/lib/api` 只保留兼容 re-export
- 涉及模块：`src/5-shared/api`、`src/5-shared/lib/api`、所有引用 API 的 feature 模块
- 负责人类型：Shared 维护者 + Feature 维护者
- 前置依赖：无
- 实施动作：
  - 审核 `src/5-shared/lib/api` 中所有文件，区分“真正实现”与“兼容壳”
  - 把仍在 `lib/api` 中承担真实实现职责的内容迁回 `api`
  - 将 `lib/api` 压缩为统一的兼容导出层
  - 逐步替换 feature 中对 `@/5-shared/lib/api`、`@/5-shared/lib/api/*` 的直接依赖
  - 在兼容文件顶部加入 `@deprecated` 与移除日期
- 验收标准：
  - 新代码不再出现 `@/5-shared/lib/api` 直接依赖
  - 全仓对 `@/5-shared/lib/api` 的引用仅剩兼容层自身或明确保留的过渡调用
  - `src/5-shared/api` 成为唯一正式实现目录
- 风险提示：
  - `withRetry`、`client.ts`、`errorHandler.ts` 等文件可能存在循环依赖风险
  - 迁移时要避免把文档中的示例 import 当成业务依赖处理

#### A2. 收敛 layout composables 到 `src/5-shared/lib/layout`

- 任务标题：统一布局 composable 正式入口
- 目标状态：`src/5-shared/lib/layout` 成为唯一正式实现目录，`hooks/layout` 只保留兼容壳
- 涉及模块：`src/5-shared/lib/layout`、`src/5-shared/lib/hooks/layout`
- 负责人类型：Shared 维护者
- 前置依赖：无
- 实施动作：
  - 检查 `hooks/layout` 是否仍有独占实现或历史注释需要保留
  - 将旧入口整理为单一 `index.ts` 兼容壳
  - 全仓替换旧 import 到 `@/5-shared/lib/layout`
  - 禁止继续向 `hooks/layout` 增加文件
- 验收标准：
  - `hooks/layout` 下不再新增真实实现文件
  - 全仓业务代码统一从 `@/5-shared/lib/layout` 引入
  - `hooks/layout` 可以在下一阶段安全删除
- 风险提示：
  - 需要确认是否存在自动导入配置或 IDE 索引仍指向旧路径

#### A3. 收敛权限能力到 `src/5-shared/lib/permissions`

- 任务标题：统一权限判断与权限 hook 入口
- 目标状态：`permissions` 成为唯一正式入口，`authorization` 与 `hooks/usePermission.ts` 进入兼容层
- 涉及模块：`src/5-shared/lib/permissions`、`src/5-shared/lib/authorization`、`src/5-shared/lib/hooks/usePermission.ts`
- 负责人类型：架构负责人 + Shared 维护者
- 前置依赖：无
- 实施动作：
  - 明确 `permissions` 目录承载的公共接口，包括权限判断函数与 `usePermission`
  - 把重复的 `usePermission` 实现收敛为一份
  - 为 `authorization` 与 `hooks/usePermission.ts` 保留过渡 re-export
  - 更新共享导出入口，例如 `5-shared/lib/index.ts`、`hooks/index.ts`、`composables/index.ts`
  - 统一文档示例与新代码 import 口径
- 验收标准：
  - `usePermission` 只保留一份真实实现
  - 新代码统一从 `@/5-shared/lib/permissions` 导入
  - `authorization` 与 `hooks/usePermission.ts` 仅剩兼容用途
- 风险提示：
  - 两份 `usePermission` 可能存在行为差异，迁移前必须先对外部 API 做兼容比对

#### A4. 收敛 directives 入口到 `src/5-shared/lib/directives`

- 任务标题：统一 directives 正式入口
- 目标状态：`src/5-shared/lib/directives` 成为唯一入口，顶层和 `6-processes` 相关目录停止使用
- 涉及模块：`src/5-shared/lib/directives`、`src/directives`、`src/6-processes/directives`
- 负责人类型：Shared 维护者
- 前置依赖：无
- 实施动作：
  - 确认 `src/directives` 与 `src/6-processes/directives` 是否为空壳、占位目录或历史残留
  - 将所有全局 directive 注册约定统一记录到 `shared/lib/directives`
  - 清理顶层和 `6-processes` 的误导性目录
  - 统一 `app-main.ts` 等应用初始化说明中的引用口径
- 验收标准：
  - 文档和代码只承认 `@/5-shared/lib/directives`
  - `src/directives` 与 `src/6-processes/directives` 不再承载任何正式职责
  - 新增 directive 的落点规则明确
- 风险提示：
  - 即使当前目录为空，也需要同步更新团队认知与注释，否则会再次出现游离目录

### B 组：业务主线模块收敛

#### B1. 锁定 `indicator` 为唯一主线模块

- 任务标题：完成指标功能主线切换
- 目标状态：所有新增需求和主线修复只进入 `src/3-features/indicator`
- 涉及模块：`src/3-features/indicator`、`src/3-features/legacy-indicator`
- 负责人类型：架构负责人 + Indicator 模块维护者
- 前置依赖：A1
- 实施动作：
  - 对比 `indicator` 与 `legacy-indicator` 的入口、路由依赖、核心 UI、API 依赖
  - 明确哪些能力已经在主线具备，哪些还需补齐后才能封存 legacy
  - 将外部入口、文档、开发约定统一指向 `indicator`
  - 将 `legacy-indicator` 标记为兼容模块，并写明下线日期
- 验收标准：
  - 新功能不再落入 `legacy-indicator`
  - 主线路由与主线文档只引用 `indicator`
  - `legacy-indicator` 的角色从“并行主线”变为“待退场兼容模块”
- 风险提示：
  - 两套 UI 可能存在能力缺口，必须先补主线再彻底封存 legacy

#### B2. 清理指标模块对旧 Shared 入口的依赖

- 任务标题：让指标模块完整对齐 canonical import path
- 目标状态：`indicator` 模块不再依赖旧 API、旧权限、旧 layout、旧 directives 入口
- 涉及模块：`src/3-features/indicator`
- 负责人类型：Indicator 模块维护者
- 前置依赖：A1、A2、A3、A4
- 实施动作：
  - 全量替换 `indicator` 模块中的旧入口 import
  - 检查 `README`、示例代码、测试文件中的旧路径
  - 作为后续其他 feature 的迁移样板
- 验收标准：
  - `indicator` 模块中的 import 全部符合 canonical path
  - `indicator` 成为目录治理迁移样板模块
- 风险提示：
  - 模块体量较大，适合拆成多张子卡片并配套回归测试

### C 组：历史代码归档

#### C1. 迁出 `_deprecated` 与旧 router 备份

- 任务标题：把历史页面与旧路由移出主干认知
- 目标状态：`src/_deprecated` 与 `src/1-app/providers/_deprecated` 不再被视为正式源码结构的一部分
- 涉及模块：`src/_deprecated`、`src/1-app/providers/_deprecated`
- 负责人类型：架构负责人 + 发布负责人
- 前置依赖：B1
- 实施动作：
  - 确认正式运行链路不再依赖 `_deprecated` 相关目录
  - 将历史路由、旧页面迁移到项目级归档目录或 `docs/archive`
  - 在归档位置补“来源路径 + 归档原因 + 可删除条件”
- 验收标准：
  - `src` 根目录不再保留 `_deprecated` 作为长期正式结构
  - 旧 router 文件不再和现行 router 并排出现
  - 历史代码具备清晰归档说明
- 风险提示：
  - 需要先验证是否仍有动态 import 或注释引用依赖这些文件

#### C2. 清理 `.back` 等备份文件

- 任务标题：移除源码目录中的临时备份文件
- 目标状态：`src` 中不再存在 `.back`、`back.back` 等临时备份文件
- 涉及模块：全仓 `src`
- 负责人类型：发布负责人 + 各模块维护者
- 前置依赖：B1
- 实施动作：
  - 识别所有备份类文件
  - 需要保留的迁入 `docs/archive/backup-files`
  - 不需要保留的直接删除
  - 将“备份文件不得进入 `src`”加入团队规则
- 验收标准：
  - `find src -name '*.back'` 无结果
  - 团队约定中明确禁止将临时备份文件提交到 `src`
- 风险提示：
  - 删除前需确认备份文件未承担唯一历史参考价值

### D 组：顶层目录改名与 import 迁移

#### D1. 建立顶层目录改名映射

- 任务标题：锁定顶层目录重命名映射与别名策略
- 目标状态：实现前就固定 rename 映射与 import 别名方案
- 涉及模块：`src/1-app`、`src/3-features`、`src/4-entities`、`src/5-shared`、`src/6-processes`
- 负责人类型：架构负责人
- 前置依赖：A1、A2、A3、A4、B1
- 实施动作：
  - 固定 rename 映射：
    - `1-app -> app`
    - `3-features -> features`
    - `4-entities -> entities`
    - `5-shared -> shared`
    - `6-processes -> processes`
  - 明确 `archive` 用于接收历史代码，不再在 `src` 内保留 `_deprecated`
  - 明确 alias、自动导入、测试配置的同步更新范围
- 验收标准：
  - 顶层 rename 映射无争议
  - 实施时不会出现“改名后 import 该怎么写”的二次讨论
- 风险提示：
  - 顶层目录改名会触发全仓 import 变化，必须在共享层收敛后进行

#### D2. 执行顶层目录 rename 与 import 迁移

- 任务标题：完成顶层目录语义化改名
- 目标状态：顶层目录统一改为 `app / features / entities / shared / processes / archive`
- 涉及模块：`src` 顶层、tsconfig / vite alias、自动导入配置、测试配置
- 负责人类型：架构负责人 + 发布负责人
- 前置依赖：D1
- 实施动作：
  - 统一修改目录名
  - 一次性更新 import alias 与自动导入配置
  - 全仓替换旧路径 import
  - 跑构建、类型检查、核心业务回归
- 验收标准：
  - `src` 顶层目录名全部切换为目标命名
  - 旧顶层路径不再出现在正式 import 中
  - 构建和主要页面路由恢复正常
- 风险提示：
  - 这是高影响阶段，必须冻结并行结构性改动

#### D3. 清理逻辑别名和迁移注释

- 任务标题：结束“逻辑别名阶段”
- 目标状态：项目不再需要在文档中同时解释旧顶层名与新顶层名
- 涉及模块：架构文档、开发规范、README
- 负责人类型：架构负责人
- 前置依赖：D2
- 实施动作：
  - 更新文档中的目录示例
  - 删除“逻辑上把 1-app 看作 app”一类过渡性表述
  - 统一项目术语
- 验收标准：
  - 新文档只使用语义化顶层目录名称
  - 团队不再使用旧目录名描述主干结构
- 风险提示：
  - 文档不更新会造成迁移后认知回退

### E 组：规则固化

#### E1. 固化新增目录约束

- 任务标题：建立新增目录准入规则
- 目标状态：后续新增目录不再靠个人习惯决定
- 涉及模块：架构文档、代码评审清单、团队开发规范
- 负责人类型：架构负责人
- 前置依赖：D2
- 实施动作：
  - 明确新增目录必须回答的三个问题：
    - 这个目录的职责是什么？
    - 为什么不能放进现有目录？
    - 它的正式入口和退出策略是什么？
  - 固定允许的子目录集合：`api / model / ui / lib / schema / adapters / config / tests`
  - 将规则加入 code review 清单
- 验收标准：
  - 新目录申请有统一模板
  - Code review 可据此拒绝不合规目录扩张
- 风险提示：
  - 如果规则只写在文档里、不进入评审流程，后续仍会失效

#### E2. 固化兼容层下线模板

- 任务标题：建立 `@deprecated` 退出模板
- 目标状态：所有兼容壳都有明确下线日期和替代入口
- 涉及模块：所有兼容层文件
- 负责人类型：Shared 维护者 + 发布负责人
- 前置依赖：A1、A2、A3、A4、B1
- 实施动作：
  - 统一兼容层头部注释模板
  - 统一记录替代入口与删除日期
  - 在发布检查中增加“过期兼容层扫描”
- 验收标准：
  - 新增兼容层都有替代入口与具体移除日期
  - 过期兼容层会进入版本清理清单
- 风险提示：
  - 没有截止日期的兼容层最终会重新变成正式层

建议使用以下头部模板：

```ts
/**
 * @deprecated Temporary compatibility layer.
 * Use `@/5-shared/api` instead.
 * Remove after 2026-04-17.
 */
```

## 7. 统一验收命令

以下命令用于在执行阶段判断是否达到“归零”或“只剩兼容壳”状态。

```bash
rg -n "@/5-shared/lib/api" src --glob '!**/*.md'
rg -n "@/5-shared/lib/hooks/layout" src --glob '!**/*.md'
rg -n "@/5-shared/lib/authorization|@/5-shared/lib/hooks/usePermission" src --glob '!**/*.md'
rg -n "legacy-indicator|@/_deprecated" src --glob '!**/*.md'
find src -name '*.back' -o -name 'back.back'
```

验收解释：

- 如果命令结果只剩兼容层文件本身，说明 import 收敛基本完成。
- 如果命令仍返回业务模块主代码，说明该治理任务不能关闭。

## 8. 完成定义

本轮目录治理完成，必须同时满足以下条件：

1. 每个重复能力都有唯一正式入口，没有“待定”项。
2. Canonical import path 已经固定，新代码不再混用旧路径。
3. `legacy-indicator`、`_deprecated`、`.back` 不再作为主干结构的一部分。
4. 顶层目录改名已经完成，或已经被明确排进已承诺的下一阶段窗口。
5. 所有兼容层都带替代入口和具体移除日期。
6. 执行文档可以直接拆成 issue，不需要额外补全决策。
