/**
 * Pattern Renderer Plugins Export Index
 * 
 * プラグインアーキテクチャの全体的なエクスポート
 */

// Core classes
export { PatternRendererCore } from '../PatternRendererCore';
export { SeriesRegistry, GlobalStateManager } from '../SeriesRegistry';

// Plugin interfaces
export type {
  IRendererPlugin,
  IKeyPointRendererPlugin,
  ILineRendererPlugin,
  IAreaRendererPlugin,
  IMetricRendererPlugin,
  IPluginRegistry,
  PluginContext,
  PluginUtilities,
  PluginOptions,
  PluginMetadata,
  MarkerStyle,
  LineStyle,
  AreaStyle,
  MetricStyle,
  RenderResult,
} from './interfaces';

export { PluginError } from './interfaces';

// Plugin implementations
export { KeyPointRenderer } from './KeyPointRenderer';
export { LineRenderer } from './LineRenderer';
export { MetricRenderer } from './MetricRenderer';

// Plugin registry
export { PluginRegistry } from './PluginRegistry';

// Utilities
export { 
  PluginUtilitiesImpl,
  ColorUtils,
  TimeUtils,
  NumberUtils,
  ValidationUtils,
} from './utils';

// Backward compatibility - 既存のコードとの互換性のため
export { PatternRenderer } from '../pattern-renderer';

/**
 * Factory function for creating PatternRendererCore
 */
export function createPatternRenderer(chart: unknown, mainSeries: unknown) {
  return new PatternRendererCore(chart, mainSeries);
}

/**
 * Factory function for backward compatibility
 */
export function createLegacyPatternRenderer(chart: unknown, mainSeries: unknown) {
  return new PatternRenderer(chart, mainSeries);
}

/**
 * Migration helper - gradually replace old with new
 */
export function createPatternRendererWithMigration(
  chart: unknown, 
  mainSeries: unknown, 
  useNewCore: boolean = false
) {
  if (useNewCore) {
    return new PatternRendererCore(chart, mainSeries);
  } else {
    return new PatternRenderer(chart, mainSeries);
  }
}