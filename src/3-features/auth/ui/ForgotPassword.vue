<template>
  <div class="forgot-password-page">
    <div class="forgot-password-card">
      <div class="header">
        <h1>找回密码</h1>
        <p>通过邮箱验证码重置登录密码</p>
      </div>

      <el-steps :active="activeStep" finish-status="success" simple class="steps">
        <el-step title="输入邮箱" />
        <el-step title="验证邮箱" />
        <el-step title="设置新密码" />
      </el-steps>

      <el-form v-if="activeStep === 0" ref="emailFormRef" :model="emailForm" :rules="emailRules">
        <el-form-item prop="email">
          <el-input v-model="emailForm.email" placeholder="请输入绑定邮箱" />
        </el-form-item>
        <el-button type="primary" :loading="submitting" class="primary-btn" @click="handleSendCode">
          {{ resendCountdown > 0 ? `${resendCountdown} 秒后可重发` : '发送验证码' }}
        </el-button>
      </el-form>

      <el-form
        v-else-if="activeStep === 1"
        ref="verifyFormRef"
        :model="verifyForm"
        :rules="verifyRules"
      >
        <el-alert type="info" :closable="false" show-icon class="helper">
          验证码已发送至 {{ maskedEmail }}
        </el-alert>
        <el-form-item prop="code">
          <el-input v-model="verifyForm.code" placeholder="请输入 6 位验证码" maxlength="6" />
        </el-form-item>
        <div class="resend-row">
          <span class="resend-hint">
            {{ resendCountdown > 0 ? `${resendCountdown} 秒后可重新发送` : '未收到验证码？' }}
          </span>
          <el-button
            link
            type="primary"
            :disabled="resendCountdown > 0 || submitting"
            @click="handleResendCode"
          >
            重新发送
          </el-button>
        </div>
        <div class="actions">
          <el-button @click="activeStep = 0">上一步</el-button>
          <el-button type="primary" :loading="submitting" @click="handleVerifyCode">下一步</el-button>
        </div>
      </el-form>

      <el-form
        v-else
        ref="resetFormRef"
        :model="resetForm"
        :rules="resetRules"
      >
        <el-form-item prop="newPassword">
          <el-input
            v-model="resetForm.newPassword"
            type="password"
            show-password
            placeholder="请输入新密码"
            @focus="passwordGuideVisible = true"
            @blur="handlePasswordBlur"
            @input="checkPasswordStrength"
          />
        </el-form-item>
        <transition name="guide-fade">
          <div v-if="showPasswordGuide" class="password-guide">
            <div class="guide-bars">
              <div
                v-for="barIndex in 3"
                :key="barIndex"
                class="guide-bar"
                :class="barIndex <= activeBarCount ? passwordStrength.class : ''"
              />
            </div>
            <div class="guide-meta">
              <span class="guide-strength" :class="passwordStrength.class">
                {{ passwordStrength.text || '待检测' }}
              </span>
              <ul class="guide-checklist">
                <li class="guide-item" :class="{ met: hasMinLength }"><span class="guide-dot" />至少8位</li>
                <li class="guide-item" :class="{ met: hasLetter }"><span class="guide-dot" />包含字母</li>
                <li class="guide-item" :class="{ met: hasNumber }"><span class="guide-dot" />包含数字</li>
              </ul>
            </div>
          </div>
        </transition>
        <el-form-item prop="confirmPassword">
          <el-input
            v-model="resetForm.confirmPassword"
            type="password"
            show-password
            placeholder="请再次输入新密码"
          />
        </el-form-item>
        <div class="actions">
          <el-button @click="activeStep = 1">上一步</el-button>
          <el-button type="primary" :loading="submitting" @click="handleConfirmReset">
            确认重置
          </el-button>
        </div>
      </el-form>

      <div class="footer-links">
        <el-button link @click="router.push('/login')">返回登录</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { authApi } from '@/features/auth/api/auth'
import type { ZXCVBNResult } from 'zxcvbn'

const router = useRouter()

const activeStep = ref(0)
const submitting = ref(false)
const resendCountdown = ref(0)
const passwordGuideVisible = ref(false)

const emailFormRef = ref<FormInstance>()
const verifyFormRef = ref<FormInstance>()
const resetFormRef = ref<FormInstance>()
let countdownTimer: ReturnType<typeof setInterval> | null = null
let zxcvbnEvaluator: ((password: string, userInputs?: string[]) => ZXCVBNResult) | null = null
let strengthCheckToken = 0

const emailForm = reactive({
  email: ''
})

const verifyForm = reactive({
  code: ''
})

const resetForm = reactive({
  newPassword: '',
  confirmPassword: ''
})

const passwordStrength = ref({
  class: '',
  text: '',
  score: 0
})

const emailRules: FormRules = {
  email: [
    { required: true, message: '请输入邮箱地址', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' }
  ]
}

const verifyRules: FormRules = {
  code: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { pattern: /^\d{6}$/, message: '验证码必须为 6 位数字', trigger: 'blur' }
  ]
}

const resetRules: FormRules = {
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    {
      pattern: /^(?=.*[A-Za-z])(?=.*\d).{8,20}$/,
      message: '密码需为 8-20 位，且至少包含一个字母和一个数字',
      trigger: 'blur'
    }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== resetForm.newPassword) {
          callback(new Error('两次输入的密码不一致'))
          return
        }
        callback()
      },
      trigger: 'blur'
    }
  ]
}

const hasMinLength = computed(() => resetForm.newPassword.length >= 8)
const hasLetter = computed(() => /[A-Za-z]/.test(resetForm.newPassword))
const hasNumber = computed(() => /[0-9]/.test(resetForm.newPassword))
const activeBarCount = computed(() => {
  if (passwordStrength.value.score <= 0) return 0
  if (passwordStrength.value.score === 1) return 1
  if (passwordStrength.value.score === 2) return 2
  return 3
})
const showPasswordGuide = computed(
  () => passwordGuideVisible.value || resetForm.newPassword.length > 0 || resetForm.confirmPassword.length > 0
)

const maskedEmail = computed(() => {
  const [name, domain] = emailForm.email.split('@')
  if (!name || !domain) {
    return emailForm.email
  }
  if (name.length <= 2) {
    return `${name[0]}*@${domain}`
  }
  return `${name[0]}${'*'.repeat(Math.max(1, name.length - 2))}${name[name.length - 1]}@${domain}`
})

const loadZxcvbn = async () => {
  if (zxcvbnEvaluator) {
    return zxcvbnEvaluator
  }

  const module = await import('zxcvbn')
  zxcvbnEvaluator = module.default
  return zxcvbnEvaluator
}

const applyStrengthState = (score: number) => {
  if (score <= 1) {
    passwordStrength.value = { class: 'weak', text: '弱', score }
    return
  }

  if (score <= 3) {
    passwordStrength.value = { class: 'medium', text: '中等', score }
    return
  }

  passwordStrength.value = { class: 'strong', text: '强', score }
}

const checkPasswordStrength = async (password: string) => {
  passwordGuideVisible.value = true
  const currentToken = ++strengthCheckToken

  if (!password) {
    passwordStrength.value = { class: '', text: '', score: 0 }
    return
  }

  try {
    const evaluate = await loadZxcvbn()
    const result = evaluate(password)
    if (currentToken !== strengthCheckToken) return
    applyStrengthState(result.score)
  } catch {
    const score =
      (password.length >= 8 ? 1 : 0) + (/[A-Za-z]/.test(password) ? 1 : 0) + (/[0-9]/.test(password) ? 1 : 0)
    if (currentToken !== strengthCheckToken) return
    applyStrengthState(score)
  }
}

const handlePasswordBlur = () => {
  window.setTimeout(() => {
    if (!resetForm.newPassword && !resetForm.confirmPassword) {
      passwordGuideVisible.value = false
    }
  }, 120)
}

const startCountdown = (seconds = 60) => {
  resendCountdown.value = seconds
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }
  countdownTimer = setInterval(() => {
    if (resendCountdown.value <= 1) {
      resendCountdown.value = 0
      if (countdownTimer) {
        clearInterval(countdownTimer)
        countdownTimer = null
      }
      return
    }
    resendCountdown.value -= 1
  }, 1000)
}

const handleSendCode = async () => {
  if (!emailFormRef.value) return
  await emailFormRef.value.validate()
  submitting.value = true
  try {
    const response = await authApi.sendResetCode(emailForm.email)
    ElMessage.success(response.data.message)
    verifyForm.code = ''
    startCountdown(60)
    activeStep.value = 1
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '验证码发送失败')
  } finally {
    submitting.value = false
  }
}

const handleResendCode = async () => {
  if (resendCountdown.value > 0 || submitting.value) {
    return
  }
  submitting.value = true
  try {
    const response = await authApi.sendResetCode(emailForm.email)
    ElMessage.success(response.data.message)
    startCountdown(60)
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '验证码发送失败')
  } finally {
    submitting.value = false
  }
}

const handleVerifyCode = async () => {
  if (!verifyFormRef.value) return
  await verifyFormRef.value.validate()
  submitting.value = true
  try {
    const response = await authApi.verifyResetCode(emailForm.email, verifyForm.code)
    ElMessage.success(response.data.message)
    activeStep.value = 2
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '验证码校验失败')
  } finally {
    submitting.value = false
  }
}

const handleConfirmReset = async () => {
  if (!resetFormRef.value) return
  await resetFormRef.value.validate()
  submitting.value = true
  try {
    const response = await authApi.confirmResetPassword(
      emailForm.email,
      verifyForm.code,
      resetForm.newPassword
    )
    ElMessage.success(response.data.message)
    void router.push('/login')
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '密码重置失败')
  } finally {
    submitting.value = false
  }
}

onBeforeUnmount(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }
})
</script>

<style scoped>
.forgot-password-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: linear-gradient(160deg, #f2f6fb 0%, #e4edf8 100%);
}

.forgot-password-card {
  width: min(100%, 520px);
  padding: 32px;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 24px 60px rgba(20, 46, 89, 0.12);
}

.header {
  margin-bottom: 24px;
}

.header h1 {
  margin: 0 0 8px;
  font-size: 28px;
}

.header p {
  margin: 0;
  color: #5f6b7a;
}

.steps {
  margin-bottom: 24px;
}

.steps :deep(.el-step__title) {
  font-size: 13px;
  font-weight: normal;
}

.helper {
  margin-bottom: 16px;
}

.resend-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: -6px 0 16px;
}

.resend-hint {
  color: #5f6b7a;
  font-size: 13px;
}

.primary-btn {
  width: 100%;
}

.actions {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.password-guide {
  margin: -6px 0 16px;
  padding: 14px 16px;
  border-radius: 14px;
  background: #f5f8fc;
  border: 1px solid #d9e4f1;
}

.guide-bars {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 10px;
}

.guide-bar {
  height: 8px;
  border-radius: 999px;
  background: #d5deea;
}

.guide-bar.weak {
  background: #e45649;
}

.guide-bar.medium {
  background: #d9922e;
}

.guide-bar.strong {
  background: #2c9c5b;
}

.guide-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.guide-strength {
  min-width: 36px;
  font-weight: 600;
}

.guide-strength.weak {
  color: #e45649;
}

.guide-strength.medium {
  color: #d9922e;
}

.guide-strength.strong {
  color: #2c9c5b;
}

.guide-checklist {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 4px;
  color: #6a7480;
  font-size: 13px;
}

.guide-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.guide-item.met {
  color: #2c9c5b;
}

.guide-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.guide-fade-enter-active,
.guide-fade-leave-active {
  transition: opacity 0.2s ease;
}

.guide-fade-enter-from,
.guide-fade-leave-to {
  opacity: 0;
}

.footer-links {
  margin-top: 20px;
  text-align: center;
}
</style>
