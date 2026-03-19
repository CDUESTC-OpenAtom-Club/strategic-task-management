# Strategic Task Management 文档目录

本目录只保留当前前端架构重构仍在使用的计划、映射、实施与接口文档。历史方案、阶段报告和协作文档已归档。

## 当前主文档

- `architecture-refactor-plan.md`
  - 当前前端架构重构总方案
- `migration-mapping.md`
  - 迁移映射与落位关系
- `backup-migration-strategy.md`
  - 备份、迁移与回滚策略
- `testing-strategy.md`
  - 测试策略与验证口径
- `implementation-guide.md`
  - 实施步骤与执行说明
- `api-reference.md`
  - API 参考说明
- `API调用规范.md`
  - 接口调用规范
- `frontend-api-guide.md`
  - 前端接口接入说明
- `architecture/`
  - 当前 ADR 与架构专题文档

## 归档目录

- `archive/2026-03-delivery-history/`
  - 阶段报告
  - 验收结果
  - 协作文档
  - 一次性交付记录
- `archive/2026-03-legacy-plans/`
  - 已被当前方案替代的旧版计划和旧版设计稿
- `archive/ui-soft-delete-backup-20260319-004611*`
  - UI 软删除相关备份
- `archive/corrupted-files-backup/`
  - 异常文件备份
- `archive/duplicate-components-backup/`
  - 重复组件备份

## 清理原则

1. 根目录只保留当前仍作为执行基线的方案文档。
2. 旧版设计稿、旧路线图、阶段报告和协作文档统一归档。
3. 备份文件始终保留在 `archive/`，不与当前方案文档混放。
4. 新文档如果不再参与当前实施，应直接归档而不是继续堆在根目录。

## 阅读顺序

1. `architecture-refactor-plan.md`
2. `migration-mapping.md`
3. `backup-migration-strategy.md`
4. `testing-strategy.md`
5. `implementation-guide.md`
