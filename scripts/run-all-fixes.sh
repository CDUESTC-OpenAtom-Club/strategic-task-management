#!/bin/bash
# 长期多轮测试和修复主控制脚本
# 此脚本将按顺序执行所有修复轮次

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( dirname "$SCRIPT_DIR" )"
cd "$PROJECT_DIR"

echo "=========================================="
echo "  前端架构长期修复计划"
echo "  项目: $PROJECT_DIR"
echo "  开始时间: $(date)"
echo "=========================================="

# 创建必要的目录
mkdir -p logs
mkdir -p docs

# 进度日志文件
PROGRESS_LOG="logs/progress.log"
if [ ! -f "$PROGRESS_LOG" ]; then
  touch "$PROGRESS_LOG"
fi

# 记录开始时间
echo "===== 修复开始 $(date) =====" >> "$PROGRESS_LOG"

# 定义各轮次脚本
ROUNDS=(
  "fix-round1-p0.sh:第一轮：P0关键修复"
  "fix-round2-types.sh:第二轮：类型安全增强"
  "fix-round5-testing.sh:第三轮：全面测试和验收"
)

# 总轮次数
TOTAL_ROUNDS=${#ROUNDS[@]}
CURRENT_ROUND=0
FAILED_ROUNDS=()

# 执行每一轮
for round_info in "${ROUNDS[@]}"; do
  IFS=':' read -r script_name description <<< "$round_info"
  CURRENT_ROUND=$((CURRENT_ROUND + 1))

  echo ""
  echo "=========================================="
  echo "  [$CURRENT_ROUND/$TOTAL_ROUNDS] $description"
  echo "=========================================="

  # 检查脚本是否存在
  if [ ! -f "scripts/$script_name" ]; then
    echo "❌ 脚本不存在: scripts/$script_name"
    FAILED_ROUNDS+=("$description (脚本不存在)")
    continue
  fi

  # 添加执行权限
  chmod +x "scripts/$script_name"

  # 执行脚本
  if bash "scripts/$script_name"; then
    echo "✅ $description 完成"
    echo "$(date): Round $CURRENT_ROUND - SUCCESS" >> "$PROGRESS_LOG"
  else
    echo "❌ $description 失败"
    echo "$(date): Round $CURRENT_ROUND - FAILED" >> "$PROGRESS_LOG"
    FAILED_ROUNDS+=("$description")

    # 询问是否继续
    echo ""
    echo "⚠️ 当前轮次失败，是否继续执行下一轮？"
    echo "  输入 'yes' 继续，其他任意键停止"
    read -r response
    if [ "$response" != "yes" ]; then
      echo "用户选择停止执行"
      break
    fi
  fi

  # 每轮完成后建议提交
  echo ""
  echo "💡 建议提交当前轮次的更改："
  echo "   git add ."
  echo "   git commit -m \"fix: 完成 $description\""
  echo ""
  echo "按 Enter 继续下一轮，或输入 'commit' 自动提交..."
  read -r user_input

  if [ "$user_input" = "commit" ]; then
    git add .
    git commit -m "fix: 完成 $description"
    echo "✅ 已提交更改"
  fi
done

# 生成总结报告
echo ""
echo "=========================================="
echo "  执行总结"
echo "=========================================="

SUCCESS_COUNT=$((CURRENT_ROUND - ${#FAILED_ROUNDS[@]}))
echo "总轮次: $TOTAL_ROUNDS"
echo "成功: $SUCCESS_COUNT"
echo "失败: ${#FAILED_ROUNDS[@]}"

if [ ${#FAILED_ROUNDS[@]} -gt 0 ]; then
  echo ""
  echo "失败的轮次:"
  for failed_round in "${FAILED_ROUNDS[@]}"; do
    echo "  ❌ $failed_round"
  done
fi

# 最终检查
echo ""
echo "=========================================="
echo "  最终状态检查"
echo "=========================================="

# 统计当前错误和警告
ERRORS=$(npm run lint 2>&1 | grep -c "error" || echo "0")
WARNINGS=$(npm run lint 2>&1 | grep -c "warning" || echo "0")

echo "ESLint错误: $ERRORS"
echo "ESLint警告: $WARNINGS"

# 类型检查
if npm run type-check > /dev/null 2>&1; then
  echo "类型检查: ✅ 通过"
else
  echo "类型检查: ❌ 失败"
fi

# 构建检查
if npm run build > /dev/null 2>&1; then
  echo "构建: ✅ 成功"
else
  echo "构建: ❌ 失败"
fi

# 记录结束时间
echo "===== 修复结束 $(date) =====" >> "$PROGRESS_LOG"

# 生成最终报告
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
cat > "docs/FIXES_SUMMARY_$TIMESTAMP.md" << EOF
# 修复执行总结报告

## 执行信息
- 开始时间: $(head -2 "$PROGRESS_LOG" | tail -1 | cut -d' ' -f4-)
- 结束时间: $(date)
- 总轮次: $TOTAL_ROUNDS
- 成功: $SUCCESS_COUNT
- 失败: ${#FAILED_ROUNDS[@]}

## 当前状态

| 指标 | 值 |
|-----|---|
| ESLint错误 | $ERRORS |
| ESLint警告 | $WARNINGS |
| 类型检查 | $(npm run type-check > /dev/null 2>&1 && echo "通过 ✅" || echo "失败 ❌") |
| 构建状态 | $(npm run build > /dev/null 2>&1 && echo "成功 ✅" || echo "失败 ❌") |

## 执行详情

$(cat "$PROGRESS_LOG")

## 下一步建议

$([ $ERRORS -eq 0 ] && [ $SUCCESS_COUNT -eq $TOTAL_ROUNDS ] && echo "✅ 所有修复完成，项目可以投入生产使用！" || echo "⚠️ 仍有问题需要修复，请查看失败的轮次并手动处理。")

---

报告生成时间: $(date)
EOF

echo ""
echo "📄 详细报告已生成: docs/FIXES_SUMMARY_$TIMESTAMP.md"

if [ $ERRORS -eq 0 ] && [ $SUCCESS_COUNT -eq $TOTAL_ROUNDS ]; then
  echo ""
  echo "=========================================="
  echo "  ✅🎉 所有修复完成！"
  echo "  前端项目已准备就绪！"
  echo "=========================================="
  exit 0
else
  echo ""
  echo "=========================================="
  echo "  ⚠️ 执行完成，但仍有问题"
  echo "  请查看报告了解详情"
  echo "=========================================="
  exit 1
fi
