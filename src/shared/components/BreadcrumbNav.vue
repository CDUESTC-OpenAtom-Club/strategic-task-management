<script setup lang="ts">
import { computed } from 'vue'
import type { BreadcrumbItem } from '@/types'

const props = defineProps<{
  items: BreadcrumbItem[]
}>()

const emit = defineEmits<{
  navigate: [index: number]
}>()

const isLast = (index: number) => index === props.items.length - 1

const handleClick = (index: number) => {
  if (!isLast(index)) {
    emit('navigate', index)
  }
}

const levelIcons = computed(() => ({
  organization: '🏢',
  department: '📁',
  indicator: '📊'
}))
</script>

<template>
  <div class="breadcrumb-nav">
    <el-breadcrumb separator="/">
      <el-breadcrumb-item
        v-for="(item, index) in items"
        :key="index"
        :class="{ 'is-link': !isLast(index), 'is-current': isLast(index) }"
        @click="handleClick(index)"
      >
        <span class="breadcrumb-content">
          <span class="level-icon">{{ levelIcons[item.level] }}</span>
          <span class="level-label">{{ item.label }}</span>
        </span>
      </el-breadcrumb-item>
    </el-breadcrumb>
  </div>
</template>

<style scoped>
.breadcrumb-nav {
  padding: 12px 16px;
  background: var(--bg-white);
  border-radius: 8px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.breadcrumb-content {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.level-icon {
  font-size: 14px;
}

.level-label {
  font-size: 14px;
}

.is-link {
  cursor: pointer;
}

.is-link:hover .level-label {
  color: var(--color-primary);
}

.is-current .level-label {
  font-weight: 600;
  color: var(--text-main);
}

:deep(.el-breadcrumb__item) {
  display: inline-flex;
  align-items: center;
}

:deep(.el-breadcrumb__inner) {
  display: inline-flex;
  align-items: center;
}
</style>
