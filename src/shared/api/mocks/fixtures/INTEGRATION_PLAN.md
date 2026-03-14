# Mock 数据整合计划

## 背景
在项目中发现了两套 Mock 数据系统：
1. 旧系统：`/src/mock/` 目录（已废弃）
2. 当前系统：`/src/shared/api/mocks/` 目录（正在使用）

## 整合目标
将旧系统中的丰富数据整合到当前系统中，提供更全面的模拟数据支持。

## 旧系统中的有价值数据

### 1. 多年指标数据（`/indicators/` 目录）
- `indicators2023.ts` - 2023年完整指标数据
- `indicators2024.ts` - 2024年完整指标数据
- `indicators2025.ts` - 2025年完整指标数据（已归档）
- `indicators2026.ts` - 2026年完整指标数据（当前工作年份）
- `utils.ts` - 季度里程碑生成工具

### 2. Dashboard 数据（`mockIndicators.ts`）
- `mockDashboardData` - 完整的 Dashboard 统计数据
- `mockDepartmentProgress` - 部门进度数据
- `mockOrgTree` - 完整的组织树结构

### 3. 历史数据导出（`historicalIndicators.ts`）
- 多年数据的统一导出
- 按年份筛选的工具函数

## 整合步骤

### 步骤 1: 更新 fixtures 导出
- 在 `index.ts` 中添加新的数据导出
- 保持向后兼容性

### 步骤 2: 更新 mockIndicators.ts
- 添加多年数据支持
- 整合更丰富的指标数据
- 添加历史数据查询函数

### 步骤 3: 创建 mockDashboardData.ts
- 整合完整的 Dashboard 数据
- 添加部门进度和组织树数据

### 步骤 4: 更新 handler.ts
- 添加历史数据查询的 API 接口
- 添加多年指标筛选功能
- 添加组织树查询接口

### 步骤 5: 清理和文档
- 更新文档说明新增的 API 接口
- 确保所有数据类型正确对齐

## 新增 API 接口计划

### 指标相关
- `GET /api/v1/indicators/history?year=2025` - 获取历史年份指标
- `GET /api/v1/indicators/years` - 获取有数据的年份列表
- `GET /api/v1/indicators/:year/:id` - 获取指定年份的指标详情

### Dashboard 相关
- `GET /api/v1/dashboard/history?year=2025` - 获取历史年份 Dashboard 数据
- `GET /api/v1/organization/tree` - 获取完整组织树
- `GET /api/v1/departments/progress?year=2025` - 获取部门进度数据

### 时间范围
- 2023-2025年：历史归档数据
- 2026年：当前工作年份数据
