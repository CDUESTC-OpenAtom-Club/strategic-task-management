<script setup lang="ts">
/**
 * Indicator Detail Page - Thin Wrapper
 *
 * This page is a thin wrapper around the IndicatorDetailView component.
 * All business logic is handled in the features/strategic-indicator module.
 *
 * Architecture: Pages Layer (Thin Wrapper Pattern)
 * - Renders PageHeader for page title
 * - Delegates to IndicatorDetailView for all functionality
 */

import { PageHeader } from '@/5-shared/ui/layout'
import { IndicatorDetailView } from '@/3-features/indicator'
</script>

<template>
  <div class="indicator-detail-page">
    <PageHeader title="指标详情" :show-back="true" />
    <IndicatorDetailView />
  </div>
</template>

<style scoped>
.indicator-detail-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>
