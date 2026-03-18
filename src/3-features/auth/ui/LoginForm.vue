<template>
  <el-form
    ref="formRef"
    :model="formData"
    :rules="rules"
    class="login-form"
    @keyup.enter="handleSubmit"
  >
    <el-form-item prop="username">
      <div class="input-wrapper">
        <label class="input-label">用户名</label>
        <el-input
          v-model="formData.username"
          placeholder="请输入用户名"
          size="large"
          :disabled="loading"
          @input="resetError"
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
          v-model="formData.password"
          type="password"
          placeholder="请输入密码"
          size="large"
          show-password
          :disabled="loading"
        >
          <template #prefix>
            <el-icon><Lock /></el-icon>
          </template>
        </el-input>
      </div>
    </el-form-item>

    <div class="form-options">
      <el-checkbox v-model="formData.rememberMe" :disabled="loading"> 记住用户名 </el-checkbox>
      <el-button type="primary" link :disabled="loading" @click="$emit('forgot-password')">
        忘记密码？
      </el-button>
    </div>

    <el-form-item>
      <el-button
        type="primary"
        size="large"
        :loading="loading"
        :disabled="isLocked"
        class="login-btn"
        native-type="button"
        @click.prevent="handleSubmit"
      >
        {{ buttonText }}
      </el-button>
    </el-form-item>

    <!-- Error display -->
    <div v-if="errorMessage" class="error-message">
      <el-alert :title="errorMessage" type="error" :closable="false" show-icon />
    </div>

    <!-- Lock warning -->
    <div v-if="isLocked" class="lock-warning">
      <el-alert title="账户已被临时锁定" type="warning" :closable="false" show-icon>
        <template #default>
          <p>由于多次登录失败，账户已被临时锁定。</p>
          <p>请5分钟后重试或联系管理员。</p>
        </template>
      </el-alert>
    </div>

    <!-- Remaining attempts -->
    <div v-else-if="errorCount > 0" class="attempts-warning">
      <el-alert
        :title="`登录失败，剩余尝试次数：${remainingAttempts}`"
        type="warning"
        :closable="false"
        show-icon
      />
    </div>
  </el-form>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import type { LoginFormState } from '../model/types'
import { VALIDATION_RULES, SESSION_CONFIG, TOKEN_KEYS } from '../model/constants'
import { logger } from '@/5-shared/lib/utils/logger'

// Props
interface Props {
  loading?: boolean
  errorMessage?: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  errorMessage: ''
})

// Emits
interface Emits {
  (e: 'submit', credentials: { username: string; password: string }): void
  (e: 'forgot-password'): void
}

const emit = defineEmits<Emits>()

// Form ref
const formRef = ref<FormInstance>()

// Form data
const formData = reactive<LoginFormState>({
  username: '',
  password: '',
  rememberMe: false
})

// Error tracking
const errorCount = ref(0)
const isLocked = ref(false)
let lockTimer: ReturnType<typeof setTimeout> | null = null

// Computed
const remainingAttempts = computed(() => SESSION_CONFIG.MAX_LOGIN_ATTEMPTS - errorCount.value)

const buttonText = computed(() => {
  if (props.loading) {
    return '登录中...'
  }
  if (isLocked.value) {
    return '账户已锁定'
  }
  return '登 录'
})

// Validation rules
const rules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    {
      min: VALIDATION_RULES.USERNAME_MIN_LENGTH,
      max: VALIDATION_RULES.USERNAME_MAX_LENGTH,
      message: `用户名长度应在 ${VALIDATION_RULES.USERNAME_MIN_LENGTH}-${VALIDATION_RULES.USERNAME_MAX_LENGTH} 个字符之间`,
      trigger: 'blur'
    }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    {
      min: VALIDATION_RULES.PASSWORD_MIN_LENGTH,
      max: VALIDATION_RULES.PASSWORD_MAX_LENGTH,
      message: `密码长度应在 ${VALIDATION_RULES.PASSWORD_MIN_LENGTH}-${VALIDATION_RULES.PASSWORD_MAX_LENGTH} 个字符之间`,
      trigger: 'blur'
    }
  ]
}

// Methods
const resetError = () => {
  // Error count is managed by parent component
}

const handleSubmit = async () => {
  if (isLocked.value) {
    ElMessage.error('账户已锁定，请稍后再试')
    return
  }

  if (!formRef.value) {
    ElMessage.warning('表单未初始化')
    return
  }

  try {
    await formRef.value.validate()

    // Emit submit event
    emit('submit', {
      username: formData.username,
      password: formData.password
    })

    // Handle remember me
    if (formData.rememberMe) {
      localStorage.setItem(TOKEN_KEYS.REMEMBERED_USERNAME, formData.username)
    } else {
      localStorage.removeItem(TOKEN_KEYS.REMEMBERED_USERNAME)
    }
  } catch (error) {
    logger.debug('Login form validation blocked submit', error)
  }
}

const incrementErrorCount = () => {
  errorCount.value++

  if (errorCount.value >= SESSION_CONFIG.MAX_LOGIN_ATTEMPTS) {
    isLocked.value = true
    startAutoUnlock()
  }
}

const resetErrorCount = () => {
  errorCount.value = 0
  isLocked.value = false
  if (lockTimer) {
    clearTimeout(lockTimer)
    lockTimer = null
  }
}

const startAutoUnlock = () => {
  if (lockTimer) {
    clearTimeout(lockTimer)
  }

  lockTimer = setTimeout(() => {
    resetErrorCount()
    ElMessage.success('账户已解锁，请重新登录')
  }, SESSION_CONFIG.LOCK_DURATION)
}

// Initialize remembered username
const initRememberedUsername = () => {
  const remembered = localStorage.getItem(TOKEN_KEYS.REMEMBERED_USERNAME)
  if (remembered) {
    formData.username = remembered
    formData.rememberMe = true
  }
}

// Expose methods for parent component
defineExpose({
  incrementErrorCount,
  resetErrorCount,
  resetForm: () => formRef.value?.resetFields()
})

// Initialize on mount
initRememberedUsername()
</script>

<style scoped>
.login-form {
  width: 100%;
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

.login-form :deep(.el-form-item) {
  margin-bottom: var(--spacing-2xl);
}

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

.error-message,
.lock-warning,
.attempts-warning {
  margin-top: var(--spacing-lg);
}

.error-message :deep(.el-alert),
.lock-warning :deep(.el-alert),
.attempts-warning :deep(.el-alert) {
  border-radius: var(--radius-md);
}

.lock-warning :deep(.el-alert p) {
  margin: var(--spacing-xs) 0;
  font-size: 12px;
}
</style>
