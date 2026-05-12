<template>
  <div class="error-page">
    <div class="error-content">
      <div class="error-code">403</div>
      <div class="error-title">访问被拒绝</div>
      <div class="error-desc">您没有权限访问此页面</div>
      <div class="error-detail">
        <el-alert type="warning" :closable="false" show-icon>
          <template #title>
            <span v-if="userRole">
              当前角色 <strong>{{ roleDisplayName }}</strong> 无权访问此功能
            </span>
            <span v-else> 请先登录后再尝试访问 </span>
          </template>
          <template #default>
            <p v-if="suggestedRoute" class="suggestion-text">
              您可以访问：<el-link type="primary" @click="goToSuggested">{{
                suggestedRouteName
              }}</el-link>
            </p>
          </template>
        </el-alert>
      </div>
      <div class="error-actions">
        <el-button type="primary" @click="handleGoBack"> 返回上一页 </el-button>
        <el-button @click="handleGoHome"> 回到首页 </el-button>
        <el-button v-if="!isAuthenticated" type="success" @click="handleGoLogin">
          去登录
        </el-button>
      </div>
      <!-- Auto-redirect countdown -->
      <div v-if="showCountdown" class="auto-redirect">
        <el-text type="info" size="small"> {{ countdown }} 秒后自动跳转到首页 </el-text>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/features/auth/model/store'

const router = useRouter()
const authStore = useAuthStore()

const countdown = ref(10)
const showCountdown = ref(true)
let countdownTimer: ReturnType<typeof setInterval> | null = null

const isAuthenticated = computed(() => authStore.isAuthenticated)
const userRole = computed(() => authStore.userRole)

const roleDisplayName = computed(() => {
  const roleMap: Record<string, string> = {
    strategic_dept: '战略发展部',
    functional_dept: '职能部门',
    secondary_college: '二级学院'
  }
  return roleMap[userRole.value || ''] || userRole.value || '未知'
})

const suggestedRoute = computed(() => {
  if (!isAuthenticated.value) return '/login'
  if (userRole.value === 'strategic_dept') return '/strategic-tasks'
  return '/dashboard'
})

const suggestedRouteName = computed(() => {
  if (!isAuthenticated.value) return '登录页面'
  if (userRole.value === 'strategic_dept') return '战略任务'
  return '仪表盘'
})

const handleGoBack = () => {
  router.back()
}

const handleGoHome = () => {
  router.push('/dashboard')
}

const handleGoLogin = () => {
  router.push('/login')
}

const goToSuggested = () => {
  router.push(suggestedRoute.value)
}

onMounted(() => {
  countdownTimer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      if (countdownTimer) {
        clearInterval(countdownTimer)
      }
      router.push('/dashboard')
    }
  }, 1000)
})

onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }
})
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
  max-width: 500px;
  padding: 20px;
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
  margin-bottom: 24px;
}

.error-detail {
  margin-bottom: 32px;
  text-align: left;
}

.suggestion-text {
  margin: 8px 0 0 0;
  font-size: 13px;
}

.error-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.auto-redirect {
  margin-top: 24px;
}
</style>
