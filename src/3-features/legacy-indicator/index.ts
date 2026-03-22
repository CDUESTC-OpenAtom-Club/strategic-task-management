/**
 * @deprecated Temporary compatibility layer for the retired legacy indicator module.
 * Use `@/features/indicator` instead.
 * Remove after 2026-04-17.
 */

export * from '@/features/indicator'

// Preserve the old component name while routing callers to the active view.
export { default as IndicatorDistributionView } from '@/features/indicator/ui/IndicatorDistributeView.vue'
