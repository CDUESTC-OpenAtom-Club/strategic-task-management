# `src` 目录治理方案

## 1. 背景

当前 `strategic-task-management/src` 已经有明确的分层意图，但实际落地中混入了三套规则：

1. FSD/分层目录规则：`1-app`、`3-features`、`4-entities`、`5-shared`、`6-processes`
2. 历史迁移规则：`_deprecated`、`legacy-*`、`*.back`
3. 临时兼容规则：同一能力在新旧目录中并存，导入路径不统一

结果不是“目录稍微有点乱”，而是团队成员很难稳定回答下面这些问题：

- 一个新功能应该放在 `feature`、`entity` 还是 `shared`？
- 同样是 API Client，应该用 `5-shared/api/client.ts` 还是 `5-shared/lib/api/client.ts`？
- `indicator` 和 `legacy-indicator` 哪个是主线？
- `_deprecated`、`back.back`、旧 router 这些目录是否仍然参与运行？
- `hooks`、`layout`、`loading`、`permissions` 为什么在多个位置重复出现？

所以这次整理不建议从“批量改名”开始，而建议先建立一套**目录治理方法**，让之后每次迁移都能落到同一规则下。

## 2. 现状问题画像

基于当前仓库，问题主要分为五类。

### 2.1 顶层目录语义不统一

当前顶层存在：

```text
src/
├── 1-app
├── 3-features
├── 4-entities
├── 5-shared
├── 6-processes
├── _deprecated
└── directives
```

问题：

- 采用了带数字的分层命名，但缺少 `2-*`，阅读时会产生“是不是少了一层”的困惑
- `directives` 游离在分层体系之外，同时 `5-shared/lib/directives` 和 `6-processes/directives` 也在表达相近概念
- `_deprecated` 作为历史存档存在合理性，但现在仍在 `src` 根目录，会持续干扰主干认知

### 2.2 同一能力在多处重复

当前比较明显的重复包括：

- API 客户端同时存在于 `5-shared/api` 与 `5-shared/lib/api`
- 权限能力同时存在于 `5-shared/lib/authorization`、`5-shared/lib/permissions`、`5-shared/lib/hooks/usePermission.ts`
- 布局相关 hooks 同时存在于 `5-shared/lib/hooks/layout` 与 `5-shared/lib/layout`
- Loading/Error hooks 存在 hooks 版与领域拆分版双轨
- Milestone API 同时出现在 `3-features/milestone/api` 与 `4-entities/milestone/api`
- `indicator` 与 `legacy-indicator` 双模块并存

这类重复是“乱感”的主要来源，因为目录树虽然能看懂，但**无法判断哪个才是准入口**。

### 2.3 层级职责边界被打穿

几个典型现象：

- `entity` 层大多只有类型，但有的模块开始出现 API
- `feature` 层里既有页面级 View，又有较底层的数据能力
- `shared` 中既有纯工具，也有明显带业务语义的东西，比如某些 dashboard、indicator 相关能力
- `services`、`lib`、`api`、`config` 的边界没有完全定型

这会导致后续新增代码时越来越依赖“感觉”，而不是依赖目录约定。

### 2.4 迁移状态暴露在主干目录中

例如：

- `legacy-indicator`
- `_deprecated/2-pages`
- `providers/_deprecated`
- `*.back`
- 文档中多处 `@deprecated`

这些不是不能有，而是需要**集中管理**。如果过渡态直接和正式目录并排，团队成员会默认“先能用就行”，久而久之主干就被历史包袱覆盖。

### 2.5 命名风格不完全一致

当前同时存在：

- `profile` / `user`
- `organization` / `org`
- `error-handling` / `loading` / `hooks` / `utils`
- `DashboardDataService` 这种 OOP 命名
- `useLoadingState` 这种 composable 命名
- `indicator.ts` / `indicatorApi.ts` / `query.ts` / `mutations.ts` 混合存在

这说明项目不是简单缺目录，而是缺少一份**统一命名契约**。

## 3. 治理目标

整理目录时，建议只追求下面四个目标：

1. 任何新代码都能快速判断“应该放哪里”
2. 同一能力只保留一个正式入口，旧入口只做短期兼容
3. 历史遗留与主线代码物理隔离
4. 目录名表达职责，而不是表达迁移过程

换句话说，目标不是一次性“改到最完美”，而是让目录结构从“堆积式增长”变成“可治理增长”。

## 4. 推荐方法：四步治理法

这是我建议你们长期采用的方法，不是一次性脚本。

### 第一步：先定义“主干层级”，不要先改文件

先把主干目录冻结为这几类：

```text
src/
├── app
├── features
├── entities
├── shared
├── processes        # 如果暂时用不到，可以先保留但限制新增
└── archived         # 或迁出 src，专门存历史代码
```

这里有两个关键建议：

- **去掉数字前缀**。`1-app/3-features/4-entities/5-shared/6-processes` 在演示时清晰，但在长期维护里，数字比语义更吵。
- **把历史代码移出主路径语义**。`_deprecated` 不建议继续留在主结构中，最好迁到 `docs/archive/` 或项目根的 `legacy/`、`archive/`。

如果短期不想大迁移，可以先使用“逻辑别名”：

- 文档和代码规范里统一称 `1-app` 为 `app`
- 统一称 `3-features` 为 `features`
- 统一称 `4-entities` 为 `entities`
- 统一称 `5-shared` 为 `shared`

先统一认知，再统一物理目录。

### 第二步：为每一层写清楚“允许放什么”

建议采用下面这套职责定义。

#### `app`

只放应用装配层：

- `main.ts`
- 根组件
- router
- providers
- 全局样式
- 应用级初始化

禁止放：

- 具体业务类型
- 具体业务 API
- 可复用业务组件

#### `features`

只放“可被用户感知的业务能力”：

- 指标管理
- 计划管理
- 审批
- 登录
- 仪表盘

一个 feature 内允许有：

- `api`
- `model`
- `lib`
- `ui`

但 feature 的 `ui` 应以**业务视图组件**为主，不建议无限膨胀成页面仓库。

#### `entities`

只放领域对象的稳定抽象：

- 类型
- schema
- adapter
- entity 级小型数据访问
- 领域内聚但不依赖具体页面的逻辑

适合放在 `entities/indicator` 的是：

- `types.ts`
- `schema.ts`
- `mapper.ts`
- `status.ts`

不适合放在 entity 的是：

- “指标列表页如何筛选”
- “指标下发弹窗如何展示”

#### `shared`

只放跨业务复用且无强业务归属的内容：

- 基础 UI
- 通用 hooks/composables
- HTTP client
- 通用工具
- 通用校验
- 配置

判断标准只有一句：

> 如果把 `indicator`、`plan`、`task` 这些业务名删掉，这段代码仍然成立，它才适合进 `shared`。

#### `processes`

如果保留，就只放跨 feature 的业务编排，例如：

- 跨模块初始化流程
- 多 feature 联动流程
- 页面级 workflow orchestration

如果当前项目没有真正发挥这一层，建议：

- 保留目录但停止新增
- 或在下一阶段把内容并回 `app` / `features`

### 第三步：给所有目录名建立统一命名契约

建议统一如下。

#### 顶层目录命名

- 一律小写英文
- 一律不用数字前缀
- 一律不用“临时状态词”作为正式主干目录名

推荐：

```text
app
features
entities
shared
processes
archive
```

#### 模块目录命名

- 业务模块统一用单数或统一用约定俗成名词，核心是项目内一致
- 推荐优先使用完整名词，不混用缩写

推荐统一为：

- `organization`，不要同时出现 `org`
- `indicator`
- `milestone`
- `plan`
- `task`
- `user`
- `profile`

如果 `user` 和 `profile` 实际是同一业务，请二选一：

- `user`: 面向用户实体与管理
- `profile`: 面向“当前登录用户个人中心”

两者可以并存，但职责必须切开。

#### 子目录命名

建议每个 feature/entity 只允许从下面集合中选：

```text
api/
model/
ui/
lib/
schema/
adapters/
config/
tests/
```

不要继续扩散出语义接近但不等价的目录，例如：

- `services`
- `helpers`
- `utils`
- `hooks`
- `composables`

这几个建议处理为：

- 纯业务逻辑：放 `lib`
- 纯数据状态：放 `model`
- 通用 Vue composable：放 `shared/lib` 或 `shared/composables`
- 需要面向 HTTP/后端：放 `api`

也就是说，**减少近义目录**，比新增目录更重要。

### 第四步：建立迁移机制，而不是一次性重构

我建议按“主入口收敛”推进，不按“把所有文件全搬完”推进。

每次只做一类收敛：

1. 先定义正式入口
2. 旧目录保留兼容导出
3. 全仓导入逐步迁移
4. 导入归零后再删除旧目录

例如 API client 的整理顺序应该是：

1. 明确 `shared/api` 或 `shared/lib/api` 谁是正式位置
2. 另一处只保留兼容层，并在文件顶部写明下线时间
3. 全量替换 import
4. 替换完成后再删除兼容层

这样目录会越来越稳，而不是“今天搬过去，明天又搬回来”。

## 5. 推荐目标结构

结合你们当前仓库，我更推荐下面这个结构。

```text
src/
├── app/
│   ├── main.ts
│   ├── App.vue
│   ├── providers/
│   ├── router/
│   ├── layouts/
│   ├── styles/
│   └── config/
├── features/
│   ├── approval/
│   ├── auth/
│   ├── dashboard/
│   ├── indicator/
│   ├── messages/
│   ├── milestone/
│   ├── organization/
│   ├── plan/
│   ├── profile/
│   ├── task/
│   └── admin/
├── entities/
│   ├── indicator/
│   ├── milestone/
│   ├── organization/
│   ├── plan/
│   ├── task/
│   └── user/
├── shared/
│   ├── api/
│   ├── ui/
│   ├── lib/
│   ├── config/
│   ├── types/
│   ├── assets/
│   └── styles/
├── processes/
└── archive/
```

如果想再进一步收敛，可以额外约束：

- `shared/api` 成为 HTTP 能力唯一入口
- `shared/lib` 只保留纯函数、通用 composables、存储、权限、格式化
- `shared/services` 逐步收拢到 `shared/api` 或 `shared/lib`
- `archive/` 不参与正式构建

## 6. 当前仓库的具体收敛建议

下面这些是可以直接列入治理 backlog 的事项。

### 6.1 一级优先级：先解决“哪个才是正式入口”

优先收敛：

1. `5-shared/api` 与 `5-shared/lib/api`
2. `5-shared/lib/hooks/layout` 与 `5-shared/lib/layout`
3. `5-shared/lib/hooks/usePermission.ts` 与 `5-shared/lib/authorization` / `permissions`
4. `3-features/indicator` 与 `3-features/legacy-indicator`
5. `src/directives` 与 `5-shared/lib/directives`

原则：

- 每组只能保留一个正式实现目录
- 其他目录只能是短期 re-export / 兼容层

### 6.2 二级优先级：把迁移垃圾移出主干

建议处理：

- `src/_deprecated` 移到 `docs/archive/` 或项目根 `archive/src-deprecated/`
- `providers/_deprecated` 移到 `archive/routers/`
- `*.back` 文件迁到 `docs/archive/backup-files/`

这样做的收益很大，因为团队打开 `src` 时会立刻安静很多。

### 6.3 三级优先级：减少“近义词目录”

建议做如下规范：

- `helpers` 并入 `lib`
- `services` 只保留真正的 service，不再作为“兜底杂物间”
- `hooks` 与 `composables` 二选一
- `authorization` 与 `permissions` 二选一

我的建议是：

- Vue 生态统一使用 `composables` 或继续用 `hooks` 都可以，但项目内只能一个名字
- 权限统一为 `permissions`

### 6.4 四级优先级：让 entity 更像 entity

当前 `entities` 层已经有雏形，但可继续增强：

- `indicator`、`plan`、`task`、`milestone`、`organization`、`user` 的 `types` 统一风格
- 把领域 mapper、schema、adapter 从 feature 中抽回 entity
- feature 更专注于“用户操作流程”和“组合业务逻辑”

## 7. 推荐迁移顺序

不要按目录树从上往下改，建议按风险最低的顺序推进。

### Phase 1：只做规则，不动主目录名

目标：

- 写出目录治理文档
- 明确正式入口清单
- 禁止新增 `legacy-*`、`*.back`、重复能力目录

产出：

- 一份目录规范
- 一份“正式入口映射表”

### Phase 2：收敛共享层重复能力

目标：

- 统一 API 客户端入口
- 统一 permission 入口
- 统一 layout/composable 入口

原因：

- 这一层改动收益最高，且对业务页面影响可控

### Phase 3：收敛 feature 主线与历史分支

目标：

- 明确 `indicator` 还是 `legacy-indicator` 为正式主线
- 历史分支只保留兼容壳
- 清理 `_deprecated` 依赖链

### Phase 4：视情况重命名顶层目录

目标：

- `1-app -> app`
- `3-features -> features`
- `4-entities -> entities`
- `5-shared -> shared`
- `6-processes -> processes`

这一步放到最后，因为它最“显眼”，但对长期质量的收益反而不是最高。前面三阶段没完成时，单纯改名只会制造更大的迁移成本。

## 8. 团队执行规则

为了避免整理完之后又重新变乱，建议加四条团队规则。

### 规则 1：新增目录必须回答三个问题

新增目录前，PR 里必须能回答：

1. 这个目录的职责是什么？
2. 为什么不能放进现有目录？
3. 它的正式入口和退出策略是什么？

如果答不清，通常说明不该新增目录。

### 规则 2：每类能力只能有一个正式入口

例如：

- API Client 只能有一个
- Permission 检查只能有一个
- Layout composable 只能有一个

其他位置只能 re-export，不能继续演化。

### 规则 3：过渡目录必须带截止时间

例如：

```ts
/**
 * @deprecated Temporary compatibility layer.
 * Remove after 2026-04-30 once all imports are migrated.
 */
```

没有截止时间的兼容层，最后一定会变成正式层。

### 规则 4：历史代码不进入主路径

原则上：

- 备份文件不进 `src`
- `.back` 文件不进 `src`
- `_deprecated` 不与主模块并排

历史代码要么归档，要么删除，不要作为“长期参考资料”悬挂在主线目录里。

## 9. 可直接落地的检查清单

你们后续每次整理目录，可以按这个清单执行。

### 目录治理检查清单

- 是否存在同一能力的多个正式目录？
- 是否存在带 `legacy`、`deprecated`、`backup`、`.back` 的主干代码？
- 是否存在无法判断职责的近义目录，如 `helpers`、`utils`、`services` 混用？
- 新增代码是否能明确归类到 `app`、`features`、`entities`、`shared`、`processes` 之一？
- `shared` 中是否混入了强业务语义代码？
- `feature` 中是否混入了应属于 entity 的稳定领域模型？
- 是否已经为兼容层设置删除时间？
- 是否已经为正式入口写清 import 约定？

## 10. 结论

这次整理最重要的不是“把目录改成更漂亮的名字”，而是先建立下面这个治理顺序：

1. 先定主干层级
2. 再定职责边界
3. 再定命名契约
4. 最后按正式入口逐步迁移

如果只做“批量 rename”，短期会更整齐，但几周后仍然会继续变乱。

如果按这份方法推进，即使短期内目录名还没完全重构，团队也会先获得两个最关键的收益：

- 新代码知道该放哪
- 旧代码知道什么时候删

---

如果你愿意，我下一步可以继续帮你做两件更具体的事，二选一就行：

1. 直接基于这份方案，给你列一个**你们仓库专属的目录迁移 TODO 清单**
2. 先帮你做一版**“目标目录结构 + import 迁移映射表”**

## 11. 相关文档

- [执行 TODO 清单](./src-directory-governance-todo.md)
