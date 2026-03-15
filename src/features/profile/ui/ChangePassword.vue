<template>
  <div class="change-password">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="120px" class="password-form">
      <el-form-item label="原密码" prop="oldPassword">
        <el-input
          v-model="form.oldPassword"
          type="password"
          placeholder="请输入原密码"
          show-password
        />
      </el-form-item>

      <el-form-item label="新密码" prop="newPassword">
        <el-input
          v-model="form.newPassword"
          type="password"
          placeholder="请输入新密码"
          show-password
          @input="checkPasswordStrength"
        />
        <div v-if="form.newPassword" class="password-strength">
          <div class="strength-label">密码强度：</div>
          <div class="strength-meter">
            <div
              class="strength-bar"
              :class="passwordStrength.class"
              :style="{ width: passwordStrength.width }"
            />
          </div>
          <div class="strength-text" :class="passwordStrength.class">
            {{ passwordStrength.text }}
          </div>
        </div>
      </el-form-item>

      <el-form-item label="确认新密码" prop="confirmPassword">
        <el-input
          v-model="form.confirmPassword"
          type="password"
          placeholder="请再次输入新密码"
          show-password
        />
      </el-form-item>

      <el-form-item>
        <el-button type="primary" :loading="loading" @click="handleSubmit"> 修改密码 </el-button>
        <el-button @click="handleReset"> 重置 </el-button>
      </el-form-item>
    </el-form>

    <div class="password-tips">
      <h4>密码要求：</h4>
      <ul>
        <li>至少8个字符</li>
        <li>包含大小写字母</li>
        <li>包含数字</li>
        <li>包含特殊字符</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance } from 'element-plus'
import { useAuthStore } from '@/features/auth/model/store'
import api from '@/shared/api'

const router = useRouter()
const authStore = useAuthStore()

const formRef = ref<FormInstance>()
const loading = ref(false)

const form = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const passwordStrength = ref({
  width: '0%',
  class: '',
  text: '弱',
  score: 0
})

const validatePass = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (value === '') {
    callback(new Error('请输入新密码'))
  } else {
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

const checkPasswordStrength = (password: string) => {
  let score = 0

  // Length check
  if (password.length >= 8) {
    score++
  }
  if (password.length >= 12) {
    score++
  }

  // Character variety checks
  if (/[a-z]/.test(password)) {
    score++
  } // lowercase
  if (/[A-Z]/.test(password)) {
    score++
  } // uppercase
  if (/[0-9]/.test(password)) {
    score++
  } // number
  if (/[^A-Za-z0-9]/.test(password)) {
    score++
  } // special character

  const strengthMap = [
    { width: '20%', class: 'weak', text: '弱' },
    { width: '40%', class: 'weak', text: '弱' },
    { width: '60%', class: 'medium', text: '中等' },
    { width: '80%', class: 'strong', text: '强' },
    { width: '100%', class: 'strong', text: '很强' }
  ]

  const strengthIndex = Math.min(score, strengthMap.length - 1)
  passwordStrength.value = strengthMap[strengthIndex]
  passwordStrength.value.score = score
}

const handleSubmit = async () => {
  if (!formRef.value) {
    return
  }

  try {
    await formRef.value.validate()

    if (passwordStrength.value.score < 3) {
      ElMessage.warning('密码强度太弱，请设置更复杂的密码')
      return
    }

    loading.value = true

    // 调用API修改密码
    const response = await api.put('/api/user/password', {
      oldPassword: form.oldPassword,
      newPassword: form.newPassword
    })

    if (response.data?.success || response.success) {
      ElMessage.success('密码修改成功，请重新登录')

      // 清空表单
      handleReset()

      // 延迟1秒后退出登录
      setTimeout(() => {
        authStore.logout()
        router.push('/login')
      }, 1000)
    }
  } catch (error: unknown) {
    console.error('修改密码失败:', error)
    ElMessage.error(error.response?.data?.message || error.message || '修改密码失败，请重试')
  } finally {
    loading.value = false
  }
}

const handleReset = () => {
  if (!formRef.value) {
    return
  }
  formRef.value.resetFields()
  passwordStrength.value = { width: '0%', class: '', text: '弱', score: 0 }
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
  margin-bottom: 24px;
}

.password-strength {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.strength-label {
  color: var(--text-secondary);
}

.strength-meter {
  flex: 1;
  height: 4px;
  background: var(--border-color);
  border-radius: 2px;
  overflow: hidden;
}

.strength-bar {
  height: 100%;
  transition: all 0.3s;
  border-radius: 2px;
}

.strength-bar.weak {
  background: #f56c6c;
}

.strength-bar.medium {
  background: #e6a23c;
}

.strength-bar.strong {
  background: #67c23a;
}

.strength-text {
  font-weight: 600;
  min-width: 40px;
  text-align: right;
}

.strength-text.weak {
  color: #f56c6c;
}

.strength-text.medium {
  color: #e6a23c;
}

.strength-text.strong {
  color: #67c23a;
}

.password-tips {
  background: var(--bg-light);
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.password-tips h4 {
  margin: 0 0 8px 0;
  color: var(--text-main);
  font-size: 14px;
}

.password-tips ul {
  margin: 0;
  padding-left: 20px;
  color: var(--text-regular);
  font-size: 13px;
}

.password-tips li {
  margin-bottom: 4px;
}
</style>
