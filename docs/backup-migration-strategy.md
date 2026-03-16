# 备份与迁移策略

## 概述

在进行架构重构前，必须建立完整的备份与迁移策略，以确保代码安全和快速回滚能力。本策略包括代码备份、依赖管理、CI 配置和风险评估。

---

## 1. 代码备份策略

### 1.1 分支管理

```bash
# 1. 创建重构分支
git checkout -b refactor/frontend-architecture

# 2. 检查当前状态
git status

# 3. 备份当前代码到临时目录（本地备份）
cp -r src src.backup.$(date +%Y%m%d%H%M%S)

# 4. 添加备份到 git（可选，用于远程备份）
git add src.backup.*
git commit -m "backup: 架构重构前的原始代码备份"
git tag -a backup/frontend-architecture-$(date +%Y%m%d) -m "架构重构前的完整代码备份"

# 5. 推送备份（可选）
git push origin refactor/frontend-architecture
git push origin --tags
```

### 1.2 备份验证

```bash
# 验证备份完整性
diff -r src src.backup.$(ls -1 src.backup.* | tail -1) --exclude='*.log' --exclude='*.tmp'

# 检查备份大小
du -sh src src.backup.*
```

---

## 2. 依赖管理与环境检查

### 2.1 依赖验证

```bash
# 1. 清理 node_modules（可选）
rm -rf node_modules package-lock.json bun.lock

# 2. 重新安装依赖
npm install

# 3. 验证依赖树
npm ls

# 4. 检查类型错误
npm run type-check

# 5. 运行现有测试
npm run test

# 6. 检查代码格式
npm run lint:check
npm run format:check
```

### 2.2 环境信息记录

```bash
# 记录当前环境信息
node -v > environment-info.txt
npm -v >> environment-info.txt
uname -a >> environment-info.txt
cat package.json | grep -E '"name"|"version"|"vue"|"typescript"|"vite"' >> environment-info.txt
```

---

## 3. CI/CD 配置检查

### 3.1 检查 GitHub Actions

```bash
# 查看现有 CI 配置
cat .github/workflows/*.yml

# 运行构建测试
npm run build:check
```

### 3.2 临时 CI 分支配置

在 `.github/workflows/` 中创建临时配置，用于测试重构后的代码：

```yaml
# .github/workflows/refactor.yml
name: Refactor CI
on:
  push:
    branches:
      - refactor/**
  pull_request:
    branches:
      - refactor/**

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install dependencies
        run: npm install
      - name: Type check
        run: npm run type-check
      - name: Lint
        run: npm run lint:check
      - name: Build
        run: npm run build:check
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install dependencies
        run: npm install
      - name: Run tests
        run: npm run test
```

---

## 4. 增量式迁移策略

### 4.1 阶段式实施

| 阶段 | 目标 | 实施命令 |
|------|------|----------|
| 阶段 1 | 创建目标目录结构 | `mkdir -p src/1-app/src/1-app/providers src/1-app/layouts src/2-pages/dashboard/ui src/3-features src/4-entities src/5-shared/ui src/5-shared/lib/src/5-shared/assets src/6-processes` |
| 阶段 2 | 迁移应用入口 | `mv src/App.vue src/1-app/; mv src/main.ts src/1-app/; mv src/app/* src/1-app/` |
| 阶段 3 | 迁移共享资源 | `mv src/shared src/5-shared/; mv src/composables src/5-shared/lib/hooks/; mv src/utils src/5-shared/lib/utils/; mv src/config src/5-shared/; mv src/constants src/5-shared/; mv src/types src/5-shared/types/; mv src/api src/5-shared/lib/api/; mv src/assets src/5-shared/assets/` |
| 阶段 4 | 迁移页面组件 | `mv src/pages src/2-pages/` |
| 阶段 5 | 迁移功能模块 | `mv src/features src/3-features/` |
| 阶段 6 | 迁移实体 | `mv src/entities src/4-entities/` |
| 阶段 7 | 迁移跨功能流程 | `mv src/directives src/6-processes/; mv src/mock src/6-processes/` |
| 阶段 8 | 测试与优化 | `npm run type-check; npm run test` |

### 4.2 实时验证

每个阶段完成后，立即进行验证：

```bash
# 检查类型错误
npm run type-check

# 运行测试
npm run test

# 构建验证
npm run build:check
```

---

## 5. 回滚策略

### 5.1 快速回滚

```bash
# 1. 停止当前工作
git status

# 2. 恢复原始代码
rm -rf src
mv src.backup.$(ls -1 src.backup.* | tail -1) src

# 3. 清理临时文件
rm -f environment-info.txt
rm -f src.backup.*

# 4. 验证回滚成功
npm run type-check
npm run test

# 5. 重置 git 状态
git reset HEAD --hard
```

### 5.2 部分回滚

```bash
# 仅回滚特定目录
cp -r src.backup.$(ls -1 src.backup.* | tail -1)/src/App.vue src/
cp -r src.backup.$(ls -1 src.backup.* | tail -1)/src/main.ts src/
```

### 5.3 CI 回滚触发

在 GitHub 中可以通过以下方式触发回滚：

1. **手动回滚**：在 Actions 中手动运行回滚任务
2. **自动回滚**：通过 PR 检查失败自动触发
3. **标签回滚**：使用备份标签进行版本回滚

---

## 6. 验证与测试策略

### 6.1 单元测试验证

```bash
# 运行现有单元测试
npm run test

# 运行特定测试文件
npx vitest run tests/unit/features/auth/

# 测试覆盖率
npx vitest run --coverage
```

### 6.2 集成测试

```bash
# 启动开发服务器（后台运行）
npm run dev &

# 等待服务器启动
sleep 3

# 运行集成测试（使用 curl 验证）
curl -f http://localhost:5173 > /dev/null && echo "服务器响应正常"

# 关闭服务器
pkill -f "vite"
```

### 6.3 端到端测试（待实现）

```bash
# 安装 Playwright（待添加）
npm install -D @playwright/test

# 初始化 Playwright
npx playwright install

# 运行 E2E 测试
npx playwright test
```

---

## 7. 文档更新策略

### 7.1 README.md 更新

在重构过程中更新 `README.md`，记录：

1. 架构变更说明
2. 新的目录结构
3. 迁移过程中的重要决策
4. 已知问题与解决方法

### 7.2 架构文档更新

```bash
# 更新架构图
# 更新迁移映射表
# 更新实施指南
```

---

## 8. 监控与日志记录

### 8.1 构建过程监控

```bash
# 记录构建过程
npm run build:check 2>&1 | tee build.log

# 检查构建输出
grep -E 'error|warning|failed|success' build.log
```

### 8.2 测试过程监控

```bash
# 记录测试过程
npm run test 2>&1 | tee test.log

# 检查测试结果
grep -E 'PASS|FAIL|pending|coverage' test.log
```

### 8.3 增量迁移记录

```bash
# 创建迁移记录文件
touch migration-log.txt
echo "$(date): 开始架构重构" >> migration-log.txt

# 每个阶段完成后记录
echo "$(date): 阶段 1 完成 - 创建目标目录结构" >> migration-log.txt
ls -la src >> migration-log.txt

# 完成后总结
echo "$(date): 架构重构完成" >> migration-log.txt
echo "文件变更: $(find src -name "*.vue" -o -name "*.ts" | wc -l) 个文件" >> migration-log.txt
```

---

## 9. 风险评估与缓解

### 9.1 高风险操作

| 操作 | 风险 | 缓解措施 |
|------|------|----------|
| `src/App.vue` 迁移 | 整个应用可能无法启动 | 提前备份，完成后立即测试 |
| `main.ts` 迁移 | 入口文件错误导致白屏 | 检查 imports，验证 tsconfig 路径 |
| `vite.config.ts` 路径别名修改 | 构建失败 | 逐步更新，测试每个变更 |
| 大量文件重命名 | git 追踪问题 | 使用 git mv 命令 |

### 9.2 高风险时段

1. **第一阶段**：应用入口迁移
2. **配置变更**：vite 与 tsconfig 配置
3. **类型定义调整**：types 目录重组

---

## 10. 完成标志与总结

### 10.1 完成标志

- 所有测试通过
- 应用正常运行
- 构建过程无错误
- 代码符合架构规范
- CI 任务成功执行

### 10.2 重构总结

```bash
# 生成变更统计
git diff --name-only | wc -l > refactor-summary.txt
git diff --stat >> refactor-summary.txt
npm run lint:check >> refactor-summary.txt
npm run test >> refactor-summary.txt
```

---

## 参考链接

- [Git 分支管理](https://git-scm.com/book/zh/v2/Git-%E5%88%86%E6%94%AF-%E5%88%86%E6%94%AF%E7%AE%A1%E7%90%86)
- [npm 依赖管理](https://docs.npmjs.com/cli/v10/configuring-npm/package-lock-json)
- [Vite 配置](https://cn.vitejs.dev/config/)
- [TypeScript 路径映射](https://www.typescriptlang.org/tsconfig#paths)