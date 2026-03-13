# FSD 架构文档

## 项目结构

```
src/
├── app/                    # 应用初始化
├── pages/                  # 路由页面
├── features/              # 业务功能
│   ├── admin/            # ✅ api + model + ui
│   ├── approval/         # ✅ api + model + ui
│   ├── auth/             # ✅ api + model + ui
│   ├── dashboard/        # ✅ api + model + ui
│   ├── indicator/        # ✅ api + model + ui
│   ├── messages/         # ✅ api + model + ui
│   ├── milestone/        # ✅ api + model + ui
│   ├── organization/     # ✅ api + model + ui
│   ├── plan/             # ✅ api + model + ui
│   ├── profile/          # ✅ api + model + ui
│   ├── strategic-indicator/ # ✅ api + model + ui
│   └── task/             # ✅ api + model + ui
├── entities/             # 业务实体
├── shared/               # 共享资源
│   ├── api/             # API客户端
│   ├── lib/             # 工具库
│   │   ├── authorization/
│   │   ├── charts/
│   │   ├── error-handling/
│   │   ├── layout/
│   │   ├── loading/
│   │   ├── timing/
│   │   └── validation/
│   ├── config/
│   └── ui/
└── router/              # 路由配置

## 导入规则

✅ 允许: app → pages → features → entities → shared
❌ 禁止: 跨feature直接导入（需通过entities/shared）

## 向后兼容

- `src/composables/` → 重导出自 `src/shared/lib/`
- `src/api/` → 重导出自 `src/shared/api/`
- `src/data/` → 重导出自 `src/shared/api/fixtures/`

## 验证

运行 `node scripts/check-fsd-compliance.cjs` 检查合规性
