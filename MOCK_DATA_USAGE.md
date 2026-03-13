# SISM Mock 数据使用指南

## 概述

我们已经成功建立了完整的 Mock 数据系统，数据与后端完全对齐，可以独立于后端进行前端开发和测试。

## 快速开始

### 启用 Mock 模式

在 `.env` 文件中设置：

```env
VITE_USE_MOCK=true
```

然后启动开发服务器：

```bash
npm run dev
```

启动时会看到控制台输出：

```
🎭 [Mock Mode] Using local mock data
```

## 已创建的 Mock 数据

### 1. 用户数据 (`mockUsers.ts`

包含 5 个测试用户：

| 用户名 | 姓名 | 角色 | 部门 |
|--------|------|------|------|
| admin | 系统管理员 | 战略发展部 | strategic_dept |
| kychu | 张三 | 职能部门 | 科研处 |
| jsxy | 李四 | 二级学院 | 计算机学院 |
| jiaowuchu | 王五 | 职能部门 | 教务处 |
| xueshengchu | 赵六 | 职能部门 | 学生处 |

### 2. 评估周期数据 (`mockAssessmentCycles.ts`)

- 2025-2026 学年第一学期 (active)
- 2025-2026 学年第二学期 (pending)
- 2025 年度考核 (active)

### 3. 战略任务数据 (`mockStrategicTasks.ts`)

5 个战略任务：
1. 科研项目申报与管理 (科研处)
2. 教学质量提升工程 (教务处)
3. 人才培养质量提升 (学生处)
4. 师资队伍建设 (人事处)
5. 校园基础设施建设 (后勤处)

### 4. 指标数据 (`mockIndicators.ts`)

8 个战略指标，包括：
- 国家级项目立项数 (科研处, 75% 进度)
- 科研经费到账额 (科研处, 80% 进度, 待审批)
- 课程满意度 (教务处, 85% 进度)
- 就业率 (学生处, 70% 进度, 待审批)
- 人才引进完成率 (人事处, 55% 进度)
- 高质量论文发表数 (科研处, 90% 进度)
- 精品课程建设数量 (教务处, 60% 进度)
- 实验室建设项目完成率 (后勤处, 40% 进度)

### 5. 里程碑数据 (`mockMilestones.ts`)

19 个里程碑，与指标关联，包含：
- 已完成的里程碑
- 进行中的里程碑
- 待完成的里程碑

## 业务场景

### 场景 1: 完整的审批流程

指标"人才引进完成率"包含完整的审计日志：
1. 提交进度 (DRAFT → PENDING)
2. 审批拒绝 (PENDING → REJECTED)
3. 更新后重新提交 (REJECTED → PENDING)
4. 最终审批通过 (PENDING → APPROVED)

### 场景 2: 待审批数据

指标"科研经费到账额"和"就业率"处于待审批状态，可用于测试审批功能。

### 场景 3: 草稿状态

指标"实验室建设项目完成率"处于草稿状态。

## 支持的 API 接口

### 认证接口
- `POST /auth/login` - 用户登录
- `GET /auth/info` - 获取用户信息
- `POST /auth/logout` - 退出登录

### 评估周期接口
- `GET /api/assessment-cycles` - 获取评估周期列表
- `GET /api/assessment-cycles/:id` - 获取单个评估周期

### 战略任务接口
- `GET /api/strategic-tasks` - 获取战略任务列表
- `GET /api/strategic-tasks/:id` - 获取单个战略任务
- `POST /api/strategic-tasks` - 创建战略任务
- `PUT /api/strategic-tasks/:id` - 更新战略任务
- `DELETE /api/strategic-tasks/:id` - 删除战略任务

### 指标接口
- `GET /api/indicators` - 获取指标列表（支持 taskId, status, responsibleDept 过滤）
- `GET /api/indicators/:id` - 获取单个指标（含关联里程碑）
- `POST /api/indicators` - 创建指标
- `PUT /api/indicators/:id` - 更新指标
- `DELETE /api/indicators/:id` - 删除指标

### 里程碑接口
- `GET /api/milestones` - 获取里程碑列表
- `GET /api/milestones/:id` - 获取单个里程碑
- `POST /api/milestones` - 创建里程碑
- `PUT /api/milestones/:id` - 更新里程碑
- `DELETE /api/milestones/:id` - 删除里程碑

### 其他接口
- `GET /api/orgs` - 获取组织架构
- `GET /api/system/announcement` - 获取系统公告
- `GET /api/dashboard` - 获取仪表板数据
- `GET /api/dashboard/overview` - 获取概览数据
- `GET /api/dashboard/department-progress` - 获取部门进度
- `GET /api/dashboard/recent-activities` - 获取最近活动

## 测试登录账号

| 用户名 | 密码 | 说明 |
|--------|------|------|
| admin | 任意 | 战略发展部用户 |
| kychu | 任意 | 科研处用户 |
| jsxy | 任意 | 计算机学院用户 |
| jiaowuchu | 任意 | 教务处用户 |
| xueshengchu | 任意 | 学生处用户 |

## 文件结构

```
src/shared/api/mocks/
├── data.ts                           # 数据导出和响应生成器
├── handler.ts                        # API 路由处理器
├── mockApiPlugin.ts                 # Vite 插件
├── mockApiMiddleware.ts            # Express 中间件
└── fixtures/
│   ├── index.ts                   # 统一导出
│   ├── mockUsers.ts            # 用户数据
│   ├── mockAssessmentCycles.ts   # 评估周期数据
│   ├── mockStrategicTasks.ts     # 战略任务数据
│   ├── mockIndicators.ts         # 指标数据
│   ├── mockMilestones.ts         # 里程碑数据
│   └── mockDashboardData.ts      # 仪表板数据生成器
```

## 与后端对齐说明

### 类型定义

所有 Mock 数据严格使用 `src/types/entities.ts` 中定义的类型，确保：

- 字段名与后端完全一致（如 `dueDate` 而非 `deadline`）
- 枚举值与后端完全一致
- API 响应格式与后端一致

### API 响应格式

```typescript
{
  code: 200,
  success: true,
  data: T | null,
  message: string,
  timestamp: number
}
```

### 分页响应格式

```typescript
{
  code: 200,
  success: true,
  data: {
    content: T[],
    pageNumber: number,
    pageSize: number,
    totalElements: number,
    totalPages: number,
    hasNext: boolean,
    hasPrevious: boolean
  },
  message: string,
  timestamp: number
}
```

## 切换到真实后端

当后端开发完成后，只需修改 `.env` 文件：

```env
VITE_USE_MOCK=false
VITE_API_TARGET=http://localhost:8080  # 改为实际后端地址
```

## 自定义 Mock 数据

### 添加新的指标

编辑 `src/shared/api/mocks/fixtures/mockIndicators.ts`:

```typescript
{
  indicatorId: 9,
  taskId: 2,
  indicatorName: '新指标名称',
  // ... 其他字段
}
```

### 添加新的 API 接口

编辑 `src/shared/api/mocks/handler.ts` 的 `MockApiHandler.handleRequest` 方法中添加新的路由处理。
