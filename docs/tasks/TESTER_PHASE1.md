# Tester - 阶段一任务卡

> **模块**: 测试与验证
> **工期**: 2周（主要在Week 2）
> **分支**: `refactor/phase1-emergency-fixes`
> **负责人**: Tester/QA

---

## 📋 任务概述

对阶段一的紧急修复进行全面测试验证，确保代码质量和功能正常。

---

## Week 1: 准备与辅助

### Day 1-2: 测试环境准备

#### 1. 创建测试目录结构

```bash
cd /Users/blackevil/Documents/前端架构测试/strategic-task-management
mkdir -p tests/phase1/{unit,integration,e2e}
```

#### 2. 准备测试数据

```bash
# 备份测试数据库
# 创建测试用户账号
# 准备测试用指标数据
```

#### 3. 编写测试计划

创建 `tests/phase1/test-plan.md`:

```markdown
# 阶段一测试计划

## 测试范围

1. Indicator模块合并
2. API客户端统一
3. 公共工具函数

## 测试类型

- 单元测试
- 集成测试
- 回归测试

## 测试环境

- 开发环境: localhost:5173
- 测试API: http://localhost:8080/api

## 测试数据

- 测试用户: test_user / test123
- 测试指标: 已准备10条测试数据
```

---

## Week 2: 测试执行

### Day 1: 单元测试

#### Task 1.1: API客户端测试

**创建 `tests/phase1/unit/api-client.test.ts`**:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApiClient, withRetry } from '@/shared/lib/api/client'
import axios from 'axios'

vi.mock('axios')

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createApiClient', () => {
    it('应该创建axios实例', () => {
      const client = createApiClient()
      expect(client).toBeDefined()
      expect(client.interceptors).toBeDefined()
    })

    it('应该添加请求拦截器', () => {
      const client = createApiClient()
      expect(client.interceptors.request.handlers).toHaveLength(1)
    })

    it('应该添加响应拦截器', () => {
      const client = createApiClient()
      expect(client.interceptors.response.handlers).toHaveLength(1)
    })
  })

  describe('withRetry', () => {
    it('应该重试5xx错误', async () => {
      const error = {
        config: {},
        response: { status: 500 }
      } as any

      const result = await withRetry(error)
      expect(result).toBe(true)
    })

    it('应该重试网络错误', async () => {
      const error = {
        config: {},
        response: undefined
      } as any

      const result = await withRetry(error)
      expect(result).toBe(true)
    })

    it('不应该重试4xx错误', async () => {
      const error = {
        config: {},
        response: { status: 400 }
      } as any

      const result = await withRetry(error)
      expect(result).toBe(false)
    })

    it('应该在最大重试次数后停止', async () => {
      const error = {
        config: { _retryCount: 3 },
        response: { status: 500 }
      } as any

      const result = await withRetry(error)
      expect(result).toBe(false)
    })
  })
})
```

#### Task 1.2: 工具函数测试

**创建 `tests/phase1/unit/utils.test.ts`**:

```typescript
import { describe, it, expect } from 'vitest'
import { getProgressStatus, getProgressColor, getProgressWidth } from '@/shared/lib/utils/progress'
import { getStatusTagType, getStatusText } from '@/shared/lib/utils/status'
import { formatDate, formatDateTime, formatRelativeTime } from '@/shared/lib/format/date'
import { formatNumber, formatPercent } from '@/shared/lib/format/number'

describe('Progress Utils', () => {
  describe('getProgressStatus', () => {
    it('100%应该返回success', () => {
      expect(getProgressStatus(100)).toBe('success')
    })

    it('小于30%应该返回danger', () => {
      expect(getProgressStatus(20)).toBe('danger')
    })

    it('30-60%应该返回warning', () => {
      expect(getProgressStatus(45)).toBe('warning')
    })

    it('60-100%应该返回normal', () => {
      expect(getProgressStatus(80)).toBe('normal')
    })
  })

  describe('getProgressColor', () => {
    it('应该返回正确的颜色', () => {
      expect(getProgressColor('success')).toBe('#67c23a')
      expect(getProgressColor('normal')).toBe('#409eff')
      expect(getProgressColor('warning')).toBe('#e6a23c')
      expect(getProgressColor('danger')).toBe('#f56c6c')
    })
  })
})

describe('Status Utils', () => {
  describe('getStatusTagType', () => {
    it('应该返回正确的标签类型', () => {
      expect(getStatusTagType('pending')).toBe('warning')
      expect(getStatusTagType('completed')).toBe('success')
      expect(getStatusTagType('failed')).toBe('danger')
    })
  })
})

describe('Date Utils', () => {
  describe('formatDate', () => {
    it('应该格式化日期', () => {
      const date = new Date('2025-03-15')
      expect(formatDate(date)).toBe('2025-03-15')
    })
  })

  describe('formatRelativeTime', () => {
    it('应该显示相对时间', () => {
      const now = new Date()
      expect(formatRelativeTime(now)).toBe('刚刚')
    })
  })
})
```

#### Task 1.3: 运行单元测试

```bash
# 运行所有测试
npm run test

# 运行特定测试文件
npm run test -- tests/phase1/unit/

# 生成覆盖率报告
npm run test:coverage

# 查看覆盖率
open coverage/index.html
```

**验收标准**:

- [ ] 所有单元测试通过
- [ ] 测试覆盖率 > 80%
- [ ] 无测试警告

---

### Day 2-3: 回归测试

#### Task 2.1: 功能测试清单

**创建 `tests/phase1/e2e/checklist.md`**:

```markdown
# 回归测试清单

## 认证模块

- [ ] 登录功能正常
- [ ] 登出功能正常
- [ ] Token刷新正常
- [ ] 权限验证正常

## 仪表盘

- [ ] 仪表盘加载正常
- [ ] 数据显示正确
- [ ] 图表渲染正常
- [ ] 刷新功能正常

## 指标模块

- [ ] 指标列表加载
- [ ] 指标搜索功能
- [ ] 指标过滤功能
- [ ] 指标详情查看
- [ ] 指标创建功能
- [ ] 指标编辑功能
- [ ] 指标删除功能
- [ ] 指标下发功能

## 计划模块

- [ ] 计划列表加载
- [ ] 计划详情查看
- [ ] 计划树展开/收起

## 任务模块

- [ ] 任务列表加载
- [ ] 任务状态更新

## 审批模块

- [ ] 待审批列表
- [ ] 审批通过
- [ ] 审批拒绝
```

#### Task 2.2: 手动测试步骤

```bash
# 1. 启动开发服务器
npm run dev

# 2. 打开浏览器
open http://localhost:5173

# 3. 按照测试清单逐项测试

# 4. 记录测试结果
```

#### Task 2.3: 自动化测试（如有E2E框架）

```bash
# 运行E2E测试
npm run test:e2e

# 运行特定测试
npm run test:e2e -- indicator.spec.ts
```

**验收标准**:

- [ ] 所有核心功能测试通过
- [ ] 无功能退化
- [ ] 性能无明显下降

---

### Day 4: 问题跟踪与验证

#### Task 3.1: 创建问题报告

**创建 `docs/tasks/issues.md`**:

```markdown
# 阶段一问题报告

## 问题列表

### P0 - 阻塞性问题

| ID   | 标题            | 发现者 | 状态     | 修复者       |
| ---- | --------------- | ------ | -------- | ------------ |
| I001 | XXX功能无法使用 | Tester | 🔄修复中 | Programmer A |

### P1 - 重要问题

| ID   | 标题        | 发现者 | 状态     | 修复者       |
| ---- | ----------- | ------ | -------- | ------------ |
| I002 | XXX显示错误 | Tester | ⏳待修复 | Programmer B |

### P2 - 一般问题

| ID   | 标题        | 发现者 | 状态     | 修复者 |
| ---- | ----------- | ------ | -------- | ------ |
| I003 | XXX样式问题 | Tester | 📝已记录 | -      |

## 问题统计

- P0: 1个
- P1: 2个
- P2: 3个
- 总计: 6个
```

#### Task 3.2: 验证修复

对于每个修复的问题：

1. 获取修复的commit hash
2. 拉取最新代码
3. 重新测试相关功能
4. 更新问题状态

---

### Day 5: 阶段验收

#### Task 4.1: 生成测试报告

**创建 `docs/tasks/phase1-test-report.md`**:

```markdown
# 阶段一测试报告

## 测试概况

- 测试周期: 2025-03-15 ~ 2025-03-22
- 测试人员: Tester
- 测试环境: 开发环境

## 测试结果

### 单元测试

- 测试用例: 45个
- 通过: 45个
- 失败: 0个
- 覆盖率: 85%

### 集成测试

- 测试场景: 12个
- 通过: 12个
- 失败: 0个

### 回归测试

- 测试功能: 25个
- 通过: 24个
- 失败: 1个

### 问题统计

- P0: 0个
- P1: 1个
- P2: 3个
- 总计: 4个

## 结论

✅ 阶段一测试通过，可以进入下一阶段

## 遗留问题

1. XXX问题将在阶段二修复
2. YYY问题已记录，后续优化
```

#### Task 4.2: 验收会议准备

准备以下材料：

1. 测试报告
2. 问题清单
3. 功能演示准备
4. 改进建议

---

## ✅ 验收标准

### 测试覆盖

- [ ] 单元测试覆盖率 > 80%
- [ ] 所有核心功能有测试用例
- [ ] API测试覆盖完整

### 功能验证

- [ ] 所有回归测试通过
- [ ] 无P0级别问题
- [ ] P1级别问题 < 2个

### 文档

- [ ] 测试报告完整
- [ ] 问题清单更新
- [ ] 测试用例文档化

---

## 🚨 问题上报流程

### 发现问题时

1. **立即记录**

   ```bash
   # 创建问题记录
   echo "I00X: 问题描述" >> docs/tasks/issues.md
   ```

2. **评估严重性**
   - P0: 阻塞开发，立即上报
   - P1: 影响功能，当天内上报
   - P2: 优化项，记录即可

3. **通知开发者**
   ```markdown
   @programmer-a 发现问题I001，请查看
   问题描述：XXX
   复现步骤：XXX
   ```

### 验证修复后

1. 重新测试
2. 更新问题状态
3. 通知团队

---

## 📝 每日报告模板

### Day 1 报告

```
✅ 完成：测试环境准备
📁 创建目录：tests/phase1/
📋 编写计划：测试计划文档
📅 明日计划：开始单元测试
```

### Day 2 报告

```
✅ 完成：单元测试
🧪 测试用例：45个
📊 覆盖率：85%
🐛 发现问题：2个
📅 明日计划：回归测试
```

### Day 3 报告

```
✅ 完成：回归测试
✅ 通过功能：24/25
❌ 失败功能：1个
🐛 新发现问题：2个
📅 明日计划：问题验证
```

### Day 4 报告

```
✅ 完成：问题验证
🔄 修复中：1个
✅ 已修复：3个
📝 已记录：2个
📅 明日计划：验收准备
```

### Day 5 报告

```
✅ 完成：阶段验收
📊 测试报告：已完成
🎯 验收状态：通过
📈 质量评估：良好
📅 后续计划：阶段二准备
```

---

## 📚 相关文档

- [重构方案总览](../前端渐进式重构方案.md)
- [团队协调文档](./TEAM_COORDINATION.md)
- [Programmer A任务卡](./PROGRAMMER_A_PHASE1.md)
- [Programmer B任务卡](./PROGRAMMER_B_PHASE1.md)
