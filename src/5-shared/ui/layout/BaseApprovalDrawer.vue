<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title: string
    subtitle?: string
    size?: string
    loading?: boolean
    showEmpty?: boolean
    emptyDescription?: string
    emptyImageSize?: number
    customClass?: string
    contentPadding?: string
    minContentHeight?: string
  }>(),
  {
    subtitle: '',
    size: '640px',
    loading: false,
    showEmpty: false,
    emptyDescription: '暂无数据',
    emptyImageSize: 120,
    customClass: '',
    contentPadding: '16px',
    minContentHeight: '360px'
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
}>()

const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
})

const handleClose = () => {
  visible.value = false
  emit('close')
}
</script>

<template>
  <el-drawer
    v-model="visible"
    :title="title"
    direction="rtl"
    :size="size"
    :before-close="handleClose"
    :class="customClass"
  >
    <template #header>
      <slot name="header">
        <div class="drawer-header">
          <div class="header-title">{{ title }}</div>
          <div v-if="subtitle" class="header-subtitle">{{ subtitle }}</div>
        </div>
      </slot>
    </template>

    <div
      v-loading="loading"
      class="drawer-content"
      :style="{ padding: contentPadding, minHeight: minContentHeight }"
    >
      <el-empty
        v-if="!loading && showEmpty"
        :description="emptyDescription"
        :image-size="emptyImageSize"
      />
      <slot v-else />
    </div>

    <template #footer>
      <slot name="footer">
        <div class="drawer-footer">
          <el-button @click="handleClose">关闭</el-button>
        </div>
      </slot>
    </template>
  </el-drawer>
</template>

<style scoped>
.drawer-header {
  width: 100%;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.header-subtitle {
  margin-top: 8px;
  font-size: 13px;
  color: #64748b;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
}
</style>
