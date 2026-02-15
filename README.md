# 战略指标管理系统 (SISM) - 前端

> Strategic Indicator Management System - Vue 3 前端应用

[![Vue 3](https://img.shields.io/badge/Vue-3.5-green)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7.2-purple)](https://vitejs.dev/)
[![Element Plus](https://img.shields.io/badge/Element_Plus-2.9-409eff)](https://element-plus.org/)

---

## 目录

- [项目简介](#项目简介)
- [技术栈](#技术栈)
- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [开发指南](#开发指南)
- [文档中心](#文档中心)
- [用户角色](#用户角色)
- [许可证](#许可证)

---

## 项目简介

战略指标管理系统是一个面向组织的战略任务执行监控平台，提供：

- **可视化看板** - 实时展示战略任务完成情况、指标进度、部门对比分析
- **指标全生命周期管理** - 创建、分配、填报、审批、跟踪全流程
- **里程碑跟踪** - 按时间节点追踪指标完成进度，自动预警延期风险
- **多角色权限体系** - 战略发展部、职能部门、二级学院三级管理
- **审计日志** - 完整记录所有操作历史，支持追溯和审计

---

## 技术栈

| 类别 | 技术 | 说明 |
|------|------|------|
| 前端框架 | Vue 3.5 | Composition API + `<script setup>` |
| 开发语言 | TypeScript 5.7 | 类型安全 |
| 构建工具 | Vite 7.2 | 快速开发体验 |
| UI 组件库 | Element Plus 2.9 | 企业级组件库 |
| 图表库 | ECharts 5.6 | 数据可视化 |
| 状态管理 | Pinia 3.0 | Vue 官方状态管理 |
| 路由 | Vue Router 4.5 | 客户端路由 |
| HTTP 客户端 | Axios 1.7 | API 请求 |
| 测试框架 | Vitest + fast-check | 单元测试 + 属性测试 |
| 代码规范 | ESLint + Prettier | 代码质量保证 |

---

## 环境要求

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0

---

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，配置后端 API 地址
```

### 3. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000 即可使用系统。

> **注意**: 需要先启动后端服务 (sism-backend)，前端才能正常工作。

---

## 项目结构

```
src/
├── api/                    # API 请求层
│   └── interceptors/       # 请求/响应拦截器
├── components/             # Vue 组件
│   ├── admin/              # 管理员组件
│   ├── approval/           # 审批流程组件
│   ├── charts/             # ECharts 图表组件
│   ├── common/             # 通用组件 (表格、表单、骨架屏等)
│   ├── indicator/          # 指标管理组件
│   ├── message/            # 消息中心组件
│   ├── milestone/          # 里程碑组件
│   ├── plan/               # 计划管理组件
│   ├── profile/            # 个人中心组件
│   └── task/               # 任务组件
├── composables/            # Composition API 组合函数
│   ├── dashboard/          # 看板相关
│   └── layout/             # 布局相关
├── config/                 # 配置文件
├── constants/              # 常量定义
├── mock/                   # Mock 数据
├── router/                 # 路由配置
├── stores/                 # Pinia 状态管理
│   ├── auth.ts             # 认证状态
│   ├── strategic.ts        # 战略指标状态
│   ├── dashboard.ts        # 看板状态
│   └── ...
├── types/                  # TypeScript 类型定义
│   └── schemas.ts          # Zod 运行时验证
├── utils/                  # 工具函数
│   ├── authHelpers/        # 认证辅助
│   ├── dataMappers/        # 数据映射
│   ├── formatters.ts       # 格式化函数
│   └── ...
├── views/                  # 页面视图
├── App.vue                 # 根组件
└── main.ts                 # 应用入口

tests/                      # 测试文件
├── property/               # 属性测试 (fast-check)
└── unit/                   # 单元测试 (vitest)

docs/                       # 项目文档
├── archive/                # 归档文档
├── user-manual/            # 用户操作手册
├── api-reference.md        # API 接口文档
├── common-components-guide.md  # 通用组件指南
├── frontend-api-guide.md   # 前端 API 使用指南
├── optimization-progress.md    # 优化实施进度
└── ...
```

---

## 开发指南

### 可用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 (端口 3000) |
| `npm run build` | 构建生产版本 |
| `npm run build:check` | TypeScript 类型检查 + 构建 |
| `npm run preview` | 预览生产构建 |
| `npm run test` | 运行所有测试 |
| `npm run test:watch` | 监听模式运行测试 |
| `npm run lint` | ESLint 检查并自动修复 |
| `npm run format` | Prettier 格式化 |

### 代码规范

1. 使用 **Vue 3 Composition API** + `<script setup>` 语法
2. 使用 **TypeScript** 进行类型检查
3. 遵循 **ESLint** 和 **Prettier** 代码规范
4. 组件命名使用 **PascalCase**
5. 使用 **Pinia** 进行状态管理
6. API 调用统一通过 `src/api/` 目录
7. 为新功能编写单元测试

### 使用通用组件

```typescript
import { DataTable, DataForm, EmptyState, SkeletonLoader } from '@/components/common'
```

详见 [通用组件指南](docs/common-components-guide.md)。

### 使用 Zod 数据验证

```typescript
import { validateIndicator, validateUser } from '@/types'

const result = validateIndicator(newData)
if (!result.success) {
  console.error('验证失败:', result.errors)
}
```

---

## 文档中心

| 文档 | 说明 |
|------|------|
| [CLAUDE.md](CLAUDE.md) | 项目开发指南 (供 Claude Code 使用) |
| [API 接口文档](docs/api-reference.md) | 后端 API 接口规范 |
| [前端 API 指南](docs/frontend-api-guide.md) | 前端 API 调用指南 |
| [通用组件指南](docs/common-components-guide.md) | 组件使用文档 |
| [优化实施进度](docs/optimization-progress.md) | 前端优化总结 |
| [数据库架构](docs/database-schema.md) | 后端数据库结构 |
| [用户操作手册](docs/user-manual/) | 各角色操作指南 |

---

## 用户角色

| 角色 | 代码值 | 说明 |
|------|--------|------|
| 战略发展部 | `strategic_dept` | 系统管理员，可查看所有部门数据 |
| 职能部门 | `functional_dept` | 中层管理，负责审批和分配 |
| 二级学院 | `secondary_college` | 执行层，负责填报和执行 |

---

## 测试

```bash
# 运行所有测试
npm run test

# 运行特定测试文件
npx vitest tests/unit/formatters.spec.ts

# 监听模式
npm run test:watch
```

---

## 部署

```bash
# 构建
npm run build

# 输出目录: dist/
# 部署 dist/ 目录到静态文件服务器
```

---

## License

Private - All Rights Reserved

---

## 相关项目

- **后端项目**: [sism-backend](../sism-backend/)
- **Vue 3 文档**: https://vuejs.org/
- **Element Plus 文档**: https://element-plus.org/
- **ECharts 文档**: https://echarts.apache.org/
