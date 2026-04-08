<template>
  <div class="user-profile">
    <el-card class="profile-card">
      <template #header>
        <div class="card-header">
          <span class="header-title">个人信息</span>
          <el-button v-if="!isEditing" type="primary" size="small" @click="startEdit">
            编辑
          </el-button>
          <div v-else class="header-actions">
            <el-button size="small" @click="cancelEdit">取消</el-button>
            <el-button type="primary" size="small" :loading="loading" @click="saveProfile">
              保存
            </el-button>
          </div>
        </div>
      </template>

      <el-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-width="100px"
        class="profile-form"
      >
        <!-- Avatar -->
        <div class="avatar-section">
          <el-avatar :size="80" :src="user?.avatar">
            <el-icon :size="40"><User /></el-icon>
          </el-avatar>
          <div class="avatar-info">
            <div class="user-name">{{ user?.realName || user?.name }}</div>
            <div class="user-role">{{ roleLabel }}</div>
          </div>
        </div>

        <el-divider />

        <!-- Basic Info -->
        <el-form-item label="用户名">
          <el-input :value="user?.username" disabled placeholder="用户名" />
        </el-form-item>

        <el-form-item label="真实姓名" prop="realName">
          <el-input
            v-model="formData.realName"
            :disabled="!isEditing"
            placeholder="请输入真实姓名"
          />
        </el-form-item>

        <el-form-item label="所属部门">
          <el-input :value="user?.department || user?.orgName" disabled placeholder="所属部门" />
        </el-form-item>

        <el-form-item label="角色">
          <el-tag :type="roleType">{{ roleLabel }}</el-tag>
        </el-form-item>

        <el-form-item label="邮箱" prop="email">
          <el-input v-model="formData.email" :disabled="!isEditing" placeholder="请输入邮箱">
            <template #prefix>
              <el-icon><Message /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item label="手机号" prop="phone">
          <el-input v-model="formData.phone" :disabled="!isEditing" placeholder="请输入手机号">
            <template #prefix>
              <el-icon><Phone /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <el-divider />

        <!-- Account Info -->
        <el-form-item label="账户状态">
          <el-tag :type="user?.isActive ? 'success' : 'danger'">
            {{ user?.isActive ? '正常' : '已禁用' }}
          </el-tag>
        </el-form-item>

        <el-form-item label="创建时间">
          <span class="info-text">{{ formatDate(user?.createdAt) }}</span>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- Password Change Card -->
    <el-card class="password-card">
      <template #header>
        <span class="header-title">修改密码</span>
      </template>

      <el-button type="primary" plain @click="showPasswordDialog = true"> 修改密码 </el-button>
    </el-card>

    <!-- Password Change Dialog -->
    <el-dialog
      v-model="showPasswordDialog"
      title="修改密码"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="passwordFormRef"
        :model="passwordForm"
        :rules="passwordRules"
        label-width="100px"
      >
        <el-form-item label="旧密码" prop="oldPassword">
          <el-input
            v-model="passwordForm.oldPassword"
            type="password"
            show-password
            placeholder="请输入旧密码"
          />
        </el-form-item>

        <el-form-item label="新密码" prop="newPassword">
          <el-input
            v-model="passwordForm.newPassword"
            type="password"
            show-password
            placeholder="请输入新密码"
          />
        </el-form-item>

        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input
            v-model="passwordForm.confirmPassword"
            type="password"
            show-password
            placeholder="请再次输入新密码"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showPasswordDialog = false">取消</el-button>
        <el-button type="primary" :loading="passwordLoading" @click="handlePasswordChange">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, reactive, computed } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { User, Message, Phone } from '@element-plus/icons-vue'
import type { User as UserType } from '@/entities/user/model/types'
import type { UserProfileFormState, PasswordChangeFormState } from '../model/types'
import { ROLE_CONFIG, VALIDATION_RULES } from '../model/constants'
import { userApi } from '../api'
import { logger } from '@/shared/lib/utils/logger'

// Props
interface Props {
  user: UserType | null
}

const props = defineProps<Props>()

// Emits
interface Emits {
  (e: 'update', data: Partial<UserType>): void
  (e: 'password-changed'): void
}

const emit = defineEmits<Emits>()

// Form refs
const formRef = ref<FormInstance>()
const passwordFormRef = ref<FormInstance>()

// State
const isEditing = ref(false)
const loading = ref(false)
const passwordLoading = ref(false)
const showPasswordDialog = ref(false)

// Form data
const formData = reactive<UserProfileFormState>({
  realName: '',
  email: '',
  phone: '',
  loading: false,
  errors: {}
})

const passwordForm = reactive<PasswordChangeFormState>({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

// Computed
const roleLabel = computed(() => {
  if (!props.user?.role) {
    return '未知'
  }
  return ROLE_CONFIG[props.user.role]?.label || props.user.role
})

const roleType = computed(() => {
  if (!props.user?.role) {
    return 'info'
  }
  const config = ROLE_CONFIG[props.user.role]
  return config ? '' : 'info'
})

// Validation rules
const rules: FormRules = {
  realName: [
    { required: true, message: '请输入真实姓名', trigger: 'blur' },
    {
      max: VALIDATION_RULES.REALNAME_MAX_LENGTH,
      message: '姓名长度不能超过50个字符',
      trigger: 'blur'
    }
  ],
  email: [{ type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' }],
  phone: [
    { pattern: VALIDATION_RULES.PHONE_PATTERN, message: '请输入有效的手机号', trigger: 'blur' }
  ]
}

const passwordRules: FormRules = {
  oldPassword: [{ required: true, message: '请输入旧密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    {
      min: VALIDATION_RULES.PASSWORD_MIN_LENGTH,
      max: VALIDATION_RULES.PASSWORD_MAX_LENGTH,
      message: `密码长度应在 ${VALIDATION_RULES.PASSWORD_MIN_LENGTH}-${VALIDATION_RULES.PASSWORD_MAX_LENGTH} 个字符之间`,
      trigger: 'blur'
    }
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== passwordForm.newPassword) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

// Methods
const formatDate = (date?: string) => {
  if (!date) {
    return '暂无'
  }
  return new Date(date).toLocaleString('zh-CN')
}

const startEdit = () => {
  if (!props.user) {
    return
  }

  formData.realName = props.user.realName || props.user.name || ''
  formData.email = props.user.email || ''
  formData.phone = props.user.phone || ''
  isEditing.value = true
}

const cancelEdit = () => {
  isEditing.value = false
  formRef.value?.resetFields()
}

const saveProfile = async () => {
  if (!formRef.value) {
    return
  }

  try {
    await formRef.value.validate()

    loading.value = true

    // Emit update event to parent
    emit('update', {
      realName: formData.realName,
      email: formData.email,
      phone: formData.phone
    })

    ElMessage.success('个人信息更新成功')
    isEditing.value = false
  } catch (error) {
    logger.error('Profile update validation failed:', error)
  } finally {
    loading.value = false
  }
}

const handlePasswordChange = async () => {
  if (!passwordFormRef.value) {
    return
  }

  try {
    await passwordFormRef.value.validate()

    passwordLoading.value = true

    // Call API to change password
    await userApi.changePassword({
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword
    })

    ElMessage.success('密码修改成功，请重新登录')

    // Reset form
    passwordForm.oldPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
    showPasswordDialog.value = false

    // Emit password changed event
    emit('password-changed')
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '密码修改失败'
    ElMessage.error(errorMessage || '密码修改失败')
  } finally {
    passwordLoading.value = false
  }
}
</script>

<style scoped>
.user-profile {
  max-width: 800px;
  margin: 0 auto;
}

.profile-card,
.password-card {
  margin-bottom: var(--spacing-xl);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-main);
}

.header-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.avatar-section {
  display: flex;
  align-items: center;
  gap: var(--spacing-xl);
  padding: var(--spacing-lg) 0;
}

.avatar-info {
  flex: 1;
}

.user-name {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: var(--spacing-xs);
}

.user-role {
  font-size: 14px;
  color: var(--text-secondary);
}

.profile-form :deep(.el-form-item__label) {
  font-weight: 500;
  color: var(--text-regular);
}

.info-text {
  color: var(--text-regular);
  font-size: 14px;
}

.profile-form :deep(.el-input.is-disabled .el-input__wrapper) {
  background-color: var(--bg-light);
}
</style>
