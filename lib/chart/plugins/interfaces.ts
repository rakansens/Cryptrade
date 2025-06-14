/**
 * Pattern Renderer Plugin Interfaces
 * 
 * パターンレンダラーのプラグインアーキテクチャ用インターフェース定義
 */

import type { IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts';
import type { PatternVisualization } from '@/types/pattern';
import type { SeriesRegistry } from '../SeriesRegistry';

/**
 * レンダラープラグインの基底インターフェース
 */
export interface IRendererPlugin {
  /**
   * プラグインの名前（デバッグ用）
   */
  readonly name: string;
  
  /**
   * プラグインの初期化
   */
  initialize?(context: PluginContext): void;
  
  /**
   * パターンのレンダリング実行
   */
  render(id: string, data: PatternVisualization, extra?: unknown): Promise<void> | void;
  
  /**
   * パターンの削除
   */
  remove(id: string): Promise<void> | void;
  
  /**
   * プラグインのクリーンアップ
   */
  dispose(): Promise<void> | void;
  
  /**
   * プラグインがサポートする描画タイプを確認
   */
  supports(data: PatternVisualization): boolean;
}

/**
 * プラグイン実行コンテキスト
 */
export interface PluginContext {
  chart: IChartApi;
  mainSeries: ISeriesApi<SeriesType>;
  registry: SeriesRegistry;
  instanceId: number;
  utilities: PluginUtilities;
}

/**
 * プラグイン共通ユーティリティ
 */
export interface PluginUtilities {
  /**
   * 線の色を取得
   */
  getLineColor(type: string): string;
  
  /**
   * ラインスタイルを変換
   */
  convertLineStyle(style: string): number;
  
  /**
   * 色に透明度を追加
   */
  addOpacity(color: string, opacity: number): string;
  
  /**
   * 時間範囲を計算
   */
  calculateTimeRange(keyPoints: Array<{ time: number; value: number }>): {
    minTime: number;
    maxTime: number;
    startTime: number;
    endTime: number;
  };
  
  /**
   * IDの部分一致検索
   */
  findPatternByFuzzyMatch?(searchId: string): string | null;
}

/**
 * キーポイントレンダラープラグイン専用インターフェース
 */
export interface IKeyPointRendererPlugin extends IRendererPlugin {
  /**
   * マーカースタイル設定
   */
  setMarkerStyle?(style: MarkerStyle): void;
}

/**
 * ラインレンダラープラグイン専用インターフェース
 */
export interface ILineRendererPlugin extends IRendererPlugin {
  /**
   * ラインスタイル設定
   */
  setLineStyle?(style: LineStyle): void;
  
  /**
   * ライン色の一括変更
   */
  updateLineColors?(patternId: string, colors: Record<string, string>): void;
}

/**
 * エリアレンダラープラグイン専用インターフェース
 */
export interface IAreaRendererPlugin extends IRendererPlugin {
  /**
   * エリアスタイル設定
   */
  setAreaStyle?(style: AreaStyle): void;
}

/**
 * メトリックレンダラープラグイン専用インターフェース
 */
export interface IMetricRendererPlugin extends IRendererPlugin {
  /**
   * メトリック表示スタイル設定
   */
  setMetricStyle?(style: MetricStyle): void;
  
  /**
   * メトリック値の更新
   */
  updateMetric?(patternId: string, metric: string, value: number): void;
}

/**
 * マーカースタイル設定
 */
export interface MarkerStyle {
  shape?: 'circle' | 'square' | 'arrowUp' | 'arrowDown';
  color?: string;
  size?: number;
  text?: {
    color?: string;
    fontSize?: number;
  };
}

/**
 * ラインスタイル設定
 */
export interface LineStyle {
  color?: string;
  width?: number;
  style?: 'solid' | 'dashed' | 'dotted';
  opacity?: number;
}

/**
 * エリアスタイル設定
 */
export interface AreaStyle {
  fillColor?: string;
  opacity?: number;
  borderColor?: string;
  borderWidth?: number;
}

/**
 * メトリックスタイル設定
 */
export interface MetricStyle {
  showLabels?: boolean;
  labelPosition?: 'left' | 'right';
  colors?: {
    target?: string;
    stopLoss?: string;
    breakout?: string;
  };
  lineStyles?: {
    target?: 'solid' | 'dashed' | 'dotted';
    stopLoss?: 'solid' | 'dashed' | 'dotted';
    breakout?: 'solid' | 'dashed' | 'dotted';
  };
}

/**
 * プラグインレジストリ
 */
export interface IPluginRegistry {
  /**
   * プラグインの登録
   */
  register<T extends IRendererPlugin>(plugin: T): void;
  
  /**
   * プラグインの取得
   */
  get<T extends IRendererPlugin>(name: string): T | undefined;
  
  /**
   * 指定したデータをサポートするプラグインを取得
   */
  getSupporting(data: PatternVisualization): IRendererPlugin[];
  
  /**
   * すべてのプラグインを取得
   */
  getAll(): IRendererPlugin[];
  
  /**
   * プラグインの登録解除
   */
  unregister(name: string): boolean;
  
  /**
   * すべてのプラグインのクリーンアップ
   */
  dispose(): Promise<void>;
}

/**
 * レンダリング結果
 */
export interface RenderResult {
  success: boolean;
  plugin: string;
  patternId: string;
  seriesCreated: number;
  errors?: string[];
  warnings?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * プラグインエラー
 */
export class PluginError extends Error {
  constructor(
    public readonly pluginName: string,
    public readonly operation: string,
    message: string,
    public readonly cause?: Error
  ) {
    super(`[${pluginName}] ${operation}: ${message}`);
    this.name = 'PluginError';
  }
}

/**
 * プラグイン設定オプション
 */
export interface PluginOptions {
  /**
   * プラグインの有効/無効
   */
  enabled?: boolean;
  
  /**
   * プラグイン固有の設定
   */
  config?: Record<string, unknown>;
  
  /**
   * デバッグモード
   */
  debug?: boolean;
  
  /**
   * エラー処理方針
   */
  errorHandling?: 'strict' | 'lenient' | 'silent';
}

/**
 * プラグインメタデータ
 */
export interface PluginMetadata {
  name: string;
  version: string;
  description?: string;
  author?: string;
  dependencies?: string[];
  supports: string[]; // サポートする描画タイプ
  options?: PluginOptions;
}