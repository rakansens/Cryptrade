/**
 * Pattern Renderer Plugins Export Index
 * 
 * プラグインアーキテクチャの全体的なエクスポート
 */

// Core classes
import { PatternRendererCore } from '../PatternRendererCore';
import { PatternRenderer } from '../pattern-renderer';
import type { IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts';
export { PatternRendererCore };
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
export { PatternRenderer };

/**
 * Factory function for creating PatternRendererCore
 */
export function createPatternRenderer(chart: IChartApi, mainSeries: ISeriesApi<SeriesType>) {
  return new PatternRendererCore(chart, mainSeries);
}

/**
 * Factory function for backward compatibility
 */
export function createLegacyPatternRenderer(chart: IChartApi, mainSeries: ISeriesApi<SeriesType>) {
  return new PatternRenderer(chart, mainSeries);
}

/**
 * Migration helper - gradually replace old with new
 */
export function createPatternRendererWithMigration(
  chart: IChartApi, 
  mainSeries: ISeriesApi<SeriesType>, 
  useNewCore: boolean = false
) {
  if (useNewCore) {
    return new PatternRendererCore(chart, mainSeries);
  } else {
    return new PatternRenderer(chart, mainSeries);
  }
}