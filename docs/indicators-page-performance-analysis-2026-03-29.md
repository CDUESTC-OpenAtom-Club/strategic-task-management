# `/indicators` 页面前端性能分析与优化讨论稿

## 1. 目标与约束

本文档只讨论 `/indicators` 页面及其关联前端加载链的性能优化，不讨论业务规则调整。

本轮明确约束：

- 不改变业务逻辑
- 不改变接口语义
- 不改变审批、填报、撤回、状态判断结果
- 不先改后端 SQL 或数据库结构
- 对可能影响“展示时机”或“筛选口径”的优化，先讨论再实施

---

## 2. 当前页面加载链路

根据前端代码静态分析，`/indicators` 页在进入时会触发以下几类请求。

### 2.1 首屏核心请求

1. 组织数据

- 入口：`orgStore.loadDepartments()`
- 作用：决定当前用户组织、部门/学院列表、筛选项

2. Plan 列表

- 入口：`planStore.loadPlans({ background: true })`
- 作用：决定当前页面属于哪个 `plan`、当前 plan 状态、学院候选 plan 列表

3. 指标列表

- 入口：`strategicStore.loadIndicatorsByYear(timeContext.currentYear)`
- 作用：页面主体列表数据来源

4. 周期列表

- 入口：`timeContext.initialize()`、`strategicApi.getAllCycles()`、`planApi` 兜底链
- 作用：年份解析、周期选择、plan 年份映射

5. 消息/通知

- 入口：layout 层 `messageStore.fetchMessages()`
- 作用：头部消息角标与通知中心

### 2.2 首屏后的补充请求

1. 批量加载学院候选 plan 详情

- 入口：`loadCollegePlanDetails()`
- 特征：对多个 `plan` 调用 `planStore.loadPlanDetails(plan.id)`

2. 当前 plan 的月报摘要

- 入口：`loadCurrentPlanReportSummary(planId)`
- 特征：根据 `planId + reportOrgId` 查当前月份上报

3. 指标逐条工作流快照

- 入口：`loadIndicatorWorkflowSnapshot(indicator.id)`
- 特征：页面拿到指标列表后，再对部分指标逐条补查历史/审批快照

4. 审批状态轮询

- 入口：`restartPlanApprovalPolling()`
- 特征：定时刷新当前 plan 详情与当前月 report 摘要

### 2.3 提交/填报阶段请求

1. `POST /reports`

- 创建当月 `plan_report` 草稿

2. `PUT /reports/{id}`

- 保存本次指标填报内容

3. `POST /reports/{id}/submit`

- 提交当前月上报

4. `POST /plans/{id}/submit`

- 提交整体审批包装动作

---

## 3. 当前已识别的性能风险点

以下风险点按“对页面响应时间影响大小”排序。

### P1. `/notifications` 误拉全量

现象：

- 消息中心原本应走“我的通知”
- 若误打全量 `/notifications`，会拉取整批告警事件

影响：

- 与 `/indicators` 业务无直接关系
- 但会阻塞 layout 初始化
- 极易放大首屏超时

当前状态：

- 已修成 `/notifications/my?page=0&size=20`
- 已改为后台执行，不再阻塞页面初始化

### P2. `/cycles/list` 重复初始化

现象：

- `timeContext`
- `strategicApi`
- `planApi` 年份兜底
- 多处都可能触发 `cycles/list`

影响：

- 单次请求本身通常不大
- 但容易在首屏重复触发，形成无意义并发

当前状态：

- 已给 `timeContext.initialize()` 增加单飞与已加载复用

### P3. 指标列表接口天然较重

接口：

- `GET /api/v1/indicators?year=...`

风险原因：

- 不是只查 `indicator`
- 还会补任务名、里程碑、最新填报进度、当前月填报状态
- 前端又会在此基础上做二次聚合

影响：

- 这是 `/indicators` 页面主耗时来源候选之一
- 指标数量上来后，首屏列表成本会明显上升

结论：

- 这类优化最终大概率需要后端聚合策略和 SQL 一起看
- 前端只能减少“基于此接口之后的二次放大”

### P4. 学院候选 plan 详情批量预加载

入口：

- `loadCollegePlanDetails()`

现状：

- 对 `collegePlanCandidates` 中的每个 `plan` 都调用一次 `loadPlanDetails`

风险原因：

- `GET /plans/{id}/details` 是重接口
- 含 plan + tasks + indicators + milestones + report 聚合数据
- 候选 plan 一多，会直接从 1 次请求变成 N 次重请求

影响：

- 二级学院视角下尤其明显
- 会拖慢“页面可交互时间”

结论：

- 这是前端最值得继续优化的一项
- 但如果改成严格懒加载，可能影响“来源部门筛选项首次出现时机”
- 需要你确认是否允许这种优化

### P5. 指标逐条快照补查

入口：

- `loadIndicatorWorkflowSnapshot(indicator.id)`

现状：

- 页面拿到指标列表后，会对满足条件的指标逐条补查填报/审批快照

风险原因：

- 属于典型 N+1
- 数据量稍大就会明显放大网络与后端压力

当前状态：

- 已优化成只对“有上报/审批痕迹”的指标补查
- 不再对全部指标无脑触发

结论：

- 已有改善
- 若后续还慢，下一步应该考虑“按展开时再查”或“分页内再查”
- 但这可能改变某些行内状态出现时机，需要你确认

### P6. report 列表后逐条详情补查

入口：

- `indicatorFillApi.getIndicatorFillHistory()`

现状：

- 先 `GET /reports/plan/{planId}`
- 再对每个 report `GET /reports/{id}`

风险原因：

- 列表 + 明细 N+1
- 在历史数据多时会明显放大

影响：

- 不一定拖慢首屏
- 但会拖慢打开某些指标详情、审批记录、填报历史相关动作

结论：

- 这块也适合优化
- 但更偏“操作内性能优化”，不是首屏第一优先级

---

## 4. 已完成的安全优化

以下项目已经实施，且不改变业务逻辑：

1. 通知接口改为用户级分页接口

- 从 `/notifications` 改为 `/notifications/my`

2. 消息拉取改为后台执行

- 不阻塞 layout 和 `/indicators` 首屏

3. `timeContext` 初始化加单飞

- 避免 `/cycles/list` 重复触发

4. 指标快照补查收敛

- 只对有审批/上报痕迹的指标进行补查

---

## 5. 推荐的下一步前端优化项

下面只列“不改业务规则”的优化项。

### 方案 A：学院候选 plan 详情改为懒加载

思路：

- 不在页面进入时对所有候选 `plan` 批量调用 `GET /plans/{id}/details`
- 改为只加载：
  - 当前命中的 `selectedCollegePlan`
  - 或当前筛选后的首个候选 plan

预期收益：

- 二级学院视角下首屏请求数明显下降
- 避免多个重接口并发

可能影响：

- 来源部门筛选项如果依赖所有 plan 详情字段，首次展示可能需要退化到基础 plan 字段
- 某些“全部候选来源部门”信息可能从“立刻完整”变成“逐步补齐”

是否影响业务逻辑：

- 不影响最终结果
- 可能影响筛选项的首次展示时机

建议优先级：

- `高`

### 方案 B：指标快照改为按需加载

思路：

- 不在列表拿到后立刻补查
- 改为在以下时机触发：
  - 用户展开详情
  - 打开审批抽屉
  - 需要显示审批动作按钮时

预期收益：

- 大幅减少列表页首屏后续并发请求数

可能影响：

- 某些行内“可审批/审批状态”标识可能晚一点出现

是否影响业务逻辑：

- 不影响最终审批结果
- 可能影响部分状态的展示时机

建议优先级：

- `中高`

### 方案 C：report 历史明细改为二段式按需展开

思路：

- 先只拉 `GET /reports/plan/{planId}`
- 只有用户进入某条 report 详情时，再打 `GET /reports/{id}`

预期收益：

- 降低历史/审批记录场景下的 N+1

可能影响：

- 历史详情首次打开会比现在多一次懒加载等待

是否影响业务逻辑：

- 不影响

建议优先级：

- `中`

### 方案 D：进一步削减 plan 列表兜底链路

思路：

- 减少 `loadPlansByCycleFallback()` 的触发概率
- 优先保证 `/plans` 主接口直接可用

预期收益：

- 避免 `cycles/list + plans/cycle/{id}` 这种 1+N 请求链

可能影响：

- 需要更仔细梳理 `planApi` 失败兜底逻辑

是否影响业务逻辑：

- 原则上不影响
- 但属于更深一层的容错逻辑调整

建议优先级：

- `中`

---

## 6. 暂不建议先动的优化

### 1. 改指标主接口返回结构

原因：

- 会直接触碰后端聚合逻辑
- 联动面太大

### 2. 改 plan 详情接口语义

原因：

- 会影响多个页面
- 虽然收益可能大，但不适合先从前端单边做

### 3. 改审批轮询规则

原因：

- 可能影响审批状态同步时机
- 容易被误判成“业务逻辑变化”

---

## 7. 建议讨论顺序

建议我们按下面顺序讨论：

1. 是否允许“学院候选 plan 详情”从批量预加载改成懒加载
2. 是否允许“指标 workflow 快照”从列表首屏补查改成按需加载
3. 是否需要继续压缩 `report` 历史明细加载

---

## 8. 需要你确认的决策点

请你只需要回答这三个点即可：

1. `学院候选 plan 详情`：

- 你是否接受“只先加载当前命中的 plan 详情，其他候选 plan 详情延后加载”？

2. `指标审批快照`：

- 你是否接受“列表页先不补齐所有指标的审批快照，等用户展开/操作时再补查”？

3. `历史详情`：

- 你是否接受“历史 report 先只显示列表，点开某条时再查详情”？

如果你愿意，我下一步就按你选的优先级，从最安全的一项开始做。
