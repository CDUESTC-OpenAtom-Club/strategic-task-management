# 前端缓存设计方案

## 概述

本文档定义 `strategic-task-management` 前端的数据缓存设计口径，目标是在不牺牲数据正确性的前提下，尽量降低重复请求、缩短首屏等待时间、改善页面切换与刷新体验。

本文档适用于：

- 列表类接口缓存
- 详情类接口缓存
- 组织、年份、计划、指标等读多写少数据
- 页面首屏、切页、返回、刷新等典型交互场景

本文档不主张对所有数据一刀切长缓存。缓存的核心原则是：

1. 先按数据稳定性分层，再决定缓存范围。
2. 先保证失效正确，再追求命中率。
3. 优先缓存"慢但稳定"的读请求。
4. 对审批、待办、角标这类高时效数据保持谨慎。

---

## 当前基础设施

### 已实现的缓存能力

当前项目已经具备统一缓存能力，核心位于：

- [`src/5-shared/lib/utils/cache.ts`](../src/5-shared/lib/utils/cache.ts)

现有能力包括：

- `buildQueryKey(domain, resource, params)`：构造结构化缓存 key
- `fetchWithCache(...)`：统一读缓存入口
- `invalidateQueries(...)`：按 key 或 tag 失效
- `scope`：支持 `memory`、`session`、`local`
- `ttlMs`：缓存存活时间
- `staleWhileRevalidate`：先返回旧缓存，再后台刷新
- `dedupeWindowMs`：同窗口去重
- `tags`：标签化失效

**核心类：`CacheManager`**

- `memory` 存储：Map 结构，页面刷新后失效
- `session`/`local` 存储：使用 sessionStorage/localStorage
- 自动清理过期条目（60秒间隔）
- 缓存统计：hits, misses, staleHits, writes, invalidations, dedupedRequests

### API Client 结构

- [`src/5-shared/api/client.ts`](../src/5-shared/api/client.ts)：简化的 API Client
  - 不包含自动重试、请求去重（应在业务层显式处理）
  - 只负责 Token 注入、错误转换、基础拦截器

### 现有缓存配置

已在 `cache.ts` 中预配置的缓存策略：

```typescript
export const DEFAULT_CACHE_CONFIGS: Record<string, CachePolicy> = {
  '["org","departments",null]': {
    ttlMs: 10 * 60 * 1000,
    scope: 'memory',
    staleWhileRevalidate: true,
    dedupeWindowMs: 1000,
    tags: ['org.list']
  },
  '["plan","list",null]': {
    ttlMs: 2 * 60 * 1000,
    scope: 'memory',
    dedupeWindowMs: 1000,
    tags: ['plan.list']
  },
  '["indicator","list",null]': {
    ttlMs: 2 * 60 * 1000,
    scope: 'memory',
    dedupeWindowMs: 1000,
    tags: ['indicator.list']
  },
  // ... 其他配置
}
```

URL 模式匹配配置：

```typescript
createUrlPatternPolicyMap(): Map<string, CachePolicy>
```

支持的 URL 模式：
- `/organizations` → 10min, memory, stale-while-revalidate
- `/orgs` → 5min, memory, stale-while-revalidate
- `/cycles` → 5min, memory, stale-while-revalidate
- `/plans` → 2min, memory
- `/indicators` → 2min, memory, useLastModified
- `/tasks` → 2min, memory

---

## 当前缓存实施状态

### ✅ 已实施缓存的模块

| 模块 | 文件位置 | 缓存状态 | 备注 |
|------|---------|---------|------|
| 组织机构 (Organization) | `src/3-features/organization/api/org.ts` | ✅ 已实施 | 使用 `fetchWithCache`，30分钟 TTL，session scope |
| 认证用户 (Auth User) | `src/3-features/auth/api/query.ts` | ✅ 已实施 | session scope，持久化 |
| 仪表板 (Dashboard) | `src/3-features/dashboard/api/query.ts` | ✅ 已实施 | overview / alert summary 已接入统一缓存 |
| 年度周期 (Cycle List) | `src/5-shared/lib/timeContext.ts` | ✅ 已实施 | session scope，30分钟 TTL，支持刷新复用 |
| 工作流查询 (Workflow Query) | `src/3-features/workflow/api/queries.ts` | ✅ 已实施 | todo/detail/definitions 已接入分层缓存 |

### ❌ 未实施缓存的模块

| 模块 | 文件位置 | 状态 | 建议优先级 |
|------|---------|------|-----------|
| 里程碑 (Milestone) | `src/4-entities/milestone/api/milestoneApi.ts` | ✅ 已实施 | list/detail/validation 已接入统一缓存 |
| 消息角标 / 未读数 | `src/3-features/messages/` | ✅ 已实施 | 短 TTL memory cache + 写后失效 |

### 当前代码模式

**已实施缓存的示例**（org.ts）：
```typescript
async getAllDepartments(): Promise<Department[]> {
  const response = await fetchWithCache({
    key: buildQueryKey('org', 'departments'),
    policy: {
      ttlMs: 10 * 60 * 1000,
      scope: 'memory',
      staleWhileRevalidate: true,
      dedupeWindowMs: 1000,
      tags: ['org.list']
    },
    fetcher: async () => {
      const result = await this.requestOrgList()
      return result ?? { data: [], success: false, message: '组织接口不可用' }
    }
  })
  // ... 数据转换逻辑
}
```

**未实施缓存的示例**（indicator/api/query.ts）：
```typescript
export async function queryIndicators(
  filters?: IndicatorFilters
): Promise<PaginatedResponse<Indicator>> {
  // 直接调用 apiClient，未使用缓存
  const response = await apiClient.get<IndicatorListResponse>(
    '/indicators',
    filters as Record<string, unknown> | undefined
  )
  return normalizeIndicatorList(unwrapData(response))
}
```

---

## 缓存分层

### 1. `memory`

仅在当前页面生命周期或当前标签页运行期内有效，刷新后消失。

适合：

- 当前页短时重复读取的数据
- 频繁切换的列表
- 容易变化但允许短暂复用的数据
- 待办、角标、工作流详情等高频查询

特点：

- 命中快
- 失效简单
- 不会跨刷新残留旧值

### 2. `session`

缓存存在于当前浏览器会话中，刷新页面仍可复用，关闭标签页或浏览器后消失。

适合：

- 当前登录会话内较稳定的数据
- 首屏基础数据
- 组织列表、年份列表、计划列表、指标列表

特点：

- 对"刷新后又要等一轮"问题改善明显
- 风险低于 `local`
- 是业务缓存的主力层

**当前实施状态**：仅认证用户数据使用 session scope

### 3. `local`

缓存跨会话持久化，需要更严格的版本管理与失效控制。

适合：

- 极稳定的字典型数据
- 组织树、固定枚举、低频变化配置

不适合：

- 计划明细
- 指标明细
- 审批待办
- 任何强依赖当前状态变化的数据

特点：

- 命中收益最高
- 但最容易产生脏数据
- 必须配合 `version` 使用

**当前实施状态**：暂未使用 local scope

---

## 数据分级策略

### A 类：基础稳定数据

包括：

- 组织机构列表 ✅ 已实施
- 学院列表 ✅ 已实施（作为 org 子集）
- 职能部门列表 ✅ 已实施（作为 org 子集）
- 年度 cycle 列表 ✅ 已实施
- 静态字典与枚举映射 ⚠️ 暂未单独建设

建议策略：

- `scope: 'session'`
- `ttlMs: 30min ~ 2h`
- `staleWhileRevalidate: true`

其中组织列表如果变更频率极低，可以进一步评估升级为：

- `scope: 'local'`
- 增加 `version`

**当前实施**：
- 组织列表：`scope: 'session'`, `ttlMs: 30min`，并带 `version`
- 年度列表：`scope: 'session'`, `ttlMs: 30min`

### B 类：业务列表数据

包括：

- `plan list` ✅ 已实施
- `indicator list` ✅ 已实施
- `task list` ✅ 已实施
- dashboard 概览统计 ✅ 已实施

建议策略：

- `scope: 'session'`
- `ttlMs: 1min ~ 5min`
- `staleWhileRevalidate: true`
- 列表 key 必须带查询条件

这类数据最适合"先显示缓存，再静默刷新"的模式。

**当前配置**：
- plan list: `scope: 'session'`, `ttlMs: 2min`
- indicator list: `scope: 'session'`, `ttlMs: 2min`
- task list: `scope: 'session'`, `ttlMs: 2min`

### C 类：业务详情数据

包括：

- `plan detail` ✅ 已实施
- 指标详情 ✅ 已实施
- 任务详情 ✅ 已实施
- 某个实例的审批流详情 ✅ 已实施

建议策略：

- 优先 `memory`
- 必要时短期 `session`
- `ttlMs: 30s ~ 2min`
- key 必须带对象 ID 与上下文参数

详情数据缓存应比列表更保守。

**当前实施**：
- `plan detail`：已实施，`memory` 1min
- `indicator detail`：已实施，`memory` 1min
- `task detail`：已实施，`memory` 1min
- `workflow detail`：已实施，`memory` 30s

### D 类：强时效状态数据

包括：

- 我的待办 ✅ 已实施
- 审批节点状态 ✅ 已实施
- 消息角标 ✅ 已实施
- 通知未读数 ✅ 已实施
- 实时工作流状态 ✅ 已实施（短 TTL）

建议策略：

- `scope: 'memory'`
- `ttlMs: 10s ~ 30s` 或仅做请求去重
- 不建议持久化到 `session`/`local`

原因是这类数据一旦陈旧，用户会立刻感知错误。

**当前实施**：
- `workflow.todo`：已实施，`memory` 20s

---

## 缓存 Key 设计

缓存 key 必须表达完整上下文，避免跨部门、跨年份、跨视角串数据。

统一格式：

```ts
buildQueryKey(domain, resource, params)
```

### 推荐维度

- `year` - 年份（重要！防止跨年数据混乱）
- `orgId` - 组织ID
- `viewRole` - 视图角色（战略发展部/职能部门/二级学院）
- `planId` - 计划ID
- `taskId` - 任务ID
- `indicatorId` - 指标ID
- `workflowInstanceId` - 工作流实例ID
- `version` - 缓存版本（用于结构变更时强制失效）

### 示例

```ts
// 组织列表（当前已实施）
buildQueryKey('org', 'departments', { version: 'v2' })

// 年度周期列表（待实施）
buildQueryKey('cycle', 'list', { userId, orgId })

// 计划列表（待实施，必须带年份和组织）
buildQueryKey('plan', 'list', { year: 2026, orgId: 36, role: 'functional_dept' })

// 计划详情（待实施）
buildQueryKey('plan', 'detail', { planId: 41001, year: 2026, orgId: 36 })

// 指标列表（待实施，必须带年份和组织）
buildQueryKey('indicator', 'list', { year: 2026, orgId: 36, role: 'functional_dept' })

// 工作流待办（待实施）
buildQueryKey('workflow', 'todo', { userId: 191, orgId: 36 })
```

### 设计要求

1. 只要接口返回可能因参数不同而不同，key 就必须带参数。
2. 只要页面存在"视角切换"，key 就必须带 `viewRole` 或等价信息。
3. 只要缓存可能跨版本不兼容，就必须带 `version`。

---

## 失效设计

缓存不是"存起来就不管"，写操作后的失效规则比命中策略更重要。

### 当前失效实施状态

| 失效场景 | 实施状态 | 备注 |
|---------|---------|------|
| invalidateQueries 调用 | ✅ 已实施 | plan / indicator / task / workflow mutations 已接入 |
| 标签化失效 | ✅ 已实施 | tags 已用于读写缓存和失效联动 |

### 1. 指标写操作

包括：

- 新增指标 ❌ 未失效
- 编辑指标 ❌ 未失效
- 删除指标 ❌ 未失效
- 下发指标 ❌ 未失效
- 撤回指标 ❌ 未失效
- 里程碑变更 ❌ 未失效

应失效：

- `indicator.list`（所有相关 key）
- 相关 `plan.detail`
- 必要时 `task.list`

**当前状态**：已实施，`indicator/api/mutations.ts` 已接入 `invalidateQueries`

### 2. Plan 写操作

包括：

- 创建 plan ❌ 未失效
- 编辑 plan ❌ 未失效
- 提交审批 ❌ 未失效
- 审批通过/驳回 ❌ 未失效
- 撤回 ❌ 未失效

应失效：

- `plan.list`（所有相关 key）
- 对应 `plan.detail`
- 相关 workflow 读取缓存

**当前状态**：已实施，`plan/api/mutations.ts` 已接入 `invalidateQueries`

### 3. 审批类操作

包括：

- 待办处理 ❌ 未失效
- 节点通过/驳回 ❌ 未失效
- 评论、记录、流转 ❌ 未失效

应失效：

- `workflow.todo`
- `workflow.detail`
- 必要时相关 `plan.detail` 或 `indicator.detail`

**当前状态**：已实施，`workflow/api/mutations.ts` 已接入 `invalidateQueries`

### 4. 组织数据变更

组织数据一般变更少，不建议依赖运行时频繁失效。

建议方案：

- 以 TTL 为主
- 辅以缓存版本号升级

---

## 页面加载设计

缓存设计不只是接口层配置，也影响页面的加载顺序。

### 首屏推荐三段式加载

#### 第一段：框架必需数据

优先加载：

- ✅ 当前用户（已使用 session scope）
- ✅ 组织列表（已使用 memory scope + fetchWithCache）
- ❌ 年份列表（待实施）

特点：

- 这些数据缓存收益高
- 直接决定页面骨架是否能快速渲染

#### 第二段：列表主数据

再加载：

- ❌ `indicator list`（待实施）
- ❌ `plan list`（待实施）
- ❌ `task list`（待实施）

特点：

- 可以优先命中缓存
- 允许后台静默刷新

#### 第三段：详情与重计算数据

最后加载：

- ❌ `plan detail`（待实施）
- ❌ 工作流详情（待实施）
- ❌ 大体量聚合数据（待实施）

特点：

- 不应阻塞左侧导航与首屏基本交互

---

## 推荐缓存矩阵

| 数据类型 | scope | ttl | staleWhileRevalidate | 当前状态 | 备注 |
|---|---|---:|---|---|---|
| 组织列表 | `session` | 30min | 是 | ✅ 已实施 | 已带 `version` |
| 学院列表 | `session` | 30min | 是 | ✅ 复用组织缓存 | 已实施 |
| 职能部门列表 | `session` | 30min | 是 | ✅ 复用组织缓存 | 已实施 |
| 年度列表 | `session` | 30min | 是 | ✅ 已实施 | `timeContext` 已接入 |
| plan 列表 | `session` | 2min | 是 | ✅ 已实施 | key 已带用户上下文/version |
| indicator 列表 | `session` | 2min | 是 | ✅ 已实施 | key 已带用户上下文/version |
| task 列表 | `session` | 2min | 是 | ✅ 已实施 | key 已带用户上下文/version |
| plan detail | `memory` / `session` | 1min | 视场景 | ✅ 已实施 | `basic/full` 两类 detail 已接入 |
| indicator detail | `memory` | 1min | 否 | ✅ 已实施 | 更保守 |
| dashboard 概览 | `memory` / `session` | 45s | 是 | ✅ 已实施 | query 层已统一 |
| workflow todo | `memory` | 10s~30s | 否 | ✅ 已实施 | 20s TTL |
| 消息角标 | `memory` | 10s~30s | 否 | ✅ 已实施 | 未读数与消息列表均为短缓存 |

---

## 与现有项目的落地建议

### 第一阶段：优先改造高收益低风险项 ✅ 已完成

建议先统一以下接口到缓存体系：

1. ✅ `org.departments` - **已完成**
2. ✅ `cycle.list` - **已完成**
3. ✅ `plan.list` - **已完成**
4. ✅ `indicator.list` - **已完成**

优先原因：

- 这些接口读多写少
- 对首屏和页面切换影响最大
- 失效规则相对清晰

### 第二阶段：补齐详情缓存 ✅ 已完成

建议逐步覆盖：

1. ✅ `plan.detail` - **已完成**
2. ✅ `task.detail` - **已完成**
3. ✅ `indicator.detail` - **已完成**

注意事项：

- 必须先补好失效 tag
- 必须校验 key 参数是否完整

### 第三阶段：实现 mutation 失效 ✅ 已完成

这是当前最缺失的部分：

1. ✅ indicator mutations 后失效 `indicator.list`
2. ✅ plan mutations 后失效 `plan.list`
3. ✅ workflow mutations 后失效相关缓存

实施方法：

```typescript
// 在 mutations.ts 中
import { invalidateQueries } from '@/shared/lib/utils/cache'

export async function createIndicator(data: IndicatorCreateRequest): Promise<Indicator> {
  const response = await apiClient.post<IndicatorDetailResponse>('/indicators', data)

  // 失效相关缓存
  invalidateQueries(['indicator.list'])

  return response.data
}
```

### 第四阶段：保守治理高时效接口

建议只做：

- 短 TTL
- 请求去重
- 后台刷新

不要过度持久化审批与待办数据。

---

## 风险与边界

### 1. 跨角色串缓存

风险：

- 战略发展部视角与职能部门视角读取到同一缓存

规避方式：

- key 中显式带 `orgId` 与 `viewRole`

**当前状态**：已部分实施，key 已带 `orgId/role/version`

### 2. 跨年份串缓存

风险：

- 2025 年页面读取到 2026 年数据

规避方式：

- 所有年维度列表与详情 key 显式带 `year`

**当前状态**：已部分实施，年维度查询已带 `year`

### 3. 写后读脏数据

风险：

- 下发、撤回、编辑后仍显示旧缓存

规避方式：

- 所有 mutation 后统一调用 `invalidateQueries`
- 优先按 tag 失效，不依赖页面手动刷新

**当前状态**：已显著降低，核心 mutation 均已接入失效

### 4. `local` 持久缓存污染

风险：

- 发版后结构变了，但浏览器里还是旧缓存

规避方式：

- 所有 `local` 缓存必须带 `version`
- 版本升级时切换缓存版本号

**当前状态**：暂未使用 local scope，风险较低

---

## 实施原则

### 1. 默认策略

如果一种数据暂时没有明确结论，默认采用：

```ts
scope: 'session'
ttlMs: 2 * 60 * 1000
staleWhileRevalidate: true
dedupeWindowMs: 1000
```

然后再按真实使用情况微调。

### 2. 页面原则

- 不要让详情接口阻塞首屏基础结构
- 不要在组织未加载时直接显示"暂无"
- 能先展示缓存就先展示缓存
- 能后台补刷新就不要阻塞用户

### 3. 工程原则

- 所有缓存读统一走 `fetchWithCache`
- 所有 mutation 明确声明失效范围
- 所有高价值缓存必须可追踪 key 和 tag

---

## 建议的后续工作项

### 高优先级

1. **为 indicator query 实施缓存**
   - 迁移 `src/3-features/indicator/api/query.ts` 到 `fetchWithCache` 模式
   - key 必须包含 year、orgId、role 参数

2. **为 plan query 实施缓存**
   - 迁移 `src/3-features/plan/api/query.ts` 到 `fetchWithCache` 模式
   - key 必须包含 year、orgId、role 参数

3. **实现 indicator 失效**
   - 在 `src/3-features/indicator/api/mutations.ts` 中所有写操作后调用 `invalidateQueries`

4. **实现 plan 失效**
   - 在 `src/3-features/plan/api/mutations.ts` 中所有写操作后调用 `invalidateQueries`

### 中优先级

5. **为 task 实施缓存**
   - 迁移 `src/3-features/task/api/query.ts`

6. **增加缓存调试面板**
   - ✅ 已完成：开发态面板已接入 `cacheManager.getStats()`
   - 显示命中率、过期时间、当前条目等

### 低优先级

7. **将 memory scope 升级为 session**
   - ✅ 已完成：组织列表和年份列表已升级

8. **实现年份列表缓存**
   - ✅ 已完成：`timeContext` 与相关 year/cycle 查询已接入

---

## 总结

本项目的缓存设计不应追求"所有请求都永久缓存"，而应追求：

- 稳定数据长一点
- 列表数据短一点
- 详情数据谨慎一点
- 审批数据保守一点
- 写操作失效明确一点

**一句话总结：**

缓存的重点不是"存"，而是"按上下文正确复用，并在写操作后及时失效"。

**当前状态总结：**

- ✅ 基础设施完整（CacheManager、fetchWithCache、invalidateQueries）
- ✅ 组织数据已正确实施缓存
- ✅ 核心模块已全面接入统一缓存体系
- ✅ 写操作失效机制已覆盖 plan / indicator / task / workflow / messages / milestone
- ✅ 主要查询 API 已接入缓存体系

**最紧迫任务：**

1. 为 indicator/plan 的 query API 实施缓存
2. 为所有 mutation 操作添加缓存失效

---

# 实施指南

本章节提供具体的代码模板和实施步骤，确保缓存方案能够快速、正确地落地。

## 业务决策确认

| 决策项 | 确认值 | 说明 |
|-------|-------|------|
| 缓存生命周期 | `memory`（刷新后失效） | 简单可靠，避免版本管理问题 |
| 实施范围 | 列表 + 详情 | indicator/plan 的 list 和 detail |
| 角色隔离 | 必须隔离 | key 必须包含 orgId + role |
| 年份隔离 | 不需要 | 年份切换不频繁，可共享缓存 |
| 失效时机 | 写操作后立即 | mutation 后调用 invalidateQueries |
| 调试工具 | console 日志 | 关键操作输出日志 |

---

## 一、缓存配置常量

在 `src/5-shared/lib/utils/cache-config.ts` 中创建统一配置：

```typescript
/**
 * 缓存配置常量
 * 统一管理所有缓存相关的 TTL、key、tag 等配置
 */
import type { CachePolicy } from './cache'

// ========== TTL 常量 ==========
export const CACHE_TTL = {
  /** 列表缓存：2分钟 */
  LIST: 2 * 60 * 1000,
  /** 详情缓存：1分钟 */
  DETAIL: 1 * 60 * 1000,
  /** 组织列表：10分钟 */
  ORG: 10 * 60 * 1000,
} as const

// ========== 缓存 Tag ==========
export const CACHE_TAGS = {
  INDICATOR_LIST: 'indicator.list',
  INDICATOR_DETAIL: 'indicator.detail',
  PLAN_LIST: 'plan.list',
  PLAN_DETAIL: 'plan.detail',
  TASK_LIST: 'task.list',
  TASK_DETAIL: 'task.detail',
  ORG_LIST: 'org.list',
} as const

// ========== 列表缓存策略 ==========
export const LIST_CACHE_POLICY: CachePolicy = {
  ttlMs: CACHE_TTL.LIST,
  scope: 'memory',
  staleWhileRevalidate: true,
  dedupeWindowMs: 1000,
  tags: [CACHE_TAGS.INDICATOR_LIST], // 使用时替换为具体 tag
}

// ========== 详情缓存策略 ==========
export const DETAIL_CACHE_POLICY: CachePolicy = {
  ttlMs: CACHE_TTL.DETAIL,
  scope: 'memory',
  staleWhileRevalidate: false,  // 详情不使用过期后仍显示的策略
  dedupeWindowMs: 1000,
  tags: [CACHE_TAGS.INDICATOR_DETAIL], // 使用时替换为具体 tag
}

// ========== 失效 Tag 映射 ==========
/**
 * 定义每个写操作需要失效的缓存 tag
 * 用于 mutation 操作后统一失效
 */
export const INVALIDATION_MAP = {
  // Indicator 相关写操作
  createIndicator: [CACHE_TAGS.INDICATOR_LIST],
  updateIndicator: [CACHE_TAGS.INDICATOR_LIST, CACHE_TAGS.INDICATOR_DETAIL],
  deleteIndicator: [CACHE_TAGS.INDICATOR_LIST, CACHE_TAGS.INDICATOR_DETAIL],
  distributeIndicator: [CACHE_TAGS.INDICATOR_LIST, CACHE_TAGS.INDICATOR_DETAIL],
  withdrawIndicator: [CACHE_TAGS.INDICATOR_LIST, CACHE_TAGS.INDICATOR_DETAIL],
  submitIndicatorForReview: [CACHE_TAGS.INDICATOR_LIST, CACHE_TAGS.INDICATOR_DETAIL],
  approveIndicator: [CACHE_TAGS.INDICATOR_LIST, CACHE_TAGS.INDICATOR_DETAIL],
  rejectIndicator: [CACHE_TAGS.INDICATOR_LIST, CACHE_TAGS.INDICATOR_DETAIL],

  // Plan 相关写操作
  createPlan: [CACHE_TAGS.PLAN_LIST],
  updatePlan: [CACHE_TAGS.PLAN_LIST, CACHE_TAGS.PLAN_DETAIL],
  deletePlan: [CACHE_TAGS.PLAN_LIST, CACHE_TAGS.PLAN_DETAIL],
  submitPlanForApproval: [CACHE_TAGS.PLAN_LIST, CACHE_TAGS.PLAN_DETAIL],
  approvePlan: [CACHE_TAGS.PLAN_LIST, CACHE_TAGS.PLAN_DETAIL],
  rejectPlan: [CACHE_TAGS.PLAN_LIST, CACHE_TAGS.PLAN_DETAIL],
} as const
```

---

## 二、查询 API 改造模板

### 2.1 列表查询改造

**改造前**（`src/3-features/indicator/api/query.ts`）：

```typescript
export async function queryIndicators(
  filters?: IndicatorFilters
): Promise<PaginatedResponse<Indicator>> {
  const response = await apiClient.get<IndicatorListResponse>(
    '/indicators',
    filters as Record<string, unknown> | undefined
  )
  return normalizeIndicatorList(unwrapData(response))
}
```

**改造后**：

```typescript
import { fetchWithCache, buildQueryKey } from '@/shared/lib/utils/cache'
import { LIST_CACHE_POLICY, CACHE_TAGS } from '@/shared/lib/utils/cache-config'
import { logger } from '@/shared/lib/utils/logger'

/**
 * 获取当前用户的角色信息
 * 从用户 store 或 context 中获取
 */
function getCurrentRole(): string {
  // TODO: 从实际的用户状态中获取角色
  // const userStore = useUserStore()
  // return userStore.currentRole || 'guest'
  return 'guest'
}

/**
 * 获取当前用户的组织ID
 */
function getCurrentOrgId(): number | undefined {
  // TODO: 从实际的用户状态中获取组织ID
  // const userStore = useUserStore()
  // return userStore.orgId
  return undefined
}

export async function queryIndicators(
  filters?: IndicatorFilters
): Promise<PaginatedResponse<Indicator>> {
  const orgId = getCurrentOrgId()
  const role = getCurrentRole()

  // 构建带上下文的缓存 key
  const cacheKey = buildQueryKey('indicator', 'list', {
    orgId,
    role,
    ...filters,  // 其他查询条件也加入 key
  })

  logger.debug('[Cache] Fetching indicator list', { key: cacheKey, filters })

  try {
    const response = await fetchWithCache({
      key: cacheKey,
      policy: {
        ...LIST_CACHE_POLICY,
        tags: [CACHE_TAGS.INDICATOR_LIST],
      },
      fetcher: async () => {
        const result = await apiClient.get<IndicatorListResponse>(
          '/indicators',
          filters as Record<string, unknown> | undefined
        )
        return result
      },
      onHit: (entry) => {
        logger.debug('[Cache] HIT for indicator list', {
          key: entry.key,
          expiresIn: entry.expiresAt - Date.now(),
        })
      },
    })

    const normalized = normalizeIndicatorList(unwrapData(response))
    logger.debug('[Cache] Indicator list fetched', {
      total: normalized.totalElements,
      fromCache: false, // fetchWithCache 可以返回来源标识
    })

    return normalized
  } catch (error) {
    logger.error('[Cache] Failed to fetch indicator list', error)
    throw error
  }
}
```

### 2.2 详情查询改造

**改造前**：

```typescript
export async function getIndicatorById(id: number): Promise<Indicator> {
  const response = await apiClient.get<IndicatorDetailResponse>(`/indicators/${id}`)
  return unwrapData(response)
}
```

**改造后**：

```typescript
export async function getIndicatorById(id: number): Promise<Indicator> {
  const cacheKey = buildQueryKey('indicator', 'detail', { id })

  logger.debug('[Cache] Fetching indicator detail', { key: cacheKey, id })

  try {
    const response = await fetchWithCache({
      key: cacheKey,
      policy: {
        ...DETAIL_CACHE_POLICY,
        tags: [CACHE_TAGS.INDICATOR_DETAIL],
      },
      fetcher: async () => {
        return await apiClient.get<IndicatorDetailResponse>(`/indicators/${id}`)
      },
      onHit: (entry) => {
        logger.debug('[Cache] HIT for indicator detail', {
          key: entry.key,
          expiresIn: entry.expiresAt - Date.now(),
        })
      },
    })

    const result = unwrapData(response)
    logger.debug('[Cache] Indicator detail fetched', { id })

    return result
  } catch (error) {
    logger.error('[Cache] Failed to fetch indicator detail', { id, error })
    throw error
  }
}
```

---

## 三、变更 API 改造模板

### 3.1 基础 Mutation 改造

**改造前**（`src/3-features/indicator/api/mutations.ts`）：

```typescript
export async function createIndicator(data: IndicatorCreateRequest): Promise<Indicator> {
  const response = await apiClient.post<IndicatorDetailResponse>('/indicators', data)
  return response.data
}

export async function updateIndicator(id: number, data: IndicatorUpdateRequest): Promise<Indicator> {
  const response = await apiClient.post<IndicatorDetailResponse>(`/indicators/${id}/breakdown`, data)
  return response.data
}

export async function distributeIndicator(id: number, request: DistributeRequest): Promise<DistributionResult> {
  const response = await apiClient.post<DistributionResponse>(`/indicators/${id}/distribute`, request)
  return response.data
}
```

**改造后**：

```typescript
import { invalidateQueries } from '@/shared/lib/utils/cache'
import { INVALIDATION_MAP, CACHE_TAGS } from '@/shared/lib/utils/cache-config'
import { logger } from '@/shared/lib/utils/logger'

/**
 * 失效缓存并记录日志
 */
function invalidateCacheWithLog(
  operation: string,
  tags: string[]
): void {
  logger.info(`[Cache] Invalidating after ${operation}`, { tags })
  const count = invalidateQueries(tags)
  logger.info(`[Cache] Invalidated ${count} entries`, { operation, tags })
}

export async function createIndicator(data: IndicatorCreateRequest): Promise<Indicator> {
  logger.info('[API] createIndicator', data)

  const response = await apiClient.post<IndicatorDetailResponse>('/indicators', data)
  const result = response.data

  // 写操作后立即失效缓存
  invalidateCacheWithLog('createIndicator', INVALIDATION_MAP.createIndicator)

  return result
}

export async function updateIndicator(
  id: number,
  data: IndicatorUpdateRequest
): Promise<Indicator> {
  logger.info('[API] updateIndicator', { id, data })

  const response = await apiClient.post<IndicatorDetailResponse>(
    `/indicators/${id}/breakdown`,
    data
  )
  const result = response.data

  // 失效列表和详情缓存
  invalidateCacheWithLog('updateIndicator', [
    ...INVALIDATION_MAP.updateIndicator,
  ])

  // 如果有具体的详情缓存 key，也要失效
  invalidateQueries(buildQueryKey('indicator', 'detail', { id }))

  return result
}

export async function distributeIndicator(
  id: number,
  request: DistributeRequest
): Promise<DistributionResult> {
  logger.info('[API] distributeIndicator', { id, request })

  const response = await apiClient.post<DistributionResponse>(
    `/indicators/${id}/distribute`,
    request
  )
  const result = response.data

  // 下发操作失效相关缓存
  invalidateCacheWithLog('distributeIndicator', [
    CACHE_TAGS.INDICATOR_LIST,
    CACHE_TAGS.INDICATOR_DETAIL,
  ])

  return result
}

export async function withdrawIndicator(id: number, reason?: string): Promise<void> {
  logger.info('[API] withdrawIndicator', { id, reason })

  await apiClient.post(`/indicators/${id}/withdraw`, { reason })

  // 撤回操作失效相关缓存
  invalidateCacheWithLog('withdrawIndicator', [
    CACHE_TAGS.INDICATOR_LIST,
    CACHE_TAGS.INDICATOR_DETAIL,
  ])
}
```

### 3.2 批量操作改造

```typescript
export async function batchDistributeIndicators(
  indicatorIds: number[],
  targetOrgIds: number[],
  deadline?: string
): Promise<DistributionResult> {
  logger.info('[API] batchDistributeIndicators', {
    indicatorIds,
    targetOrgIds,
    deadline,
  })

  const responses = await Promise.all(
    indicatorIds.map(indicatorId =>
      apiClient.post<DistributionResponse>(`/indicators/${indicatorId}/distribute`, {
        targetOrgIds,
        deadline,
      })
    )
  )

  const result = responses[0]?.data ?? ({ success: true } as unknown as DistributionResult)

  // 批量操作后失效缓存
  invalidateCacheWithLog('batchDistributeIndicators', [
    CACHE_TAGS.INDICATOR_LIST,
  ])

  // 失效所有相关详情缓存
  indicatorIds.forEach(id => {
    invalidateQueries(buildQueryKey('indicator', 'detail', { id }))
  })

  return result
}
```

---

## 四、Plan 模块改造示例

### 4.1 Plan Query 改造

```typescript
// src/3-features/plan/api/query.ts
import { fetchWithCache, buildQueryKey } from '@/shared/lib/utils/cache'
import { LIST_CACHE_POLICY, DETAIL_CACHE_POLICY, CACHE_TAGS } from '@/shared/lib/utils/cache-config'
import { logger } from '@/shared/lib/utils/logger'

export async function getAllPlans(): Promise<ApiResponse<Plan[]>> {
  const orgId = getCurrentOrgId()
  const role = getCurrentRole()

  return fetchWithCache({
    key: buildQueryKey('plan', 'list', { orgId, role }),
    policy: {
      ...LIST_CACHE_POLICY,
      tags: [CACHE_TAGS.PLAN_LIST],
    },
    fetcher: () => api.get('/plans'),
    onHit: (entry) => {
      logger.debug('[Cache] HIT for plan list', {
        key: entry.key,
        expiresIn: entry.expiresAt - Date.now(),
      })
    },
  })
}

export async function getPlanById(planId: number | string): Promise<ApiResponse<Plan>> {
  return fetchWithCache({
    key: buildQueryKey('plan', 'detail', { planId }),
    policy: {
      ...DETAIL_CACHE_POLICY,
      tags: [CACHE_TAGS.PLAN_DETAIL],
    },
    fetcher: () => api.get(`/plans/${planId}`),
    onHit: (entry) => {
      logger.debug('[Cache] HIT for plan detail', {
        key: entry.key,
        expiresIn: entry.expiresAt - Date.now(),
      })
    },
  })
}
```

### 4.2 Plan Mutations 改造

```typescript
// src/3-features/plan/api/mutations.ts
import { invalidateQueries, buildQueryKey } from '@/shared/lib/utils/cache'
import { INVALIDATION_MAP, CACHE_TAGS } from '@/shared/lib/utils/cache-config'
import { logger } from '@/shared/lib/utils/logger'

function invalidateCacheWithLog(operation: string, tags: string[]): void {
  logger.info(`[Cache] Invalidating after ${operation}`, { tags })
  const count = invalidateQueries(tags)
  logger.info(`[Cache] Invalidated ${count} entries`, { operation, tags })
}

export async function createPlan(data: Partial<Plan>): Promise<ApiResponse<Plan>> {
  logger.info('[API] createPlan', data)

  const result = await api.post('/plans', data)

  invalidateCacheWithLog('createPlan', INVALIDATION_MAP.createPlan)

  return result
}

export async function updatePlan(
  planId: number | string,
  data: Partial<Plan>
): Promise<ApiResponse<Plan>> {
  logger.info('[API] updatePlan', { planId, data })

  const result = await api.put(`/plans/${planId}`, data)

  invalidateCacheWithLog('updatePlan', INVALIDATION_MAP.updatePlan)
  invalidateQueries(buildQueryKey('plan', 'detail', { planId }))

  return result
}

export async function deletePlan(planId: number | string): Promise<ApiResponse<void>> {
  logger.info('[API] deletePlan', { planId })

  const result = await api.delete(`/plans/${planId}`)

  invalidateCacheWithLog('deletePlan', INVALIDATION_MAP.deletePlan)
  invalidateQueries(buildQueryKey('plan', 'detail', { planId }))

  return result
}

export async function submitPlanForApproval(
  planId: number | string,
  comment?: string
): Promise<ApiResponse<void>> {
  logger.info('[API] submitPlanForApproval', { planId, comment })

  const result = await api.post(`/plans/${planId}/publish`)

  invalidateCacheWithLog('submitPlanForApproval', INVALIDATION_MAP.submitPlanForApproval)

  return result
}
```

---

## 五、调试日志规范

### 5.1 日志级别

| 级别 | 用途 | 示例场景 |
|-----|------|---------|
| `debug` | 详细追踪 | 缓存命中、TTL 计算 |
| `info` | 关键操作 | 写操作、缓存失效 |
| `warn` | 潜在问题 | 缓存未命中但数据正常 |
| `error` | 错误 | 请求失败、数据异常 |

### 5.2 日志格式

```typescript
// 查询日志
logger.debug('[Cache] Fetching {resource} list', { key, filters })
logger.debug('[Cache] HIT for {resource} {type}', { key, expiresIn })
logger.info('[Cache] {resource} fetched', { total, fromCache })

// 写操作日志
logger.info('[API] {operation}', { params })
logger.info('[Cache] Invalidating after {operation}', { tags })
logger.info('[Cache] Invalidated {count} entries', { operation, tags })

// 错误日志
logger.error('[Cache] Failed to fetch {resource}', { params, error })
```

### 5.3 调试技巧

在浏览器控制台过滤缓存相关日志：

```javascript
// 只看缓存相关日志
localStorage.logFilter = '[Cache]'

// 查看缓存统计
import { cacheManager } from '@/shared/lib/utils/cache'
console.table(cacheManager.getStats())
```

---

## 六、实施检查清单

### Phase 1: 准备工作
- [x] 创建 `src/5-shared/lib/utils/cache-config.ts`
- [x] 定义 TTL 常量和策略工厂
- [ ] 定义 INVALIDATION_MAP
- [ ] 实现 `getCurrentRole()` 和 `getCurrentOrgId()` 工具函数

### Phase 2: Indicator 模块
- [ ] 改造 `indicator/api/query.ts`（列表 + 详情）
- [ ] 改造 `indicator/api/mutations.ts`（所有写操作）
- [ ] 添加缓存失效调用
- [ ] 添加调试日志

### Phase 3: Plan 模块
- [ ] 改造 `plan/api/query.ts`（列表 + 详情）
- [ ] 改造 `plan/api/mutations.ts`（所有写操作）
- [ ] 添加缓存失效调用
- [ ] 添加调试日志

### Phase 4: 测试验证
- [ ] 测试列表缓存命中
- [ ] 测试详情缓存命中
- [ ] 测试写操作后缓存失效
- [ ] 测试跨角色数据隔离
- [ ] 验证日志输出

---

## 七、常见问题

### Q1: 如何获取当前用户的角色和组织？

需要从用户状态管理中获取。如果项目使用了 Pinia store：

```typescript
// src/3-features/auth/model/store.ts 或类似位置
import { useAuthStore } from '@/features/auth/model/store'

function getCurrentRole(): string {
  const authStore = useAuthStore()
  return authStore.user?.role || 'guest'
}

function getCurrentOrgId(): number | undefined {
  const authStore = useAuthStore()
  return authStore.user?.orgId
}
```

### Q2: 是否需要缓存用户数据？

用户数据通常变化不频繁，但关系到权限判断，建议：
- 使用 `session` scope（当前项目已实施）
- 较长的 TTL（30分钟）
- 用户信息更新时主动失效

### Q3: 列表分页如何处理缓存？

分页参数应该包含在缓存 key 中：

```typescript
const cacheKey = buildQueryKey('indicator', 'list', {
  orgId,
  role,
  page: filters.page,
  size: filters.size,
})
```

这样不同页的数据会分别缓存，互不影响。

### Q4: 如何强制刷新缓存？

在需要强制刷新时，使用 `force: true` 参数：

```typescript
const response = await fetchWithCache({
  key: cacheKey,
  policy: LIST_CACHE_POLICY,
  fetcher: () => apiClient.get('/indicators'),
  force: true,  // 强制刷新，忽略缓存
})
```

或者直接失效后重新请求：

```typescript
invalidateQueries([CACHE_TAGS.INDICATOR_LIST])
// 下一次 fetchWithCache 会重新请求
```

---

## 八、总结

本缓存方案的核心设计原则：

1. **简单优先**：使用 `memory` scope，避免复杂的持久化和版本管理
2. **失效第一**：写操作后立即失效，确保数据一致性
3. **角色隔离**：不同角色的缓存独立，避免数据混乱
4. **可观测**：通过日志追踪缓存行为，便于调试

实施后的预期效果：

- 列表页切换：减少 90% 的重复请求
- 详情页返回：减少 80% 的重复请求
- 写操作后：立即看到最新数据（缓存失效）
