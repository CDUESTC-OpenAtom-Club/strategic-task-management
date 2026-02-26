<template>
  <div class="profile-view">
    <!-- 页面头部 - Requirements: 5.1, 5.2, 5.3, 5.4 -->
    <div class="profile-header">
      <div class="header-content">
        <h1 class="page-title">个人信息管理</h1>
        <p class="page-desc">管理您的个人资料、密码和通知偏好设置</p>
      </div>
    </div>

    <!-- 用户信息卡片 - Requirements: 2.1, 2.2, 3.4 -->
    <el-card class="user-card card-animate" shadow="never">
      <div class="user-avatar-section">
        <div class="avatar-wrapper">
          <el-avatar :size="80" class="user-avatar">
            {{ currentUser?.name?.charAt(0) || 'U' }}
          </el-avatar>
          <el-button class="avatar-edit-btn" circle size="small" type="primary">
            <el-icon><Edit /></el-icon>
          </el-button>
        </div>
        <div class="user-info">
          <h2 class="user-name">{{ currentUser?.name || '用户' }}</h2>
          <div class="user-meta">
            <el-tag size="small" type="info">{{ currentUser?.department || '未分配部门' }}</el-tag>
            <span class="user-role">{{ getRoleLabel(currentUser?.role) }}</span>
          </div>
        </div>
      </div>
    </el-card>

    <!-- Tab 内容区 - Requirements: 2.1, 5.1 -->
    <el-card class="content-card card-animate" shadow="never">
      <el-tabs v-model="activeTab" class="profile-tabs">
        <el-tab-pane label="基本信息" name="basic">
          <transition name="tab-fade" mode="out-in">
            <BasicInfo v-if="activeTab === 'basic'" />
          </transition>
        </el-tab-pane>
        <el-tab-pane label="修改密码" name="password">
          <transition name="tab-fade" mode="out-in">
            <ChangePassword v-if="activeTab === 'password'" />
          </transition>
        </el-tab-pane>
        <el-tab-pane label="通知设置" name="notifications">
          <transition name="tab-fade" mode="out-in">
            <NotificationSettings v-if="activeTab === 'notifications'" />
          </transition>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Edit } from '@element-plus/icons-vue'
import BasicInfo from '@/components/profile/BasicInfo.vue'
import ChangePassword from '@/components/profile/ChangePassword.vue'
import NotificationSettings from '@/components/profile/NotificationSettings.vue'
import { useAuthStore } from '@/stores/auth'

// 使用共享 Store
const authStore = useAuthStore()

// 当前用户信息
const currentUser = computed(() => authStore.user)

const activeTab = ref('basic')

// 角色标签映射
const getRoleLabel = (role?: string) => {
  const roleMap: Record<string, string> = {
    'strategic_dept': '战略发展部',
    'functional_dept': '职能部门',
    'secondary_college': '二级学院'
  }
  return roleMap[role || ''] || '普通用户'
}
</script>

<style scoped>
/* ========================================
   ProfileView 统一样式
   使用 colors.css 中定义的 CSS 变量
   Requirements: 2.1, 3.4, 5.1
   ======================================== */

/* 页面主容器 - 使用统一的页面容器样式 */
.profile-view {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2xl);
  max-width: 900px;
  margin: 0 auto;
}

/* ========================================
   页面头部样式 - 统一页面头部规范
   Requirements: 5.1, 5.2, 5.3, 5.4
   ======================================== */
.profile-header {
  margin-bottom: var(--spacing-md);
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--text-main);
}

.page-desc {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
}

/* ========================================
   用户信息卡片样式 - 统一卡片规范
   Requirements: 2.1, 2.2, 2.4
   ======================================== */
.user-card {
  background: var(--bg-white);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-card);
  transition: box-shadow var(--transition-normal);
}

.user-card:hover {
  box-shadow: var(--shadow-hover);
}

/* 用户头像区域 - Requirements: 3.4 */
.user-avatar-section {
  display: flex;
  align-items: center;
  gap: var(--spacing-xl);
  padding: var(--spacing-lg) 0;
}

.avatar-wrapper {
  position: relative;
  flex-shrink: 0;
}

.user-avatar {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
  font-size: 28px;
  font-weight: 600;
  color: var(--bg-white);
  box-shadow: var(--shadow-card);
  transition: box-shadow var(--transition-normal);
}

.user-avatar:hover {
  box-shadow: var(--shadow-hover);
}

.avatar-edit-btn {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 28px;
  height: 28px;
  box-shadow: var(--shadow-card);
  transition: all var(--transition-fast);
}

.avatar-edit-btn:hover {
  transform: scale(1.1);
  box-shadow: var(--shadow-hover);
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.user-name {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-main);
}

.user-meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.user-role {
  font-size: 13px;
  color: var(--text-secondary);
}

/* ========================================
   内容卡片样式 - 统一卡片规范
   Requirements: 2.1, 2.2
   ======================================== */
.content-card {
  background: var(--bg-white);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-card);
  transition: box-shadow var(--transition-normal);
  min-height: 400px;
}

.content-card:hover {
  box-shadow: var(--shadow-hover);
}

/* ========================================
   Tab 样式定制 - 统一 Tab 规范
   Requirements: 5.1
   ======================================== */
.profile-tabs :deep(.el-tabs__header) {
  margin-bottom: var(--spacing-xl);
  border-bottom: 1px solid var(--border-light);
}

.profile-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.profile-tabs :deep(.el-tabs__item) {
  font-size: 15px;
  padding: 0 var(--spacing-xl);
  height: 48px;
  line-height: 48px;
  color: var(--text-regular);
  transition: all var(--transition-fast);
}

.profile-tabs :deep(.el-tabs__item:hover) {
  color: var(--color-primary);
}

.profile-tabs :deep(.el-tabs__item.is-active) {
  color: var(--color-primary);
  font-weight: 600;
}

.profile-tabs :deep(.el-tabs__active-bar) {
  height: 3px;
  border-radius: 2px;
  background-color: var(--color-primary);
  transition: transform var(--transition-normal);
}

/* ========================================
   Tab 切换过渡动画 - 统一过渡动画规范
   Requirements: 6.1
   ======================================== */
.tab-fade-enter-active,
.tab-fade-leave-active {
  transition: all var(--transition-normal);
}

.tab-fade-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.tab-fade-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* ========================================
   卡片入场动画 - 统一动画规范
   Requirements: 6.1
   ======================================== */
.card-animate {
  animation: fadeInUp 0.4s ease-out;
}

.card-animate:nth-child(2) {
  animation-delay: 0.1s;
}

.card-animate:nth-child(3) {
  animation-delay: 0.2s;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ========================================
   标签样式 - 统一标签规范
   Requirements: 9.1, 9.3
   ======================================== */
.user-meta :deep(.el-tag) {
  border-radius: var(--radius-sm);
}

/* ========================================
   按钮过渡效果 - 统一过渡动画规范
   Requirements: 6.1
   ======================================== */
:deep(.el-button) {
  transition: all var(--transition-fast);
}

:deep(.el-button:active) {
  transform: scale(0.96);
}
</style>