export function resolveIndicatorYear(
  indicator: { year?: number | null },
  fallbackYear: number
): number {
  return typeof indicator.year === 'number' ? indicator.year : fallbackYear
}
