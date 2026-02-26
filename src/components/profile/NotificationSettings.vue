<template>
  <div class="notification-settings">
    <el-form
      ref="formRef"
      :model="form"
      label-width="200px"
      class="settings-form"
    >
      <div class="settings-section">
        <h3 class="section-title">邮件通知</h3>

        <el-form-item label="接收邮件通知">
          <el-switch
            v-model="form.emailNotifications"
            active-text="开启"
            inactive-text="关闭"
          />
        </el-form-item>

        <el-form-item v-if="form.emailNotifications" label="邮件地址">
          <el-input
            v-model="form.emailAddress"
            placeholder="请输入接收通知的邮箱地址"
            style="max-width: 300px;"
          />
        </el-form-item>
      </div>

      <el-divider />

      <div class="settings-section">
        <h3 class="section-title">系统通知类型</h3>

        <el-form-item label="预警通知">
          <el-switch
            v-model="form.alertNotifications"
            active-text="开启"
            inactive-text="关闭"
          />
          <div class="setting-description">
            当指标出现预警时发送通知
          </div>
        </el-form-item>

        <el-form-item label="审批通知">
          <el-switch
            v-model="form.approvalNotifications"
            active-text="开启"
            inactive-text="关闭"
          />
          <div class="setting-description">
            当有新的审批任务时发送通知
          </div>
        </el-form-item>

        <el-form-item label="系统通知">
          <el-switch
            v-model="form.systemNotifications"
            active-text="开启"
            inactive-text="关闭"
          />
          <div class="setting-description">
            系统更新、维护等重要通知
          </div>
        </el-form-item>
      </div>

      <el-divider />

      <div class="settings-section">
        <h3 class="section-title">通知频率</h3>

        <el-form-item label="预警通知频率">
          <el-radio-group v-model="form.alertFrequency">
            <el-radio value="immediate">立即</el-radio>
            <el-radio value="hourly">每小时</el-radio>
            <el-radio value="daily">每天</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="审批通知频率">
          <el-radio-group v-model="form.approvalFrequency">
            <el-radio value="immediate">立即</el-radio>
            <el-radio value="hourly">每小时</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="免打扰时间">
          <el-time-picker
            v-model="form.doNotDisturbStart"
            placeholder="开始时间"
            format="HH:mm"
            value-format="HH:mm"
            style="margin-right: 8px;"
          />
          <span>至</span>
          <el-time-picker
            v-model="form.doNotDisturbEnd"
            placeholder="结束时间"
            format="HH:mm"
            value-format="HH:mm"
            style="margin-left: 8px;"
          />
        </el-form-item>
      </div>

      <el-form-item>
        <el-button type="primary" @click="handleSubmit" :loading="loading">
          保存设置
        </el-button>
        <el-button @click="handleReset">
          重置
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const formRef = ref()
const loading = ref(false)
const authStore = useAuthStore()

const form = reactive({
  emailNotifications: true,
  emailAddress: '',
  alertNotifications: true,
  approvalNotifications: true,
  systemNotifications: true,
  alertFrequency: 'immediate',
  approvalFrequency: 'immediate',
  doNotDisturbStart: '22:00',
  doNotDisturbEnd: '08:00'
})

const handleSubmit = async () => {
  loading.value = true

  try {
    // TODO: Call API to save notification settings
    const settings = {
      userId: authStore.user?.id,
      ...form
    }

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))

    ElMessage.success('通知设置保存成功')
  } catch (error) {
    console.error('Failed to save notification settings:', error)
    ElMessage.error('保存失败，请重试')
  } finally {
    loading.value = false
  }
}

const handleReset = () => {
  // Reset to default values
  Object.assign(form, {
    emailNotifications: true,
    emailAddress: '',
    alertNotifications: true,
    approvalNotifications: true,
    systemNotifications: true,
    alertFrequency: 'immediate',
    approvalFrequency: 'immediate',
    doNotDisturbStart: '22:00',
    doNotDisturbEnd: '08:00'
  })
}

const loadSettings = () => {
  // TODO: Load user's notification settings from API
  // For now, use default values
  if (authStore.user?.email) {
    form.emailAddress = authStore.user.email
  }
}

onMounted(() => {
  loadSettings()
})
</script>

<style scoped>
.notification-settings {
  max-width: 800px;
  margin: 0 auto;
}

.settings-form {
  background: var(--bg-white);
  padding: 24px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.settings-section {
  margin-bottom: 24px;
}

.section-title {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-main);
}

.setting-description {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.el-divider {
  margin: 24px 0;
}
</style>