<template>
  <div class="error-page">
    <div class="error-content">
      <div class="error-code">403</div>
      <div class="error-title">访问被拒绝</div>
      <div class="error-desc">您没有权限访问此页面</div>
      <div class="error-actions">
        <el-button type="primary" @click="handleGoBack"> 返回上一页 </el-button>
        <el-button @click="handleGoHome"> 回到首页 </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const handleGoBack = () => {
  router.back()
}

const handleGoHome = () => {
  router.push('/dashboard')
}
</script>

<style scoped>
.error-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}

.error-content {
  text-align: center;
}

.error-code {
  font-size: 120px;
  font-weight: 700;
  color: var(--el-color-warning);
  line-height: 1;
  margin-bottom: 20px;
}

.error-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 12px;
}

.error-desc {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin-bottom: 32px;
}

.error-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}
</style>
