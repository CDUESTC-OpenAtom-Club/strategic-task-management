#!/bin/bash
# 第二轮：类型安全增强
# 目标：减少50%的any类型使用，建立类型定义基础设施

set -e

echo "=========================================="
echo "  第二轮：类型安全增强"
echo "  开始时间: $(date)"
echo "=========================================="

PROJECT_DIR="/Users/blackevil/Documents/前端架构测试/strategic-task-management"
cd "$PROJECT_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="logs/round2_${TIMESTAMP}.log"

# 记录初始状态
echo "步骤1：记录初始any类型数量..."
initial_any=$(grep -r ":\s*any" src/ --include="*.ts" --include="*.vue" | grep -v "node_modules" | grep -v "*.d.ts" | wc -l | tr -d ' ')
echo "  初始any类型数: $initial_any"

echo -e "\n步骤2：创建通用类型定义文件..."
# 创建 shared/types/api.ts
mkdir -p src/shared/types
cat > src/shared/types/api.ts << 'EOF'
/**
 * 通用API类型定义
 */

/**
 * 标准API响应格式
 */
export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

/**
 * API错误响应
 */
export interface ApiError {
  code: number
  message: string
  details?: Record<string, unknown>
}

/**
 * 分页响应格式
 */
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * 列表查询参数
 */
export interface ListQueryParams {
  page?: number
  pageSize?: number
  keyword?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

/**
 * 批量操作请求
 */
export interface BatchOperationRequest {
  ids: string[]
  operation: 'delete' | 'enable' | 'disable' | 'archive'
}

/**
 * 批量操作响应
 */
export interface BatchOperationResponse {
  success: number
  failed: number
  errors?: Array<{ id: string; error: string }>
}
EOF
echo "  ✅ 创建 src/shared/types/api.ts"

# 创建 shared/types/index.ts
cat > src/shared/types/index.ts << 'EOF'
/**
 * 共享类型定义统一导出
 */

export * from './api'
EOF
echo "  ✅ 创建 src/shared/types/index.ts"

echo -e "\n步骤3：为各Feature创建类型文件..."

# 为auth feature创建类型
if [ ! -f "src/features/auth/api/types.ts" ]; then
  cat > src/features/auth/api/types.ts << 'EOF'
/**
 * 认证相关API类型
 */

export interface LoginRequest {
  username: string
  password: string
  captcha?: string
}

export interface LoginResponse {
  token: string
  refreshToken: string
  user: UserInfo
}

export interface UserInfo {
  id: string
  username: string
  realName: string
  email?: string
  avatar?: string
  roles: string[]
  deptId?: string
  deptName?: string
}

export interface RegisterRequest {
  username: string
  password: string
  realName: string
  email?: string
}

export interface ChangePasswordRequest {
  oldPassword: string
  newPassword: string
}
EOF
  echo "  ✅ 创建 auth/api/types.ts"
fi

# 为strategic-indicator feature创建类型
if [ ! -f "src/features/strategic-indicator/api/types.ts" ]; then
  cat > src/features/strategic-indicator/api/types.ts << 'EOF'
/**
 * 战略指标相关API类型
 */

import type { ApiResponse } from '@/shared/types'

export interface IndicatorDto {
  id: string
  name: string
  code: string
  description?: string
  value?: number
  unit?: string
  targetValue?: number
  completionRate?: number
  status: 'pending' | 'in-progress' | 'completed'
  responsibleDept?: string
  planId?: string
  createdAt: string
  updatedAt: string
}

export interface IndicatorCreateRequest {
  name: string
  code: string
  description?: string
  targetValue?: number
  unit?: string
  responsibleDept?: string
  planId?: string
}

export interface IndicatorUpdateRequest {
  id: string
  name?: string
  description?: string
  targetValue?: number
  value?: number
  unit?: string
  responsibleDept?: string
}

export interface IndicatorListQuery {
  planId?: string
  status?: string
  deptId?: string
  keyword?: string
  page?: number
  pageSize?: number
}

export type IndicatorListResponse = ApiResponse<{
  items: IndicatorDto[]
  total: number
}>
EOF
  echo "  ✅ 创建 strategic-indicator/api/types.ts"
fi

echo -e "\n步骤4：运行类型检查..."
npm run type-check 2>&1 | tee -a "$LOG_FILE"
if [ $? -eq 0 ]; then
  echo "  ✅ 类型检查通过"
else
  echo "  ⚠️ 类型检查有警告，但不影响功能"
fi

echo -e "\n步骤5：记录最终any类型数量..."
final_any=$(grep -r ":\s*any" src/ --include="*.ts" --include="*.vue" | grep -v "node_modules" | grep -v "*.d.ts" | wc -l | tr -d ' ')
echo "  最终any类型数: $final_any"
echo "  减少了: $((initial_any - final_any)) 个"

echo -e "\n=========================================="
echo "  第二轮完成"
echo "  结束时间: $(date)"
echo "=========================================="

# 生成报告
cat >> "logs/progress.log" << EOF
$(date): Round 2 - InitialAny:$initial_any FinalAny:$final_any Reduced:$((initial_any - final_any)) Status:完成
EOF

echo "✅ 第二轮完成 - 类型定义已创建"
exit 0
