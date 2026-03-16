<script setup lang="ts">
/**
 * Indicator Distribute Page - Thin Wrapper
 *
 * This page is a thin wrapper around the IndicatorDistributeView component.
 * All business logic is handled in the features/strategic-indicator module.
 *
 * Architecture: Pages Layer (Thin Wrapper Pattern)
 * - Renders PageHeader for page title
 * - Delegates to IndicatorDistributeView for all functionality
 */

import { PageHeader } from '@/shared/ui/layout'
import { IndicatorDistributeView } from '@/features/indicator'
</script>

<template>
  <div class="indicator-distribute-page">
    <PageHeader title="下发指标" :show-back="true" />
    <IndicatorDistributeView />
  </div>
</template>

<style scoped>
.indicator-distribute-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>
