<template>
  <div class="profile-view">
    <el-card class="profile-card">
      <template #header>
        <div class="card-header">
          <span class="title">个人资料</span>
        </div>
      </template>

      <el-tabs v-model="activeTab" class="profile-tabs">
        <el-tab-pane label="基本信息" name="basic">
          <BasicInfo />
        </el-tab-pane>
        <el-tab-pane label="修改密码" name="password">
          <ChangePassword />
        </el-tab-pane>
        <el-tab-pane label="通知设置" name="notification">
          <NotificationSettings />
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import BasicInfo from './BasicInfo.vue'
import ChangePassword from './ChangePassword.vue'
import NotificationSettings from './NotificationSettings.vue'

const activeTab = ref('basic')
</script>

<style scoped>
.profile-view {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.profile-card {
  border-radius: 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header .title {
  font-size: 18px;
  font-weight: 600;
}

.profile-tabs {
  margin-top: 10px;
}

:deep(.el-tabs__content) {
  padding: 20px 0;
}
</style>
