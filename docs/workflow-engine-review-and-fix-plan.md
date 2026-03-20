# 流程引擎接口审查与修复计划

## 审查范围

本次审查基于当前仓库中的前端代码、API 契约、适配层和 mock 逻辑进行。

说明：

- 当前仓库未发现可直接审查的后端服务实现代码，因此后端部分结论以“接口契约/前端调用方式”作为依据。
- 数据库按既定前提不改动，修复计划仅围绕前后端接口、调用链、建模方式与页面交互收敛。

## 目标基线

本次修复应以以下目标为唯一基线：

- 仅保留两个核心接口：流程启动、节点审批。
- 启动接口仅传：`flowCode`（或流程类型编码）、`starterUserId`。
- 审批接口仅传：`stepInstanceId`、`approved`、`operatorUserId`，涉及跨部门场景时补充 `orgId`。
- 流程定义统一来自 `flow_definition` 和 `step_definition`。
- 流程运行统一围绕 `audience_instance` 和 `step_instance`。
- 节点只绑定角色，不由前端预选具体审批人。
- 下一节点由后端依据 `flow_definition_id + step_index +/- 1 + is_terminal` 自动推导。
- 不再提供撤回、跳转、改派等非常规能力。

补充口径：

- 当前业务审批核心是“整体 Plan 审批”，不是“单个指标逐条审批”。
- 指标步骤可以作为查询、展示、统计或关联范围使用，但不应成为审批主对象。
- 前端不再提供“选择审批人模板”或“选择具体审批人”的能力，审批人解析全部由后端根据角色、组织和流程定义完成。

## 审查结论

当前实现 **部分接近目标，但整体不符合**。主要问题不在数据库，而在：

- 前端存在两套流程/审批模型并存。
- 启动与审批接口参数未收敛到目标模型。
- 业务实体 ID、实例 ID、任务 ID、节点 ID 之间存在混用。
- 前端仍在做“审批人选择”，没有完全交给后端按角色和组织解算。
- 页面上仍暴露撤回等非目标能力。

## 主要不符合项

### 1. 启动接口参数不符合目标设计

现状：

- `workflow` API 需要 `workflowCode + businessEntityId + businessEntityType`
- 旧 `approval` API 需要 `submitterId + requesterOrgId + entityType + entityId + workflowCode`

问题：

- 不符合“启动接口只传流程类型 + 启动用户 ID”的约束。
- 前端还需要知道太多业务字段，导致后端无法统一按用户上下文自行补全。

影响：

- 页面和流程引擎强耦合。
- 流程启动逻辑分散，难以统一维护。

补充说明：

- 对“整体 Plan 审批”这个主场景，前端更合理的接口形态应当是 `POST /plans/{planId}/submit-dispatch`，请求体只保留 `workflowCode`。
- `planId` 由路径给出，`starterUserId` 和 `starterOrgId` 由后端从当前登录态提取，流程引擎内部再将其转换为实例启动参数。
- 因此，对前端来说，这里的“启动接口最小入参”实际应落成：
  - 路径：`planId`
  - Body：`workflowCode`
  - 登录用户：由后端自动获取

### 2. 审批接口未统一以 `step_instance_id` 为核心

现状：

- 新接口按 `/workflows/tasks/{taskId}/approve|reject|decision` 调用。
- 多处代码将 `instanceId` 当 `taskId` 直接发起审批，失败后再查详情兜底。
- 某些场景甚至直接拿业务填报 ID 去调用审批接口。

问题：

- 不符合“审批针对当前待审节点”的要求。
- 当前前端无法保证“本次审批的对象”一定是唯一待审节点。

影响：

- 审批对象标识不稳定。
- 一旦流程实例下存在多个任务/节点，很容易误审或逻辑分叉。

### 3. 前端仍然要求选择具体审批人

现状：

- 计划发起审批前，会先拉取 preview。
- 如果节点 `selectable = true`，前端要求用户选择 `approverId`。
- 提交 payload 时带 `selectedApprovers[{ stepDefId, approverId }]`。

问题：

- 与“节点绑定角色、后端结合角色和 ORGID 自动查人”的原则冲突。
- 审批链条仍带有人工选人逻辑。

影响：

- 页面行为和数据库设计意图不一致。
- 后端无法彻底收敛为“角色映射审批人”。

修正口径：

- 前端可以保留“审批流程预览”，但只能用于展示节点名称、步骤顺序、角色信息和提示文案。
- 前端不能展示可编辑的审批人下拉框，也不能再提交 `selectedApprovers`。
- 如果预览接口仍返回候选审批人，也只能作为只读参考，不参与提交。

### 4. 旧审批模型仍然写死固定层级认知

现状：

- 旧 `approval` 模块仍内置“直属上级、二级上级、上级部门”的数据结构。

问题：

- 与“只有 4 类流程定义，层级增减只靠 step_definition 配置”的原则冲突。

影响：

- 容易让后续实现继续沿用固定层级审批思维。

### 5. 节点流转展示未真正基于 `step_index`

现状：

- 多处逻辑直接用 `tasks.map((t, i) => i)` 作为 `stepIndex`。
- 当前步骤、时间轴、状态映射带有明显前端推断性质。

问题：

- 不符合“以 step_instance.step_index 和 step_definition 为准”的要求。
- 前端并未消费真实节点索引，也没有 `is_terminal` 的明确模型。

影响：

- 页面展示可能与真实流转不一致。
- 难以支持退回、终止、跨层级节点等标准行为。

### 6. 页面仍包含撤回、取消、改派等非目标能力

现状：

- 前端保留撤回入口。
- API 中保留取消、改派能力。

问题：

- 与“全流程只依赖启动、审批两个核心接口”的边界冲突。

影响：

- 前后端职责边界不清。
- 会持续干扰流程引擎核心接口收敛。

## 当前可保留的部分

以下内容可作为后续修复基础：

- 页面点击时已经可以固定映射到某个 `workflowCode`。
- 流程预览结构中已经出现 `roleId` 字段。
- 现有页面已有“发起审批”和“审批处理”的明确交互入口。

## 修复原则

数据库不动的前提下，本次修复应遵循以下原则：

- 优先收敛接口，不先动页面表现。
- 优先统一标识，再统一流程逻辑。
- 先去掉不该由前端负责的能力，再补足标准字段。
- 保留页面入口，但替换底层 API 和 payload。

## 修复计划

## 一期：接口收敛

目标：让前后端都围绕两个核心接口工作。

### 后端修复计划

后端需要统一为两类接口：

1. 启动接口

- 建议接口：`POST /workflow-instances/start`
- 请求体：
  - `flowCode: string`
  - `starterUserId: number`

后端职责：

- 根据 `flowCode` 查 `flow_definition`
- 根据 `starterUserId` 反查用户、组织、业务上下文
- 写入 `audience_instance`
- 同时写入 `step_instance`
  - 第一个节点：已提交
  - 第二个节点：待审批
- 返回：
  - `instanceId`
  - `currentStepInstanceId`
  - `currentStepIndex`
  - `status`

2. 审批接口

- 建议接口：`POST /workflow-step-instances/approve`
- 请求体：
  - `stepInstanceId: number`
  - `approved: boolean`
  - `operatorUserId: number`
  - `orgId?: number`
  - `comment?: string`

后端职责：

- 校验 `stepInstanceId` 是否为待审批节点
- 校验 `operatorUserId` 与当前登录用户一致
- 若为跨部门场景，使用 `role_id + orgId` 查审批人
- 更新当前 `step_instance`
- 若 `approved = true`
  - 若当前节点 `is_terminal = true`，流程结束
  - 否则按 `step_index + 1` 查下一节点定义并生成下一条 `step_instance`
- 若 `approved = false`
  - 按 `step_index - 1` 查回退节点定义并生成待处理节点
- 返回：
  - `instanceId`
  - `currentStepInstanceId`
  - `currentStepIndex`
  - `status`
  - `isFinished`

### 前端修复计划

1. 废弃旧审批接口层

需要逐步下线：

- `src/3-features/approval/api/approval.ts`
- `src/3-features/task/api/strategicApi.ts` 中审批兼容逻辑

处理方式：

- 保留页面组件，但底层全部改调统一 workflow engine API。
- 删除“instanceId 当 taskId 直接审批，失败后兜底解析 pending task”的逻辑。

2. 收敛启动参数

前端页面只保留：

- 固定流程编码 `flowCode`

不再由前端主动传：

- `selectedApprovers`
- `requesterOrgId`
- `entityType`
- `entityId`
- `businessEntityType`
- 其他可由后端反查补全的上下文字段

对 Plan 审批主场景，前端实际提交约定为：

- 接口：`POST /plans/{planId}/submit-dispatch`
- 请求体：
  - `workflowCode: string`

其中：

- `planId` 来自当前页面上下文
- `starterUserId`、`starterOrgId` 来自后端登录态
- 流程实例内部所需的业务实体信息由后端补全

3. 收敛审批参数

前端审批按钮必须绑定到真正的待审批节点：

- 页面待办列表返回的主键必须改为 `stepInstanceId`
- 审批提交仅传：
  - `stepInstanceId`
  - `approved`
  - `operatorUserId`
  - `orgId`（仅跨部门场景）
  - `comment`

4. 移除审批人选择弹窗中的“选人”职责

当前“选择审批人”弹窗要改为：

- 仅展示流程预览
- 展示每个节点绑定的角色名称
- 不允许用户手工选择具体 `approverId`

如果页面必须保留确认动作：

- 按钮名称仍可保留“确认发起审批”
- 但提交时不再带 `selectedApprovers`
- 弹窗标题应从“选择审批人”调整为“确认审批流程”或同类只读含义标题

## 二期：页面行为收敛

目标：让页面逻辑只围绕“启动流程”“处理当前节点”。

### 前端页面修复项

1. 整体 Plan 审批页面

修复目标：

- 发起审批的对象明确为“当前整体 Plan”
- 不再把指标 ID 作为流程主对象
- 页面上的指标仅作为 Plan 范围内的数据展示，不单独触发审批实例

建议处理：

- 保留“发起审批”入口，但调用统一的 Plan 提交接口
- 将页面中“下发即逐条触发指标审批流”的逻辑逐步下线

2. 下发页面

修复目标：

- 点击“下发”即唯一映射到固定 `flowCode`
- 不再把指标 ID、任务 ID、实例 ID 混为流程主参数

建议处理：

- 在页面层建立固定映射表，例如：
  - `战略发展部 -> 职能部门 = FLOW_1`
  - `职能部门 -> 二级学院 = FLOW_2`
  - 其他两个固定流程 = `FLOW_3`、`FLOW_4`

3. 审批抽屉/待办列表

修复目标：

- 列表数据的主键统一使用 `stepInstanceId`
- 展示字段明确为：
  - `instanceId`
  - `stepInstanceId`
  - `flowName`
  - `stepName`
  - `stepIndex`
  - `applicant`
  - `orgName`

4. 时间轴/流程状态展示

修复目标：

- 使用后端返回的真实 `stepIndex`
- 使用后端返回的真实终止状态
- 不再使用数组下标推断当前节点

### 功能下线项

建议前端下线以下能力：

- 撤回
- 改派
- 取消流程
- 临时加签
- 任意跳转节点

说明：

- 如果产品暂时不能删按钮，至少先禁用并标注“当前版本不支持”。

## 三期：模型统一

目标：消除仓库中并存的两套流程模型。

### 统一后的前端领域模型建议

- `FlowDefinition`
  - `id`
  - `flowCode`
  - `flowName`

- `StepDefinition`
  - `id`
  - `flowDefinitionId`
  - `stepIndex`
  - `stepName`
  - `roleId`
  - `isTerminal`

- `WorkflowInstance`
  - `instanceId`
  - `flowDefinitionId`
  - `starterUserId`
  - `status`
  - `currentStepInstanceId`
  - `currentStepIndex`

- `StepInstance`
  - `stepInstanceId`
  - `instanceId`
  - `stepDefinitionId`
  - `stepIndex`
  - `status`
  - `operatorUserId`
  - `orgId`
  - `comment`

### 需要删除的概念

- `taskId` 作为通用审批节点 ID 的用法
- `instanceId` 直接审批的用法
- `selectedApprovers`
- 固定多级主管审批字段模型

## 分工建议

### 后端优先项

1. 给出统一的两个核心接口
2. 返回真实的 `stepInstanceId`
3. 返回真实的 `stepIndex`
4. 返回 `isFinished/currentStep/isTerminal` 等流程状态字段
5. 屏蔽旧审批接口或标记废弃
6. 将 Plan 提交接口的请求体收敛为仅 `workflowCode`
7. 将审批人解析完全后移到后端角色解析逻辑

### 前端优先项

1. 新建统一 workflow engine API 层
2. 改造待办列表主键为 `stepInstanceId`
3. 删除审批人选择提交逻辑
4. 删除审批兜底解析逻辑
5. 禁用撤回/改派/取消能力
6. 将 Plan 发起审批弹窗改为只读流程确认弹窗

## 风险提示

### 风险 1：前端改完但后端仍返回 taskId

结果：

- 前端仍然无法稳定锁定当前待审节点。

要求：

- 后端必须优先补齐 `stepInstanceId`。

### 风险 2：后端仍要求前端传审批人

结果：

- 无法实现“角色与人员解耦”。

要求：

- 审批人解析必须后移到后端。

### 风险 3：页面仍保留旧入口

结果：

- 两套接口并存，最终又回到现在的混乱状态。

要求：

- 新接口切通后，旧入口应尽快移除或重定向。

## 建议的实施顺序

1. 先收敛 Plan 提交审批接口，只保留 `workflowCode`
2. 同步删除前端“选审批人”提交流程
3. 后端统一返回真实 `stepInstanceId`
4. 再改待办列表和审批提交
5. 最后清理旧 approval API、兼容层和撤回能力

## 最终结论

在“不改数据库”的前提下，这个系统是可以收敛到目标方案的。

真正需要修的不是表，而是：

- 前端接口调用方式
- 前端审批建模
- 后端接口入参与返回结构
- 旧审批兼容层

只要把“启动只认流程类型和发起人”“审批只认当前节点实例”这两件事落稳，现有数据库思路仍然可以成立。
