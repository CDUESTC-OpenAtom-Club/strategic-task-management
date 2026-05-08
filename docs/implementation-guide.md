# 架构修复实施指南

## 前言

本文档提供完整的前端架构重构实施指导，将当前项目从现有结构迁移到标准的 6 层架构。

本指南将分为：

1. 团队角色分配
2. 详细实施步骤
3. 每日进度检查
4. 问题处理机制

---

## 一、团队角色与任务分配

### 角色定义

| 角色                         | 主要职责                             | 对应阶段 |
| ---------------------------- | ------------------------------------ | -------- |
| **架构分析师 (Agent 1)**     | 分析当前架构、识别风险、制定迁移策略 | 准备阶段 |
| **架构重构师 (Agent 2)**     | 基础架构重构、配置更新、目录重组     | 阶段 1-2 |
| **页面重构师 (Agent 3)**     | 页面组件迁移、路由重构、导航测试     | 阶段 3   |
| **功能模块重构师 (Agent 4)** | Features 模块重构、业务逻辑分离      | 阶段 4   |
| **架构优化师 (Agent 5)**     | 实体层、共享资源、API 重构           | 阶段 5   |
| **流程重构师 (Agent 6)**     | 跨功能流程重构、流程集成             | 阶段 6   |
| **测试架构师 (Agent 7)**     | 测试结构重构、测试用例补充           | 阶段 7   |
| **质量保证师 (Agent 8)**     | 整体验证、问题修复、性能优化         | 阶段 8   |

---

## 二、实施时间表

| 阶段       | 任务                 | 负责人         | 预计时间 |
| ---------- | -------------------- | -------------- | -------- |
| **阶段 0** | 准备与备份           | 架构分析师     | 0.5 天   |
| **阶段 1** | 创建目标目录结构     | 架构重构师     | 0.5 天   |
| **阶段 2** | 应用入口与配置重构   | 架构重构师     | 1 天     |
| **阶段 3** | 页面与路由重构       | 页面重构师     | 2 天     |
| **阶段 4** | 功能模块重构         | 功能模块重构师 | 3 天     |
| **阶段 5** | 实体层与共享资源重构 | 架构优化师     | 2 天     |
| **阶段 6** | 流程与集成重构       | 流程重构师     | 1 天     |
| **阶段 7** | 测试重构             | 测试架构师     | 2 天     |
| **阶段 8** | 验证与优化           | 质量保证师     | 1 天     |

**总预计时间：14 天**

---

## 三、详细实施步骤

### 阶段 0：准备与备份 (0.5 天)

**负责人：架构分析师**

#### 任务清单：

- [ ] 创建重构分支

  ```bash
  git checkout -b refactor/frontend-architecture
  ```

- [ ] 备份当前代码

  ```bash
  cp -r src src.backup.$(date +%Y%m%d%H%M%S)
  git add src.backup.*
  git commit -m "backup: 架构重构前的原始代码备份"
  git tag backup/frontend-architecture-$(date +%Y%m%d)
  ```

- [ ] 验证当前项目状态

  ```bash
  npm install
  npm run type-check
  npm run test
  npm run build:check
  ```

- [ ] 记录环境信息

  ```bash
  node -v > environment-info.txt
  npm -v >> environment-info.txt
  ```

- [ ] 创建迁移日志文件
  ```bash
  touch migration-log.txt
  echo "$(date): 开始架构重构" >> migration-log.txt
  ```

#### 输出：

- 重构分支与备份标签
- 项目状态验证报告
- 环境信息记录

---

### 阶段 1：创建目标目录结构 (0.5 天)

**负责人：架构重构师**

#### 任务清单：

- [ ] 创建完整的目标目录结构

  ```bash
  mkdir -p src/1-app/{providers,layouts,styles}
  mkdir -p src/2-pages/{dashboard,auth,strategy/{plans,indicators,tasks},admin,approval,messages,profile,error}/ui
  mkdir -p src/3-features/{auth,dashboard,plan,indicator,legacy-indicator,milestone,task,approval,messages,user,admin,organization,profile}/{ui,model,api,lib}
  mkdir -p src/4-entities/{user,indicator,organization,plan,task,milestone}/{model,ui}
  mkdir -p src/5-shared/{ui/{form,layout,charts,message,feedback,table,display,error},lib/{api,auth,utils,hooks},config,constants,types,assets}
  mkdir -p src/6-processes/{approval,messaging,directives,mock}
  ```

- [ ] 验证目录结构

  ```bash
  ls -la src/
  ls -la src/1-app/
  ls -la src/2-pages/
  ls -la src/3-features/
  ls -la src/4-entities/
  ls -la src/5-shared/
  ls -la src/6-processes/
  ```

- [ ] 记录到迁移日志
  ```bash
  echo "$(date): 阶段 1 完成 - 创建目标目录结构" >> migration-log.txt
  ```

#### 输出：

- 完整的目标目录结构
- 目录结构验证报告

---

### 阶段 2：应用入口与配置重构 (1 天)

**负责人：架构重构师**

#### 任务清单：

- [ ] 迁移应用入口文件

  ```bash
  git mv src/App.vue src/1-app/
  git mv src/main.ts src/1-app/
  git mv src/app/* src/1-app/
  rmdir src/app/
  ```

- [ ] 迁移样式文件

  ```bash
  mv src/colors.css src/1-app/styles/_colors.css
  mv src/style.css src/1-app/styles/index.scss
  mv src/unified-styles.css src/1-app/styles/unified-styles.css
  ```

- [ ] 更新 vite.config.ts

  ```typescript
  // 更新路径别名
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@/1-app': fileURLToPath(new URL('./src/1-app', import.meta.url)),
      '@/2-pages': fileURLToPath(new URL('./src/2-pages', import.meta.url)),
      '@/3-features': fileURLToPath(new URL('./src/3-features', import.meta.url)),
      '@/4-entities': fileURLToPath(new URL('./src/4-entities', import.meta.url)),
      '@/5-shared': fileURLToPath(new URL('./src/5-shared', import.meta.url)),
      '@/6-processes': fileURLToPath(new URL('./src/6-processes', import.meta.url))
    }
  }
  ```

- [ ] 更新 tsconfig.json

  ```json
  {
    "compilerOptions": {
      "baseUrl": ".",
      "paths": {
        "@/*": ["src/*"],
        "@/1-app/*": ["src/1-app/*"],
        "@/2-pages/*": ["src/2-pages/*"],
        "@/3-features/*": ["src/3-features/*"],
        "@/4-entities/*": ["src/4-entities/*"],
        "@/5-shared/*": ["src/5-shared/*"],
        "@/6-processes/*": ["src/6-processes/*"]
      }
    }
  }
  ```

- [ ] 更新 vitest.config.ts（参照 `testing-strategy.md`）

- [ ] 更新入口导入

  ```typescript
  // src/1-app/main.ts
  import { createApp } from 'vue'
  import App from './App.vue'
  import './styles/index.scss'
  // 更新其他导入...
  ```

- [ ] 验证类型检查

  ```bash
  npm run type-check
  ```

- [ ] 验证构建

  ```bash
  npm run build:check
  ```

- [ ] 记录到迁移日志
  ```bash
  echo "$(date): 阶段 2 完成 - 应用入口与配置重构" >> migration-log.txt
  ```

#### 输出：

- 重构后的入口文件
- 更新的配置文件
- 类型检查和构建验证报告

---

### 阶段 3：页面与路由重构 (2 天)

**负责人：页面重构师**

#### 任务清单：

- [ ] 迁移页面目录

  ```bash
  git mv src/pages/* src/2-pages/
  rmdir src/pages/
  ```

- [ ] 重命名与调整页面（根据迁移映射表）

  ```bash
  # 示例：重命名文件
  git mv src/2-pages/admin/ui/AdminConsolePage.vue src/2-pages/admin/ui/UserManagementPage.vue
  ```

- [ ] 更新路由配置

  ```typescript
  // src/1-app/providers/with-router.ts
  import DashboardPage from '@/2-pages/dashboard/ui/DashboardPage.vue'
  import LoginPage from '@/2-pages/auth/ui/LoginPage.vue'
  // 更新所有导入...
  ```

- [ ] 更新导入路径（使用搜索替换）

  ```bash
  # 使用 sed 或 IDE 批量替换
  # 从 '@/pages/' 替换为 '@/2-pages/'
  ```

- [ ] 测试页面访问

  ```bash
  npm run dev
  # 手动测试所有页面路由
  ```

- [ ] 运行现有测试

  ```bash
  npm run test
  ```

- [ ] 记录到迁移日志
  ```bash
  echo "$(date): 阶段 3 完成 - 页面与路由重构" >> migration-log.txt
  ```

#### 输出：

- 重构后的页面目录
- 更新的路由配置
- 页面访问测试报告

---

### 阶段 4：功能模块重构 (3 天)

**负责人：功能模块重构师**

#### 任务清单：

- [ ] 迁移 features 目录

  ```bash
  git mv src/features/* src/3-features/
  rmdir src/features/
  ```

- [ ] 验证每个 feature 模块结构

  ```bash
  # 检查每个 feature 是否有 ui/model/api/lib 子目录
  ls -la src/3-features/auth/
  ls -la src/3-features/indicator/
  # ... 检查其他模块
  ```

- [ ] 更新导入路径

  ```bash
  # 从 '@/features/' 替换为 '@/3-features/'
  ```

- [ ] 重构 Store（如有需要）

  ```typescript
  // 确保 Store 位于 model 目录
  // src/3-features/auth/model/store.ts
  ```

- [ ] 运行功能测试

  ```bash
  npx vitest run tests/unit/features/
  ```

- [ ] 记录到迁移日志
  ```bash
  echo "$(date): 阶段 4 完成 - 功能模块重构" >> migration-log.txt
  ```

#### 输出：

- 重构后的 features 目录
- 更新的模块导入
- 功能测试报告

---

### 阶段 5：实体层与共享资源重构 (2 天)

**负责人：架构优化师**

#### 任务清单：

- [ ] 迁移实体目录

  ```bash
  git mv src/entities/* src/4-entities/
  rmdir src/entities/
  ```

- [ ] 迁移共享资源

  ```bash
  git mv src/shared/* src/5-shared/
  rmdir src/shared/

  git mv src/composables/* src/5-shared/lib/hooks/
  rmdir src/composables/

  git mv src/utils/* src/5-shared/lib/utils/
  rmdir src/utils/

  git mv src/config/* src/5-shared/config/
  rmdir src/config/

  git mv src/constants/* src/5-shared/constants/
  rmdir src/constants/

  git mv src/types/* src/5-shared/types/
  rmdir src/types/

  git mv src/api/* src/5-shared/api/
  rmdir src/api/

  git mv src/assets/* src/5-shared/assets/
  rmdir src/assets/
  ```

- [ ] 更新导入路径

  ```bash
  # '@/shared/' → '@/5-shared/'
  # '@/composables/' → '@/shared/lib/*'
  # '@/utils/' → '@/5-shared/lib/utils/'
  # '@/config/' → '@/5-shared/config/'
  # '@/constants/' → '@/5-shared/constants/'
  # '@/types/' → '@/shared/types/'
  # '@/api/' → '@/shared/api/'
  # '@/assets/' → '@/5-shared/assets/'
  ```

- [ ] 验证类型检查

  ```bash
  npm run type-check
  ```

- [ ] 运行共享库测试

  ```bash
  npx vitest run tests/unit/shared/
  ```

- [ ] 记录到迁移日志
  ```bash
  echo "$(date): 阶段 5 完成 - 实体层与共享资源重构" >> migration-log.txt
  ```

#### 输出：

- 重构后的共享资源目录
- 更新的导入路径
- 类型检查与测试报告

---

### 阶段 6：流程与集成重构 (1 天)

**负责人：流程重构师**

#### 任务清单：

- [ ] 迁移跨功能流程

  ```bash
  git mv src/directives src/6-processes/
  git mv src/mock src/6-processes/

  # 可选：将 approval/messages 等复杂流程移到 6-processes/
  ```

- [ ] 检查流程集成点

  ```bash
  # 检查各模块间的依赖关系
  # 确保没有循环依赖
  ```

- [ ] 运行集成测试

  ```bash
  npx vitest run tests/integration/
  ```

- [ ] 验证完整应用流程

  ```bash
  npm run dev
  # 测试端到端用户流程
  ```

- [ ] 记录到迁移日志
  ```bash
  echo "$(date): 阶段 6 完成 - 流程与集成重构" >> migration-log.txt
  ```

#### 输出：

- 重构后的流程目录
- 集成测试报告
- 流程验证报告

---

### 阶段 7：测试重构 (2 天)

**负责人：测试架构师**

#### 任务清单：

- [ ] 创建新的测试目录结构（参照 `testing-strategy.md`）

  ```bash
  mkdir -p tests/unit/{1-app,2-pages,3-features,4-entities,5-shared,6-processes}
  mkdir -p tests/integration/{api,routes,features,state}
  mkdir -p tests/helpers/{mocks,factories,fixtures}
  ```

- [ ] 迁移现有测试到对应目录

  ```bash
  # 使用 git mv 保留历史
  git mv tests/unit/features/* tests/unit/3-features/
  git mv tests/unit/shared/* tests/unit/5-shared/
  # ... 其他测试迁移
  ```

- [ ] 更新测试导入路径

  ```bash
  # 更新所有测试中的导入语句
  ```

- [ ] 创建测试辅助工具

  ```typescript
  // tests/helpers/mocks/api.mock.ts
  // tests/helpers/factories/indicator.factory.ts
  // tests/helpers/fixtures/indicator.fixture.ts
  ```

- [ ] 运行所有测试

  ```bash
  npm run test
  ```

- [ ] 生成测试覆盖率报告

  ```bash
  npm run test:coverage
  ```

- [ ] 记录到迁移日志
  ```bash
  echo "$(date): 阶段 7 完成 - 测试重构" >> migration-log.txt
  ```

#### 输出：

- 重构后的测试目录
- 测试辅助工具
- 测试覆盖率报告

---

### 阶段 8：验证与优化 (1 天)

**负责人：质量保证师**

#### 任务清单：

- [ ] 执行完整的测试套件

  ```bash
  npm run test:coverage
  ```

- [ ] 验证所有功能正常

  ```bash
  npm run dev
  # 完整的功能测试清单：
  # - 登录/登出
  # - 仪表板访问
  # - 指标管理（增删改查）
  # - 计划管理
  # - 任务管理
  # - 审批流程
  # - 个人资料设置
  ```

- [ ] 修复重构过程中的问题

  ```bash
  # 使用 git bisect 或其他工具定位问题
  # 回滚有问题的单个变更
  ```

- [ ] 优化应用性能

  ```bash
  # 检查构建大小
  npm run build:prod
  # 分析 bundle
  ```

- [ ] 生成最终的重构报告

  ```bash
  # 创建重构总结
  git diff --stat >> refactor-summary.txt
  npm run lint:check >> refactor-summary.txt
  npm run test:coverage >> refactor-summary.txt
  ```

- [ ] 记录到迁移日志

  ```bash
  echo "$(date): 阶段 8 完成 - 验证与优化" >> migration-log.txt
  echo "$(date): 架构重构全部完成!" >> migration-log.txt
  ```

- [ ] 创建最终提交与标签
  ```bash
  git add -u
  git commit -m "refactor: 完成前端架构重构"
  git tag refactor/frontend-architecture-complete
  ```

#### 输出：

- 完整的测试报告
- 重构总结文档
- 最终代码提交

---

## 四、每日进度检查机制

### 每日站会问题

1. **昨天完成了什么？**
   - 回顾昨日任务
   - 检查是否有阻塞问题

2. **今天计划做什么？**
   - 明确今日目标
   - 确保与整体进度一致

3. **有什么问题需要帮助？**
   - 及时暴露风险
   - 寻求团队支持

### 每日检查清单

- [ ] 所有测试通过
- [ ] 可以正常构建
- [ ] 代码已提交并推送
- [ ] 迁移日志已更新
- [ ] 无未解决的类型错误
- [ ] 无 ESLint 警告

---

## 五、问题处理机制

### 常见问题处理

| 问题           | 可能原因                    | 解决方法                                     |
| -------------- | --------------------------- | -------------------------------------------- |
| 类型检查失败   | 导入路径错误                | 检查路径别名配置，更新导入语句               |
| 构建失败       | 缺少依赖或配置错误          | 清理 node_modules 重新安装，检查 vite 配置   |
| 测试失败       | 组件未正确挂载或依赖未 mock | 添加 mock 依赖，使用 Vue Test Utils 正确挂载 |
| 路由不工作     | 路径配置错误                | 检查路由配置，验证组件导入路径               |
| Store 状态异常 | 初始化问题                  | 检查 Pinia 配置，确保正确创建实例            |

### 回滚策略

**快速回滚整个重构：**

```bash
# 方式 1：使用备份标签
git checkout backup/frontend-architecture-$(date +%Y%m%d)
cp -r src.backup.* src

# 方式 2：使用 git reset
git reset --hard HEAD~N  # N 为要回滚的提交数
```

**部分回滚单个阶段：**

```bash
# 使用 git revert 回滚特定提交
git revert <commit-hash>

# 或使用 git restore 恢复特定文件
git restore --source=<commit-hash> -- path/to/file
```

### 关键里程碑

- **里程碑 1（第 2 天结束）**：阶段 2 完成，应用入口与配置重构完成，基础功能可用
- **里程碑 2（第 5 天结束）**：阶段 4 完成，页面与功能模块重构完成
- **里程碑 3（第 9 天结束）**：阶段 6 完成，所有代码迁移完成
- **里程碑 4（第 14 天结束）**：全部完成，测试通过，可合并到主分支

---

## 六、验收标准

### 代码质量

- [ ] 符合项目架构规范（6 层目录结构）
- [ ] 无未解决的类型错误
- [ ] 代码风格统一（ESLint + Prettier）
- [ ] 无循环依赖

### 功能完整性

- [ ] 所有页面可正常访问
- [ ] 所有功能正常工作
- [ ] API 调用正常
- [ ] 数据展示与交互正常

### 测试覆盖

- [ ] 单元测试覆盖率 ≥ 70%
- [ ] 集成测试覆盖率 ≥ 30%
- [ ] 总体覆盖率 ≥ 80%
- [ ] 所有测试通过

### 性能指标

- [ ] 页面加载时间 ≤ 2s
- [ ] 首屏渲染时间 ≤ 1s
- [ ] 构建时间合理

---

## 七、后续优化建议

### 短期优化（重构后 1 周）

1. 添加 E2E 测试（Playwright）
2. 完善组件文档（Storybook）
3. 优化 bundle 大小
4. 添加性能监控

### 长期优化（重构后 1 个月）

1. 建立代码审查流程
2. 添加自动发布流程
3. 完善架构文档
4. 建立组件库

---

## 附录：相关文档

- `architecture-refactor-plan.md` - 整体重构计划
- `migration-mapping.md` - 详细迁移映射表
- `backup-migration-strategy.md` - 备份与迁移策略
- `testing-strategy.md` - 测试策略

---

**祝您重构顺利！**
