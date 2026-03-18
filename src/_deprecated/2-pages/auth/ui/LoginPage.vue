<template>
  <LoginView />
</template>

<script setup lang="ts">
/**
 * LoginPage - Thin Wrapper
 *
 * This page is a thin wrapper around the LoginView component.
 * All business logic and UI are handled in the features/auth module.
 *
 * Architecture: Pages Layer (Thin Wrapper Pattern)
 * - Delegates to LoginView for all functionality
 */

import { LoginView } from '@/3-features/auth'
</script>
