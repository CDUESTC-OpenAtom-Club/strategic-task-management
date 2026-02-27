<template>
  <div class="login-page">
    <!-- 背景层 - 轮换风景图 -->
    <div class="bg-layer">
      <transition-group name="bg-fade">
        <div 
          v-for="(img, index) in bgImages" 
          v-show="currentBgIndex === index"
          :key="img.id"
          class="bg-image"
          :style="{ backgroundImage: `url(${img.url})` }"
        ></div>
      </transition-group>
      <div class="bg-overlay"></div>
    </div>

    <!-- 主内容区 -->
    <div class="login-wrapper">
      <!-- 左侧：学校信息展示区 -->
      <div class="info-panel">
        <div class="school-brand">
          <div class="school-emblem">
            <svg viewBox="0 0 80 80" class="emblem-svg">
              <rect x="10" y="10" width="60" height="60" fill="none" stroke="currentColor" stroke-width="2"/>
              <rect x="20" y="20" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"/>
              <path d="M40 25 L40 55 M30 35 L50 35 M30 45 L50 45" stroke="currentColor" stroke-width="2"/>
            </svg>
          </div>
          <div class="school-text">
            <h1 class="school-name">战略指标管理系统</h1>
            <p class="school-name-en">Strategic Indicator Management System</p>
          </div>
        </div>

        <div class="info-content">
          <div class="info-stats">
            <div class="stat-item">
              <div class="stat-value">{{ currentTime }}</div>
              <div class="stat-label">当前时间</div>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <div class="stat-value">{{ currentDate }}</div>
              <div class="stat-label">{{ currentWeekday }}</div>
            </div>
          </div>

          <div class="info-notice">
            <div class="notice-header">
              <span class="notice-icon">📢</span>
              <span class="notice-title">系统公告</span>
            </div>
            <ul class="notice-list">
              <li>2025年度战略指标填报工作已启动</li>
              <li>请各部门于12月15日前完成数据提交</li>
              <li>系统维护时间：每周日 02:00-06:00</li>
            </ul>
          </div>

          <div class="info-links">
            <a href="#" class="info-link">使用手册</a>
            <span class="link-divider">|</span>
            <a href="#" class="info-link">常见问题</a>
            <span class="link-divider">|</span>
            <a href="#" class="info-link">技术支持</a>
          </div>
        </div>
      </div>

      <!-- 右侧：登录表单区 -->
      <div class="login-panel">
        <div class="login-card">
          <div class="login-header">
            <h2 class="login-title">用户登录</h2>
            <p class="login-subtitle">User Login</p>
          </div>

          <el-form 
            ref="loginFormRef" 
            :model="loginForm" 
            :rules="loginRules" 
            class="login-form"
            @keyup.enter="handleLogin"
          >
            <el-form-item prop="username">
              <div class="input-wrapper">
                <label class="input-label">用户名</label>
                <el-input
                  v-model="loginForm.username"
                  placeholder="请输入用户名"
                  size="large"
                  @input="resetErrorCount"
                >
                  <template #prefix>
                    <el-icon><User /></el-icon>
                  </template>
                </el-input>
              </div>
            </el-form-item>

            <el-form-item prop="password">
              <div class="input-wrapper">
                <label class="input-label">密码</label>
                <el-input
                  v-model="loginForm.password"
                  type="password"
                  placeholder="请输入密码"
                  size="large"
                  show-password
                >
                  <template #prefix>
                    <el-icon><Lock /></el-icon>
                  </template>
                </el-input>
              </div>
            </el-form-item>

            <div class="form-options">
              <el-checkbox v-model="rememberMe">记住用户名</el-checkbox>
              <el-button type="primary" link @click="handleForgotPassword">忘记密码？</el-button>
            </div>

            <el-form-item>
              <el-button
                type="primary"
                size="large"
                :loading="loading"
                :disabled="isLoginLocked"
                class="login-btn"
                native-type="button"
                @click.prevent="handleLogin"
              >
                {{ loading ? '登录中...' : (isLoginLocked ? '账户已锁定' : '登 录') }}
              </el-button>
            </el-form-item>
          </el-form>

          <!-- 锁定状态提示 -->
          <div v-if="isLoginLocked" class="lock-alert">
            <el-alert
              title="账户已被临时锁定"
              type="error"
              :closable="false"
              show-icon
            >
              <template #default>
                <p>由于多次登录失败，账户已被临时锁定。</p>
                <p>请5分钟后重试或联系管理员。</p>
              </template>
            </el-alert>
          </div>

          <!-- 错误次数提示 -->
          <div v-else-if="loginErrorCount > 0" class="error-alert">
            <el-alert
              :title="`登录失败，剩余尝试次数：${remainingAttempts}`"
              type="warning"
              :closable="false"
              show-icon
            />
          </div>

          <div class="login-footer">
            <div class="footer-status">
              <span class="status-indicator" :class="{ online: systemOnline }"></span>
              <span>{{ systemOnline ? '系统运行正常' : '系统维护中' }}</span>
            </div>
          </div>
        </div>

        <div class="copyright">
          <p>© 2024-2025 战略发展部 版权所有</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

// ========== 背景轮换图片 ==========
interface BgImage {
  id: number
  url: string
  author?: string
}

const bgImages = ref<BgImage[]>([])
const currentBgIndex = ref(0)
let bgInterval: ReturnType<typeof setInterval> | null = null

// 预设的高质量风景图（校园/建筑/自然风光）
const defaultBgImages: BgImage[] = [
  { id: 1, url: 'https://images.unsplash.com/photo-1562774053-701939374585?w=1920&q=80', author: 'University Campus' },
  { id: 2, url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1920&q=80', author: 'Library' },
  { id: 3, url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1920&q=80', author: 'Graduation' },
  { id: 4, url: 'https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?w=1920&q=80', author: 'Campus Building' },
  { id: 5, url: 'https://images.unsplash.com/photo-1607237138185-eedd9c632b0b?w=1920&q=80', author: 'University Hall' }
]

// 从 Unsplash API 获取随机风景图（备用方案）
const fetchBgImages = async () => {
  try {
    // 使用 Unsplash Source API（无需 API Key）
    // 主题：university, campus, architecture, nature
    const themes = ['university', 'campus', 'architecture', 'library', 'education']
    const images: BgImage[] = themes.map((theme, index) => ({
      id: index + 1,
      url: `https://source.unsplash.com/1920x1080/?${theme}`,
      author: theme
    }))
    bgImages.value = images
  } catch (error) {
    // 使用默认背景图
    bgImages.value = defaultBgImages
  }
}

// 切换背景图
const startBgRotation = () => {
  bgInterval = setInterval(() => {
    currentBgIndex.value = (currentBgIndex.value + 1) % bgImages.value.length
  }, 8000) // 每8秒切换一次
}

// 时间显示
const currentTime = ref('')
const currentDate = ref('')
const currentWeekday = ref('')
let timeInterval: ReturnType<typeof setInterval> | null = null

const updateTime = () => {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  currentDate.value = now.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  currentWeekday.value = now.toLocaleDateString('zh-CN', { weekday: 'long' })
}

// 系统状态
const systemOnline = ref(true)

// 登录表单
const loginForm = reactive({ username: '', password: '' })
const loading = ref(false)
const loginFormRef = ref<FormInstance>()
const rememberMe = ref(false)

// 登录错误计数
const loginErrorCount = ref(0)
const maxLoginAttempts = 5
let lockTimer: ReturnType<typeof setTimeout> | null = null

const isLoginLocked = computed(() => loginErrorCount.value >= maxLoginAttempts)
const remainingAttempts = computed(() => maxLoginAttempts - loginErrorCount.value)

const resetErrorCount = () => {
  if (loginErrorCount.value > 0 && loginErrorCount.value < maxLoginAttempts) {
    // 输入时不重置，只有成功登录才重置
  }
}

const startAutoUnlock = () => {
  if (lockTimer) {clearTimeout(lockTimer)}
  lockTimer = setTimeout(() => {
    loginErrorCount.value = 0
    ElMessage.success('账户已解锁，请重新登录')
  }, 5 * 60 * 1000)
}

// 表单验证规则
const loginRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度应在 3-20 个字符之间', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 20, message: '密码长度应在 6-20 个字符之间', trigger: 'blur' }
  ]
}

const handleLogin = async () => {
  if (isLoginLocked.value) {
    ElMessage.error('账户已锁定，请稍后再试')
    return
  }

  // 修复P1: 增强表单验证逻辑，处理 loginFormRef 为 null 的情况
  if (loginFormRef.value) {
    try {
      await loginFormRef.value.validate()
    } catch {
      return
    }
  } else {
    // 备用验证：直接检查表单数据
    if (!loginForm.username || loginForm.username.length < 3) {
      ElMessage.warning('请输入有效的用户名（至少3个字符）')
      return
    }
    if (!loginForm.password || loginForm.password.length < 6) {
      ElMessage.warning('请输入有效的密码（至少6个字符）')
      return
    }
  }

  loading.value = true

  try {
    // 调用后端登录API
    const result = await authStore.login({
      username: loginForm.username,
      password: loginForm.password
    })

    if (result.success) {
      // 登录成功
      loginErrorCount.value = 0

      if (rememberMe.value) {
        localStorage.setItem('remembered_username', loginForm.username)
      } else {
        localStorage.removeItem('remembered_username')
      }

      ElMessage.success(`欢迎回来，${authStore.userDepartment}`)
      
      // Navigate to dashboard after successful login
      router.push('/dashboard')
    } else {
      // 登录失败
      loginErrorCount.value++
      
      if (isLoginLocked.value) {
        startAutoUnlock()
        ElMessage.error('登录失败次数过多，账户已被临时锁定')
      } else {
        const errorMsg = result.error || '用户名或密码错误'
        ElMessage.error(`${errorMsg}，剩余尝试次数：${remainingAttempts.value}`)
      }
    }
  } catch (error: any) {
    console.error('❌ [Login] 登录异常:', error)
    loginErrorCount.value++
    
    if (isLoginLocked.value) {
      startAutoUnlock()
      ElMessage.error('登录失败次数过多，账户已被临时锁定')
    } else {
      const errorMsg = error.message || error.error || '登录失败，请检查网络连接'
      ElMessage.error(`${errorMsg}，剩余尝试次数：${remainingAttempts.value}`)
    }
  } finally {
    loading.value = false
  }
}

const handleForgotPassword = () => {
  ElMessage.info('请联系管理员重置密码')
}

onMounted(() => {
  // 初始化背景图
  bgImages.value = defaultBgImages
  startBgRotation()
  
  // 初始化时间
  updateTime()
  timeInterval = setInterval(updateTime, 1000)
  
  // 恢复记住的用户名
  const remembered = localStorage.getItem('remembered_username')
  if (remembered) {
    loginForm.username = remembered
    rememberMe.value = true
  }
})

onUnmounted(() => {
  if (timeInterval) {clearInterval(timeInterval)}
  if (lockTimer) {clearTimeout(lockTimer)}
  if (bgInterval) {clearInterval(bgInterval)}
})
</script>


<style scoped>
/* ========== 登录页面样式 - 使用统一设计令牌 ========== */

.login-page {
  min-height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Microsoft YaHei', sans-serif;
  position: relative;
  overflow: hidden;
}

/* ========== 背景层 ========== */
.bg-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.bg-image {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  /* 默认渐变背景（图片加载前显示） */
  background-color: var(--color-primary-dark);
  /* 轻微放大效果 */
  transform: scale(1.05);
  transition: transform 10s ease-out;
}

/* 背景图切换动画 */
.bg-fade-enter-active,
.bg-fade-leave-active {
  transition: opacity 2s ease;
}

.bg-fade-enter-from,
.bg-fade-leave-to {
  opacity: 0;
}

.bg-overlay {
  position: absolute;
  inset: 0;
  /* 深色遮罩确保文字可读 */
  background: 
    linear-gradient(135deg, rgba(43, 109, 231, 0.85) 0%, rgba(64, 158, 255, 0.7) 100%);
  /* 网格纹理 */
  background-image: 
    linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
  background-size: 40px 40px;
}

/* ========== 主容器 ========== */
.login-wrapper {
  position: relative;
  z-index: 10;
  display: flex;
  width: 100%;
  max-width: 1100px;
  min-height: 600px;
  margin: var(--spacing-xl);
  background: var(--bg-white);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

/* ========== 左侧信息面板 ========== */
.info-panel {
  flex: 1;
  background: linear-gradient(180deg, var(--color-primary-dark) 0%, #1a4a8a 100%);
  padding: calc(var(--spacing-2xl) * 2) var(--spacing-2xl);
  display: flex;
  flex-direction: column;
  color: var(--bg-white);
  position: relative;
}

.info-panel::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 1px;
  background: linear-gradient(180deg, transparent, var(--color-warning), transparent);
}

/* 学校品牌 */
.school-brand {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  margin-bottom: calc(var(--spacing-2xl) * 2);
  padding-bottom: var(--spacing-2xl);
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.school-emblem {
  width: 64px;
  height: 64px;
  color: var(--color-warning);
  flex-shrink: 0;
}

.emblem-svg {
  width: 100%;
  height: 100%;
}

.school-text {
  flex: 1;
}

.school-name {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 var(--spacing-xs) 0;
  letter-spacing: 2px;
  color: var(--bg-white);
}

.school-name-en {
  font-size: 11px;
  color: rgba(255,255,255,0.6);
  margin: 0;
  letter-spacing: 1px;
  text-transform: uppercase;
}

/* 信息内容 */
.info-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* 统计信息 */
.info-stats {
  display: flex;
  align-items: center;
  gap: var(--spacing-2xl);
  padding: var(--spacing-2xl);
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-2xl);
}

.stat-item {
  flex: 1;
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--color-warning);
  font-family: 'Consolas', 'Monaco', monospace;
  letter-spacing: 1px;
}

.stat-label {
  font-size: 12px;
  color: rgba(255,255,255,0.6);
  margin-top: var(--spacing-xs);
}

.stat-divider {
  width: 1px;
  height: 40px;
  background: rgba(255,255,255,0.2);
}

/* 公告区域 */
.info-notice {
  flex: 1;
  padding: var(--spacing-xl);
  background: rgba(0,0,0,0.2);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-2xl);
}

.notice-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.notice-icon {
  font-size: 16px;
}

.notice-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-warning);
}

.notice-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.notice-list li {
  font-size: 13px;
  color: rgba(255,255,255,0.8);
  padding: var(--spacing-sm) 0;
  padding-left: var(--spacing-lg);
  position: relative;
  line-height: 1.5;
}

.notice-list li::before {
  content: '•';
  position: absolute;
  left: 0;
  color: var(--color-warning);
}

.notice-list li + li {
  border-top: 1px dashed rgba(255,255,255,0.1);
}

/* 底部链接 */
.info-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  padding-top: var(--spacing-lg);
  border-top: 1px solid rgba(255,255,255,0.1);
}

.info-link {
  font-size: 12px;
  color: rgba(255,255,255,0.6);
  text-decoration: none;
  transition: color var(--transition-fast);
}

.info-link:hover {
  color: var(--color-warning);
}

.link-divider {
  color: rgba(255,255,255,0.3);
  font-size: 12px;
}

/* ========== 右侧登录面板 ========== */
.login-panel {
  width: 420px;
  padding: calc(var(--spacing-2xl) * 2) var(--spacing-2xl);
  display: flex;
  flex-direction: column;
  background: var(--bg-white);
}

.login-card {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* 登录头部 */
.login-header {
  text-align: center;
  margin-bottom: calc(var(--spacing-2xl) + var(--spacing-lg));
}

.login-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-primary-dark);
  margin: 0 0 var(--spacing-sm) 0;
  letter-spacing: 4px;
}

.login-subtitle {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 2px;
}

/* 登录表单 */
.login-form {
  flex: 1;
}

.input-wrapper {
  width: 100%;
}

.input-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: var(--spacing-sm);
}

/* Element Plus 输入框样式覆盖 */
.login-form :deep(.el-input__wrapper) {
  background: var(--bg-light);
  border: 1px solid var(--border-input);
  border-radius: var(--radius-sm);
  box-shadow: none !important;
  padding: var(--spacing-xs) var(--spacing-md);
  transition: all var(--transition-fast);
}

.login-form :deep(.el-input__wrapper:hover) {
  border-color: var(--border-color);
}

.login-form :deep(.el-input__wrapper.is-focus) {
  background: var(--bg-white);
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.15) !important;
}

.login-form :deep(.el-input__inner) {
  font-size: 14px;
  color: var(--text-main);
}

.login-form :deep(.el-input__prefix) {
  color: var(--text-secondary);
}

.login-form :deep(.el-form-item) {
  margin-bottom: var(--spacing-2xl);
}

/* 表单选项 */
.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-2xl);
}

.form-options :deep(.el-checkbox__label) {
  font-size: 13px;
  color: var(--text-regular);
}

.form-options :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
}

.form-options :deep(.el-button) {
  font-size: 13px;
  color: var(--color-primary);
}

/* 登录按钮 */
.login-btn {
  width: 100%;
  height: 48px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 8px;
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, var(--color-primary-dark) 0%, var(--color-primary) 100%);
  border: none;
  transition: all var(--transition-normal);
}

.login-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
  transform: translateY(-1px);
  box-shadow: var(--shadow-hover);
}

.login-btn:active:not(:disabled) {
  transform: translateY(0);
}

.login-btn:disabled {
  background: var(--border-color);
  cursor: not-allowed;
}

/* 警告提示 */
.lock-alert,
.error-alert {
  margin-top: var(--spacing-lg);
}

.lock-alert :deep(.el-alert),
.error-alert :deep(.el-alert) {
  border-radius: var(--radius-md);
}

.lock-alert :deep(.el-alert p) {
  margin: var(--spacing-xs) 0;
  font-size: 12px;
}

/* 登录底部 */
.login-footer {
  margin-top: auto;
  padding-top: var(--spacing-2xl);
  border-top: 1px solid var(--border-color);
}

.footer-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  font-size: 12px;
  color: var(--text-secondary);
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-danger);
}

.status-indicator.online {
  background: var(--color-success);
  box-shadow: 0 0 0 3px rgba(103, 194, 58, 0.2);
}

/* 版权信息 */
.copyright {
  text-align: center;
  margin-top: var(--spacing-2xl);
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--border-color);
}

.copyright p {
  margin: 0;
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.8;
}

/* ========== 响应式 ========== */
@media (max-width: 900px) {
  .login-wrapper {
    flex-direction: column;
    max-width: 480px;
    min-height: auto;
  }

  .info-panel {
    padding: var(--spacing-2xl);
  }

  .info-panel::after {
    display: none;
  }

  .school-brand {
    margin-bottom: var(--spacing-2xl);
    padding-bottom: var(--spacing-lg);
  }

  .info-stats {
    margin-bottom: var(--spacing-xl);
    padding: var(--spacing-lg);
  }

  .info-notice {
    display: none;
  }

  .login-panel {
    width: 100%;
    padding: var(--spacing-2xl);
  }

  .login-header {
    margin-bottom: var(--spacing-2xl);
  }
}

@media (max-width: 480px) {
  .login-wrapper {
    margin: 0;
    border-radius: 0;
    min-height: 100vh;
  }

  .school-emblem {
    width: 48px;
    height: 48px;
  }

  .school-name {
    font-size: 18px;
  }

  .stat-value {
    font-size: 18px;
  }

  .login-title {
    font-size: 20px;
    letter-spacing: 2px;
  }
}
</style>
