<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Aim, Switch, Monitor, Lock, SwitchButton } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import YearSelector from '@/components/common/YearSelector.vue'
import {
  useAppLayout,
  useNavigation,
  useDepartmentSwitcher,
  useNotificationCenter
} from '@/composables/layout'
import { initApprovalNotifications } from '@/features/approval/services/approvalNotifications'
import { disconnectWebSocket } from '@/shared/services/websocket'

const router = useRouter()

// 开发环境检测
const isDev = import.meta.env.DEV

// 使用 Layout Composables
const { isLoggedIn, currentUser, isStrategicDept, strategicDeptName, handleLogout } = useAppLayout()

const { viewingDept, viewingRole, viewingDeptName, deptOptions } = useDepartmentSwitcher()

const { tabs, activeTab, handleTabClick } = useNavigation(viewingRole)

const { unreadCount, handleNotificationClick, Bell } = useNotificationCenter()

// 初始化审批通知
onMounted(() => {
  if (isLoggedIn.value) {
    initApprovalNotifications()
  }
})

// 清理WebSocket连接
onUnmounted(() => {
  disconnectWebSocket()
})

// 切换视角时导航到第一个可用的标签页
watch(viewingDept, () => {
  if (tabs.value.length > 0) {
    router.push(tabs.value[0].path)
  }
})

// 处理下拉菜单命令
const handleDropdownCommand = async (command: string) => {
  switch (command) {
    case 'console':
      router.push('/admin/console')
      break
    case 'changePassword':
      router.push('/profile?tab=password')
      break
    case 'logout':
      try {
        await ElMessageBox.confirm('确定要退出登录吗?', '退出确认', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        })
        handleLogout()
        disconnectWebSocket()
        router.push('/login')
      } catch {
        // 用户取消
      }
      break
  }
}
</script>

<template>
  <router-view v-if="!isLoggedIn" />

  <!-- 主应用界面 -->
  <div v-else class="app-container">
    <!-- 顶部导航栏 -->
    <header class="app-header">
      <div class="header-content">
        <div class="header-left">
          <div class="logo-box">
            <el-icon :size="24" color="#ffffff"><Aim /></el-icon>
          </div>
          <div class="title-box">
            <h1 class="app-title">战略指标管理系统</h1>
            <p class="app-subtitle">Strategic Indicator Management System</p>
          </div>
        </div>
        <div class="header-right">
          <!-- 年份选择器 -->
          <YearSelector />

          <!-- 战略发展部专属：部门视角切换 -->
          <div v-if="isStrategicDept" class="dept-switcher">
            <el-icon class="switcher-icon"><Switch /></el-icon>
            <el-select
              v-model="viewingDept"
              placeholder="切换部门视角"
              size="small"
              class="dept-select"
            >
              <el-option
                v-for="dept in deptOptions"
                :key="dept.value"
                :label="dept.label"
                :value="dept.value"
              >
                <span>{{ dept.label }}</span>
                <el-tag
                  v-if="dept.role === 'strategic_dept'"
                  size="small"
                  type="primary"
                  style="margin-left: 8px"
                  >管理</el-tag
                >
              </el-option>
            </el-select>
            <el-tag
              v-if="viewingDept !== strategicDeptName"
              type="warning"
              size="small"
              class="viewing-tag"
            >
              查看中: {{ viewingDeptName }}
            </el-tag>
          </div>

          <div class="user-info">
            <span class="dept-name">{{ currentUser?.department }}</span>
            <span class="user-name">{{ currentUser?.name }}</span>
          </div>
          <el-badge :value="unreadCount" :max="99" class="notification-badge">
            <el-button :icon="Bell" circle @click="handleNotificationClick" />
          </el-badge>
          <el-dropdown @command="handleDropdownCommand">
            <el-avatar class="user-avatar" :size="32">
              {{ currentUser?.name?.charAt(0)?.toUpperCase() || 'U' }}
            </el-avatar>
            <template #dropdown>
              <el-dropdown-menu>
                <!-- 管理员专属菜单 -->
                <el-dropdown-item v-if="isStrategicDept" command="console">
                  <el-icon><Monitor /></el-icon>
                  控制台
                </el-dropdown-item>

                <!-- 所有用户可见 -->
                <el-dropdown-item command="changePassword">
                  <el-icon><Lock /></el-icon>
                  修改密码
                </el-dropdown-item>

                <el-dropdown-item command="logout" :divided="isStrategicDept">
                  <el-icon><SwitchButton /></el-icon>
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="app-main">
      <!-- 标签页导航 -->
      <div v-if="tabs.length > 0" class="tab-nav">
        <div
          v-for="tab in tabs"
          :key="tab.id"
          :class="['tab-item', { active: activeTab === tab.id }]"
          role="tab"
          :aria-selected="activeTab === tab.id"
          tabindex="0"
          @click.stop.prevent="handleTabClick(tab.path)"
          @keydown.enter="handleTabClick(tab.path)"
          @keydown.space.prevent="handleTabClick(tab.path)"
        >
          <el-icon :size="20"><component :is="tab.icon" /></el-icon>
          <span>{{ tab.label }}</span>
        </div>
      </div>
      <!-- 调试信息（仅开发环境） -->
      <div v-else-if="isDev" class="debug-warning">
        <p>
          ⚠️ 导航标签未显示 - 当前角色: {{ viewingRole || '未知' }} | 标签数量: {{ tabs.length }}
        </p>
      </div>

      <!-- 内容区域 - 使用 router-view -->
      <div class="content-area">
        <router-view
          :viewing-role="viewingRole"
          :viewing-dept="viewingDept"
          :selected-role="viewingRole || ''"
        />
      </div>
    </main>
  </div>
</template>

<style scoped>
/* ========== 调试警告样式 ========== */
.debug-warning {
  background: #fff3cd;
  padding: 12px;
  margin-bottom: 20px;
  border-radius: 4px;
  border: 1px solid #ffc107;
}

.debug-warning p {
  margin: 0;
  color: #856404;
}

/* ========== 高校教务系统风格 - 主框架 ========== */
.app-container {
  --primary-dark: #1a365d;
  --primary: #2c5282;
  --primary-light: #3182ce;
  --accent: #c9a227;
  --text-dark: #1e293b;
  --text-regular: #475569;
  --text-light: #94a3b8;
  --bg-page: #f1f5f9;
  --bg-card: #ffffff;
  --border: #e2e8f0;

  min-height: 100vh;
  background: var(--bg-page);
}

/* ========== 顶部导航栏 ========== */
.app-header {
  background: linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 100%);
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(26, 54, 93, 0.3);
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 12px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-box {
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.title-box {
  display: flex;
  flex-direction: column;
}

.app-title {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  margin: 0;
  line-height: 1.2;
  letter-spacing: 1px;
}

.app-subtitle {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

/* 部门切换器 */
.dept-switcher {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.switcher-icon {
  color: var(--accent);
  font-size: 16px;
}

.dept-select {
  width: 130px;
}

.dept-select :deep(.el-input__wrapper) {
  box-shadow: none !important;
  background: transparent;
  border: none;
}

.dept-select :deep(.el-input__inner) {
  color: #fff;
  font-size: 13px;
}

.dept-select :deep(.el-input__suffix) {
  color: rgba(255, 255, 255, 0.7);
}

.viewing-tag {
  margin-left: 4px;
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(255, 255, 255, 0.9);
  color: var(--primary);
}

/* 用户信息 */
.user-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  margin-right: 8px;
}

.dept-name {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
}

.user-name {
  font-size: 13px;
  font-weight: 500;
  color: #fff;
}

.notification-badge {
  margin-right: 8px;
}

.notification-badge :deep(.el-button) {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
}

.notification-badge :deep(.el-button:hover) {
  background: rgba(255, 255, 255, 0.2);
}

.notification-badge :deep(.el-badge__content) {
  background: #dc2626;
}

.user-avatar {
  background: var(--accent);
  color: var(--primary-dark);
  font-weight: 700;
  cursor: pointer;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

/* ========== 主内容区 ========== */
.app-main {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px 24px;
}

/* ========== 标签页导航 ========== */
.tab-nav {
  background: var(--bg-card);
  border-radius: 4px;
  padding: 4px;
  margin-bottom: 20px;
  display: flex;
  gap: 4px;
  border: 1px solid var(--border);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.tab-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-regular);
  font-weight: 500;
  font-size: 14px;
  user-select: none;
  -webkit-user-select: none;
}

.tab-item:hover {
  background: var(--bg-page);
  color: var(--primary);
}

.tab-item.active {
  background: linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 100%);
  color: #fff;
  box-shadow: 0 2px 8px rgba(26, 54, 93, 0.3);
}

.content-area {
  min-height: calc(100vh - 180px);
}

/* ========== 响应式 ========== */
@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    gap: 12px;
    padding: 12px 16px;
  }

  .tab-nav {
    flex-wrap: wrap;
  }

  .tab-item {
    flex: 1 1 45%;
    padding: 10px 12px;
    font-size: 13px;
  }

  .app-subtitle {
    display: none;
  }

  .dept-switcher {
    display: none;
  }
}
</style>
