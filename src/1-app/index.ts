/**
 * Application Layer
 *
 * Main application entry point following FSD (Feature-Sliced Design)
 * This is the top-level slice that orchestrates the entire application
 *
 * **Validates: Requirements 3.1 - Application Layer**
 *
 * Layer Responsibilities:
 * - Application bootstrapping and initialization
 * - Routing configuration
 * - Global state management (Pinia stores)
 * - Application-level layout and navigation
 * - Provider registration (plugins, directives, etc.)
 *
 * Public API:
 * - app/main.ts: Application initialization
 * - app/providers/: Global providers (router, store, etc.)
 * - app/layout/: Application layout components
 * - app/config/: Application-level configuration
 */

// Export main entry point
export { app, pinia, router } from './main'

// Export providers
export * from './providers'

// Export layout
export * from './layout'

// Export config
export * from './config'
