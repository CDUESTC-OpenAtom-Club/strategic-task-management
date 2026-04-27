/**
 * 兼容旧的 fixtures 导出路径。
 * 实际指标模拟数据统一复用 mocks/fixtures 中的实现，避免维护两份副本。
 */

export {
  indicators2023,
  indicators2024,
  indicators2025,
  indicators2026,
  allHistoricalIndicators,
  allIndicators,
  generateQuarterlyMilestones,
  generateHistoricalMilestones
} from '../../mocks/fixtures/indicators'
