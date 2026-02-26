# 后端 API 接口

**基础路径**: `http://localhost:8080/api`

## 认证

| 接口 | 方法 | 说明 |
|------|------|------|
| `/auth/login` | POST | 登录 |
| `/auth/logout` | POST | 登出 |
| `/auth/password` | POST | 修改密码 |
| `/user/info` | GET | 获取用户信息 |

## 指标

| 接口 | 方法 | 说明 |
|------|------|------|
| `/indicators` | GET | 获取指标列表 (参数: year, orgId, parentId) |
| `/indicators/{id}` | GET | 获取指标详情 |
| `/indicators` | POST | 创建指标 |
| `/indicators/{id}` | PUT | 更新指标 |
| `/indicators/{id}` | DELETE | 删除指标 |
| `/indicators/{id}/progress` | POST | 提交进度 |
| `/indicators/{id}/progress/withdraw` | POST | 撤回进度 |

## 里程碑

| 接口 | 方法 | 说明 |
|------|------|------|
| `/indicators/{indicatorId}/milestones` | GET | 获取里程碑列表 |
| `/indicators/{indicatorId}/milestones` | POST | 创建里程碑 |
| `/milestones/{id}` | PUT | 更新里程碑 |
| `/milestones/{id}` | DELETE | 删除里程碑 |

## 部门

| 接口 | 方法 | 说明 |
|------|------|------|
| `/orgs` | GET | 获取部门列表 |

## 计划

| 接口 | 方法 | 说明 |
|------|------|------|
| `/plans` | GET | 获取计划列表 (参数: year, status) |
| `/plans/{id}` | GET | 获取计划详情 |
| `/plans` | POST | 创建计划 |
| `/plans/{id}` | PUT | 更新计划 |
| `/plans/{id}/submit` | POST | 提交审核 |
| `/plans/{id}/approve` | POST | 审核计划 |

## 枚举值

**用户角色 (orgType)**: `strategic_dept`, `functional_dept`, `secondary_college`

**指标状态 (status)**: `not_started`, `in_progress`, `completed`, `delayed`

**审批状态**: `pending`, `approved`, `rejected`

**进度审批状态**: `none`, `draft`, `pending`, `approved`, `rejected`
