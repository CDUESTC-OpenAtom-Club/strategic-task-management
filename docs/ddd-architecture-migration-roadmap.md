# SISM 前端 DDD 架构迁移路线图

## 概述

本文档概述了将当前前端架构从 Feature-Sliced Design (FSD) 向 Domain-Driven Design (DDD) 架构迁移的路线图。

## 当前架构状态

### 现有架构 (FSD)
```
src/
├── features/          # 功能模块
│   ├── auth/
│   ├── dashboard/
│   ├── indicator/
│   └── task/
├── entities/          # 实体定义
│   ├── user/
│   ├── indicator/
│   └── milestone/
├── shared/            # 共享代码
│   ├── api/
│   ├── lib/
│   └── ui/
└── pages/             # 页面
```

### 优势
- 清晰的功能边界
- 良好的代码组织
- 易于理解和维护

## DDD 架构目标

### 目标架构 (DDD + FSD 混合)
```
src/
├── bounded-contexts/      # 限界上下文
│   ├── auth/             # 认证上下文
│   │   ├── domain/       # 领域层
│   │   │   ├── model/
│   │   │   └── service/
│   │   ├── application/  # 应用层
│   │   │   ├── use-cases/
│   │   │   └── dto/
│   │   ├── infrastructure/ # 基础设施层
│   │   │   ├── api/
│   │   │   └── persistence/
│   │   └── interfaces/   # 接口层
│   │       ├── components/
│   │       └── pages/
│   ├── strategy/         # 战略规划上下文
│   ├── execution/        # 执行管理上下文
│   ├── organization/     # 组织管理上下文
│   └── workflow/         # 工作流上下文
├── shared-kernel/        # 共享内核
│   ├── domain/
│   ├── infrastructure/
│   └── ui/
└── config/              # 配置
```

## 迁移阶段

### 阶段 1: 准备阶段 (Week 1-2)
- [ ] 完成当前架构文档
- [ ] 定义限界上下文边界
- [ ] 创建 DDD 架构模板
- [ ] 培训团队熟悉 DDD 概念

### 阶段 2: 共享内核重构 (Week 3-4)
- [ ] 提取共享类型定义
- [ ] 创建共享基础设施
- [ ] 统一 API 客户端
- [ ] 建立共享组件库

### 阶段 3: 认证上下文迁移 (Week 5-6)
- [ ] 重构认证模块
- [ ] 实现领域模型
- [ ] 创建应用服务
- [ ] 迁移认证页面和组件

### 阶段 4: 组织管理上下文迁移 (Week 7-8)
- [ ] 重构组织管理模块
- [ ] 实现组织领域模型
- [ ] 创建组织应用服务
- [ ] 迁移组织管理页面

### 阶段 5: 战略规划上下文迁移 (Week 9-12)
- [ ] 重构战略规划模块
- [ ] 实现战略领域模型
- [ ] 创建战略应用服务
- [ ] 迁移战略规划页面

### 阶段 6: 执行管理上下文迁移 (Week 13-16)
- [ ] 重构执行管理模块
- [ ] 实现执行领域模型
- [ ] 创建执行应用服务
- [ ] 迁移执行管理页面

### 阶段 7: 工作流上下文迁移 (Week 17-20)
- [ ] 重构工作流模块
- [ ] 实现工作流领域模型
- [ ] 创建工作流应用服务
- [ ] 迁移工作流页面

### 阶段 8: 集成和测试 (Week 21-24)
- [ ] 集成所有上下文
- [ ] 端到端测试
- [ ] 性能优化
- [ ] 文档完善

## 关键原则

### 1. 渐进式迁移
- 保持现有功能正常运行
- 每次只迁移一个模块
- 充分测试后再继续

### 2. 兼容性
- 保持 API 兼容性
- 提供适配器层
- 支持新旧模块共存

### 3. 质量保证
- 保持高测试覆盖率
- 代码审查
- 持续集成

## 限界上下文定义

### 1. Auth Context (认证上下文)
- 职责: 用户认证、授权、会话管理
- 核心概念: User, Role, Permission, Session, Token
- API: `/api/auth/*`

### 2. Organization Context (组织管理上下文)
- 职责: 组织、用户、角色管理
- 核心概念: Organization, User, Role, Department
- API: `/api/users/*`, `/api/roles/*`, `/api/orgs/*`

### 3. Strategy Context (战略规划上下文)
- 职责: 战略计划、指标定义、周期管理
- 核心概念: StrategicPlan, Indicator, AssessmentCycle, Milestone
- API: `/api/plans/*`, `/api/indicators/*`, `/api/cycles/*`

### 4. Execution Context (执行管理上下文)
- 职责: 任务执行、进度填报、报告生成
- 核心概念: Task, ProgressReport, Milestone, Attachment
- API: `/api/tasks/*`, `/api/reports/*`

### 5. Workflow Context (工作流上下文)
- 职责: 审批流程、工作流定义、通知
- 核心概念: Workflow, Approval, AuditLog, Notification
- API: `/api/workflows/*`, `/api/approvals/*`

## 成功指标

### 1. 代码质量
- 测试覆盖率 > 80%
- 代码重复率 < 5%
- 无严重代码异味

### 2. 架构指标
- 限界上下文内聚性 > 0.8
- 限界上下文耦合性 < 0.3
- 领域逻辑纯度 > 90%

### 3. 业务指标
- 功能交付速度提升 30%
- Bug 修复速度提升 40%
- 新功能开发周期缩短 25%

## 风险与缓解

### 风险 1: 迁移时间过长
- 缓解: 分阶段交付，每个阶段都有可用的功能

### 风险 2: 团队学习曲线
- 缓解: 提前培训，结对编程，代码审查

### 风险 3: 功能回归
- 缓解: 完善的测试套件，自动化回归测试

### 风险 4: 性能下降
- 缓解: 性能基准测试，持续监控

## 总结

本路线图提供了一个结构化的迁移路径，将当前 FSD 架构逐步演进为更加模块化、可维护的 DDD 架构。通过分阶段迁移，可以最小化风险，确保业务连续性。

**预计总时间: 24 周**
