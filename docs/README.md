# Strategic Task Management 文档目录

本目录只保留当前前端治理和仍可作为实现基线的专题文档。过时接口说明、阶段性验收报告、旧迁移计划和零引用设计稿已删除。

## 当前主文档

- `cache-design.md`
  - 当前前端缓存设计与实现口径
- `plan-withdraw-redesign.md`
  - Plan 发起后可撤回的现行前端设计口径
- `architecture/`
  - 当前仍有效的架构治理专题文档
- `../sism-backend/docs/architecture/main-branch-release-and-deploy-runbook.md`
  - 系统级主线发布与自动部署手册，前端发版后派发后端部署时应以该文档为准

## 架构专题文档

- `architecture/src-directory-governance-plan.md`
  - `src` 目录治理方案与边界定义
- `architecture/src-directory-governance-todo.md`
  - 目录治理执行 TODO 与 canonical path 决策
- `architecture/frontend-architecture-remediation-backlog.md`
  - 前端架构审查整改执行清单，包含优先级、负责人、工时、验收标准
- `architecture/legacy-indicator-retirement.md`
  - `legacy-indicator` 退场与归档口径

## 归档目录

- `archive/legacy-indicator-retired/`
  - 已退场指标旧实现的只读归档

## 清理原则

1. 根目录只保留当前仍作为执行基线的方案文档。
2. 旧版设计稿、旧路线图、阶段报告和协作文档统一归档。
3. 备份文件始终保留在 `archive/`，不与当前方案文档混放。
4. 新文档如果不再参与当前实施，应直接归档而不是继续堆在根目录。

## 阅读顺序

1. `architecture/frontend-architecture-remediation-backlog.md`
2. `architecture/src-directory-governance-plan.md`
3. `architecture/src-directory-governance-todo.md`
4. `cache-design.md`
5. `plan-withdraw-redesign.md`
