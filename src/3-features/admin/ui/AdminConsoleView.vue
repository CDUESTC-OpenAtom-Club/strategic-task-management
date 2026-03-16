<template>
  <div class="admin-console">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">
          <el-icon><Monitor /></el-icon>
          管理员控制台
        </h1>
        <p class="page-desc">管理系统用户密码及权限配置</p>
      </div>
    </div>

    <!-- 用户管理组件 -->
    <UserManagement />
  </div>
</template>

<script setup lang="ts">
import { Monitor } from '@element-plus/icons-vue'
import UserManagement from '@/3-features/admin/ui/UserManagement.vue'
</script>

<style scoped>
.admin-console {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.header-left {
  flex: 1;
}

.page-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.page-desc {
  margin: 0;
  font-size: 14px;
  color: var(--el-text-color-secondary);
}
</style>
