# SISM 前端 Mock 数据生成规划

## 项目现状分析

### 1. 现有 Mock 数据结构

项目已经有一个基本的 Mock 数据系统，但存在以下问题：

#### 现有文件结构：
```
src/mock/
├── index.ts                    # Mock 模块入口（已废弃，推荐使用 shared/api/mocks）
├── handler.ts                  # Mock API 路由处理器
├── data.ts                     # 核心 Mock 数据（包含用户、指标、任务、里程碑）
├── mockApiPlugin.ts            # Vite 开发服务器 Mock 插件
├── mockApiMiddleware.ts        # Express 风格的 Mock 中间件
└── fixtures/
    ├── mockData.ts             # 旧版数据（已废弃）
    ├── mockIndicators.ts       # 旧版指标数据
    └── indicators/
        ├── index.ts
        ├── indicators2023.ts
        ├── indicators2024.ts
        ├── indicators2025.ts
        └── indicators2026.ts
```

#### Shared API Mock（推荐）：
```
src/shared/api/mocks/
├── index.ts
├── mockApiPlugin.ts
├── mockApiMiddleware.ts
└── fixtures/
    ├── mockData.ts
    └── mockIndicators.ts
```

### 2. 问题分析

1. **数据结构不一致**：现有 `mock/data.ts` 使用旧的类型定义（如 `StrategicIndicator`），与 `src/types/entities.ts` 中的后端对齐类型不匹配
2. **字段不匹配**：
   - 后端用 `dueDate`，Mock 数据用 `deadline`
   - 后端用 `milestoneId`，Mock 数据用 `id`
   - 后端用 `progress`（百分比），Mock 数据混用各种格式
3. **API 响应格式不统一**：Mock 数据返回格式与实际后端 API 响应不一致
4. **数据完整性不足**：缺乏关联数据（如指标与任务、任务与里程碑的关联）
5. **业务逻辑不符**：Mock 数据没有体现真实的业务场景

---

## 规划目标

### 1. 核心原则

- **与后端完全对齐**：使用 `src/types/entities.ts` 中定义的类型
- **业务真实性**：数据要符合高校战略指标管理的真实场景
- **完整性**：包含所有实体类型及其关联关系
- **一致性**：API 响应格式与后端完全一致
- **可扩展性**：便于后续添加新的 Mock 数据

### 2. 具体目标

1. 重写所有 Mock 数据，使用正确的实体类型
2. 确保数据之间的关联关系（任务 → 指标 → 里程碑）
3. 添加真实的业务场景数据
4. 统一 API 响应格式
5. 优化 Mock 数据的维护性

---

## 实施计划

### 阶段一：基础架构优化（立即执行）

#### 1. 更新 Mock 数据类型

**文件：** `src/shared/api/mocks/fixtures/mockData.ts`

- 替换所有类型导入为正确的实体类型
- 确保字段名与后端完全对齐

```typescript
// 替换前
import type { StrategicIndicator, Task, Milestone, ApprovalStatus } from '@/types'

// 替换后
import type {
  StrategicTask,
  Indicator,
  Milestone,
  User,
  AssessmentCycle,
  ProgressReport,
  TaskType,
  MilestoneStatus,
  ProgressApprovalStatus,
  IndicatorStatus
} from '@/types/entities'
```

#### 2. 统一 API 响应格式

**文件：** `src/shared/api/mocks/fixtures/mockData.ts`

确保所有响应符合后端 `ApiResponse<T>` 格式：

```typescript
import type { ApiResponse, PageResponse } from '@/types/entities'

export function createMockResponse<T>(data: T, message = '操作成功'): ApiResponse<T> {
  return {
    code: 200,
    success: true,
    data,
    message,
    timestamp: Date.now()
  }
}

export function createMockPageResponse<T>(data: T[], page = 1, pageSize = 10): ApiResponse<PageResponse<T>> {
  const total = data.length
  const start = (page - 1) * pageSize
  const end = start + pageSize

  return {
    code: 200,
    success: true,
    data: {
      content: data.slice(start, end),
      pageNumber: page,
      pageSize: pageSize,
      totalElements: total,
      totalPages: Math.ceil(total / pageSize),
      hasNext: page * pageSize < total,
      hasPrevious: page > 1
    },
    message: '操作成功',
    timestamp: Date.now()
  }
}
```

### 阶段二：核心实体数据生成（高优先级）

#### 1. 评估周期数据

**文件：** `src/shared/api/mocks/fixtures/mockAssessmentCycles.ts`

```typescript
import type { AssessmentCycle } from '@/types/entities'

export const mockAssessmentCycles: AssessmentCycle[] = [
  {
    cycleId: 1,
    cycleName: '2025-2026 学年第一学期',
    startDate: '2025-09-01',
    endDate: '2026-01-15',
    status: 'active',
    createdAt: '2025-08-20T09:00:00Z',
    updatedAt: '2025-08-20T09:00:00Z'
  },
  {
    cycleId: 2,
    cycleName: '2025-2026 学年第二学期',
    startDate: '2026-02-20',
    endDate: '2026-07-10',
    status: 'pending',
    createdAt: '2025-08-20T09:00:00Z',
    updatedAt: '2025-08-20T09:00:00Z'
  }
]
```

#### 2. 战略任务数据

**文件：** `src/shared/api/mocks/fixtures/mockStrategicTasks.ts`

```typescript
import type { StrategicTask, TaskType } from '@/types/entities'

export const mockStrategicTasks: StrategicTask[] = [
  {
    taskId: 1,
    cycleId: 1,
    taskName: '科研项目申报与管理',
    taskDesc: '负责组织和管理全校科研项目的申报、立项、中期检查和结题工作',
    taskType: '定量' as TaskType,
    responsibleDept: '科研处',
    weight: 30,
    targetValue: 100,
    createdAt: '2025-09-01T09:00:00Z',
    updatedAt: '2025-10-15T14:30:00Z'
  },
  {
    taskId: 2,
    cycleId: 1,
    taskName: '教学质量提升工程',
    taskDesc: '提升教学质量，包括课程建设、教学改革、实践教学等',
    taskType: '定性' as TaskType,
    responsibleDept: '教务处',
    weight: 25,
    targetValue: null,
    createdAt: '2025-09-01T09:00:00Z',
    updatedAt: '2025-11-20T10:15:00Z'
  }
]
```

#### 3. 指标数据

**文件：** `src/shared/api/mocks/fixtures/mockIndicators.ts`

```typescript
import type { Indicator, ProgressApprovalStatus, IndicatorStatus } from '@/types/entities'

export const mockIndicators: Indicator[] = [
  {
    indicatorId: 1,
    taskId: 1,
    indicatorName: '国家级项目立项数',
    indicatorDesc: '年度国家级科研项目立项数量',
    indicatorType1: '科研',
    indicatorType2: '项目',
    isStrategic: true,
    responsibleDept: '科研处',
    responsiblePerson: '张三',
    weight: 40,
    progress: 75,
    targetValue: 20,
    actualValue: 15,
    unit: '项',
    year: 2025,
    ownerDept: '科研处',
    parentIndicatorId: null,
    progressApprovalStatus: 'APPROVED' as ProgressApprovalStatus,
    pendingProgress: null,
    pendingRemark: null,
    statusAudit: [
      {
        auditId: 1,
        timestamp: '2025-10-01T09:00:00Z',
        operator: 'admin',
        operatorName: '系统管理员',
        operatorDept: '战略发展部',
        action: 'submit',
        comment: '提交进度',
        previousStatus: 'DRAFT',
        newStatus: 'PENDING',
        previousProgress: 0,
        newProgress: 50
      },
      {
        auditId: 2,
        timestamp: '2025-10-05T14:30:00Z',
        operator: 'admin',
        operatorName: '系统管理员',
        operatorDept: '战略发展部',
        action: 'approve',
        comment: '进度正常',
        previousStatus: 'PENDING',
        newStatus: 'APPROVED',
        previousProgress: 50,
        newProgress: 75
      }
    ],
    status: 'ACTIVE' as IndicatorStatus,
    displayStatus: 'DISTRIBUTED',
    remark: '项目进展顺利',
    createdAt: '2025-09-01T09:00:00Z',
    updatedAt: '2025-10-05T14:30:00Z'
  },
  {
    indicatorId: 2,
    taskId: 1,
    indicatorName: '科研经费到账额',
    indicatorDesc: '年度科研经费到账总额（万元）',
    indicatorType1: '科研',
    indicatorType2: '经费',
    isStrategic: true,
    responsibleDept: '科研处',
    responsiblePerson: '李四',
    weight: 30,
    progress: 80,
    targetValue: 5000,
    actualValue: 4000,
    unit: '万元',
    year: 2025,
    ownerDept: '科研处',
    parentIndicatorId: null,
    progressApprovalStatus: 'APPROVED' as ProgressApprovalStatus,
    pendingProgress: null,
    pendingRemark: null,
    statusAudit: [],
    status: 'ACTIVE' as IndicatorStatus,
    displayStatus: 'DISTRIBUTED',
    remark: '',
    createdAt: '2025-09-01T09:00:00Z',
    updatedAt: '2025-11-15T10:00:00Z'
  }
]
```

#### 4. 里程碑数据

**文件：** `src/shared/api/mocks/fixtures/mockMilestones.ts`

```typescript
import type { Milestone, MilestoneStatus } from '@/types/entities'

export const mockMilestones: Milestone[] = [
  {
    milestoneId: 1,
    indicatorId: 1,
    milestoneName: '项目申报截止',
    milestoneDesc: '完成所有国家级项目的申报工作',
    targetProgress: 30,
    dueDate: '2025-10-31',
    weightPercent: 30,
    sortOrder: 1,
    status: 'COMPLETED' as MilestoneStatus,
    isPaired: true,
    createdAt: '2025-09-01T09:00:00Z',
    updatedAt: '2025-10-31T17:00:00Z'
  },
  {
    milestoneId: 2,
    indicatorId: 1,
    milestoneName: '项目立项',
    milestoneDesc: '获得项目立项通知',
    targetProgress: 60,
    dueDate: '2025-12-31',
    weightPercent: 30,
    sortOrder: 2,
    status: 'PENDING' as MilestoneStatus,
    isPaired: false,
    createdAt: '2025-09-01T09:00:00Z',
    updatedAt: '2025-10-31T17:00:00Z'
  }
]
```

#### 5. 用户数据

**文件：** `src/shared/api/mocks/fixtures/mockUsers.ts`

```typescript
import type { User, UserRole } from '@/types/entities'

export const mockUsers: User[] = [
  {
    userId: 1,
    username: 'admin',
    name: '系统管理员',
    passwordHash: 'hashed_password',
    role: 'strategic_dept' as UserRole,
    department: '战略发展部',
    email: 'admin@sism.edu.cn',
    phone: '13800138000',
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z'
  },
  {
    userId: 2,
    username: 'kychu',
    name: '张三',
    passwordHash: 'hashed_password',
    role: 'functional_dept' as UserRole,
    department: '科研处',
    email: 'kychu@sism.edu.cn',
    phone: '13800138001',
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z'
  },
  {
    userId: 3,
    username: 'jsxy',
    name: '李四',
    passwordHash: 'hashed_password',
    role: 'secondary_college' as UserRole,
    department: '计算机学院',
    email: 'jsxy@sism.edu.cn',
    phone: '13800138002',
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z'
  }
]
```

### 阶段三：API 接口完善

**文件：** `src/shared/api/mocks/handler.ts`

更新 API 处理器，支持以下关键接口：

```typescript
// ============================================
// 战略任务 API
// ============================================
else if (path === '/api/strategic-tasks' && method === 'GET') {
  response = await this.handleGetStrategicTasks(query)
} else if (path.startsWith('/api/strategic-tasks/') && method === 'GET') {
  const id = path.split('/').pop()
  response = await this.handleGetStrategicTask(id!)
}

// ============================================
// 指标 API（与后端对齐）
// ============================================
else if (path === '/api/indicators' && method === 'GET') {
  response = await this.handleGetIndicators(query)
} else if (path.startsWith('/api/indicators/') && method === 'GET') {
  const id = path.split('/').pop()
  response = await this.handleGetIndicator(id!)
} else if (path === '/api/indicators' && method === 'POST') {
  response = await this.handleCreateIndicator(data)
} else if (path.startsWith('/api/indicators/') && method === 'PUT') {
  const id = path.split('/').pop()
  response = await this.handleUpdateIndicator(id!, data)
}

// ============================================
// 里程碑 API
// ============================================
else if (path === '/api/milestones' && method === 'GET') {
  response = await this.handleGetMilestones(query)
}

// ============================================
// 评估周期 API
// ============================================
else if (path === '/api/assessment-cycles' && method === 'GET') {
  response = await this.handleGetAssessmentCycles(query)
}
```

### 阶段四：业务场景数据

#### 1. 教学质量场景

```typescript
// 教学质量任务
{
  taskId: 3,
  cycleId: 1,
  taskName: '教学质量提升',
  taskDesc: '提升课程质量和教学效果',
  taskType: '定性',
  responsibleDept: '教务处',
  weight: 25,
  targetValue: null,
  createdAt: '2025-09-01T09:00:00Z',
  updatedAt: '2025-11-20T10:15:00Z'
}

// 相关指标
{
  indicatorId: 3,
  taskId: 3,
  indicatorName: '课程满意度',
  indicatorDesc: '学生对课程的满意度评分',
  indicatorType1: '教学',
  indicatorType2: '满意度',
  isStrategic: true,
  responsibleDept: '教务处',
  responsiblePerson: '王五',
  weight: 40,
  progress: 85,
  targetValue: 90,
  actualValue: 76.5,
  unit: '分',
  year: 2025,
  ownerDept: '教务处',
  parentIndicatorId: null,
  progressApprovalStatus: 'APPROVED',
  pendingProgress: null,
  pendingRemark: null,
  statusAudit: [],
  status: 'ACTIVE',
  displayStatus: 'DISTRIBUTED',
  remark: '',
  createdAt: '2025-09-01T09:00:00Z',
  updatedAt: '2025-11-20T10:15:00Z'
}
```

#### 2. 人才培养场景

```typescript
// 人才培养任务
{
  taskId: 4,
  cycleId: 1,
  taskName: '人才培养质量提升',
  taskDesc: '提升学生培养质量',
  taskType: '定性',
  responsibleDept: '学生处',
  weight: 20,
  targetValue: null,
  createdAt: '2025-09-01T09:00:00Z',
  updatedAt: '2025-11-20T10:15:00Z'
}

// 相关指标
{
  indicatorId: 4,
  taskId: 4,
  indicatorName: '就业率',
  indicatorDesc: '毕业生就业率',
  indicatorType1: '就业',
  indicatorType2: '就业率',
  isStrategic: true,
  responsibleDept: '学生处',
  responsiblePerson: '赵六',
  weight: 50,
  progress: 70,
  targetValue: 95,
  actualValue: 66.5,
  unit: '%',
  year: 2025,
  ownerDept: '学生处',
  parentIndicatorId: null,
  progressApprovalStatus: 'PENDING',
  pendingProgress: 70,
  pendingRemark: '受经济形势影响，就业率略有下降',
  statusAudit: [
    {
      auditId: 1,
      timestamp: '2025-11-20T10:15:00Z',
      operator: 'jsxy',
      operatorName: '计算机学院',
      operatorDept: '二级学院',
      action: 'submit',
      comment: '提交就业率数据',
      previousStatus: 'DRAFT',
      newStatus: 'PENDING',
      previousProgress: 0,
      newProgress: 70
    }
  ],
  status: 'ACTIVE',
  displayStatus: 'PENDING_APPROVAL',
  remark: '',
  createdAt: '2025-09-01T09:00:00Z',
  updatedAt: '2025-11-20T10:15:00Z'
}
```

---

## 实施步骤

### 第一步：更新基础架构（1-2天）

1. 替换 `src/shared/api/mocks/fixtures/mockData.ts` 中的类型导入
2. 更新 `createMockResponse` 和 `createMockError` 函数，使用正确的 API 响应格式
3. 创建 `createMockPageResponse` 函数

### 第二步：重写核心数据（2-3天）

1. 创建 `src/shared/api/mocks/fixtures/mockUsers.ts`（使用 User 类型）
2. 创建 `src/shared/api/mocks/fixtures/mockAssessmentCycles.ts`（使用 AssessmentCycle 类型）
3. 创建 `src/shared/api/mocks/fixtures/mockStrategicTasks.ts`（使用 StrategicTask 类型）
4. 创建 `src/shared/api/mocks/fixtures/mockIndicators.ts`（使用 Indicator 类型）
5. 创建 `src/shared/api/mocks/fixtures/mockMilestones.ts`（使用 Milestone 类型）

### 第三步：完善 API 处理器（1-2天）

1. 更新 `src/shared/api/mocks/handler.ts` 中的所有接口方法
2. 添加缺失的 API 接口处理
3. 确保接口返回正确的数据格式

### 第四步：创建业务场景数据（1天）

1. 在各数据文件中添加真实的业务场景数据
2. 确保数据之间的关联关系正确
3. 添加审计日志数据

### 第五步：测试与验证（1天）

1. 启动开发服务器，验证所有页面数据加载正常
2. 测试各项功能（查看、添加、编辑、删除）
3. 检查数据一致性

---

## 启用 Mock 模式

### 方法一：环境变量（推荐）

在 `.env.development` 文件中添加：

```env
VITE_USE_MOCK=true
VITE_API_TARGET=http://localhost:8080  # Mock 模式下此配置无效
```

### 方法二：命令行参数

```bash
VITE_USE_MOCK=true npm run dev
```

### 验证 Mock 模式

启动开发服务器后，控制台会显示：

```
🎭 [Mock Mode] Using local mock data
```

---

## 维护建议

### 1. 数据更新策略

- 每当后端 API 变更时，同步更新 Mock 数据
- 添加新功能时，同时添加对应的 Mock 数据
- 定期审查和更新业务场景数据

### 2. 性能优化

- 对于大数据量场景，使用分页响应
- 避免在 Mock 数据中创建过多的关联关系
- 合理使用延迟模拟

### 3. 质量保障

- 确保 Mock 数据与后端类型定义一致
- 测试 Mock API 接口的正确性
- 保持数据的真实性和合理性

---

## 总结

通过本规划，我们将建立一个符合真实业务逻辑的 Mock 数据系统，解决现有数据结构不一致、字段不匹配和业务场景不符的问题。新的 Mock 数据将：

1. 与后端 API 完全对齐
2. 包含真实的业务场景
3. 提供完整的数据关联
4. 支持所有前端功能的测试
5. 易于维护和扩展

这样，在后端开发完成之前，前端可以正常进行功能开发和测试，提高开发效率。
