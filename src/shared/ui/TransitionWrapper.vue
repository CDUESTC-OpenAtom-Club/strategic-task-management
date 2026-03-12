<!--
  通用过渡动画组件

  封装常用的过渡效果，提供统一的动画体验
-->
<template>
  <transition :name="transitionName" :mode="mode" :appear="appear" @before-enter="handleBeforeEnter" @enter="handleEnter" @after-enter="handleAfterEnter" @before-leave="handleBeforeLeave" @leave="handleLeave" @after-leave="handleAfterLeave">
    <slot></slot>
  </transition>
</template>

<script setup lang="ts">
interface Props {
  /** 过渡动画类型 */
  type?: 'fade' | 'slide' | 'zoom' | 'collapse' | 'slide-fade' | 'bounce' | 'custom'
  /** 过渡模式 */
  mode?: 'in-out' | 'out-in' | 'default'
  /** 是否在初始渲染时应用过渡 */
  appear?: boolean
  /** 自定义过渡名称（当 type 为 custom 时使用） */
  customName?: string
  /** 方向（用于 slide 类型） */
  direction?: 'up' | 'down' | 'left' | 'right'
}

const props = withDefaults(defineProps<Props>(), {
  type: 'fade',
  mode: 'default',
  appear: false,
  customName: '',
  direction: 'up'
})

const emit = defineEmits<{
  beforeEnter: []
  enter: []
  afterEnter: []
  beforeLeave: []
  leave: []
  afterLeave: []
}>()

/** 计算过渡名称 */
const transitionName = computed(() => {
  if (props.type === 'custom') {
    return props.customName
  }

  const names: Record<string, string> = {
    fade: 'el-fade',
    zoom: 'el-zoom-in',
    collapse: 'el-collapse',
    'slide-fade': 'slide-fade',
    bounce: 'bounce'
  }

  if (props.type === 'slide') {
    return `slide-${props.direction}`
  }

  return names[props.type] || 'el-fade'
})

function handleBeforeEnter() {
  emit('beforeEnter')
}

function handleEnter() {
  emit('enter')
}

function handleAfterEnter() {
  emit('afterEnter')
}

function handleBeforeLeave() {
  emit('beforeLeave')
}

function handleLeave() {
  emit('leave')
}

function handleAfterLeave() {
  emit('afterLeave')
}
</script>

<script lang="ts">
import { computed } from 'vue'
export default {
  name: 'TransitionWrapper'
}
</script>

<style scoped>
/* ============================================
   Slide Fade 过渡效果
   ============================================ */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-fade-enter-from {
  transform: translateY(10px);
  opacity: 0;
}

.slide-fade-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}

/* ============================================
   Slide 过渡效果
   ============================================ */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(20px);
  opacity: 0;
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(-20px);
  opacity: 0;
}

.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-left-enter-from,
.slide-left-leave-to {
  transform: translateX(20px);
  opacity: 0;
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(-20px);
  opacity: 0;
}

/* ============================================
   Bounce 过渡效果
   ============================================ */
.bounce-enter-active {
  animation: bounce-in 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.bounce-leave-active {
  animation: bounce-out 0.3s ease-in;
}

@keyframes bounce-in {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes bounce-out {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  100% {
    transform: scale(0);
    opacity: 0;
  }
}

/* ============================================
   列表项过渡效果 (用于 v-for 列表)
   ============================================ */
.list-enter-active,
.list-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

.list-leave-active {
  position: absolute;
  width: 100%;
}

/* ============================================
   Flip Card 过渡效果
   ============================================ */
.flip-enter-active,
.flip-leave-active {
  transition: all 0.6s;
  transform-style: preserve-3d;
}

.flip-enter-from,
.flip-leave-to {
  transform: rotateY(90deg);
  opacity: 0;
}
</style>
