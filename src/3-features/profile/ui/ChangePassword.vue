<template>
  <div class="change-password">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="120px" class="password-form">
      <el-form-item label="原密码" prop="oldPassword" :error="serverErrors.oldPassword">
        <el-input
          v-model="form.oldPassword"
          type="password"
          placeholder="请输入原密码"
          show-password
          @input="clearServerError('oldPassword')"
        />
      </el-form-item>

      <el-form-item label="新密码" prop="newPassword" :error="serverErrors.newPassword">
        <el-input
          v-model="form.newPassword"
          type="password"
          placeholder="请输入新密码"
          show-password
          @focus="passwordGuideVisible = true"
          @blur="handlePasswordBlur"
          @input="checkPasswordStrength"
        />
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
              <span class="guide-strength" :class="passwordStrength.class">{{
                passwordStrength.text
              }}</span>
              <ul class="guide-checklist">
                <li class="guide-item" :class="{ met: hasMinLength }">
                  <span class="guide-dot" />至少8位
                </li>
                <li class="guide-item" :class="{ met: hasLetter }">
                  <span class="guide-dot" />包含字母
                </li>
                <li class="guide-item" :class="{ met: hasNumber }">
                  <span class="guide-dot" />包含数字
                </li>
              </ul>
            </div>

            <p class="guide-note">密码修改成功后，系统会自动退出当前登录，请使用新密码重新登录。</p>
          </div>
        </transition>
      </el-form-item>

      <el-form-item label="确认新密码" prop="confirmPassword" :error="serverErrors.confirmPassword">
        <el-input
          v-model="form.confirmPassword"
          type="password"
          placeholder="请再次输入新密码"
          show-password
          @input="clearServerError('confirmPassword')"
        />
      </el-form-item>

      <el-form-item>
        <el-button type="primary" :loading="loading" @click="handleSubmit"> 修改密码 </el-button>
        <el-button @click="handleReset"> 清空 </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus'
import { useAuthStore } from '@/features/auth/model/store'
import { apiClient as api } from '@/shared/api/client'
import { logger } from '@/shared/lib/utils/logger'
import type { ZXCVBNResult } from 'zxcvbn'

const router = useRouter()
const authStore = useAuthStore()

const formRef = ref<FormInstance>()
const loading = ref(false)
const passwordGuideVisible = ref(false)

const form = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const serverErrors = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const passwordStrength = ref({
  class: '',
  text: '',
  score: 0
})

let zxcvbnEvaluator: ((password: string, userInputs?: string[]) => ZXCVBNResult) | null = null
let strengthCheckToken = 0

type PasswordField = keyof typeof serverErrors

const resetServerErrors = () => {
  serverErrors.oldPassword = ''
  serverErrors.newPassword = ''
  serverErrors.confirmPassword = ''
}

const clearServerError = (field: PasswordField) => {
  serverErrors[field] = ''
}

const validatePass = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (value === '') {
    callback(new Error('请输入新密码'))
  } else {
    clearServerError('newPassword')
    if (form.confirmPassword !== '') {
      if (formRef.value) {
        formRef.value.validateField('confirmPassword')
      }
    }
    callback()
  }
}

const validateConfirmPass = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (value === '') {
    callback(new Error('请再次输入新密码'))
  } else if (value !== form.newPassword) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    clearServerError('confirmPassword')
    callback()
  }
}

const rules = {
  oldPassword: [
    { required: true, message: '请输入原密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少6个字符', trigger: 'blur' }
  ],
  newPassword: [
    { validator: validatePass, trigger: 'blur' },
    { min: 8, message: '新密码长度至少8个字符', trigger: 'blur' }
  ],
  confirmPassword: [{ validator: validateConfirmPass, trigger: 'blur' }]
}

const hasMinLength = computed(() => form.newPassword.length >= 8)
const hasLetter = computed(() => /[A-Za-z]/.test(form.newPassword))
const hasNumber = computed(() => /[0-9]/.test(form.newPassword))
const activeBarCount = computed(() => {
  if (passwordStrength.value.score <= 0) return 0
  if (passwordStrength.value.score === 1) return 1
  if (passwordStrength.value.score === 2) return 2
  return 3
})

const loadZxcvbn = async () => {
  if (zxcvbnEvaluator) {
    return zxcvbnEvaluator
  }

  const module = await import('zxcvbn')
  zxcvbnEvaluator = module.default
  return zxcvbnEvaluator
}

const getPasswordUserInputs = () => {
  const user = authStore.user
  return [user?.username, user?.name, user?.realName, user?.department].filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0
  )
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
  clearServerError('newPassword')
  passwordGuideVisible.value = true
  const currentToken = ++strengthCheckToken

  if (!password) {
    passwordStrength.value = { class: '', text: '', score: 0 }
    return
  }

  try {
    const evaluate = await loadZxcvbn()
    const result = evaluate(password, getPasswordUserInputs())
    if (currentToken !== strengthCheckToken) {
      return
    }
    applyStrengthState(result.score)
  } catch (error) {
    logger.warn('zxcvbn load failed, falling back to local password strength rules', error)
    const score =
      (password.length >= 8 ? 1 : 0) +
      (/[A-Za-z]/.test(password) ? 1 : 0) +
      (/[0-9]/.test(password) ? 1 : 0)

    if (currentToken !== strengthCheckToken) {
      return
    }

    applyStrengthState(score)
  }
}

const showPasswordGuide = computed(
  () => passwordGuideVisible.value || form.newPassword.length > 0 || form.confirmPassword.length > 0
)

const handlePasswordBlur = () => {
  window.setTimeout(() => {
    if (!form.newPassword && !form.confirmPassword) {
      passwordGuideVisible.value = false
    }
  }, 120)
}

type ApiFieldError = {
  field?: string
  message?: string
}

type ApiLikeError = {
  message?: string
  details?: {
    data?: ApiFieldError[]
  }
}

const errorTextMap: Record<string, string> = {
  'Current password is incorrect': '原密码错误',
  'New password and confirm password do not match': '两次输入的密码不一致',
  'Password must be at least 8 characters': '密码长度至少8个字符',
  'Password must be at least 8 characters long': '密码长度至少8个字符',
  'Password must be at least 8 characters and contain at least one letter and one number':
    '密码至少8位，且需包含字母和数字',
  'Old password is required': '请输入原密码',
  'New password is required': '请输入新密码',
  'Confirm password is required': '请再次输入新密码',
  WEAK_PASSWORD: '密码至少8位，且需包含字母和数字'
}

const translateErrorMessage = (message?: string) => {
  if (!message) {
    return ''
  }
  return errorTextMap[message] || message
}

const applyFieldErrors = (fieldErrors: ApiFieldError[]) => {
  let firstField: PasswordField | null = null

  fieldErrors.forEach(({ field, message }) => {
    if (!field || !message) {
      return
    }

    const translated = translateErrorMessage(message)
    if (field === 'oldPassword' || field === 'newPassword' || field === 'confirmPassword') {
      serverErrors[field] = translated
      if (!firstField) {
        firstField = field
      }
    }
  })

  if (firstField && formRef.value) {
    formRef.value.scrollToField(firstField)
  }
}

const handleSubmit = async () => {
  if (!formRef.value) {
    return
  }

  try {
    resetServerErrors()
    await formRef.value.validate()

    if (
      form.newPassword.length < 8 ||
      !/[A-Za-z]/.test(form.newPassword) ||
      !/[0-9]/.test(form.newPassword)
    ) {
      ElMessage.warning('密码至少8位，且需包含字母和数字')
      return
    }

    loading.value = true

    // 调用API修改密码
    const response = await api.post('/profile/password', {
      oldPassword: form.oldPassword,
      newPassword: form.newPassword,
      confirmPassword: form.confirmPassword
    })

    if (response.data?.success || response.success) {
      handleReset()
      await ElMessageBox.alert('密码已修改成功，请使用新密码重新登录。', '密码修改成功', {
        type: 'success',
        confirmButtonText: '重新登录',
        closeOnClickModal: false,
        closeOnPressEscape: false,
        showClose: false
      })
      authStore.logout({ redirect: false })
      await router.replace('/login')
    }
  } catch (error: unknown) {
    logger.error('修改密码失败:', error)
    const apiError = error as ApiLikeError
    const fieldErrors = apiError.details?.data

    if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
      applyFieldErrors(fieldErrors)
      ElMessage.error(translateErrorMessage(fieldErrors[0]?.message) || '请检查输入后重试')
      return
    }

    ElMessage.error(translateErrorMessage(apiError.message) || '修改密码失败，请重试')
  } finally {
    loading.value = false
  }
}

const handleReset = () => {
  if (!formRef.value) {
    return
  }
  formRef.value.resetFields()
  resetServerErrors()
  passwordGuideVisible.value = false
  passwordStrength.value = { class: '', text: '', score: 0 }
}
</script>

<style scoped>
.change-password {
  max-width: 600px;
  margin: 0 auto;
}

.password-form {
  background: var(--bg-white);
  padding: 24px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.password-guide {
  margin-top: 12px;
  padding-top: 4px;
}

.guide-bars {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.guide-bar {
  flex: 1;
  height: 8px;
  border-radius: 999px;
  background: #e2e8f0;
  transition: background-color 0.25s ease;
}

.guide-bar.weak {
  background: #f56565;
}

.guide-bar.medium {
  background: #f6ad55;
}

.guide-bar.strong {
  background: #48bb78;
}

.guide-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 4px;
}

.guide-strength.weak {
  color: #e53e3e;
}

.guide-strength.medium {
  color: #d97706;
}

.guide-strength.strong {
  color: #38a169;
}

.guide-checklist {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 18px;
}

.guide-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #a0aec0;
  white-space: nowrap;
}

.guide-item.met {
  color: #38a169;
}

.guide-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.guide-note {
  margin: 6px 0 0;
  font-size: 12px;
  color: #94a3b8;
}

.guide-fade-enter-active,
.guide-fade-leave-active {
  transition: all 0.18s ease;
}

.guide-fade-enter-from,
.guide-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 768px) {
  .password-form {
    padding: 20px 16px;
  }

  .guide-meta {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }

  .guide-checklist {
    flex-wrap: wrap;
    gap: 8px 14px;
  }
}
</style>
