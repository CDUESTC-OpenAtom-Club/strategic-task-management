<script setup lang="ts">
/**
 * Indicator List Page - Thin Wrapper
 *
 * This page is a thin wrapper around the IndicatorListView component.
 * All business logic is handled in the features/strategic-indicator module.
 *
 * Architecture: Pages Layer (Thin Wrapper Pattern)
 * - Renders PageHeader for page title
 * - Delegates to IndicatorListView for all functionality
 */

import { PageHeader } from '@/5-shared/ui/layout'
import { IndicatorListView } from '@/3-features/indicator'
</script>

<template>
  <div class="indicator-list-page">
    <PageHeader title="战略指标管理" />
    <IndicatorListView />
  </div>
</template>

<style scoped>
.indicator-list-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>
