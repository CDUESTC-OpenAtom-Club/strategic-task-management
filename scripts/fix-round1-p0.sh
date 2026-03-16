#!/bin/bash
# 第一轮：P0关键修复
# 目标：消除所有22个ESLint错误

set -e  # 遇到错误立即退出

echo "=========================================="
echo "  第一轮：P0关键修复"
echo "  开始时间: $(date)"
echo "=========================================="

PROJECT_DIR="/Users/blackevil/Documents/前端架构测试/strategic-task-management"
cd "$PROJECT_DIR"

# 创建日志目录
mkdir -p logs
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="logs/round1_${TIMESTAMP}.log"

echo "步骤1：备份当前代码..."
if [ ! -d "src.backup" ]; then
  cp -r src src.backup
  echo "✅ 备份完成: src.backup/"
else
  echo "ℹ️ 备份已存在，跳过"
fi

echo -e "\n步骤2：修复TaskIndicatorTree.vue中的字符串编码问题..."
# 问题：第123行有未终止的字符串（中文编码问题）
# 使用sed修复该行
FILE="src/features/task/ui/TaskIndicatorTree.vue"
if [ -f "$FILE" ]; then
  # 检查问题是否存在
  if grep -q "未分" "$FILE" 2>/dev/null; then
    echo "  修复第123行的未终止字符串..."
    # 该行应该修复为：const dept = indicator.responsibleDept || '未分配'
    sed -i.tmp "s/const dept = indicator.responsibleDept || '未分/const dept = indicator.responsibleDept || '未分配'/g" "$FILE"
    rm -f "${FILE}.tmp"
    echo "  ✅ TaskIndicatorTree.vue 已修复"
  else
    echo "  ℹ️ TaskIndicatorTree.vue 无问题或已修复"
  fi
fi

echo -e "\n步骤3：修复未使用的导入..."
# 修复 src/features/task/api/mutations.ts
FILE="src/features/task/api/mutations.ts"
if [ -f "$FILE" ]; then
  echo "  修复 mutations.ts 中未使用的导入..."
  # 删除未使用的 Indicator, Milestone 导入
  # 原始行: import type { ApiResponse, StrategicTask, Indicator, Milestone } from '@/types'
  # 修复为: import type { ApiResponse, StrategicTask } from '@/types'
  sed -i.tmp 's/, Indicator, Milestone } from '\''@\/types'\''//g' "$FILE"
  rm -f "${FILE}.tmp"
  echo "  ✅ mutations.ts 已修复"
fi

# 修复 src/features/task/model/store.ts
FILE="src/features/task/model/store.ts"
if [ -f "$FILE" ]; then
  echo "  修复 store.ts 中未使用的导入..."
  # 删除未使用的 TaskFilters 导入
  sed -i.tmp 's/, TaskFilters }/\}/g' "$FILE"
  rm -f "${FILE}.tmp"
  echo "  ✅ store.ts 已修复"
fi

# 修复 src/features/task/ui/TaskApprovalDrawer.vue
FILE="src/features/task/ui/TaskApprovalDrawer.vue"
if [ -f "$FILE" ]; then
  echo "  修复 TaskApprovalDrawer.vue 中未使用的导入..."
  # 删除未使用的 ref 导入（如果存在且未使用）
  # 需要检查是否真的未使用
  if grep -q "import.*ref.*from" "$FILE"; then
    # 检查是否使用了ref
    ref_count=$(grep -o "ref(" "$FILE" | wc -l | tr -d ' ')
    if [ "$ref_count" -eq 0 ]; then
      # 未使用，删除导入
      sed -i.tmp '/import.*ref.*from.*vue/d' "$FILE"
      rm -f "${FILE}.tmp"
      echo "  ✅ TaskApprovalDrawer.vue 已修复"
    fi
  fi
fi

echo -e "\n步骤4：运行ESLint自动修复..."
npm run lint -- --fix 2>&1 | tee -a "$LOG_FILE"

echo -e "\n步骤5：验证修复结果..."
# 统计错误和警告
errors=$(npm run lint 2>&1 | grep -c "error" || echo "0")
warnings=$(npm run lint 2>&1 | grep -c "warning" || echo "0")

echo "  ESLint错误数: $errors"
echo "  ESLint警告数: $warnings"

echo -e "\n步骤6：运行类型检查..."
npm run type-check 2>&1 | tee -a "$LOG_FILE"
if [ $? -eq 0 ]; then
  echo "  ✅ 类型检查通过"
else
  echo "  ❌ 类型检查失败"
fi

echo -e "\n步骤7：验证构建..."
npm run build 2>&1 | tee -a "$LOG_FILE"
if [ $? -eq 0 ]; then
  echo "  ✅ 构建成功"
else
  echo "  ❌ 构建失败"
fi

echo -e "\n=========================================="
echo "  第一轮完成"
echo "  结束时间: $(date)"
echo "=========================================="

# 生成报告
cat >> "logs/progress.log" << EOF
$(date): Round 1 - Errors:$errors Warnings:$warnings Status:完成
EOF

# 判断是否成功
if [ "$errors" -eq 0 ]; then
  echo "✅ 第一轮验证通过 - 所有错误已修复"
  exit 0
else
  echo "❌ 第一轮验证失败 - 仍有 $errors 个错误"
  echo "请检查日志: $LOG_FILE"
  exit 1
fi
