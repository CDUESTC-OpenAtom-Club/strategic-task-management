<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { ElAvatar } from 'element-plus'

defineOptions({
  inheritAttrs: false
})

const props = withDefaults(
  defineProps<{
    src?: string | null
    name?: string | null
    size?: number | string
  }>(),
  {
    src: '',
    name: '',
    size: 32
  }
)

const attrs = useAttrs()

const avatarPalette = [
  '#409EFF',
  '#36CFC9',
  '#5B8FF9',
  '#73D13D',
  '#9254DE',
  '#FA8C16',
  '#EB2F96',
  '#13C2C2'
]

const resolvedSrc = computed(() => {
  return typeof props.src === 'string' ? props.src.trim() : ''
})

const fallbackText = computed(() => {
  const value = String(props.name || '').trim()
  if (!value) {
    return 'U'
  }
  return value.charAt(0)
})

const fallbackStyle = computed(() => {
  if (resolvedSrc.value) {
    return undefined
  }

  const seed = String(props.name || '')
  const hash = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return {
    background: avatarPalette[hash % avatarPalette.length],
    color: '#fff'
  }
})
</script>

<template>
  <ElAvatar
    v-bind="attrs"
    :size="size"
    :src="resolvedSrc || undefined"
    :style="[fallbackStyle, attrs.style]"
  >
    <slot>
      {{ fallbackText }}
    </slot>
  </ElAvatar>
</template>
