# 团队协作手册 - Pages重构任务

> **目标**: 协调团队完成Pages重构
> **期限**: 1-2周
> **开始日期**: 待定

---

## 📋 团队信息

### 联系图

```
                  ┌─────────────────────────────────┐
                  │         Tech Lead         │
                  │   (协调/决策)          │
                  └─────────────────────────────────┘
         ┌───────────────────────────────────┐
         │    Code Reviewer            │
         │   (审查批准)            │
         └───────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  Programmer A  │  Programmer B  │  Programmer C  │
└─────────────────────────────────────────────┘
│  高优级Pages  │  Dashboard+Plan │ 其他Pages   │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  QA Engineer    │                 │
│   (测试验证)    │                 │
└─────────────────────────────────────────────┘
```

### 通信渠道

| 渠道      | 用途         |
| --------- | ------------ |
| 每日站会  | 每日进度同步 |
| GitHub PR | 代码审查     |
| Slack/IM  | 即时问题沟通 |
| Email     | 重要公告     |

---

## 📅 开发流程

### 1. 准备阶段（第1-2天）

**Day 1**: 项目准备

- [x] Tech Lead: 创建协作文档
- [x] Tech Lead: 创建开发分支
- [x] 全员: 拉取最新代码
- [ ] QA Engineer: 准备测试环境

**Day 2**: 任务分配

- [x] Tech Lead: 分配详细任务
- [ ] Programmer A: 领取T2-01~T2-04
- [ ] Programmer B: 颡取T2-05~T2-10
- [ ] Programmer C: 颡取T2-11~T2-16
- [ ] 全员: 创建个人分支

### 2. 并行开发（第3-7天）

**Week 1**: 高优级Pages（第3-5天）

- Day 3-4: Programmer A 完成T2-01
- Day 5: Programmer B 完成T2-05
- Day 6-7: Programmer C 完成部分任务
- Day 8-9: 完成剩余任务

**Week 2**: 其他Pages（第2天）

- Day 10: Programmer B 完成任务
- Day 11: Programmer C 完成剩余任务

### 3. 代码审查与合并（第8天）

**Day 8**: Code Reviewer审查所有PR

- Day 9: Tech Lead 批准合并

### 4. 验收阶段（第9-10天）

**Day 9**: QA Engineer执行验收测试

- Day 10: Tech Lead 确准验收

### 5. 上线准备（第11天）

- [x] Tech Lead: 准备上线
- [x] 全员: 更新文档
- [ ] QA Engineer: 验收测试

---

## 📅 每日站会流程

### 时间

每天上午9:30-30，持续15分钟

### 议程

1. **进度同步**（每人2分钟）
   - 昨天完成的任务
   - 当前进行的任务
   - 遇到的阻碍

2. **问题讨论**（剩余时间）
   - 共性问题汇总
   - 技术难点分享
   - 解决方案讨论

3. **明日计划**（最后5分钟）
   - 每人明日任务
   - 预计依赖关系
   - 识别潜在风险

### Tech Lead职责

- 协调会议进度
- 识别和解决阻塞
- 做提供技术决策
- 确保团队协作顺畅

---

## 📋 每周总结会议

### 时间

每周五下午4:00，持续30分钟

### 议程

1. **本周回顾**（10分钟）
   - 完成的任务
   - 遇成质量
   - 遇到的经验

2. **问题复盘**（10分钟）
   - 发生的问题
   - 解决方案总结
   - 避免措施

3. **下周计划**（10分钟）
   - 下周任务优先级
   - 资源调配
   - 风险识别

### Tech Lead决策

- 评估整体进度
- 决定下周工作重点
- 必要时调整资源

---

## 📋 代码审查流程

### 审查时机

每个PR创建后立即开始审查，审查时间不超过2小时。

### 审查标准

参考: `docs/tasks/CODE_REVIEW_GUIDE.md`

### 审查结果

**通过**: 批准合并到主分支
**修改请求**: 在PR中提出具体修改
**拒绝**: 说明拒绝原因，等待修改

---

## 📋 验收流程

### 验收时机

所有PR合并到主分支后，由QA Engineer执行验收测试。

### 验收标准

参考: `docs/tasks/QA_ACCEPTANCE_PLAN.md`

### 验收结果

**通过**: 验收通过，可以上线
**失败**: 记录问题，等待修复

---

## 📋 冲突处理

### 问题分类

**P0 - 阻塞性问题**

- 影响项目运行
- �即停止当前开发
- 立即上报Tech Lead

**P1 - 重要问题**

- 影响功能实现
- 在每日站会中优先讨论

**P2 - 一般问题**

- 不影响主流程
- 在每日站会中记录

### 问题上报流程

1. **发现问题**
   - 评估问题严重性
   - 选择合适渠道上报

2. **等待响应**
   - Tech Lead在2小时内响应

3. **问题解决**
   - 开发者解决
   - 验证修复效果

---

## 📋 Git工作流

### 分支策略

```bash
# 主分支
main

# 工作分支
refactor/phase2-pages-continue

# 程序员个人分支
refactor/phase2-pages-continue-programmer-a
refactor/phase2-pages-continue-programmer-b
refactor/phase2-pages-continue-programmer-c
```

### 提交流流程

#### 1. 准备工作分支

```bash
# 每个人创建个人分支
git checkout -b refactor/phase2-pages-continue
git push -u origin refactor/phase2-pages-continue-programmer-x
```

#### 2. 完成任务

```bash
# Programmer A
git checkout refactor/phase2-pages-continue-programmer-a
git rebase origin/refactor/phase2-pages-continue-programmer-x
# 完成开发...
git add .
git commit -m "refactor: 完成 IndicatorDistributePage重构"
git push -u origin refactor/phase2-pages-continue-programmer-a
```

#### 3. 创建PR

```bash
# 创建PR
gh pr create \\
  --title "refactor: IndicatorDistributePage重构" \\
  --base refactor/phase2-pages-continue \\
  --head refactor/phase2-pages-continue-programmer-a \\
  --repo CDUESTC-OpenAtom-Club/strategic-task-management \\
  --body "请审查Pages重构" \\
  --assign reviewer-a
```

#### 4. 审查通过合并

```bash
# Code Reviewer审查PR
# 审查通过后
git checkout main
git merge refactor/phase2-pages-continue-programmer-a --no-ff
git push
```

#### 5. 验收

```bash
# QA Engineer验证
# 所有PR合并后
# 执行验收测试
```

---

## 📋 质量控制

### 任务量管理

**每日目标**:

- Programmer A: 完成2-3个Pages
- Programmer B: 完成2-3个Pages
- Programmer C: 完成3-5个Pages

**每日检查**:

- Tech Lead 每天检查任务进度
- 发现滞后的任务
- 必要时提供帮助

### 质量平衡

**预警机制**:

- 连续2天无提交 → 检查原因
- 连续3天无进展 → Tech Lead主动沟通

---

## 📋 成功标准

### 代码质量

- [x] Pages < 100行
- [x] 无业务逻辑
- [x] TypeScript类型安全
- [x] ESLint 0错误

### 功能完整性

- [x] 所有页面功能正常
- [x] 路由导航正常
- [x] 权限验证正确

### 验收通过

- [x] 所有测试通过

### Git规范

- [x] 提交信息规范
- [x] PR通过代码审查
- [x] 分支管理清晰

---

**创建时间**: 2025-03-15
**版本**: v1.0
