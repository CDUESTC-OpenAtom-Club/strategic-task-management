/**
 * App Providers
 *
 * Export all application-level providers
 * Following FSD (Feature-Sliced Design) architecture
 *
 * **Validates: Requirements 3.2 - Application Providers**
 */

// Router
export { default as router } from './router'
export { startProgress, doneProgress, setProgress, incrementProgress } from './router-progress'
