<script setup lang="ts">
/**
 * Dashboard Page - Thin Wrapper
 *
 * This page is a thin wrapper around the DashboardView component.
 * All business logic is handled in the features/dashboard module.
 *
 * Architecture: Pages Layer (Thin Wrapper Pattern)
 * - Renders PageHeader for page title
 * - Delegates to DashboardView for all functionality
 */

import { PageHeader } from '@/shared/ui/layout'
import { DashboardView } from '@/features/dashboard'
</script>

<template>
  <div class="dashboard-page">
    <PageHeader title="数据看板" />
    <DashboardView />
  </div>
</template>

<style scoped>
.dashboard-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>
