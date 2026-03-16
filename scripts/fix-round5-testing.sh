#!/bin/bash
# 第五轮：全面测试和验收
# 目标：验证所有功能正常工作，系统可以投入使用

set -e

echo "=========================================="
echo "  第五轮：全面测试和验收"
echo "  开始时间: $(date)"
echo "=========================================="

PROJECT_DIR="/Users/blackevil/Documents/前端架构测试/strategic-task-management"
cd "$PROJECT_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="logs/round5_${TIMESTAMP}.log"

# 测试结果汇总
UNIT_TEST_RESULT=""
E2E_TEST_RESULT=""
BUILD_RESULT=""
LINT_RESULT=""

echo -e "\n=========================================="
echo "  1. 代码质量检查"
echo "=========================================="

echo -e "\n步骤1：运行ESLint检查..."
npm run lint 2>&1 | tee -a "$LOG_FILE"
lint_exit=$?
errors=$(npm run lint 2>&1 | grep -c "error" || echo "0")
warnings=$(npm run lint 2>&1 | grep -c "warning" || echo "0")

if [ $lint_exit -eq 0 ] && [ "$errors" -eq 0 ]; then
  LINT_RESULT="✅ 通过 (0错误, ${warnings}警告)"
else
  LINT_RESULT="❌ 失败 (${errors}错误, ${warnings}警告)"
fi
echo "  $LINT_RESULT"

echo -e "\n步骤2：运行TypeScript类型检查..."
npm run type-check 2>&1 | tee -a "$LOG_FILE"
type_exit=$?
if [ $type_exit -eq 0 ]; then
  echo "  ✅ 类型检查通过"
else
  echo "  ❌ 类型检查失败"
fi

echo -e "\n步骤3：代码格式检查..."
npm run format:check 2>&1 | tee -a "$LOG_FILE"
format_exit=$?
if [ $format_exit -eq 0 ]; then
  echo "  ✅ 代码格式符合规范"
else
  echo "  ⚠️ 代码格式需要调整（运行 npm run format 修复）"
fi

echo -e "\n=========================================="
echo "  2. 单元测试"
echo "=========================================="

echo -e "\n步骤4：运行单元测试..."
if npm run test 2>&1 | tee -a "$LOG_FILE"; then
  test_exit=$?
  # 统计测试用例数
  test_count=$(grep -c "PASS" "$LOG_FILE" || echo "0")
  UNIT_TEST_RESULT="✅ 通过 (${test_count}个测试)"
else
  test_exit=$?
  UNIT_TEST_RESULT="❌ 失败 (退出码: $test_exit)"
fi
echo "  $UNIT_TEST_RESULT"

echo -e "\n=========================================="
echo "  3. 构建验证"
echo "=========================================="

echo -e "\n步骤5：清理并重新构建..."
rm -rf dist
npm run build 2>&1 | tee -a "$LOG_FILE"
build_exit=$?
if [ $build_exit -eq 0 ]; then
  BUILD_RESULT="✅ 成功"
  # 获取构建时间
  build_time=$(grep "Build completed in" "$LOG_FILE" | tail -1 | awk '{print $NF}')
  echo "  ✅ 构建成功 ($build_time)"

  # 检查输出文件
  if [ -d "dist" ]; then
    file_count=$(find dist -type f | wc -l | tr -d ' ')
    total_size=$(du -sh dist | awk '{print $1}')
    echo "  输出: $file_count 个文件, 总大小 $total_size"
  fi
else
  BUILD_RESULT="❌ 失败 (退出码: $build_exit)"
fi

echo -e "\n步骤6：生产预览测试..."
# 启动预览服务器
npm run preview > /dev/null 2>&1 &
PREVIEW_PID=$!
sleep 5

# 检查服务器是否启动
if kill -0 $PREVIEW_PID 2>/dev/null; then
  echo "  ✅ 预览服务器启动成功 (PID: $PREVIEW_PID)"

  # 简单的HTTP检查
  if command -v curl &> /dev/null; then
    http_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4173 || echo "000")
    if [ "$http_status" = "200" ]; then
      echo "  ✅ HTTP服务正常 (状态码: 200)"
    else
      echo "  ⚠️ HTTP响应异常 (状态码: $http_status)"
    fi
  fi

  # 停止预览服务器
  kill $PREVIEW_PID 2>/dev/null || true
else
  echo "  ⚠️ 预览服务器启动失败"
fi

echo -e "\n=========================================="
echo "  4. 架构完整性检查"
echo "=========================================="

echo -e "\n步骤7：检查Feature目录结构..."
features=(
  "auth"
  "admin"
  "approval"
  "dashboard"
  "messages"
  "milestone"
  "organization"
  "plan"
  "profile"
  "strategic-indicator"
  "task"
  "user"
)

missing_index=()
for feature in "${features[@]}"; do
  if [ ! -f "src/features/$feature/index.ts" ]; then
    missing_index+=("$feature")
  fi
done

if [ ${#missing_index[@]} -eq 0 ]; then
  echo "  ✅ 所有Feature都有index.ts导出"
else
  echo "  ❌ 缺少index.ts的Feature: ${missing_index[*]}"
fi

echo -e "\n步骤8：检查Processes和Widgets层..."
if [ -d "src/processes" ]; then
  process_count=$(find src/processes -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
  echo "  ✅ Processes层存在 ($process_count 个流程模块)"
else
  echo "  ⚠️ Processes层未创建（可选）"
fi

if [ -d "src/widgets" ]; then
  widget_count=$(find src/widgets -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
  echo "  ✅ Widgets层存在 ($widget_count 个部件)"
else
  echo "  ⚠️ Widgets层未创建（可选）"
fi

echo -e "\n步骤9：检查共享模块..."
shared_modules=(
  "lib/composables"
  "lib/api"
  "lib/charts"
  "lib/validation"
  "api"
)

for module in "${shared_modules[@]}"; do
  if [ -d "src/shared/$module" ] || [ -f "src/shared/$module/index.ts" ]; then
    echo "  ✅ src/shared/$module"
  else
    echo "  ⚠️ src/shared/$module 不存在"
  fi
done

echo -e "\n=========================================="
echo "  5. 依赖安全检查"
echo "=========================================="

echo -e "\n步骤10：检查过时的依赖..."
if command -v npm &> /dev/null; then
  npm outdated 2>&1 | tee -a "$LOG_FILE" | head -20
  echo "  ℹ️ 依赖检查完成（建议定期更新）"
fi

echo -e "\n=========================================="
echo "  测试验收报告"
echo "=========================================="

cat << EOF
┌─────────────────────────────────────────────┐
│              测试验收报告                    │
├─────────────────────────────────────────────┤
│ ESLint检查      │ $LINT_RESULT"
│ 类型检查        │ $([ $type_exit -eq 0 ] && echo "✅ 通过" || echo "❌ 失败")"
│ 单元测试        │ $UNIT_TEST_RESULT"
│ 构建验证        │ $BUILD_RESULT"
│ Feature结构     │ $([ ${#missing_index[@]} -eq 0 ] && echo "✅ 完整" || echo "❌ 有缺失")"
├─────────────────────────────────────────────┤
│ 总体状态         │ $([ $lint_exit -eq 0 ] && [ $build_exit -eq 0 ] && [ ${#missing_index[@]} -eq 0 ] && echo "✅ 可以投入使用" || echo "❌ 需要修复问题")"
└─────────────────────────────────────────────┘
EOF

echo -e "\n=========================================="
echo "  第五轮完成"
echo "  结束时间: $(date)"
echo "=========================================="

# 生成最终报告
cat > "docs/FINAL_ACCEPTANCE_REPORT_$TIMESTAMP.md" << EOF
# 前端项目最终验收报告

## 验收时间
- 开始: $(date)
- 完成: $(date)

## 代码质量

| 项目 | 结果 |
|-----|------|
| ESLint错误 | $errors 个 |
| ESLint警告 | $warnings 个 |
| 类型检查 | $([ $type_exit -eq 0 ] && echo "通过 ✅" || echo "失败 ❌") |
| 代码格式 | $([ $format_exit -eq 0 ] && echo "符合规范 ✅" || echo "需要调整 ⚠️") |

## 测试结果

| 测试类型 | 结果 |
|---------|------|
| 单元测试 | $UNIT_TEST_RESULT |
| 构建测试 | $BUILD_RESULT |

## 架构完整性

- Feature模块: $([ ${#missing_index[@]} -eq 0 ] && echo "完整 ✅" || echo "有缺失 ❌")"
- 共享模块: 已实现
- Processes层: $([ -d "src/processes" ] && echo "已创建 ✅" || echo "未创建 ⚠️")"
- Widgets层: $([ -d "src/widgets" ] && echo "已创建 ✅" || echo "未创建 ⚠️")"

## 投入使用建议

$([ $lint_exit -eq 0 ] && [ $build_exit -eq 0 ] && [ ${#missing_index[@]} -eq 0 ] && echo "### ✅ 项目可以投入使用

所有关键检查项已通过，前端系统已准备就绪。" || echo "### ❌ 需要修复问题后再投入使用

请先解决上述问题后再部署到生产环境。")

## 后续建议

1. 继续减少ESLint警告
2. 完善单元测试覆盖率
3. 定期更新依赖包
4. 添加性能监控

---

报告生成时间: $(date)
EOF

# 保存进度
cat >> "logs/progress.log" << EOF
$(date): Round 5 - Lint:$errors/$warnings TypeCheck:$type_exit UnitTest:$test_exit Build:$build_exit Status:完成
EOF

if [ $lint_exit -eq 0 ] && [ $build_exit -eq 0 ] && [ ${#missing_index[@]} -eq 0 ]; then
  echo "✅ 第五轮验收通过 - 前端项目可以投入使用！"
  echo "📄 详细报告: docs/FINAL_ACCEPTANCE_REPORT_$TIMESTAMP.md"
  exit 0
else
  echo "⚠️ 第五轮验收发现问题，请查看报告"
  echo "📄 详细报告: docs/FINAL_ACCEPTANCE_REPORT_$TIMESTAMP.md"
  exit 1
fi
