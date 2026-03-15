# Programmer A - 阶段一任务卡

> **模块**: Indicator模块合并
> **工期**: 3天
> **分支**: `refactor/phase1-emergency-fixes`
> **负责人**: Programmer A

---

## 📋 任务概述

合并 `features/indicator` 和 `features/strategic-indicator` 两个重复的模块。

---

## Day 1: 差异分析

### 上午：文件对比

```bash
# 1. 切换到工作分支
git checkout refactor/phase1-emergency-fixes

# 2. 创建备份分支（安全起见）
git checkout -b backup/indicator-merge-before

# 3. 对比两个模块的文件结构
tree features/indicator
tree features/strategic-indicator

# 4. 找出所有文件差异
diff -rq features/indicator features/strategic-indicator
```

### 下午：创建差异报告

创建文件 `docs/indicator-diff-report.md`：

```markdown
# Indicator模块差异报告

## 文件对比

### API层

| 文件                | indicator版 | strategic-indicator版 | 差异说明                              |
| ------------------- | ----------- | --------------------- | ------------------------------------- |
| api/indicatorApi.ts | ✅存在      | ✅存在                | indicator版有withRetry，strategic版无 |

### UI层

| 文件                     | indicator版 | strategic-indicator版 | 差异说明   |
| ------------------------ | ----------- | --------------------- | ---------- |
| ui/IndicatorListView.vue | 398行       | 412行                 | 需逐行对比 |

### 类型定义

| 文件     | indicator版 | strategic-indicator版 | 差异说明     |
| -------- | ----------- | --------------------- | ------------ |
| types.ts | ✅存在      | ✅存在                | 对比字段差异 |

## 引用分析

以下文件引用了旧的indicator模块：

- pages/strategy/indicators/ui/\*.vue
- features/plan/\*.ts
- features/task/\*.ts

## 风险点

1. withRetry逻辑差异
2. 组件props可能不一致
3. 类型定义可能有冲突
```

---

## Day 2: 执行合并

### Step 1: 创建合并目录

```bash
# 确保在正确分支
git checkout refactor/phase1-emergency-fixes

# 进入strategic-indicator目录
cd features/strategic-indicator

# 查看当前结构
ls -la
```

### Step 2: 合并API文件

```bash
# 1. 备份当前文件
cp api/indicator.ts api/indicator.ts.backup

# 2. 对比两个API文件
diff ../indicator/api/indicatorApi.ts api/indicator.ts

# 3. 手动合并
# 保留有withRetry的版本，或使用统一的apiClient
# api/indicator.ts 最终内容应该是合并后的版本
```

**检查清单**：

- [ ] API函数签名一致
- [ ] withRetry逻辑已统一
- [ ] 导出正确

### Step 3: 合并UI组件

```bash
# 1. 对比UI文件
diff ../indicator/ui/IndicatorListView.vue ui/IndicatorList.vue

# 2. 分析差异
# - template部分：选择更好的UI结构
# - script部分：合并业务逻辑
# - style部分：合并样式

# 3. 手动合并到 ui/IndicatorList.vue
```

**检查清单**：

- [ ] 组件props一致
- [ ] events一致
- [ ] 功能完整性

### Step 4: 合并类型定义

```bash
# 1. 对比类型文件
diff ../indicator/types.ts model/types.ts

# 2. 合并类型定义
# 确保所有必要的类型都包含在内
```

---

## Day 3: 引用更新与验证

### Step 1: 更新所有引用

```bash
# 1. 查找所有引用旧模块的文件
grep -r "features/indicator" src --include="*.ts" --include="*.vue" -l

# 2. 全局替换
find src -type f \( -name "*.ts" -o -name "*.vue" \) -exec sed -i '' 's|@/features/indicator|@/features/strategic-indicator|g' {} \;

# 3. 验证替换结果
grep -r "features/indicator" src
# 应该没有输出（除了我们创建的文档）
```

### Step 2: 删除旧模块

```bash
# 1. 确认所有引用已更新
git status

# 2. 删除旧模块
rm -rf features/indicator

# 3. 提交更改
git add -A
git commit -m "refactor: 合并indicator和strategic-indicator模块"
```

### Step 3: 运行测试

```bash
# 1. 类型检查
npm run type-check

# 2. 单元测试
npm run test

# 3. 构建
npm run build

# 4. 开发服务器测试
npm run dev
```

### Step 4: 手动功能测试

打开浏览器测试以下功能：

- [ ] 指标列表页面加载
- [ ] 指标搜索和过滤
- [ ] 指标详情查看
- [ ] 指标创建/编辑
- [ ] 指标删除

---

## ✅ 验收标准

- [ ] `features/indicator` 目录已删除
- [ ] 所有 `@/features/indicator` 引用已更新为 `@/features/strategic-indicator`
- [ ] npm run test 通过
- [ ] npm run build 成功无警告
- [ ] 手动测试指标功能正常
- [ ] 代码已提交到 `refactor/phase1-emergency-fixes`

---

## 🚨 问题处理

### 如果测试失败

1. **类型错误**

   ```bash
   # 查看具体错误
   npm run type-check 2>&1 | grep error
   ```

2. **导入错误**

   ```bash
   # 查找未更新的引用
   grep -r "from '@/features/indicator'" src
   ```

3. **功能异常**
   - 回滚到备份分支：`git checkout backup/indicator-merge-before`
   - 分析差异报告
   - 重新合并

### 回滚命令

```bash
# 如果需要完全回滚
git reset --hard HEAD~1
git checkout backup/indicator-merge-before
```

---

## 📝 每日报告模板

### Day 1 报告

```
✅ 完成：差异分析
📊 发现差异：X个文件
⚠️  风险点：列出风险
📅 明日计划：开始合并
```

### Day 2 报告

```
✅ 完成：合并API、UI、类型
🐛 遇到问题：描述问题
💡 解决方案：描述方案
📅 明日计划：更新引用和测试
```

### Day 3 报告

```
✅ 完成：引用更新、测试验证
📊 测试结果：全部通过/有待修复
🎯 验收状态：已达标/待修复
📅 后续计划：合并到主分支
```

---

## 📚 相关文档

- [重构方案总览](/Users/blackevil/Documents/前端架构测试/strategic-task-management/docs/前端渐进式重构方案.md)
- [代码规范](./CODING_STANDARDS.md)
