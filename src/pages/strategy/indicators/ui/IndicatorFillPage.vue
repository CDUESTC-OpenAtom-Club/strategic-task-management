<script setup lang="ts">
/**
 * Indicator Fill Page - Thin Wrapper
 *
 * This page is a thin wrapper around the IndicatorFillView component.
 * All business logic is handled in the features/strategic-indicator module.
 *
 * Architecture: Pages Layer (Thin Wrapper Pattern)
 * - Renders PageHeader for page title
 * - Delegates to IndicatorFillView for all functionality
 */

import { PageHeader } from '@/shared/ui/layout'
import { IndicatorFillView } from '@/features/indicator'
</script>

<template>
  <div class="indicator-fill-page">
    <PageHeader title="指标填报" :show-back="true" />
    <IndicatorFillView />
  </div>
</template>

<style scoped>
.indicator-fill-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>
