<script setup lang="ts">
/**
 * Indicator Edit Page - Thin Wrapper
 *
 * This page is a thin wrapper around the IndicatorEditView component.
 * All business logic is handled in the features/strategic-indicator module.
 *
 * Architecture: Pages Layer (Thin Wrapper Pattern)
 * - Renders PageHeader for page title
 * - Delegates to IndicatorEditView for all functionality
 */

import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { PageHeader } from '@/shared/ui/layout'
import { IndicatorEditView } from '@/features/indicator'

const route = useRoute()
const pageTitle = computed(() => (route.params.id ? '编辑指标' : '新建指标'))
</script>

<template>
  <div class="indicator-edit-page">
    <PageHeader :title="pageTitle" :show-back="true" />
    <IndicatorEditView />
  </div>
</template>

<style scoped>
.indicator-edit-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>
