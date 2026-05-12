<template>
  <div class="admin-console-container" :class="{ 'is-collapsed': isCollapsed && !isHovered }">
    <!-- 左侧导航栏 -->
    <aside class="admin-sidebar" @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave">
      <div class="sidebar-header">
        <div class="header-icon-wrapper">
          <el-icon><Monitor /></el-icon>
        </div>
        <div class="header-info">
          <h2 class="title">控制台</h2>
          <p class="subtitle">管理系统核心配置</p>
        </div>
      </div>

      <nav class="sidebar-menu">
        <div
          v-for="item in menuItems"
          :key="item.id"
          class="menu-item"
          :class="{ active: activeTab === item.id }"
          @click="activeTab = item.id"
        >
          <el-tooltip
            :content="item.label"
            placement="right"
            :disabled="!isCollapsed || isHovered"
            effect="dark"
          >
            <div class="menu-item-inner">
              <el-icon class="menu-icon">
                <component :is="item.icon" />
              </el-icon>
              <span class="menu-label">{{ item.label }}</span>
              <div v-if="activeTab === item.id" class="active-indicator" />
            </div>
          </el-tooltip>
        </div>
      </nav>

      <div class="sidebar-footer">
        <div class="version-tag">SISM Admin v1.2.0</div>
      </div>

      <!-- 锁定按钮 (固定/取消固定侧边栏) -->
      <div class="collapse-toggle-wrapper">
        <div
          class="collapse-toggle"
          :title="isCollapsed ? '展开菜单' : '收起菜单'"
          @click="toggleCollapse"
        >
          <el-icon>
            <DArrowRight v-if="isCollapsed && !isHovered" />
            <DArrowLeft v-else />
          </el-icon>
        </div>
      </div>
    </aside>

    <!-- 右侧内容区 -->
    <main class="admin-main">
      <div class="main-content-scroll">
        <transition name="page-fade" mode="out-in">
          <div :key="activeTab" class="fade-container">
            <!-- 动态渲染组件 -->
            <UserManagement v-if="activeTab === 'users'" />
            <SystemAnnouncementManagement v-else-if="activeTab === 'announcements'" />
          </div>
        </transition>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import { Monitor, User, Bell, DArrowLeft, DArrowRight } from '@element-plus/icons-vue'
import UserManagement from '@/features/admin/ui/UserManagement.vue'
import SystemAnnouncementManagement from '@/features/admin/ui/SystemAnnouncementManagement.vue'

// 菜单配置
const menuItems = [
  { id: 'users', label: '用户管理', icon: shallowRef(User) },
  { id: 'announcements', label: '系统公告', icon: shallowRef(Bell) }
]

// 状态管理
const activeTab = ref('users')
const isCollapsed = ref(true) // 默认收起
const isHovered = ref(false)

const handleMouseEnter = () => {
  isHovered.value = true
}

const handleMouseLeave = () => {
  isHovered.value = false
}

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}
</script>

<style scoped>
.admin-console-container {
  display: flex;
  height: calc(100vh - var(--header-height, 64px));
  background-color: #f8fafc;
  overflow: hidden;
}

/* 侧边栏基础样式 */
.admin-sidebar {
  width: 260px;
  background: white;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  z-index: 100;
  box-shadow: 4px 0 15px rgba(0, 0, 0, 0.02);
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

/* 收起状态样式 */
.is-collapsed .admin-sidebar {
  width: 78px;
}

.sidebar-header {
  padding: 32px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  overflow: hidden;
  white-space: nowrap;
}

.is-collapsed .sidebar-header {
  padding: 32px 17px;
}

.header-icon-wrapper {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 20px;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
  flex-shrink: 0;
}

.header-info {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.is-collapsed .header-info {
  opacity: 0;
  transform: translateX(-10px);
  pointer-events: none;
}

.header-info .title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
  letter-spacing: -0.025em;
}

.header-info .subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  color: #64748b;
}

.sidebar-menu {
  flex: 1;
  padding: 0 12px;
  overflow: hidden;
}

.menu-item {
  margin-bottom: 4px;
  cursor: pointer;
  border-radius: 10px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.menu-item-inner {
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  color: #64748b;
  font-weight: 500;
  font-size: 14px;
  white-space: nowrap;
}

.is-collapsed .menu-item-inner {
  padding: 14px 15px;
}

.menu-item:hover {
  background-color: #f1f5f9;
}

.menu-item:hover .menu-item-inner {
  color: #1e293b;
}

.menu-item.active {
  background-color: #eff6ff;
}

.menu-item.active .menu-item-inner {
  color: #2563eb;
  font-weight: 600;
}

.menu-label {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.is-collapsed .menu-label {
  opacity: 0;
  transform: translateX(-10px);
}

.menu-icon {
  font-size: 20px;
  transition: transform 0.25s ease;
  flex-shrink: 0;
}

.menu-item:hover .menu-icon {
  transform: scale(1.1);
}

.active-indicator {
  position: absolute;
  right: 12px;
  width: 4px;
  height: 16px;
  background-color: #2563eb;
  border-radius: 2px;
}

.is-collapsed .active-indicator {
  right: 6px;
}

.sidebar-footer {
  padding: 24px;
  border-top: 1px solid #f1f5f9;
  overflow: hidden;
  white-space: nowrap;
  transition: opacity 0.2s ease;
}

.is-collapsed .sidebar-footer {
  opacity: 0;
}

.version-tag {
  font-size: 11px;
  color: #94a3b8;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

/* 收起切换按钮 */
.collapse-toggle-wrapper {
  position: absolute;
  bottom: 24px;
  right: -14px;
  z-index: 101;
}

.collapse-toggle {
  width: 28px;
  height: 28px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #64748b;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

.collapse-toggle:hover {
  background: #2563eb;
  color: white;
  border-color: #2563eb;
  transform: scale(1.1);
}

/* 内容区样式 */
.admin-main {
  flex: 1;
  overflow: hidden;
  position: relative;
  transition: all 0.3s ease;
}

.main-content-scroll {
  height: 100%;
  overflow-y: auto;
  padding: 32px;
  scroll-behavior: smooth;
}

.fade-container {
  max-width: 1400px;
  margin: 0 auto;
}

/* 动画效果 */
.page-fade-enter-active,
.page-fade-leave-active {
  transition: all 0.3s ease;
}

.page-fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* 适配窄屏 */
@media (max-width: 1024px) {
  .admin-sidebar {
    width: 78px !important;
  }
  .header-info,
  .menu-label,
  .subtitle,
  .sidebar-footer,
  .active-indicator,
  .collapse-toggle-wrapper {
    display: none !important;
  }
}
</style>
